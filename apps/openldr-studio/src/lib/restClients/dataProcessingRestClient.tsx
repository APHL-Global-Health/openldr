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
  payload: string | File,
  dataFeedId: string,
  mimeType: string,
  token: string,
  signal?: AbortSignal,
  force?: boolean,
) {
  try {
    const url = `${import.meta.env.VITE_PROCESSOR_BASE_URL}/api/v1/processor/process-feed${force ? "?force=true" : ""}`;
    const response = await fetch(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": mimeType,
          Authorization: `Bearer ${token}`,
          "x-datafeed-id": dataFeedId,
        },
        body: payload instanceof File ? payload : payload,
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

export async function getMessageStatus(
  messageId: string,
  token: string,
  signal?: AbortSignal,
) {
  const response = await fetch(
    `${import.meta.env.VITE_PROCESSOR_BASE_URL}/api/v1/processor/messages/${messageId}/status`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    },
  );
  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return response.json() as Promise<{ messageId: string; status: string; currentStage: string }>;
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
  stage: string;
  status: string;
  eventType: string;
  pluginName: string | null;
  pluginVersion: string | null;
  count: number;
  firstAt: string;
  lastAt: string;
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
