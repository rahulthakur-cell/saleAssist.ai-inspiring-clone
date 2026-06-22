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
   * Helper to resolve object URL (useful when MinIO runs behind CDN or has specific access URL).
   */
  getPublicUrl(objectName: string): string {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = this.configService.get<number>('MINIO_PORT', 9000);
    const useSSL = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const protocol = useSSL ? 'https' : 'http';
    return `${protocol}://${endpoint}:${port}/${this.bucketName}/${objectName}`;
  }
}
