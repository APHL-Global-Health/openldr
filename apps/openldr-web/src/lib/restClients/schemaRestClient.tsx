// const ENV = process.env;
const ENV = import.meta.env;
const IsDev = ENV.MODE === "development";

export async function getAllTables(token: any, signal?: AbortSignal) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/archive/tables`,
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
    console.error(`REST client error`, error);
    throw error;
  }
}

export async function getTableData(
  table: string,
  options: any,
  token: any,
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/archive/data/${table}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(options || {}),
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
    console.error(`REST client error`, error);
    throw error;
  }
}

export async function getTableColumns(
  table: string,
  token: any,
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/archive/table/${table}`,
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
    console.error(`REST client error`, error);
    throw error;
  }
}

export async function manipulateData(
  table: string,
  version: string,
  type: string,
  options: any,
  token: any,
  method: string = "POST",
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/archive/table/${version}/${table}/${type}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(options || {}),
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
    console.error(`REST client error`, error);
    throw error;
  }
}
