
import { Server, Socket } from "socket.io";
import User from "../models/User";
import Friend from "../models/Friend";

/* =====================================================
   ACTIVE CONNECTIONS (Multi Device Support)
===================================================== */

const onlineUsers = new Map<string, Set<string>>();

/* =====================================================
   GET FRIENDS IDS
===================================================== */

const getFriendsIds = async (userId: string): Promise<string[]> => {

  const relations = await Friend.find({
    $or: [
      { requester: userId, status: "accepted" },
      { recipient: userId, status: "accepted" }
    ]
  }).select("requester recipient");

  return relations.map((relation: any) =>
    relation.requester.toString() === userId
      ? relation.recipient.toString()
      : relation.requester.toString()
  );
};

/* =====================================================
   BROADCAST PRESENCE
===================================================== */

const broadcastPresence = async (
  io: Server,
  userId: string,
  isOnline: boolean,
  lastSeen?: Date | null
) => {

  const friendsIds = await getFriendsIds(userId);

  const payload = {
    userId,
    isOnline,
    lastSeen: lastSeen || null
  };

  friendsIds.forEach(friendId => {
    io.to(friendId).emit("presence:update", payload);
  });
};

/* =====================================================
   PRESENCE SOCKET
===================================================== */

export const presenceSocket = async (
  io: Server,
  socket: Socket
) => {

  const userId: string = socket.data.userId;
  if (!userId) return;

  /* =====================================================
     CONNECT
  ===================================================== */

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId)!.add(socket.id);

  /* ===== First Active Connection Only ===== */

  if (onlineUsers.get(userId)!.size === 1) {

    const user = await User.findByIdAndUpdate(
      userId,
      { isOnline: true },
      { new: true, select: "isInvisible" }
    );

    if (!user) return;

    if (!user.isInvisible) {

      await broadcastPresence(
        io,
        userId,
        true,
        null
      );
    }
  }

  /* =====================================================
     DISCONNECT
  ===================================================== */

  socket.on("disconnect", async () => {

    const userSockets = onlineUsers.get(userId);
    if (!userSockets) return;

    userSockets.delete(socket.id);

    /* ===== No Remaining Connections ===== */

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

      if (!user.isInvisible) {

        await broadcastPresence(
          io,
          userId,
          false,
          now
        );
      }
    }
  });
};
export const isUserOnlineNow = (userId: string): boolean => {
  const sockets = onlineUsers.get(String(userId));
  return !!sockets && sockets.size > 0;
};