import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PosthogService {
  private readonly logger = new Logger(PosthogService.name);
  private readonly apiKey: string;
  private readonly host: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('POSTHOG_API_KEY', 'phc_dev_key');
    this.host = this.configService.get<string>('POSTHOG_HOST', 'http://localhost:8000');
  }

  /**
   * Dispatches an event directly to the PostHog capture API.
   */
  async capture(
    distinctId: string,
    eventName: string,
    properties: Record<string, any> = {},
  ): Promise<void> {
    if (!this.apiKey) return;

    try {
      const url = `${this.host}/capture/`;
      const body = {
        api_key: this.apiKey,
        event: eventName,
        properties: {
          distinct_id: distinctId,
          $lib: 'node-fetch',
          ...properties,
        },
      };

      const response: any = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        this.logger.warn(`PostHog capture returned status ${response.status}`);
      }
    } catch (error: any) {
      this.logger.warn(`Failed to send event to PostHog: ${error.message}`);
    }
  }
}
