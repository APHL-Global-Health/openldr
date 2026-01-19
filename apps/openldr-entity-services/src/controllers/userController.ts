import express from "express";
import * as authService from "../services/authService";
import { getAllUsers } from "../services/userService";
import { DynamicModelManager } from "@openldr/internal-database";

export const router = (modelManager: DynamicModelManager) => {
  const _router = express.Router();

  _router.post("/create-user", async (req, res) => {
    const { firstName, lastName, email, phoneNumber, temporaryPassword } =
      req.body;

    try {
      const newUser = await authService.createUser({
        firstName: firstName,
        lastName: lastName,
        email: email,
        phoneNumber: phoneNumber,
        temporaryPassword: temporaryPassword,
      });

      res.status(200).json(newUser);
    } catch (error: any) {
      res.status(500).send(error.response.data || error.message);
    }
  });

  _router.get("", async (req, res) => {
    const users = await getAllUsers();

    res.status(200).json(users);
  });

  _router.put("/update-user/:id", async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, email, phoneNumber } = req.body;

    try {
      await authService.updateUser({
        userId: id,
        firstName: firstName,
        lastName: lastName,
        email: email,
        phoneNumber: phoneNumber,
      });

      res.status(200).send(`User updated successfully`);
    } catch (error: any) {
      console.error(error);

      res.status(500).send(error.message);
    }
  });

  _router.delete("/delete-user/:id", async (req, res) => {
    const { id } = req.params;

    try {
      await authService.deleteUser(id);
      res.status(200).send(`User deleted successfully`);
    } catch (error: any) {
      console.error(error);

      res.status(500).send(error.message);
    }
  });

  return _router;
};
