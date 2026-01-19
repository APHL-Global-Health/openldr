// const ENV = process.env;
const ENV = import.meta.env;
const IsDev = ENV.MODE === "development";

export async function authenticateAdmin(signal?: AbortSignal) {
  try {
    const formData = new URLSearchParams();
    formData.append("client_id", ENV.VITE_KEYCLOAK_CLIENT_ID!);
    formData.append("client_secret", ENV.VITE_KEYCLOAK_CLIENT_SECRET!);
    formData.append("grant_type", "client_credentials");

    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/auth/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
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
