import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient, EgressClient } from 'livekit-server-sdk';

export interface RoomRecordingResult {
  egressId: string;
  success: boolean;
  error?: string;
}

@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly livekitUrl: string;
  private roomService!: RoomServiceClient;
  private egressService!: EgressClient | null;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('LIVEKIT_API_KEY', 'devkey');
    this.apiSecret = this.configService.get<string>
      ('LIVEKIT_API_SECRET',
      'secret_dev_key_change_in_production',
    );
    this.livekitUrl = this.configService.get<string>('LIVEKIT_URL', 'http://localhost:7880');

    this.egressService = null;
    try {
      this.roomService = new RoomServiceClient(
        this.getRoomServiceUrl(this.livekitUrl),
        this.apiKey,
        this.apiSecret,
      );
      
      // Configure egress with S3 storage if available
      const minioEndpoint = this.configService.get<string>('MINIO_ENDPOINT');
      const minioPort = this.configService.get<string>('MINIO_PORT', '9000');
      const minioAccessKey = this.configService.get<string>('MINIO_ACCESS_KEY');
      const minioSecretKey = this.configService.get<string>('MINIO_SECRET_KEY');
      const minioBucket = this.configService.get<string>('MINIO_BUCKET', 'saleassist');
      const minioUseSSL = this.configService.get<boolean>('MINIO_USE_SSL', false);
      
      this.egressService = new EgressClient(
        this.getRoomServiceUrl(this.livekitUrl),
        this.apiKey,
        this.apiSecret,
      );
      
      this.logger.log('LiveKit services initialized successfully');
    } catch (error: any) {
      this.logger.error(`Failed to initialize LiveKit services: ${error.message}`);
      // Don't throw - allow the app to continue without recording
    }
  }

  /**
   * Generates a LiveKit Access Token for a participant.
   */
  async generateToken(
    roomName: string,
    participantIdentity: string,
    participantName: string,
    options: { isHost: boolean; canPublish: boolean; canSubscribe: boolean },
  ): Promise<string> {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: participantIdentity,
      name: participantName,
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      roomCreate: true, // Allow guests/viewers to initialize the empty room so they can wait
      canPublish: options.canPublish,
      canSubscribe: options.canSubscribe,
      canPublishData: true,
    });

return token.toJwt();
  }

  /**
   * Deletes/Ends a LiveKit room.
   */
  async endRoom(roomName: string): Promise<void> {
    try {
      await this.roomService.deleteRoom(roomName);
      this.logger.log(`Room ${roomName} ended successfully on LiveKit server`);
    } catch (error: any) {
      // Room might not exist or already be closed
      this.logger.warn(`Could not delete room ${roomName}: ${error.message}`);
    }
  }

  private getRoomServiceUrl(url: string): string {
    if (url.startsWith('wss://')) return url.replace(/^wss:\/\//, 'https://');
    if (url.startsWith('ws://')) return url.replace(/^ws:\/\//, 'http://');
    return url;
  }

  /**
   * Start room egress recording (records all participants' video and audio).
   */
  async startRoomRecording(roomName: string): Promise<RoomRecordingResult> {
    if (!this.egressService) {
      return { egressId: '', success: false, error: 'Egress service not configured on server' };
    }

    try {
      // Configure S3 output if MinIO is available
      const minioEndpoint = this.configService.get<string>('MINIO_ENDPOINT');
      const minioPort = this.configService.get<string>('MINIO_PORT', '9000');
      const minioAccessKey = this.configService.get<string>('MINIO_ACCESS_KEY');
      const minioSecretKey = this.configService.get<string>('MINIO_SECRET_KEY');
      const minioBucket = this.configService.get<string>('MINIO_BUCKET', 'saleassist');

      let output: any;
      if (minioEndpoint && minioAccessKey && minioSecretKey) {
        // Configure S3-compatible storage (MinIO)
        const s3Endpoint = `http://${minioEndpoint}:${minioPort}`;
        output = {
          s3: {
            bucket: minioBucket,
            region: 'us-east-1',
            accessKey: minioAccessKey,
            secretKey: minioSecretKey,
            endpoint: s3Endpoint,
            forcePathStyle: true,
          },
        };
      } else {
        // Fallback to local filepath (works with LiveKit dev server)
        output = {
          filepath: `recordings/${roomName}-${Date.now()}.mp4`,
        };
      }

      const egress = await this.egressService.startRoomCompositeEgress(
        roomName,
        output,
      );
      this.logger.log(`Recording started for room ${roomName}, egressId: ${egress.egressId}`);
      return { egressId: egress.egressId, success: true };
    } catch (error: any) {
      this.logger.error(`Failed to start recording for room ${roomName}: ${error.message}`);
      return { egressId: '', success: false, error: error.message };
    }
  }

  /**
   * Stop room egress recording.
   */
  async stopRoomRecording(egressId: string): Promise<void> {
    if (!this.egressService) {
      this.logger.warn('Egress service not available, cannot stop recording');
      return;
    }

    try {
      await this.egressService.stopEgress(egressId);
      this.logger.log(`Recording stopped, egressId: ${egressId}`);
    } catch (error: any) {
      this.logger.error(`Failed to stop recording ${egressId}: ${error.message}`);
      throw new Error(`Failed to stop recording: ${error.message}`);
    }
  }

  /**
   * List active recordings for a room.
   */
  async listRecordings(roomName: string): Promise<any[]> {
    if (!this.egressService) {
      throw new Error('Egress service not initialized');
    }

    try {
      return await this.egressService.listEgress({ roomName, active: true });
    } catch (error: any) {
      this.logger.error(`Failed to list recordings for room ${roomName}: ${error.message}`);
      return [];
    }
  }
}
