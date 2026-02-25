import Keycloak from "keycloak-js";

// const ENV = process.env;
const ENV = import.meta.env;

// Validate environment variables
const keycloakUrl = ENV.VITE_KEYCLOAK_URL;
const keycloakRealm = ENV.VITE_KEYCLOAK_REALM;
const keycloakClientId = ENV.VITE_KEYCLOAK_CLIENT_ID;

if (!keycloakUrl || !keycloakRealm || !keycloakClientId) {
  console.error("Missing Keycloak environment variables:", {
    url: keycloakUrl,
    realm: keycloakRealm,
    clientId: keycloakClientId,
  });
}

const keycloak = new Keycloak({
  url: keycloakUrl,
  realm: keycloakRealm,
  clientId: keycloakClientId,
});

export default keycloak;
