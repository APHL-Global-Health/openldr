// const ENV = process.env;
const ENV = import.meta.env;
const IsDev = ENV.MODE === "development";

export async function createPlugin(
  plugin: any,
  token: any,
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/plugin/create`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: plugin,
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

export async function createMapperPlugin(
  plugin: any,
  token: any,
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/plugin/create-mapper`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(plugin),
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

export async function getAllPlugins(token: any, signal?: AbortSignal) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/plugin`,
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

export async function updatePlugin(
  pluginId: any,
  plugin: any,
  token: any,
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/plugin/update/${pluginId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: plugin,
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

export async function updateMapperPlugin(
  pluginId: any,
  plugin: any,
  token: any,
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/plugin/update-mapper/${pluginId}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(plugin),
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

export async function deletePlugin(
  pluginId: any,
  token: any,
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/plugin/delete/${pluginId}`,
      {
        method: "DELETE",
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

    return await response.text();
  } catch (error) {
    console.error(`REST client error: ${error}`);
    throw error;
  }
}

export async function getPluginsByType(
  pluginType: any,
  token: any,
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/plugin/retrieve?pluginType=${pluginType}`,
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

export async function regenerateMapperPlugin(
  pluginId: any,
  plugin: any,
  token: any,
  signal?: AbortSignal
) {
  try {
    const response = await fetch(
      `${ENV.VITE_API_BASE_URL}/api/v1/openldr/plugin/regenerate-mapper/${pluginId}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(plugin),
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
