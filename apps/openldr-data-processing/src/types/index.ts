export interface MinioUploadResult {
  bucket: string;
  key: string;
  path: string;
  size: number;
}

export interface KeycloakConfig {
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  adminUsername?: string;
  adminPassword?: string;
}

export interface KeycloakUser {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified: boolean;
  attributes?: Record<string, string[]>;
}
