// const ENV = process.env;
const ENV = import.meta.env;
const IsDev = ENV.MODE === "development";

export async function getUniqueDataFeedsProjectsUseCases(
  index: any,
  token: any,
  startDateTime: any,
  endDateTime: any,
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/opensearch/unique-keyword-count?index=${index}&startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: signal,
      }
    );

    if (!response.ok) {
      try {
        const data = await response.json();
        if (data.error && !data.error.includes("index_not_found_exception")) {
          throw new Error(`HTTP error : ${data.error}`);
        }
        return data;
      } catch (_error: any) {
        throw new Error(
          `HTTP error ${response.status}: ${response.statusText}${IsDev ? ` - ${await response.text()}` : ""}`
        );
      }
    }

    return await response.json();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}

export async function getIndexDocumentCounts(
  token: any,
  startDateTime: any,
  endDateTime: any,
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/opensearch/index-count?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: signal,
      }
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}${IsDev ? ` - ${await response.text()}` : ""}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}

export async function getIntervalMessageCounts(
  token: any,
  startDateTime: any,
  endDateTime: any,
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/opensearch/interval-message-count?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: signal,
      }
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}${IsDev ? ` - ${await response.text()}` : ""}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}

export async function getLatestMessages(
  token: any,
  startDateTime: any,
  endDateTime: any,
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/opensearch/latest-messages?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: signal,
      }
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}${IsDev ? ` - ${await response.text()}` : ""}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}
