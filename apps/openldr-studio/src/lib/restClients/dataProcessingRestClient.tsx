// const ENV = process.env;
const ENV = import.meta.env;
const IsDev = ENV.MODE === "development";

export async function manualDataEntry(
  body: any,
  facilityId: string,
  userId: string,
  token: string,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${
        import.meta.env.VITE_PROCESSOR_BASE_URL
      }/api/v1/processor/manual-data-entry`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-user-id": userId,
          "x-facility-id": facilityId,
        },
        body: JSON.stringify(body),
        signal: signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}${
          IsDev ? ` - ${await response.text()}` : ""
        }`,
      );
    }

    return await response.text();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}

export async function sendMessageEntry(
  body: any,
  token: string,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${
        import.meta.env.VITE_PROCESSOR_BASE_URL
      }/api/v1/processor/send-message`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}${
          IsDev ? ` - ${await response.text()}` : ""
        }`,
      );
    }

    return await response.text();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}

export async function sendLiveRun(
  payload: string,
  dataFeedId: string,
  mimeType: string,
  token: string,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_PROCESSOR_BASE_URL}/api/v1/processor/process-feed`,
      {
        method: "POST",
        headers: {
          "Content-Type": mimeType,
          Authorization: `Bearer ${token}`,
          "x-datafeed-id": dataFeedId,
        },
        body: payload,
        signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}${
          IsDev ? ` - ${await response.text()}` : ""
        }`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}

export async function getMessageEvents(
  messageId: string,
  token: string,
  signal?: AbortSignal,
) {
  const response = await fetch(
    `${import.meta.env.VITE_PROCESSOR_BASE_URL}/api/v1/processor/messages/${messageId}/events`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    },
  );
  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return response.json() as Promise<{
    messageId: string;
    count: number;
    events: LiveEvent[];
  }>;
}

export interface LiveEvent {
  id: string;
  messageId: string;
  stage: string;
  status: string;
  eventType: string;
  topic: string | null;
  objectPath: string | null;
  pluginName: string | null;
  pluginVersion: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorDetails: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export async function processFeedEntry(
  body: any,
  dataFeedId: string,
  token: string,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${
        import.meta.env.VITE_PROCESSOR_BASE_URL
      }/api/v1/processor/process-feed`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-datafeed-id": dataFeedId,
        },
        body: JSON.stringify(body),
        signal: signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}${
          IsDev ? ` - ${await response.text()}` : ""
        }`,
      );
    }

    return await response.text();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}
