// room.routes.ts
import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";

import {
  // Room settings
  updateRoomInfo,
  changeRoomType,
  changeRoomPremium,
  toggleAntiSpam,
  getRoomDetails,

  // VIP
  addVip,
  removeVip,

  // Poll
  startPoll,
  votePoll,
  endPoll,

  // Voice
  setMaxVoiceSeats,
  raiseHand,
  clearRaisedHand,

  // Level / XP
  addXP,

  // Boost
  boostRoom,

  // Membership
  joinRoom,
  leaveRoom,
  autoRejoin,

  // Moderation
  kickUser,
  getBannedUsers,
  unbanOne,
  unbanMany,
  unbanAll,

  // Messages
  sendMessage,
  pinMessage,
  toggleReaction,
  getRoomMessages,

  // Users & Stats
  getRoomUsers,
  getRoomStats,

  // Delete
  deleteRoom,

  // Create / Get / Search
  createRoom,
  getRoomsByType,
  searchRooms,
  inviteToRoom,
  leaveAllMyActiveRooms,
  addRoomToFavorites,
  removeRoomFromFavorites,
  toggleRoomFavorite,
  getFavoriteRooms
} from "../controllers/room.controller";

const router = Router();

/* =====================================================
   PUBLIC ROUTES
===================================================== */

// GET /api/rooms?type=public&limit=30&page=1

// GET /api/rooms/search?q=chat&type=public&limit=30
router.get("/search", searchRooms);

/* =====================================================
   PROTECTED ROUTES
===================================================== */

router.use(protect);
/* =====================================================
   FAVORITE ROOMS
===================================================== */

// GET /api/rooms/favorites
router.get("/favorites", getFavoriteRooms);

// POST /api/rooms/:roomId/favorite
router.post("/:roomId/favorite", addRoomToFavorites);

// DELETE /api/rooms/:roomId/favorite
router.delete("/:roomId/favorite", removeRoomFromFavorites);

// PATCH /api/rooms/:roomId/favorite/toggle
router.patch("/:roomId/favorite/toggle", toggleRoomFavorite);
router.get("/", getRoomsByType);

// POST /api/rooms
router.post("/", createRoom);
// POST /api/rooms/leave-all-active
router.post("/leave-all-active", leaveAllMyActiveRooms);
/* =====================================================
   ROOM SETTINGS
===================================================== */

router.patch("/:roomId", updateRoomInfo);
router.patch("/:roomId/type", changeRoomType);
router.patch("/:roomId/premium", changeRoomPremium);
router.patch("/:roomId/anti-spam", toggleAntiSpam);
router.get("/:roomId/details", getRoomDetails);

/* =====================================================
   VIP
===================================================== */

router.post("/:roomId/vip", addVip);
router.delete("/:roomId/vip/:targetId", removeVip);

/* =====================================================
   POLL
===================================================== */

router.post("/:roomId/poll", startPoll);
router.patch("/:roomId/poll/vote", votePoll);
router.delete("/:roomId/poll", endPoll);

/* =====================================================
   VOICE
===================================================== */

router.patch("/:roomId/voice/seats", setMaxVoiceSeats);
router.post("/:roomId/voice/raise-hand", raiseHand);
router.delete("/:roomId/voice/raise-hand", clearRaisedHand);
/* =====================================================
   LEVEL / XP
===================================================== */

router.post("/:roomId/xp", addXP);

/* =====================================================
   BOOST
===================================================== */

router.post("/:roomId/boost", boostRoom);

/* =====================================================
   MEMBERSHIP
===================================================== */

router.post("/:roomId/join", joinRoom);
router.post("/:roomId/leave", leaveRoom);
router.get("/me/active-rooms", autoRejoin);

/* =====================================================
   MODERATION
===================================================== */

// Kick
router.post("/:roomId/kick/:targetId", kickUser);

// 🔴 BANNED MANAGEMENT
router.get("/:roomId/control/banned", getBannedUsers);
router.patch("/:roomId/control/unban/one", unbanOne);
router.patch("/:roomId/control/unban/many", unbanMany);
router.patch("/:roomId/control/unban/all", unbanAll);

/* =====================================================
   MESSAGES
===================================================== */

router.get("/:roomId/messages", getRoomMessages);
router.post("/:roomId/messages", sendMessage);
router.patch("/:roomId/messages/:messageId/pin", pinMessage);
router.post("/:roomId/messages/:messageId/reaction", toggleReaction);

/* =====================================================
   USERS & STATS
===================================================== */

router.get("/:roomId/users", getRoomUsers);
router.get("/:roomId/stats", getRoomStats);
router.post("/:roomId/invite", inviteToRoom);
/* =====================================================
   DELETE ROOM
===================================================== */

router.delete("/:roomId", deleteRoom);

export default router;