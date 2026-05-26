// const ENV = process.env;
const ENV = import.meta.env;
const IsDev = ENV.MODE === "development";

export async function createProject(
  project: any,
  token: any,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/project/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(project),
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

export async function getAllProjects(
  token: any,
  inEnabled: boolean | null = null,
  signal?: AbortSignal,
) {
  let query = "";
  if (inEnabled !== null) {
    query = `?isEnabled=${inEnabled ? 1 : 0}`;
  }

  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/project${query}`,
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

export async function updateProject(
  projectId: any,
  project: any,
  token: any,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/project/update/${projectId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(project),
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

export async function deleteProject(
  projectId: any,
  token: any,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/project/delete/${projectId}`,
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
