import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private minioClient!: Minio.Client;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = this.configService.get<number>('MINIO_PORT', 9000);
    const useSSL = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin_dev_password');
    
    this.bucketName = this.configService.get<string>('MINIO_BUCKET', 'saleassist');

    try {
      this.minioClient = new Minio.Client({
        endPoint: endpoint,
        port: Number(port),
        useSSL,
        accessKey,
        secretKey,
      });
    } catch (error: any) {
      this.logger.error(`Failed to initialize MinIO Client: ${error.message}`);
    }
  }

  async onModuleInit() {
    try {
      // Check if bucket exists, create if not
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName);
        this.logger.log(`Created S3 bucket: ${this.bucketName}`);

        // Set policy to allow public read access for video assets streaming
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'PublicRead',
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };
        await this.minioClient.setBucketPolicy(this.bucketName, JSON.stringify(policy));
        this.logger.log(`Set public read policy on bucket: ${this.bucketName}`);
      } else {
        this.logger.log(`Verified S3 bucket exists: ${this.bucketName}`);
      }
    } catch (error: any) {
      this.logger.error(`MinIO bucket init check failed: ${error.message}`);
    }
  }

  /**
   * Generates a presigned upload URL for direct browser S3 uploads.
   */
  async getPresignedUploadUrl(objectName: string, expirySeconds = 3600): Promise<string> {
    if (!this.minioClient) {
      throw new Error('Storage service is not configured. MinIO client failed to initialize.');
    }
    return this.minioClient.presignedPutObject(this.bucketName, objectName, expirySeconds);
  }

  /**
   * Generates a time-limited presigned GET URL for reading/streaming an object.
   * Default 6 hours — enough for a full viewing session.
   */
  async getPresignedGetUrl(objectName: string, expirySeconds = 21600): Promise<string> {
    if (!this.minioClient) {
      throw new Error('Storage service is not configured. MinIO client failed to initialize.');
    }
    return this.minioClient.presignedGetObject(this.bucketName, objectName, expirySeconds);
  }

  /**
   * Extracts the objectName from a legacy full MinIO URL.
   * Returns null if:
   * - The URL is not a recognized MinIO URL
   * - The URL is already a stream URL (to prevent double-processing / path doubling)
   */
  extractObjectName(storedUrl: string): string | null {
    try {
      // If the URL already points to our stream endpoint, do NOT re-process it.
      // Doing so would treat '/api' as the bucket name and produce a corrupted
      // doubled path like: /api/v1/storage/stream/v1/storage/stream/tenantId/file.mp4
      if (storedUrl.includes('/api/v1/storage/stream/')) {
        return null;
      }
      const url = new URL(storedUrl);
      const parts = url.pathname.split('/').filter(Boolean);
      // Path format: /bucketName/objectName... -> skip bucket, join rest
      if (parts.length >= 2) {
        return parts.slice(1).join('/');
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Returns the local API stream URL for a given objectName.
   * The stream endpoint redirects to a fresh presigned S3 GET URL.
   */
  getStreamUrl(objectName: string): string {
    let apiUrl = this.configService.get<string>('API_URL', 'http://localhost:4000');
    if (apiUrl.endsWith('/')) {
      apiUrl = apiUrl.slice(0, -1);
    }
    return `${apiUrl}/api/v1/storage/stream/${objectName}`;
  }

  async listObjects(prefix: string): Promise<Array<{ name: string; size: number; lastModified: Date; etag?: string; contentType?: string }>> {
    if (!this.minioClient) {
      throw new Error('Storage service is not configured. MinIO client failed to initialize.');
    }

    const objects: Array<{ name: string; size: number; lastModified: Date; etag?: string }> = [];
    const stream = this.minioClient.listObjects(this.bucketName, prefix, true);

    stream.on('data', (item: any) => {
      objects.push({
        name: item.name,
        size: item.size || 0,
        lastModified: item.lastModified instanceof Date ? item.lastModified : new Date(),
        etag: item.etag,
      });
    });

    await new Promise<void>((resolve, reject) => {
      stream.on('end', () => resolve());
      stream.on('error', (error: Error) => reject(error));
    });

    return Promise.all(
      objects.map(async (item) => {
        try {
          const stat = await this.minioClient.statObject(this.bucketName, item.name);
          const statAny = stat as any;
          const contentType = statAny.contentType || stat.metaData?.['content-type'] || stat.metaData?.['Content-Type'];
          return { ...item, contentType };
        } catch (error: any) {
          this.logger.warn(`Failed to stat MinIO object ${item.name}: ${error.message}`);
          return item;
        }
      }),
    );
  }

  /**
   * Deletes a file from the S3 bucket.
   */
  async deleteFile(objectName: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucketName, objectName);
      this.logger.log(`Object ${objectName} deleted successfully from ${this.bucketName}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete object ${objectName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Streams an object from MinIO. Supports partial content (HTTP range requests).
   */
  async streamObject(
    objectName: string,
    rangeStart?: number,
    rangeEnd?: number,
  ): Promise<{ stream: any; size: number; contentType: string }> {
    if (!this.minioClient) {
      throw new Error('Storage service is not configured.');
    }

    const stat = await this.minioClient.statObject(this.bucketName, objectName);
    const statAny = stat as any;
    const contentType =
      statAny.contentType ||
      stat.metaData?.['content-type'] ||
      stat.metaData?.['Content-Type'] ||
      'application/octet-stream';
    const size = stat.size;

    if (rangeStart !== undefined) {
      const end = rangeEnd !== undefined ? rangeEnd : size - 1;
      const stream = await this.minioClient.getPartialObject(
        this.bucketName,
        objectName,
        rangeStart,
        end - rangeStart + 1,
      );
      return { stream, size, contentType };
    }

    const stream = await this.minioClient.getObject(this.bucketName, objectName);
    return { stream, size, contentType };
  }

  /**
   * Helper to resolve object URL (useful when MinIO runs behind CDN or has specific access URL).
   */
  getPublicUrl(objectName: string): string {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = this.configService.get<number>('MINIO_PORT', 9000);
    const useSSL = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const protocol = useSSL ? 'https' : 'http';
    const defaultPort = useSSL ? 443 : 80;
    // Don't append default ports to avoid browser URL issues (e.g. https://host:443/...)
    const portSuffix = Number(port) === defaultPort ? '' : `:${port}`;
    return `${protocol}://${endpoint}${portSuffix}/${this.bucketName}/${objectName}`;
  }
}
