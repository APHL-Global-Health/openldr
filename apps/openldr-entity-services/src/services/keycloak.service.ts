import axios, { type AxiosInstance } from "axios";
import { logger } from "../lib/logger";
import type { KeycloakConfig, KeycloakUser, CreateUserRequest } from "../types";

const IsDev = process.env.NODE_ENV === "development";

class KeycloakService {
  private config: KeycloakConfig;
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.config = {
      baseUrl: IsDev
        ? process.env.KEYCLOAK_PUBLIC_URL!
        : process.env.KEYCLOAK_BASE_URL!,
      realm: process.env.KEYCLOAK_REALM!,
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      adminUsername: process.env.KEYCLOAK_ADMIN_USER!,
      adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD!,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Get admin access token
   */
  private async getAdminToken(): Promise<string | null> {
    try {
      // Return cached token if still valid
      if (this.accessToken && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      const response = await axios.post(
        `${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/token`,
        new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 90% of the actual expiry time
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000 * 0.9;

      return this.accessToken;
    } catch (error) {
      logger.error(error, "Failed to get Keycloak admin token");
      throw new Error("Failed to authenticate with Keycloak");
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<KeycloakUser | null> {
    try {
      const token = await this.getAdminToken();

      const response = await this.client.get(
        `/admin/realms/${this.config.realm}/users/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error(`Failed to get user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<KeycloakUser | null> {
    try {
      const token = await this.getAdminToken();

      const response = await this.client.get(
        `/admin/realms/${this.config.realm}/users`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            username: username,
            exact: true,
          },
        },
      );

      const users = response.data;
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      logger.error(error, `Failed to get user by username ${username}`);
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<KeycloakUser | null> {
    try {
      const token = await this.getAdminToken();

      const response = await this.client.get(
        `/admin/realms/${this.config.realm}/users`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            email: email,
            exact: true,
          },
        },
      );

      const users = response.data;
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      logger.error(error, `Failed to get user by email ${email}`);
      throw error;
    }
  }

  /**
   * Create a new user
   */
  async createUser(userData: CreateUserRequest): Promise<string> {
    try {
      const token = await this.getAdminToken();

      const response = await this.client.post(
        `/admin/realms/${this.config.realm}/users`,
        userData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      // Keycloak returns the user ID in the Location header
      const location = response.headers.location;
      const userId = location?.split("/").pop();

      if (!userId) {
        throw new Error("Failed to get created user ID");
      }

      logger.info(`Created user: ${userData.username} (${userId})`);
      return userId;
    } catch (error: any) {
      if (error.response?.status === 409) {
        throw new Error("User already exists");
      }
      logger.error("Failed to create user:", error);
      throw error;
    }
  }

  /**
   * Update user attributes (for lab association)
   */
  async updateUserAttributes(
    userId: string,
    attributes: Record<string, string[]>,
  ): Promise<void> {
    try {
      const token = await this.getAdminToken();

      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      await this.client.put(
        `/admin/realms/${this.config.realm}/users/${userId}`,
        {
          ...user,
          attributes: {
            ...user.attributes,
            ...attributes,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      logger.info(`Updated attributes for user ${userId}`);
    } catch (error) {
      logger.error(error, `Failed to update user attributes for ${userId}`);
      throw error;
    }
  }

  /**
   * Add lab ID to user attributes
   */
  async assignUserToLab(
    userId: string,
    labId: string,
    role: string,
  ): Promise<void> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const currentLabIds = user.attributes?.lab_ids || [];
      const currentRoles = user.attributes?.lab_roles || [];

      await this.updateUserAttributes(userId, {
        lab_ids: [...currentLabIds, labId],
        lab_roles: [...currentRoles, `${labId}:${role}`],
      });

      logger.info(`Assigned user ${userId} to lab ${labId} with role ${role}`);
    } catch (error) {
      logger.error(error, `Failed to assign user to lab`);
      throw error;
    }
  }

  /**
   * Remove lab ID from user attributes
   */
  async removeUserFromLab(userId: string, labId: string): Promise<void> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const currentLabIds = user.attributes?.lab_ids || [];
      const currentRoles = user.attributes?.lab_roles || [];

      await this.updateUserAttributes(userId, {
        lab_ids: currentLabIds.filter((id) => id !== labId),
        lab_roles: currentRoles.filter((role) => !role.startsWith(`${labId}:`)),
      });

      logger.info(`Removed user ${userId} from lab ${labId}`);
    } catch (error) {
      logger.error(error, `Failed to remove user from lab`);
      throw error;
    }
  }

  /**
   * Verify user token
   */
  async verifyToken(token: string): Promise<any> {
    try {
      const response = await this.client.post(
        `/realms/${this.config.realm}/protocol/openid-connect/token/introspect`,
        new URLSearchParams({
          token: token,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      return response.data;
    } catch (error) {
      logger.error(error, "Failed to verify token");
      throw error;
    }
  }

  /**
   * Get users in a specific role
   */
  async getUsersByRole(roleName: string): Promise<KeycloakUser[]> {
    try {
      const token = await this.getAdminToken();

      const response = await this.client.get(
        `/admin/realms/${this.config.realm}/roles/${roleName}/users`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      logger.error(error, `Failed to get users by role ${roleName}`);
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(userId: string, roleName: string): Promise<void> {
    try {
      const token = await this.getAdminToken();

      // Get role by name
      const roleResponse = await this.client.get(
        `/admin/realms/${this.config.realm}/roles/${roleName}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const role = roleResponse.data;

      // Assign role to user
      await this.client.post(
        `/admin/realms/${this.config.realm}/users/${userId}/role-mappings/realm`,
        [role],
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      logger.info(`Assigned role ${roleName} to user ${userId}`);
    } catch (error) {
      logger.error(error, `Failed to assign role:`, error);
      throw error;
    }
  }

  async getUsers(_filters?: any): Promise<KeycloakUser[]> {
    try {
      const token = await this.getAdminToken();
      const response = await this.client.get(
        `/admin/realms/${this.config.realm}/users`, //?first=0&max=100
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      logger.error(error, "Error fetching Keycloak users");
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(userId: string, userData: any): Promise<void> {
    try {
      const token = await this.getAdminToken();

      await this.client.put(
        `/admin/realms/${this.config.realm}/users/${userId}`,
        userData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      logger.info(`Updated user ${userId}`);
    } catch (error) {
      logger.error(error, `Failed to update user ${userId}`);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      const token = await this.getAdminToken();

      await this.client.delete(
        `/admin/realms/${this.config.realm}/users/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      logger.info(`Deleted user ${userId}`);
    } catch (error) {
      logger.error(error, `Failed to delete user ${userId}`);
      throw error;
    }
  }
}

const service = new KeycloakService();

export { service as keycloakService };
