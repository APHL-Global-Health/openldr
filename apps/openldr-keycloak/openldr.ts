import "dotenv/config";
import { services, docker, KeyCloak } from "@repo/openldr-core";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keycloak = new KeyCloak(
  process.env.KEYCLOAK_PUBLIC_URL!,
  process.env.KEYCLOAK_REALM!,
);

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

  // const currentEnv = path.resolve(dir, ".env");
  const rootEnv = path.resolve(dir, ".env"); //path.resolve(dir, "..", "..", ".env.infrastructure");

  console.log(
    `Looking for infrastructure env file at ${path.dirname(rootEnv)}`,
  );
  if (!fs.existsSync(rootEnv)) {
    throw new Error(
      `.env.infrastructure file not found at ${path.dirname(rootEnv)}`,
    );
  }

  console.log(`Waiting for Keycloak to be ready...`);
  await services.waitForContainerHealth(
    process.env.KEYCLOAK_HOSTNAME!,
    480000,
    docker,
  );

  console.log(`Waiting for Keycloak to be ready...`);
  await services.sleep(1000 * 10);

  const token = (
    await keycloak.getToken(
      {
        username: process.env.KEYCLOAK_ADMIN_USER!,
        password: process.env.KEYCLOAK_ADMIN_PASSWORD!,
        grant_type: "password",
        client_id: "admin-cli",
      },
      "master",
    )
  ).access_token;

  if (!(await keycloak.realmExists(token, process.env.KEYCLOAK_REALM!))) {
    await keycloak.importRealm(token, dir);
  }

  const clientId = await keycloak.createClient(token, {
    id: process.env.KEYCLOAK_CLIENT_ID,
    clientId: process.env.KEYCLOAK_CLIENT_ID,
    name: "OpenLDR System Client",
    enabled: true,
    clientAuthenticatorType: "client-secret",
    secret: process.env.KEYCLOAK_CLIENT_SECRET,
    redirectUris: ["*"],
    webOrigins: ["*"],

    publicClient: false,
    protocol: "openid-connect",
    serviceAccountsEnabled: true,
    authorizationServicesEnabled: true,
    standardFlowEnabled: true,
    directAccessGrantsEnabled: true,
  });

  const serviceAccountUserId = await keycloak.getServiceAccountUserId(
    token,
    clientId,
  );

  if (!serviceAccountUserId)
    throw new Error("Failed to get service account user ID");

  const realmMgmtClientId = await keycloak.getClientIdByClientId(
    token,
    "realm-management",
  );

  if (!realmMgmtClientId)
    throw new Error("Failed to get realm-management client ID");

  const manageUsersRoleId = await keycloak.getRoleId(
    token,
    realmMgmtClientId,
    "manage-users",
  );
  const manageClientsRoleId = await keycloak.getRoleId(
    token,
    realmMgmtClientId,
    "manage-clients",
  );

  if (!manageUsersRoleId || !manageClientsRoleId)
    throw new Error("Failed to get role IDs");

  await keycloak.assignRolesToServiceAccount(
    token,
    serviceAccountUserId,
    realmMgmtClientId,
    [
      { id: manageUsersRoleId, name: "manage-users" },
      { id: manageClientsRoleId, name: "manage-clients" },
    ],
  );

  await keycloak.createClient(token, {
    id: process.env.KEYCLOAK_WEB_CLIENT_ID,
    clientId: process.env.KEYCLOAK_WEB_CLIENT_ID,
    name: "OpenLDR Web UI Client",
    enabled: true,
    redirectUris: ["*"],
    webOrigins: ["*"],

    publicClient: true,
    protocol: "openid-connect",
    serviceAccountsEnabled: false,
    authorizationServicesEnabled: false,
    standardFlowEnabled: true,
    directAccessGrantsEnabled: true,
  });

  console.log("Keycloak initialization complete!");
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
