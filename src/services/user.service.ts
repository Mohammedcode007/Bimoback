import User from "../models/User";
import Friend from "../models/Friend";
import mongoose from "mongoose";

class UserService {

  async search(currentUserId: string, query: string) {

    const currentObjectId = new mongoose.Types.ObjectId(currentUserId);

    /* ================= FIND USERS ================= */

    const users = await User.find({
      _id: { $ne: currentObjectId },
      $or: [
        { username: { $regex: query, $options: "i" } },
        { atUsername: { $regex: query, $options: "i" } }
      ]
    }).limit(20);

    const userIds = users.map(u => u._id);

    /* ================= FIND RELATIONS ================= */

    const relations = await Friend.find({
      $or: [
        { requester: currentObjectId, recipient: { $in: userIds } },
        { recipient: currentObjectId, requester: { $in: userIds } }
      ]
    });

    const currentUser = await User.findById(currentObjectId);

    /* ================= MAP RELATIONS ================= */

    const relationMap = new Map<string, any>();

    relations.forEach(relation => {

      const otherUserId =
        relation.requester.toString() === currentUserId
          ? relation.recipient.toString()
          : relation.requester.toString();

      relationMap.set(otherUserId, relation);
    });

    /* ================= BUILD RESPONSE ================= */

    return users.map(user => {

      let status:
        | "none"
        | "pending_sent"
        | "pending_received"
        | "accepted"
        | "blocked_by_me"
        | "blocked_me" = "none";

      /* ===== BLOCK CHECK ===== */

      if (currentUser?.blockedUsers.some(id => id.equals(user._id))) {
        status = "blocked_by_me";
      }

      else if (user.blockedUsers.some(id => id.equals(currentObjectId))) {
        status = "blocked_me";
      }

      /* ===== RELATION CHECK ===== */

      const relation = relationMap.get(user._id.toString());

      if (relation) {

        if (relation.status === "accepted") {
          status = "accepted";
        }

        else if (relation.status === "pending") {

          if (relation.requester.toString() === currentUserId)
            status = "pending_sent";
          else
            status = "pending_received";
        }

        else if (relation.status === "blocked") {

          if (relation.blockedBy?.toString() === currentUserId)
            status = "blocked_by_me";
          else
            status = "blocked_me";
        }
      }

      return {
        _id: user._id,
        username: user.username,
        atUsername: user.atUsername,
        avatar: user.avatar,
        isOnline: user.isOnline,
        relationshipStatus: status
      };
    });
  }
}

export default new UserService();
