// generateToken.ts
import jwt from "jsonwebtoken";
import { JWT_EXPIRES_IN } from "./constants";

export const generateToken = (id: string) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET as string,
    { expiresIn: JWT_EXPIRES_IN }
  );
};
