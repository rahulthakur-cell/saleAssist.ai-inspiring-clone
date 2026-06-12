import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly livekitUrl: string;
  private roomService!: RoomServiceClient;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('LIVEKIT_API_KEY', 'devkey');
    this.apiSecret = this.configService.get<string>(
      'LIVEKIT_API_SECRET',
      'secret_dev_key_change_in_production',
    );
    this.livekitUrl = this.configService.get<string>('LIVEKIT_URL', 'http://localhost:7880');

    try {
      this.roomService = new RoomServiceClient(
        this.getRoomServiceUrl(this.livekitUrl),
        this.apiKey,
        this.apiSecret,
      );
    } catch (error: any) {
      this.logger.error(`Failed to initialize LiveKit RoomServiceClient: ${error.message}`);
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
}
