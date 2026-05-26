// const ENV = process.env;
const ENV = import.meta.env;
const IsDev = ENV.MODE === "development";

export async function createFacility(
  facility: any,
  token: any,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/facility/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: signal,
        body: facility ? JSON.stringify(facility) : undefined,
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

export async function getAllFacilities(token: any, signal?: AbortSignal) {
  try {
    const response = await fetch(`${ENV.VITE_API_BASE_URL}/api/v1/facility`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal: signal,
    });

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

export async function updateFacility(
  facilityId: any,
  facility: any,
  token: any,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/facility/update/${facilityId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(facility),
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

export async function deleteFacility(
  facilityId: any,
  token: any,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/facility/delete/${facilityId}`,
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
