/*import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

// Create JWKS client
export const createJwksClient = (jwksUri: string) => {
  return jwksClient({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri,
  });
};

// Get signing key function
export const getKey = (client: jwksClient.JwksClient) => {
  return (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
    client.getSigningKey(header.kid, (err, key) => {
      if (err) {
        callback(err);
      } else {
        const signingKey = key?.getPublicKey();
        callback(null, signingKey);
      }
    });
  };
};

export const verifyUser = (token: string | undefined | null) => {
  return new Promise((resolve, reject) => {
    if (!token) reject(new Error("A token is required for authentication"));
    else {
      const config = {
        jwksUri: `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
        audience: "account",
        issuer: `${process.env.KEYCLOAK_PUBLIC_URL}/realms/${process.env.KEYCLOAK_REALM}`,
      };

      const client = createJwksClient(config.jwksUri);
      const getSigningKey = getKey(client);

      jwt.verify(
        token,
        getSigningKey,
        {
          audience: config.audience,
          issuer: config.issuer,
          algorithms: ["RS256"],
        },
        (err: any, decoded: any) => {
          if (err) reject(err);
          else resolve(decoded);
        }
      );
    }
  });
};
*/
