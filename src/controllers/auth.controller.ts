
import { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  toggleInvisibleStatus
} from "../services/auth.service";

/* =========================
   REGISTER
========================= */


export const register = async (req: Request, res: Response) => {
  try {
    const { username, password, role } = req.body;

    const adminKey = req.headers["x-admin-key"]; // ✅ من Postman

    const data = await registerUser(username, password, role, adminKey);

    return res.status(201).json(data);
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};
/* =========================
   LOGIN
========================= */
/* =========================
   GOOGLE AUTH
========================= */

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { idToken, username, email, photo } = req.body;

    const data = await authWithGoogle({
      idToken,
      username,
      email,
      photo
    });

    return res.status(200).json({
      ...data,
      presence: {
        status: data.user.isInvisible ? "offline" : "online"
      }
    });
  } catch (error: any) {
    return res.status(401).json({ message: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {

    const { username, password } = req.body;

    const data = await loginUser(username, password);

    return res.json({
      ...data,
      presence: {
        status: data.user.isInvisible
          ? "offline"
          : "online"
      }
    });

  } catch (error: any) {
    return res.status(401).json({ message: error.message });
  }
};


/* =========================
   LOGOUT
========================= */

export const logout = async (req: Request, res: Response) => {
  try {

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;

    await logoutUser(userId);

    return res.json({
      message: "Logged out successfully",
      presence: {
        status: "offline"
      }
    });

  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};


/* =========================
   TOGGLE INVISIBLE
========================= */

export const toggleInvisible = async (req: Request, res: Response) => {
  try {

   

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;
    const { invisible } = req.body;

  

    if (typeof invisible !== "boolean") {
      return res.status(400).json({ message: "Invalid value" });
    }

    const data = await toggleInvisibleStatus(userId, invisible);

   

    return res.json({
      success: true,
      isInvisible: data.isInvisible
    });

  } catch (error: any) {

   

    return res.status(400).json({ message: error.message });
  }
};
