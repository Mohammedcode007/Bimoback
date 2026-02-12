import User from "../models/User";
import Friend from "../models/Friend";
import mongoose from "mongoose";

class UserService {

  async search(currentUserId: string, query: string) {

    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { username: { $regex: query, $options: "i" } },
        { atUsername: { $regex: query, $options: "i" } }
      ]
    }).limit(20);

    const userIds = users.map(u => u._id);

    const relations = await Friend.find({
      $or: [
        { requester: currentUserId, recipient: { $in: userIds } },
        { recipient: currentUserId, requester: { $in: userIds } }
      ]
    });

    const currentUser = await User.findById(currentUserId);

    const map = new Map();

    relations.forEach(r => {
      const id =
        r.requester.toString() === currentUserId
          ? r.recipient.toString()
          : r.requester.toString();

      map.set(id, r);
    });

    return users.map(user => {

      let status = "none";

      if (currentUser?.blockedUsers.includes(user._id))
        status = "blocked_by_me";
      else if (user.blockedUsers.includes(new mongoose.Types.ObjectId(currentUserId)))
        status = "blocked_me";
      else if (map.get(user._id.toString()))
        status = map.get(user._id.toString()).status;

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
