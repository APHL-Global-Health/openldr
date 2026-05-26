import { Router } from "express";
import * as userService from "../services/user.service";

const router = Router();

// Get all users
router.get("/", async (req, res) => {
  try {
    const filters = req.query || {};
    const users = await userService.getUsers(filters);
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user by ID
router.get("/:userId", async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.userId);

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new user
router.post("/", async (req, res) => {
  try {
    const userId = await userService.createUser(req.body);
    const user = await userService.getUserById(userId);

    res.status(201).json({
      success: true,
      data: { id: userId, ...user },
      message: "User created successfully",
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update user
router.put("/:userId", async (req, res) => {
  try {
    await userService.updateUser(req.params.userId, req.body);
    const user = await userService.getUserById(req.params.userId);

    res.json({
      success: true,
      data: user,
      message: "User updated successfully",
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete user
router.delete("/:userId", async (req, res) => {
  try {
    await userService.deleteUser(req.params.userId);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
