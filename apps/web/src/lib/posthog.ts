const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'http://localhost:8000';
const POSTHOG_API_KEY = process.env.NEXT_PUBLIC_POSTHOG_API_KEY || 'phc_dev_key';

/**
   * Captures visitor actions directly to the PostHog capture API.
   */
export const posthogCapture = async (
  distinctId: string,
  eventName: string,
  properties: Record<string, any> = {},
): Promise<void> => {
  if (!POSTHOG_API_KEY) return;

  try {
    const url = `${POSTHOG_HOST}/capture/`;
    const payload = {
      api_key: POSTHOG_API_KEY,
      event: eventName,
      properties: {
        distinct_id: distinctId,
        $lib: 'web-fetch',
        ...properties,
      },
    };

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      mode: 'cors',
    });
  } catch (error) {
    console.warn('PostHog frontend capture bypassed:', error);
  }
};
