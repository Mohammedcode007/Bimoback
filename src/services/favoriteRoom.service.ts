import mongoose, { Types } from "mongoose";
import FavoriteRoom from "../models/FavoriteRoom";
import Room from "../models/Room";

class FavoriteRoomService {
  private isValidObjectId(id: string) {
    return Types.ObjectId.isValid(String(id || ""));
  }

  private toObjectId(id: string) {
    if (!this.isValidObjectId(id)) {
      throw new Error("Invalid id");
    }

    return new Types.ObjectId(id);
  }

  async add(userId: string, roomId: string) {
    if (!this.isValidObjectId(userId)) {
      throw new Error("Invalid user id");
    }

    if (!this.isValidObjectId(roomId)) {
      throw new Error("Invalid room id");
    }

    const room = await Room.findOne({
      _id: roomId,
      isSuspended: { $ne: true },
    }).select("_id");

    if (!room) {
      throw new Error("Room not found");
    }

    await FavoriteRoom.updateOne(
      {
        user: this.toObjectId(userId),
        room: this.toObjectId(roomId),
      },
      {
        $setOnInsert: {
          user: this.toObjectId(userId),
          room: this.toObjectId(roomId),
        },
      },
      {
        upsert: true,
      }
    );

    return {
      roomId,
      isFavorite: true,
    };
  }

  async remove(userId: string, roomId: string) {
    if (!this.isValidObjectId(userId)) {
      throw new Error("Invalid user id");
    }

    if (!this.isValidObjectId(roomId)) {
      throw new Error("Invalid room id");
    }

    await FavoriteRoom.deleteOne({
      user: this.toObjectId(userId),
      room: this.toObjectId(roomId),
    });

    return {
      roomId,
      isFavorite: false,
    };
  }

  async toggle(userId: string, roomId: string) {
    if (!this.isValidObjectId(userId)) {
      throw new Error("Invalid user id");
    }

    if (!this.isValidObjectId(roomId)) {
      throw new Error("Invalid room id");
    }

    const userObjectId = this.toObjectId(userId);
    const roomObjectId = this.toObjectId(roomId);

    const exists = await FavoriteRoom.findOne({
      user: userObjectId,
      room: roomObjectId,
    }).select("_id");

    if (exists) {
      await FavoriteRoom.deleteOne({ _id: exists._id });

      return {
        roomId,
        isFavorite: false,
      };
    }

    const room = await Room.findOne({
      _id: roomObjectId,
      isSuspended: { $ne: true },
    }).select("_id");

    if (!room) {
      throw new Error("Room not found");
    }

    await FavoriteRoom.create({
      user: userObjectId,
      room: roomObjectId,
    });

    return {
      roomId,
      isFavorite: true,
    };
  }

  async isFavorite(userId: string, roomId: string) {
    if (!this.isValidObjectId(userId) || !this.isValidObjectId(roomId)) {
      return {
        roomId,
        isFavorite: false,
      };
    }

    const exists = await FavoriteRoom.exists({
      user: this.toObjectId(userId),
      room: this.toObjectId(roomId),
    });

    return {
      roomId,
      isFavorite: Boolean(exists),
    };
  }

  async list(userId: string, page = 1, limit = 30) {
    if (!this.isValidObjectId(userId)) {
      throw new Error("Invalid user id");
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 30));
    const skip = (safePage - 1) * safeLimit;

    const filter = {
      user: this.toObjectId(userId),
    };

    const [items, total] = await Promise.all([
      FavoriteRoom.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate({
          path: "room",
          match: {
            isSuspended: { $ne: true },
          },
          select:
            "name description avatar cover type maxUsers usersCount messagesCount boostPoints isVerified premiumLevel isLocked slowModeSeconds antiSpamEnabled level xp tags createdAt updatedAt",
        })
        .lean(),

      FavoriteRoom.countDocuments(filter),
    ]);

    const rooms = items
      .map((item: any) => {
        if (!item?.room) return null;

        return {
          ...item.room,
          isFavorite: true,
          favoriteCreatedAt: item.createdAt,
        };
      })
      .filter(Boolean);

    return {
      items: rooms,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit),
        hasMore: skip + rooms.length < total,
      },
    };
  }

  async getFavoriteRoomIds(userId: string, roomIds: string[]) {
    if (!this.isValidObjectId(userId)) {
      return new Set<string>();
    }

    const validRoomIds = Array.from(
      new Set(
        (roomIds || [])
          .map((id) => String(id || "").trim())
          .filter((id) => this.isValidObjectId(id))
      )
    );

    if (!validRoomIds.length) {
      return new Set<string>();
    }

    const favorites = await FavoriteRoom.find({
      user: this.toObjectId(userId),
      room: {
        $in: validRoomIds.map((id) => this.toObjectId(id)),
      },
    })
      .select("room")
      .lean();

    return new Set<string>(
      favorites.map((item: any) => String(item.room))
    );
  }

  async decorateRoomsWithFavorite(userId: string, rooms: any[]) {
    if (!Array.isArray(rooms) || !rooms.length) {
      return [];
    }

    const roomIds = rooms
      .map((room: any) => String(room?._id || room?.id || ""))
      .filter(Boolean);

    const favoriteSet = await this.getFavoriteRoomIds(userId, roomIds);

    return rooms.map((room: any) => {
      const plainRoom =
        typeof room?.toObject === "function" ? room.toObject() : room;

      return {
        ...plainRoom,
        isFavorite: favoriteSet.has(String(plainRoom?._id || plainRoom?.id || "")),
      };
    });
  }
}

export default new FavoriteRoomService();