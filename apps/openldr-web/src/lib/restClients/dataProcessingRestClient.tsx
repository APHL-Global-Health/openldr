// const ENV = process.env;
const ENV = import.meta.env;
const IsDev = ENV.MODE === "development";

export async function manualDataEntry(
  body: any,
  facilityId: string,
  userId: string,
  token: string,
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/api/v1/openldr/event/manual-data-entry`,
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
      }
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}${IsDev ? ` - ${await response.text()}` : ""}`
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
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/api/v1/openldr/event/send-message`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: signal,
      }
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}${IsDev ? ` - ${await response.text()}` : ""}`
      );
    }

    return await response.text();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}

export async function processFeedEntry(
  body: any,
  dataFeedId: string,
  token: string,
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/api/v1/openldr/event/process-feed`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-datafeed-id": dataFeedId,
        },
        body: JSON.stringify(body),
        signal: signal,
      }
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}${IsDev ? ` - ${await response.text()}` : ""}`
      );
    }

    return await response.text();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}
