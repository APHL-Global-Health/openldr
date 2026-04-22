const ENV = import.meta.env;
const IsDev = ENV.MODE === "development";

export async function getDoc(
  format: "yaml" | "json",
  token: any,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/api-doc/${format}`,
      {
        method: "GET",
        headers: {
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

    if (format === "json") return await response.json();

    return await response.text();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}
