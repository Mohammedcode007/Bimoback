import { Server, Socket } from "socket.io";
import User from "../models/User";
import Friend from "../models/Friend";

const onlineUsers = new Map<string, Set<string>>();

export const presenceSocket = async (io: Server, socket: Socket) => {

  const userId: string = socket.data.userId;
  if (!userId) return;

  /* ================= CONNECT ================= */

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId)!.add(socket.id);

  if (onlineUsers.get(userId)!.size === 1) {

    await User.findByIdAndUpdate(userId, {
      isOnline: true
    });

    const relations = await Friend.find({
      $or: [
        { requester: userId, status: "accepted" },
        { recipient: userId, status: "accepted" }
      ]
    });

    const friendsIds = relations.map((relation: any) =>
      relation.requester.toString() === userId
        ? relation.recipient.toString()
        : relation.requester.toString()
    );

    friendsIds.forEach(friendId => {
      io.to(friendId).emit("presence:update", {
        userId,
        status: "online"
      });
    });
  }

  /* ================= DISCONNECT ================= */

  socket.on("disconnect", async () => {

    const userSockets = onlineUsers.get(userId);
    if (!userSockets) return;

    userSockets.delete(socket.id);

    if (userSockets.size === 0) {

      onlineUsers.delete(userId);

      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date()
      });

      const relations = await Friend.find({
        $or: [
          { requester: userId, status: "accepted" },
          { recipient: userId, status: "accepted" }
        ]
      });

      const friendsIds = relations.map((relation: any) =>
        relation.requester.toString() === userId
          ? relation.recipient.toString()
          : relation.requester.toString()
      );

      friendsIds.forEach(friendId => {
        io.to(friendId).emit("presence:update", {
          userId,
          status: "offline",
          lastSeen: new Date()
        });
      });
    }
  });
};
