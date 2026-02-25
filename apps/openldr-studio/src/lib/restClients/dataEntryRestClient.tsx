// const ENV = process.env;
const ENV = import.meta.env;
const IsDev = ENV.MODE === "development";

export async function getAllForms(
  schemaType: string,
  token: any,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/forms/${schemaType}`,
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

export async function getForm(
  name: string,
  version: string,
  type: string,
  token: any,
  signal?: AbortSignal,
) {
  try {
    console.log(
      `${ENV.VITE_API_BASE_URL}/api/v1/forms/form/${name}/${version}/${type}`,
    );
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/forms/form/${name}/${version}/${type}`,
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
