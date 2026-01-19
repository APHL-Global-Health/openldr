const KcAdminClient = require("@keycloak/keycloak-admin-client").default;
// import KcAdminClient from '@keycloak/keycloak-admin-client';

// Check for required environment variables
if (
  !process.env.KEYCLOAK_CLIENT_ID ||
  !process.env.KEYCLOAK_CLIENT_SECRET ||
  !process.env.KEYCLOAK_REALM
) {
  throw new Error("Keycloak credentials not found in environment variables");
}

// connect to keycloak service using Docker network name
const kcAdminClient = new KcAdminClient({
  baseUrl: `https://${process.env.KEYCLOAK_HOSTNAME}:${process.env.KEYCLOAK_PORT}/keycloak`,
  // baseUrl: `https://127.0.0.1/keycloak`,
  realmName: process.env.KEYCLOAK_REALM,
});

kcAdminClient
  .auth({
    grantType: "client_credentials",
    clientId: process.env.KEYCLOAK_CLIENT_ID,
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
  })
  .then();

setInterval(
  async () =>
    kcAdminClient.auth({
      grantType: "client_credentials",
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    }),
  300 * 1000
); // 600 seconds

async function createUser({
  // userName,
  email,
  firstName,
  lastName,
  phoneNumber,
  temporaryPassword,
}: {
  // userName: any;
  email: any;
  firstName: any;
  lastName: any;
  phoneNumber: any;
  temporaryPassword: any;
}) {
  try {
    return await kcAdminClient.users.create({
      username: email,
      email: email,
      firstName: firstName,
      lastName: lastName,
      attributes: {
        phoneNumber: phoneNumber,
      },
      credentials: [
        {
          temporary: true,
          type: "password",
          value: temporaryPassword,
        },
      ],
      enabled: true,
    });
  } catch (error) {
    throw error;
  }
}

async function updateUser({
  userId,
  email,
  firstName,
  lastName,
  phoneNumber,
}: {
  userId: any;
  email: any;
  firstName: any;
  lastName: any;
  phoneNumber: any;
}) {
  try {
    return await kcAdminClient.users.update(
      { id: userId },
      {
        id: userId,
        firstName: firstName,
        lastName: lastName,
        email: email,
        attributes: {
          phoneNumber: phoneNumber,
        },
      }
    );
  } catch (error) {
    throw error;
  }
}

async function createClient({
  id,
  name,
  description,
  authorizationServicesEnabled = true,
  serviceAccountsEnabled = true,
}: {
  id: any;
  name: any;
  description: any;
  authorizationServicesEnabled: boolean;
  serviceAccountsEnabled: boolean;
}) {
  try {
    return await kcAdminClient.clients.create({
      id,
      name,
      description,
      authorizationServicesEnabled,
      serviceAccountsEnabled,
    });
  } catch (error) {
    throw error;
  }
}

async function deleteClient(id: any) {
  try {
    return await kcAdminClient.clients.del({
      id: id,
    });
  } catch (error) {
    throw error;
  }
}

async function getClientSecret(id: any) {
  try {
    return await kcAdminClient.clients.getClientSecret({
      id: id,
    });
  } catch (error) {
    throw error;
  }
}

async function resetClientSecret(id: any) {
  try {
    return await kcAdminClient.clients.generateNewClientSecret({
      id: id,
    });
  } catch (error) {
    throw error;
  }
}

async function deleteUser(id: any) {
  try {
    await kcAdminClient.users.del({
      id: id,
      realm: kcAdminClient.realmName,
    });
  } catch (error) {
    throw error;
  }
}

export {
  createUser,
  updateUser,
  createClient,
  deleteClient,
  getClientSecret,
  resetClientSecret,
  deleteUser,
};
