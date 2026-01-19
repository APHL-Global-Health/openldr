import * as keycloakUtil from "../utils/keycloakUtil";
import * as userService from "./userService";
import { UserParams } from "../lib/types";

async function createUser({
  email,
  firstName,
  lastName,
  phoneNumber,
  temporaryPassword,
}: UserParams) {
  try {
    const keycloakUser = await keycloakUtil.createUser({
      email,
      firstName,
      lastName,
      phoneNumber,
      temporaryPassword,
    });
    return await userService.createUser({
      userId: keycloakUser["id"],
      email,
      firstName,
      lastName,
      phoneNumber,
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
}: UserParams) {
  try {
    await keycloakUtil.updateUser({
      userId,
      email,
      firstName,
      lastName,
      phoneNumber,
    });
    await userService.updateUser({
      userId,
      email,
      firstName,
      lastName,
      phoneNumber,
    });
  } catch (error) {
    throw error;
  }
}

async function deleteUser(id: string) {
  try {
    await keycloakUtil.deleteUser(id);
    await userService.deleteUser(id);
  } catch (error) {
    throw error;
  }
}

export { createUser, updateUser, deleteUser };
