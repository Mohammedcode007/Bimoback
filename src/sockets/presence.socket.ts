import { Server, Socket } from "socket.io";
import User from "../models/User";
import Friend from "../models/Friend";

const onlineUsers = new Map<string, Set<string>>();

export const presenceSocket = async (io: Server, socket: Socket) => {

  const userId: string = socket.data.userId;
  if (!userId) return;

  /* =====================================================
     CONNECT
  ===================================================== */

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId)!.add(socket.id);

  // أول اتصال فقط
  if (onlineUsers.get(userId)!.size === 1) {

    const user = await User.findByIdAndUpdate(
      userId,
      { isOnline: true },
      { new: true, select: "isInvisible" }
    );

    if (!user) return;

    // لا نبث إذا المستخدم مخفي
    if (!user.isInvisible) {

      const relations = await Friend.find({
        $or: [
          { requester: userId, status: "accepted" },
          { recipient: userId, status: "accepted" }
        ]
      }).select("requester recipient");

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
  }

  /* =====================================================
     DISCONNECT
  ===================================================== */

  socket.on("disconnect", async () => {

    const userSockets = onlineUsers.get(userId);
    if (!userSockets) return;

    userSockets.delete(socket.id);

    // لو لا يوجد أي اتصال آخر
    if (userSockets.size === 0) {

      onlineUsers.delete(userId);

      const now = new Date();

      const user = await User.findByIdAndUpdate(
        userId,
        {
          isOnline: false,
          lastSeen: now
        },
        { new: true, select: "isInvisible" }
      );

      if (!user) return;

      // لا نبث إذا مخفي
      if (!user.isInvisible) {

        const relations = await Friend.find({
          $or: [
            { requester: userId, status: "accepted" },
            { recipient: userId, status: "accepted" }
          ]
        }).select("requester recipient");

        const friendsIds = relations.map((relation: any) =>
          relation.requester.toString() === userId
            ? relation.recipient.toString()
            : relation.requester.toString()
        );

        friendsIds.forEach(friendId => {
          io.to(friendId).emit("presence:update", {
            userId,
            status: "offline",
            lastSeen: now
          });
        });
      }
    }
  });
};
