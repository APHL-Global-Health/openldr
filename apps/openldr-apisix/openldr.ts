import fs from "fs";
import path from "path";
import { services, docker } from "@repo/openldr-core";

interface RouteConfig {
  id: string;
  uri: string;
  name: string;
  methods: string[];
  rewrite_uri: [string, string];
  upstream_url: string;
  auth_required?: string;
  ssl_enabled?: string;
}

interface UpstreamConfig {
  type: string;
  nodes:
    | Record<string, number>
    | Array<{ host: string; port: number; weight: number }>;
  scheme?: string;
  pass_host?: string;
  hash_on?: string;
  upstream_host?: string;
}

interface RouteData {
  id: string;
  uri: string;
  name: string;
  methods: string[];
  plugins: Record<string, any>;
  upstream: UpstreamConfig;
  status: number;
}

// Check if route ID is in excluded OIDC routes
const isExcludedOidcRoute = (routeId: string): boolean => {
  const excludedOidcRoutes = ["user-datafeed-authentication-route"];
  return excludedOidcRoutes.includes(routeId);
};

// Fixed method using proper shell command construction
const createRoute = async (
  containerName: string,
  adminPort: string,
  apiKey: string,
  routeId: string,
  routeName: string,
  routeData: RouteData
): Promise<boolean> => {
  try {
    console.log(`Creating route: ${routeName} (ID: ${routeId})`);

    const container = docker.getContainer(containerName);

    // Check if container is running
    const containerInfo = await container.inspect();
    if (containerInfo.State.Status !== "running") {
      throw new Error(`Container ${containerName} is not running`);
    }

    // Convert route data to JSON string
    const jsonData = JSON.stringify(routeData);

    // Method 1: Using shell with proper escaping
    const curlCommand = [
      "/bin/sh",
      "-c",
      `curl -X PUT -H "X-API-KEY: ${apiKey}" -H "Content-Type: application/json" -d '${jsonData}' http://localhost:${adminPort}/apisix/admin/routes/${routeId}`,
    ];

    const execContainer = await container.exec({
      Cmd: curlCommand,
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await execContainer.start({ Detach: false });

    return new Promise((resolve, reject) => {
      let output = "";
      let errorOutput = "";

      stream.on("data", (chunk) => {
        const data = chunk.toString();
        // Separate stdout and stderr based on content
        if (
          data.includes("curl:") ||
          data.includes("error") ||
          data.includes("Error")
        ) {
          errorOutput += data;
        } else {
          output += data;
        }
      });

      stream.on("end", () => {
        try {
          // console.log("Response:", output);
          if (errorOutput) {
            console.log("Errors:", errorOutput);
          }

          // Check if the response indicates success
          if (
            output.includes('"key":') ||
            output.includes('"value":') ||
            output.includes('"status":1')
          ) {
            console.log(`Successfully created route: ${routeName}`);
            resolve(true);
          } else if (
            output.includes("missing apikey") ||
            errorOutput.includes("missing apikey")
          ) {
            console.error("Authentication failed - check API key");
            reject(
              new Error("Authentication failed - missing or invalid API key")
            );
          } else if (output.includes("400") || errorOutput.includes("400")) {
            console.error("Bad request - check route data format");
            console.error("Route data:", JSON.stringify(routeData, null, 2));
            reject(new Error("Bad request"));
          } else {
            console.log(`Failed to create route: ${routeName}`);
            console.log("Full output:", output);
            console.log("Error output:", errorOutput);
            resolve(false);
          }
        } catch (error) {
          console.error("Error processing response:", error);
          reject(error);
        }
      });

      stream.on("error", (error) => {
        console.error("Stream error:", error);
        reject(error);
      });
    });
  } catch (error) {
    console.error(`Error creating route ${routeName}:`, error);
    throw error;
  }
};

// Generate route data
const generateRouteData = (config: RouteConfig): RouteData => {
  const {
    id,
    uri,
    name,
    methods,
    rewrite_uri: [rewriteUri0, rewriteUri1],
    upstream_url,
    auth_required = "true",
  } = config;

  const hostIp = process.env.HOST_IP || "localhost";
  const keycloakHostname = process.env.KEYCLOAK_HOSTNAME || "openldr-keycloak";
  const keycloakUrl = `http://${keycloakHostname}:${
    process.env.KEYCLOAK_PORT || "8080"
  }/keycloak`;

  // APISIX plugin configurations
  const apisixOidcConnectConfig = {
    "openid-connect": {
      bearer_only: true,
      client_id: process.env.KEYCLOAK_CLIENT_ID,
      client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
      discovery: `${keycloakUrl}/realms/${process.env.KEYCLOAK_REALM}/.well-known/openid-configuration`,
      introspection_endpoint: `${keycloakUrl}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token/introspect`,
      realm: process.env.KEYCLOAK_REALM,
      set_userinfo_header: true,
      set_access_token_header: true,
      set_id_token_header: true,
    },
  };

  const apisixCorsConfig = {
    cors: {
      allow_headers: "*",
      allow_methods: "GET,POST,PUT,DELETE,OPTIONS",
      allow_origins: "*",
      expose_headers: "*",
      max_age: 3600,
    },
  };

  // Initialize plugins
  let plugins: Record<string, any> = {};

  if (!isExcludedOidcRoute(id)) {
    plugins = { ...apisixCorsConfig, ...apisixOidcConnectConfig };
  } else {
    plugins = { ...apisixCorsConfig };
  }

  // Add proxy-rewrite plugin
  plugins["proxy-rewrite"] = {
    regex_uri: [rewriteUri0, rewriteUri1],
    use_real_request_uri_unsafe: false,
  };

  // Resolve upstream URL
  let resolvedUpstreamUrl: string;
  let host: string;
  let port: string;

  switch (upstream_url) {
    case "${ENTITY_SERVICE_URL}":
      resolvedUpstreamUrl = `${
        process.env.ENTITY_SERVICES_HOSTNAME || hostIp
      }:${process.env.USER_PROFILE_PORT || "3002"}`;
      host = process.env.ENTITY_SERVICES_HOSTNAME || hostIp;
      port = process.env.USER_PROFILE_PORT || "3002";
      break;
    case "${PLUGIN_URL}":
      resolvedUpstreamUrl = `${process.env.PLUGIN_HOSTNAME || hostIp}:${
        process.env.PLUGIN_PORT || "3006"
      }`;
      host = process.env.PLUGIN_HOSTNAME || hostIp;
      port = process.env.PLUGIN_PORT || "3006";
      break;
    case "${DATA_PROCESSING_URL}":
      resolvedUpstreamUrl = `${
        process.env.DATA_PROCESSING_HOSTNAME || hostIp
      }:${process.env.DATA_PROCESSING_PORT || "3001"}`;
      host = process.env.DATA_PROCESSING_HOSTNAME || hostIp;
      port = process.env.DATA_PROCESSING_PORT || "3001";
      break;
    case "${KEYCLOAK_URL}":
      resolvedUpstreamUrl = `${keycloakHostname}:${
        process.env.KEYCLOAK_PORT || "8080"
      }`;
      host = keycloakHostname;
      port = process.env.KEYCLOAK_PORT || "8080";
      break;
    default:
      resolvedUpstreamUrl = upstream_url;
      host = keycloakHostname;
      port = "8080";
      break;
  }

  let upstream: UpstreamConfig;

  if (
    id === "user-datafeed-authentication-route" ||
    id === "user-datafeed-authentication-route-ssl"
  ) {
    upstream = {
      type: "roundrobin",
      nodes: [
        {
          host: keycloakHostname,
          port: 8080,
          weight: 1,
        },
      ],
      scheme: "http",
      pass_host: "node",
      hash_on: "vars",
      upstream_host: `${keycloakHostname}:8080`,
    };
  } else if (resolvedUpstreamUrl === keycloakUrl) {
    upstream = {
      type: "roundrobin",
      nodes: { [resolvedUpstreamUrl]: 1 },
      scheme: "http",
      pass_host: "node",
      upstream_host: resolvedUpstreamUrl,
    };
  } else {
    upstream = {
      type: "roundrobin",
      nodes: { [resolvedUpstreamUrl]: 1 },
    };
  }

  return {
    id,
    uri,
    name,
    methods,
    plugins,
    upstream,
    status: 1,
  };
};

const setup = async (dir: string) => {
  console.log(`Running setup - ${dir}`);
};

const reset = async (dir: string) => {
  console.log(`Running reset - ${dir}`);
};

const stop = async (dir: string) => {
  console.log(`Stopping services - ${dir}`);
};

const start = async (dir: string) => {
  console.log(`Starting services - ${dir}`);

  try {
    services.loadEnv(path.resolve(".env"));

    const {
      APISIX_API_KEY = "",
      APISIX_ADMIN_PORT = "9180",
      APISIX_HOSTNAME = "openldr-apisix",
      KEYCLOAK_HOSTNAME = "openldr-keycloak",
    } = process.env;

    await services.waitForContainerHealth(APISIX_HOSTNAME, 120000, docker);

    await services.waitForContainerHealth(KEYCLOAK_HOSTNAME, 240000, docker);

    const routesDir = path.join(__dirname, "apisix_conf/init-routes");
    if (!fs.existsSync(routesDir)) {
      console.log(
        `apisix_conf/init-routes directory not found at ${routesDir}`
      );
      process.exit(1);
    }

    const files = fs.readdirSync(routesDir).filter((f) => f.endsWith(".json"));
    if (!files.length) {
      console.log(`No JSON files found in init-routes directory`);
      return;
    }

    for (const file of files) {
      const routes: RouteConfig[] = JSON.parse(
        fs.readFileSync(path.join(routesDir, file), "utf-8")
      );
      for (const route of routes) {
        const routeData = generateRouteData(route);
        await createRoute(
          APISIX_HOSTNAME,
          APISIX_ADMIN_PORT,
          APISIX_API_KEY,
          route.id,
          route.name,
          routeData
        );
      }
    }
    console.log("APISIX routes configuration complete!");
  } catch (error) {
    await console.log(`Init failed: ${error}`);
    process.exit(1);
  }
};

const { command, dir } = services.processArguments(__dirname, process.argv);
switch (command) {
  case "setup":
    setup(dir);
    break;
  case "reset":
    reset(dir);
    break;
  case "stop":
    stop(dir);
    break;
  case "start":
    start(dir);
    break;
  default:
    throw new Error(`Unknown command: ${command} - ${dir}`);
}
