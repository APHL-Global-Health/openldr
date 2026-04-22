import { keycloakService } from "../services/keycloak.service";
import { logger } from "../lib/logger";
import type { CreateUserDto, UpdateUserDto } from "../types";

/**
 * Get all users
 */
export const getUsers = async (filters?: any) => {
  try {
    return await keycloakService.getUsers(filters);
  } catch (error) {
    logger.error(error, "Failed to get users");
    throw error;
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (userId: string) => {
  try {
    return await keycloakService.getUserById(userId);
  } catch (error) {
    logger.error(error, `Failed to get user ${userId}`);
    throw error;
  }
};

/**
 * Create new user
 */
export const createUser = async (userData: CreateUserDto): Promise<string> => {
  try {
    // Validate required fields
    if (!userData.username || !userData.email) {
      throw new Error("Username and email are required");
    }

    // Check if user already exists
    const existingByUsername = await keycloakService.getUserByUsername(
      userData.username,
    );
    if (existingByUsername) {
      throw new Error(`Username "${userData.username}" already exists`);
    }

    const existingByEmail = await keycloakService.getUserByEmail(
      userData.email,
    );
    if (existingByEmail) {
      throw new Error(`Email "${userData.email}" already exists`);
    }

    // Create user in Keycloak
    const userId = await keycloakService.createUser({
      username: userData.username,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      enabled: userData.enabled !== undefined ? userData.enabled : true,
      emailVerified:
        userData.emailVerified !== undefined ? userData.emailVerified : false,
      credentials: userData.credentials || [],
      attributes: userData.attributes || {},
    });

    logger.info(`User created: ${userData.username} (${userId})`);

    return userId;
  } catch (error) {
    logger.error(error, "Failed to create user");
    throw error;
  }
};

/**
 * Update user
 */
export const updateUser = async (
  userId: string,
  updateData: UpdateUserDto,
): Promise<void> => {
  try {
    const user = await keycloakService.getUserById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Update user in Keycloak
    await keycloakService.updateUser(userId, {
      ...user,
      firstName:
        updateData.firstName !== undefined
          ? updateData.firstName
          : user.firstName,
      lastName:
        updateData.lastName !== undefined ? updateData.lastName : user.lastName,
      email: updateData.email !== undefined ? updateData.email : user.email,
      enabled:
        updateData.enabled !== undefined ? updateData.enabled : user.enabled,
      emailVerified:
        updateData.emailVerified !== undefined
          ? updateData.emailVerified
          : user.emailVerified,
      attributes:
        updateData.attributes !== undefined
          ? updateData.attributes
          : user.attributes,
    });

    logger.info(`User updated: ${userId}`);
  } catch (error) {
    logger.error(error, `Failed to update user ${userId}`);
    throw error;
  }
};

/**
 * Delete user
 */
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    const user = await keycloakService.getUserById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Delete user from Keycloak
    await keycloakService.deleteUser(userId);

    logger.info(`User deleted: ${userId}`);
  } catch (error) {
    logger.error(error, `Failed to delete user ${userId}`);
    throw error;
  }
};
