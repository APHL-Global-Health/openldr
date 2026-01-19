import { models } from "@openldr/internal-database";
import { UserParams } from "../lib/types";
const { UserModel } = models;

async function createUser({
  userId,
  username,
  email,
  firstName,
  lastName,
  phoneNumber,
  role,
  facilityId,
}: UserParams) {
  try {
    return await UserModel.create({
      userId: userId!,
      //username, //<--Does not exist
      email,
      firstName,
      lastName,
      phoneNumber,
      //role,  //<--Does not exist
      //facilityId, //<--Does not exist
    });
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
}

async function getUserById(userId: string) {
  try {
    return await UserModel.findByPk(userId);
  } catch (error) {
    console.error("Error getting user by ID:", error);
    throw error;
  }
}

/*async function getUserByUsername(username: string) {
  try {
    return await UserModel.findOne({
      where: {
        username,
      },
    });
  } catch (error) {
    console.error("Error getting user by username:", error);
    throw error;
  }
}*/

async function getAllUsers() {
  try {
    return UserModel.findAll();
  } catch (error) {
    console.error("Error getting all users:", error);
    throw error;
  }
}

async function updateUser({
  userId,
  firstName,
  lastName,
  email,
  phoneNumber,
}: UserParams) {
  try {
    return await UserModel.update(
      { firstName, lastName, email, phoneNumber },
      {
        where: { userId },
      }
    );
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
}

async function deleteUser(userId: string) {
  try {
    return await UserModel.destroy({
      where: { userId },
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}

export {
  createUser,
  getUserById,
  //   getUserByUsername,
  getAllUsers,
  updateUser,
  deleteUser,
};
