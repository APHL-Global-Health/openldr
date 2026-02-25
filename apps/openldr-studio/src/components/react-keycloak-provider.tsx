import React from "react";
import Keycloak from "keycloak-js";
import axios, { type AxiosInstance } from "axios";

const ENV = import.meta.env;
const apiUrl = ENV.VITE_API_BASE_URL || "";

interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified: boolean;
  attributes?: Record<string, string[]>;
}

interface LabAssignment {
  id: string;
  lab_id: string;
  lab_code: string;
  lab_name: string;
  lab_type: string;
  minio_bucket: string;
  role: string;
  can_upload: boolean;
  can_delete: boolean;
  can_export: boolean;
  can_manage_users: boolean;
  status: string;
  assigned_at: string;
}

export class KeycloakClient {
  #mountCount: number;
  #kc: Keycloak;
  #api: AxiosInstance;
  #authenticated: boolean | undefined;
  #listeners: Set<() => void>; // Track subscribers
  #user: User | null | undefined;
  #lab: LabAssignment | null | undefined;

  constructor(kc: Keycloak) {
    this.#mountCount = 0;
    this.#kc = kc;
    this.#api = axios.create();
    this.#authenticated = undefined;
    this.#listeners = new Set();

    if (!this.#kc.didInitialize) {
      this.#kc
        .init({
          onLoad: "check-sso", // Supported values: 'check-sso' , 'login-required'
          checkLoginIframe: false,
          // pkceMethod: "S256",
        })
        .then(
          async (auth: any) => {
            this.#authenticated = auth;

            if (auth) {
              if (!this.#user) {
                try {
                  this.#user = this.getAuthUser();
                } catch (err) {
                  console.error("Error fetching user or lab info:", err);
                }
              }
            }

            this.#notifyListeners(); // Notify all subscribers

            // Set up token refresh
            if (auth) {
              setInterval(() => {
                this.#kc
                  .updateToken(70)
                  .then((refreshed) => {
                    if (refreshed) {
                      console.log("Token refreshed");
                    }
                  })
                  .catch(() => {
                    try {
                      console.log("Failed to refresh token");
                      this.#kc.logout();
                    } catch (err: any) {
                      console.error(err);
                    }
                  });
              }, 6000);
            }
          },
          (error: any) => {
            console.error(error);
            this.#authenticated = false;
            /* Notify the user if necessary */
            console.error("Authentication Failed");
            this.#notifyListeners();
          },
        );
    }
  }

  getAuthUser(): User | null | undefined {
    if (!this.#kc.authenticated || !this.#kc.tokenParsed) return null;
    const p = this.#kc.tokenParsed as Record<string, string>;
    return {
      id: p["sub"] ?? "",
      username: p["preferred_username"] ?? p["sub"] ?? "",
      email: p["email"] ?? "",
      enabled: true,
      emailVerified: true,
    };
  }

  checkPermission(permission: string): boolean | null {
    if (!this.#lab) return null;

    switch (permission) {
      case "upload":
        return this.#lab.can_upload;
      case "delete":
        return this.#lab.can_delete;
      case "export":
        return this.#lab.can_export;
      case "manage_users":
        return this.#lab.can_manage_users;
      default:
        return false;
    }
  }

  hasRole(role: string): boolean | null {
    if (!this.#lab) return null;
    return this.#lab.role === role;
  }

  #notifyListeners(): void {
    this.#listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async #mount(): Promise<void> {
    // inner mount logic
  }

  mount(): void {
    this.#mountCount++;
    if (this.#mountCount !== 1) return;

    this.#mount();
  }

  unmount(): void {
    this.#mountCount--;
    if (this.#mountCount !== 0) return;

    // console.log("kecloak client unmounted");
  }

  refreshToken = async (minValidity: number = 5) => {
    return this.#kc.updateToken(minValidity);
  };

  get user(): User | null | undefined {
    return this.#user;
  }

  get lab(): LabAssignment | null | undefined {
    return this.#lab;
  }

  get kc(): Keycloak {
    return this.#kc;
  }

  get api(): AxiosInstance {
    return this.#api;
  }

  get ready(): boolean {
    return this.#kc.didInitialize;
  }

  get authenticated(): boolean | undefined {
    return this.#authenticated;
  }
}

export const ReactKeycloakContext = React.createContext<
  KeycloakClient | undefined
>(undefined);

export const useKeycloakClient = (client?: KeycloakClient) => {
  const ctx = React.useContext(ReactKeycloakContext);

  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const actualClient = client || ctx;

  if (!actualClient) {
    throw new Error(
      "No keycloak client set, use ReactKeycloakProvider to set one",
    );
  }

  React.useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = actualClient.subscribe(() => {
      forceUpdate();
    });

    return unsubscribe;
  }, [actualClient]);

  return actualClient;
};

export type ReactKeycloakProviderProps = {
  client: KeycloakClient;
  children?: React.ReactNode;
};

export const ReactKeycloakProvider = ({
  client,
  children,
}: ReactKeycloakProviderProps): React.JSX.Element => {
  React.useEffect(() => {
    client.mount();

    const requestInterceptor = client.api.interceptors.request.use(
      async (config) => {
        if (!config.headers["Authorization"] && client.kc && client.kc.token) {
          config.headers["Authorization"] = `Bearer ${client.kc.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    const responseInterceptor = client.api.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        const message = error?.response?.data.data;
        if (["No refresh token", "Failed to get token"].includes(message)) {
          return Promise.reject(error);
        }

        const prevRequest = error?.config;
        if (error?.response?.status === 400 && !prevRequest?.sent) {
          prevRequest.sent = true;
          window.location.href = "/";
          return Promise.reject(new Error("Refresh token expired"));
        } else if (error?.response?.status === 401 && !prevRequest?.sent) {
          try {
            prevRequest.sent = true;
            const accessToken = (await client.refreshToken()).toString();
            prevRequest.headers["Authorization"] = `Bearer ${accessToken}`;
            return client.api(prevRequest);
          } catch {
            return Promise.reject(new Error("Refresh token failed"));
          }
        }
        return Promise.reject(error);
      },
    );

    return () => {
      client.unmount();

      client.api.interceptors.request.eject(requestInterceptor);
      client.api.interceptors.response.eject(responseInterceptor);
    };
  }, [client]);

  return (
    <ReactKeycloakContext.Provider value={client}>
      {children}
    </ReactKeycloakContext.Provider>
  );
};
