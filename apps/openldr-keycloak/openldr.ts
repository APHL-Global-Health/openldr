import { services, docker } from "@repo/openldr-core";
import path from "path";
import fs from "fs";

const createClient = async (token: string, client: any) => {
  const res = await fetch(
    `${process.env.KEYCLOAK_PUBLIC_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/clients`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(client),
    }
  );

  if (!res.ok) {
    console.log(`Failed to create client ${client.clientId}`);
  } else {
    console.log(`Client ${client.clientId} created successfully.`);
  }
};

const getClientIdByClientId = async (
  token: string,
  clientId: string
): Promise<string | null> => {
  const res = await fetch(
    `${process.env.KEYCLOAK_PUBLIC_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/clients`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }

  const clients = await res.json();
  const match = clients.find((c: any) => c.clientId === clientId);
  return match?.id || null;
};

const getServiceAccountUserId = async (
  token: string,
  clientId: string
): Promise<string | null> => {
  const res = await fetch(
    `${process.env.KEYCLOAK_PUBLIC_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/clients/${clientId}/service-account-user`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }

  const user = await res.json();
  return user?.id || null;
};

const getRoleId = async (
  token: string,
  clientId: string,
  roleName: string
): Promise<string | null> => {
  const res = await fetch(
    `${process.env.KEYCLOAK_PUBLIC_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/clients/${clientId}/roles`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }

  const roles = await res.json();
  const match = roles.find((r: any) => r.name === roleName);
  return match?.id || null;
};

const assignRolesToServiceAccount = async (
  token: string,
  userId: string,
  clientId: string,
  roles: { id: string; name: string }[]
) => {
  const res = await fetch(
    `${process.env.KEYCLOAK_PUBLIC_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${userId}/role-mappings/clients/${clientId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(roles),
    }
  );

  if (res.ok) {
    console.log(`Assigned roles to service account`);
  } else {
    console.log(`Failed to assign roles`);
  }
};

const createUserByUsername = async (token: string, username: string) => {
  const res = await fetch(
    `${process.env.KEYCLOAK_PUBLIC_URL}/admin/realms/${
      process.env.KEYCLOAK_REALM
    }/users?username=${encodeURIComponent(username)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }

  return await res.json();
};

const createUserIfNotExists = async (
  token: string,
  username: string,
  userPayload: any
) => {
  const users = await createUserByUsername(token, username);
  if (users.length === 0) {
    console.log(`Creating user ${username}`);

    const createRes = await fetch(
      `${process.env.KEYCLOAK_PUBLIC_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userPayload),
      }
    );

    if (createRes.ok) {
      const createdUsers = await createRes.text();
      const _users = await createUserByUsername(token, username);

      console.log(`User ${username} created.`);
      return _users.find((u: any) => u.username === username).id;
    } else {
      console.log(`Failed to create user ${username}`);
      return null;
    }
  } else {
    console.log(`User ${username} already exists.`);
    return users.find((u: any) => u.username === username).id;
  }
};

const getToken = async (info: any, realm: string) => {
  if (!info) throw new Error("Info is required");

  const response = await fetch(
    `${process.env.KEYCLOAK_PUBLIC_URL}/realms/${realm}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(info),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get token");
  }

  const data = await response.json();

  return data;
};

const clientExists = async (
  token: string,
  clientId: string
): Promise<boolean> => {
  const id = await getClientIdByClientId(token, clientId);
  return !!id;
};

const realmExists = async (token: string, realm: string) => {
  const res = await fetch(
    `${process.env.KEYCLOAK_PUBLIC_URL}/admin/realms/${realm}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return res.ok;
};

const envsubst = (str: string): string => {
  return str.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] || "");
};

const importRealm = async (token: string, dir: string) => {
  const realmTemplate = fs.readFileSync(
    path.resolve(dir, "realm-config", "openldr-realm.json"),
    "utf-8"
  );
  const finalRealm = envsubst(realmTemplate);
  const res = await fetch(`${process.env.KEYCLOAK_PUBLIC_URL}/admin/realms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: finalRealm,
  });
  if (!res.ok) throw new Error(`Realm import failed: ${res.statusText}`);

  const response = await fetch(
    `${process.env.KEYCLOAK_PUBLIC_URL}/admin/realms/${process.env.KEYCLOAK_REALM}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attributes: {
          frontendUrl: process.env.KEYCLOAK_PUBLIC_URL,
        },
      }),
    }
  );
  if (!response.ok) throw new Error(`Realm updating failed: ${res.statusText}`);
  console.log("Realm imported.");
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

  services.loadEnv(path.resolve(".env"));

  const currentEnv = path.resolve(dir, ".env");
  const rootEnv = path.resolve(dir, "..", "..", ".env.infrastructure");

  console.log(
    `Looking for infrastructure env file at ${path.dirname(rootEnv)}`
  );
  if (!fs.existsSync(rootEnv)) {
    throw new Error(
      `.env.infrastructure file not found at ${path.dirname(rootEnv)}`
    );
  }

  console.log(`Waiting for Keycloak to be ready...`);
  await services.waitForContainerHealth(
    process.env.KEYCLOAK_HOSTNAME!,
    480000,
    docker
  );

  console.log(`Waiting for Keycloak to be ready...`);
  await services.sleep(1000 * 10);

  const token = (
    await getToken(
      {
        username: process.env.KEYCLOAK_ADMIN_USER!,
        password: process.env.KEYCLOAK_ADMIN_PASSWORD!,
        grant_type: "password",
        client_id: "admin-cli",
      },
      "master"
    )
  ).access_token;

  if (!(await realmExists(token, process.env.KEYCLOAK_REALM!))) {
    await importRealm(token, dir);
  }

  if (!(await clientExists(token, process.env.KEYCLOAK_CLIENT_ID!))) {
    console.log("Creating openldr-client...");

    await createClient(token, {
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
  }

  const clientId = await getClientIdByClientId(
    token,
    process.env.KEYCLOAK_CLIENT_ID!
  );
  if (!clientId) throw new Error("Failed to get client ID");

  const serviceAccountUserId = await getServiceAccountUserId(token, clientId);

  if (!serviceAccountUserId)
    throw new Error("Failed to get service account user ID");

  const realmMgmtClientId = await getClientIdByClientId(
    token,
    "realm-management"
  );

  if (!realmMgmtClientId)
    throw new Error("Failed to get realm-management client ID");

  const manageUsersRoleId = await getRoleId(
    token,
    realmMgmtClientId,
    "manage-users"
  );
  const manageClientsRoleId = await getRoleId(
    token,
    realmMgmtClientId,
    "manage-clients"
  );

  if (!manageUsersRoleId || !manageClientsRoleId)
    throw new Error("Failed to get role IDs");

  await assignRolesToServiceAccount(
    token,
    serviceAccountUserId,
    realmMgmtClientId,
    [
      { id: manageUsersRoleId, name: "manage-users" },
      { id: manageClientsRoleId, name: "manage-clients" },
    ]
  );

  if (!(await clientExists(token, process.env.KEYCLOAK_WEB_CLIENT_ID!))) {
    console.log("Creating Web UI client...");

    await createClient(token, {
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
  } else {
    console.log("Web UI client already exists...");
  }

  if (
    !(await clientExists(token, process.env.DEFAULT_MANUAL_ENTRY_DATA_FEED_ID!))
  ) {
    console.log("Creating Manual Entry Data Feed...");

    await createClient(token, {
      id: process.env.DEFAULT_MANUAL_ENTRY_DATA_FEED_ID,
      clientId: process.env.DEFAULT_MANUAL_ENTRY_DATA_FEED_ID,
      name: "Manual Data Entry of Lab Results",
      enabled: true,
      clientAuthenticatorType: "client-secret",
      secret: process.env.DEFAULT_MANUAL_ENTRY_DATA_FEED_SECRET,
      redirectUris: ["*"],
      webOrigins: ["*"],

      publicClient: false,
      protocol: "openid-connect",
      serviceAccountsEnabled: true,
      authorizationServicesEnabled: true,
      standardFlowEnabled: true,
      directAccessGrantsEnabled: true,
    });
  } else {
    console.log("Manual Entry Data Feed already exists...");
  }

  if (!(await clientExists(token, process.env.TEST_DATA_FEED_ID!))) {
    console.log("Creating Test Data Feed...");

    await createClient(token, {
      id: process.env.TEST_DATA_FEED_ID,
      clientId: process.env.TEST_DATA_FEED_ID,
      name: "Test Data Feed",
      enabled: true,
      clientAuthenticatorType: "client-secret",
      secret: process.env.TEST_DATA_FEED_SECRET,
      redirectUris: ["*"],
      webOrigins: ["*"],

      publicClient: false,
      protocol: "openid-connect",
      serviceAccountsEnabled: true,
      authorizationServicesEnabled: true,
      standardFlowEnabled: true,
      directAccessGrantsEnabled: true,
    });
  } else {
    console.log("Test Data Feed already exists...");
  }

  if (
    !(await clientExists(token, process.env.TEST_MANUAL_ENTRY_DATA_FEED_ID!))
  ) {
    console.log("Creating Test Manual Entry...");

    await createClient(token, {
      id: process.env.TEST_MANUAL_ENTRY_DATA_FEED_ID,
      clientId: process.env.TEST_MANUAL_ENTRY_DATA_FEED_ID,
      name: "Test Manual Entry Data Feed",
      enabled: true,
      clientAuthenticatorType: "client-secret",
      secret: process.env.TEST_MANUAL_ENTRY_DATA_FEED_SECRET,
      redirectUris: ["*"],
      webOrigins: ["*"],

      publicClient: false,
      protocol: "openid-connect",
      serviceAccountsEnabled: true,
      authorizationServicesEnabled: true,
      standardFlowEnabled: true,
      directAccessGrantsEnabled: true,
    });
  } else {
    console.log("Test Manual Entry already exists...");
  }

  console.log("Creating Dev Users...");

  const testId = await createUserIfNotExists(token, "test@user.com", {
    username: "test@user.com",
    email: "test@user.com",
    firstName: "Test",
    lastName: "User",
    enabled: true,
    emailVerified: true,
    credentials: [
      {
        type: "password",
        value: "openldr123",
        temporary: false,
      },
    ],
    realmRoles: ["user"],
  });
  if (testId) await services.updateEnvFile(rootEnv, "DEV_USER_TEST_ID", testId);

  const openldrId = await createUserIfNotExists(token, "openldr@user.com", {
    username: "openldr@user.com",
    email: "openldr@user.com",
    firstName: "OpenLDR",
    lastName: "User",
    enabled: true,
    emailVerified: true,
    credentials: [
      {
        type: "password",
        value: "openldr123",
        temporary: false,
      },
    ],
    realmRoles: ["user"],
  });
  if (openldrId)
    await services.updateEnvFile(rootEnv, "DEV_USER_OPENLDR_ID", openldrId);

  console.log("Update current .env with user IDs...");
  await fs.promises.copyFile(rootEnv, currentEnv);

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
