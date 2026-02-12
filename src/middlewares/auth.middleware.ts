import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as { id: string };

    const exists = await User.exists({ _id: decoded.id });

    if (!exists) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    req.user = { id: decoded.id };

    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token failed"
    });
  }
};
