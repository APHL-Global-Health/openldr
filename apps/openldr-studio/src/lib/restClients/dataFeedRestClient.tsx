// const ENV = process.env;
const ENV = import.meta.env;
const IsDev = ENV.MODE === "development";

export async function createDataFeed(
  dataFeed: any,
  token: any,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/datafeed/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dataFeed),
        signal: signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}${IsDev ? ` - ${await response.text()}` : ""}`,
      );
    }

    return await response.text();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}

export async function getAllDataFeeds(
  token: any,
  inEnabled = null,
  signal?: AbortSignal,
) {
  let query = "";
  if (inEnabled !== null) {
    query = `?isEnabled=${inEnabled ? 1 : 0}`;
  }

  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/datafeed${query}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}${IsDev ? ` - ${await response.text()}` : ""}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}

export async function updateDataFeed(
  dataFeedId: any,
  dataFeed: any,
  token: any,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/datafeed/update/${dataFeedId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dataFeed),
        signal: signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}${IsDev ? ` - ${await response.text()}` : ""}`,
      );
    }

    return await response.text();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}

export async function deleteDataFeed(
  dataFeedId: any,
  token: any,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/datafeed/delete/${dataFeedId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}${IsDev ? ` - ${await response.text()}` : ""}`,
      );
    }

    return await response.text();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}

export async function getClientDetails(
  clientId: any,
  token: any,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/datafeed/get-client-details?clientId=${clientId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}${IsDev ? ` - ${await response.text()}` : ""}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}

export async function resetClientDetails(
  clientId: any,
  token: any,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/datafeed/reset-client-details?clientId=${clientId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText}${IsDev ? ` - ${await response.text()}` : ""}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}
