import { Socket } from "socket.io";
import jwt, { JwtPayload } from "jsonwebtoken";

interface DecodedToken extends JwtPayload {
  id: string;
}

export const socketAuth = (
  socket: Socket,
  next: (err?: Error) => void
) => {
  try {
    let token: string | undefined;

    // 1️⃣ من handshake.auth
    if (socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }

    // 2️⃣ أو من headers (اختياري)
    if (!token && socket.handshake.headers.authorization) {
      const authHeader = socket.handshake.headers.authorization;

      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (!token) {
      return next(new Error("Socket authentication required"));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as DecodedToken;

    socket.data.userId = decoded.id;

    next();
  } catch (error) {
    return next(new Error("Invalid or expired token"));
  }
};
