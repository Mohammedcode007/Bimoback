// jwt.ts
import jwt from "jsonwebtoken";

export const signToken = (id: string) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET as string,
    {
      expiresIn: "30d"
    }
  );
};

export const verifyToken = (token: string) => {
  return jwt.verify(
    token,
    process.env.JWT_SECRET as string
  ) as { id: string };
};
