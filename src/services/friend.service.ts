import { getIO } from "../config/socket";
import Friend from "../models/Friend";
import User from "../models/User";
import notificationService from "./notification.service";

class FriendService {

    /* =====================================================
       SEND FRIEND REQUEST
    ===================================================== */

    async sendRequest(userId: string, targetId: string) {

        if (userId === targetId)
            throw new Error("Invalid operation");

        const user = await User.findById(userId);
        const target = await User.findById(targetId);

        if (!target) throw new Error("User not found");

        if (user?.blockedUsers.includes(target._id))
            throw new Error("You blocked this user");

        if (target.blockedUsers.includes(user!._id))
            throw new Error("You are blocked");

        const existing = await Friend.findOne({
            requester: { $in: [userId, targetId] },
            recipient: { $in: [userId, targetId] }
        });

        if (existing)
            throw new Error("Relation already exists");

        const relation = await Friend.create({
            requester: userId,
            recipient: targetId,
            status: "pending"
        });

        console.log("📤 Friend request created");

        /* ==== Create Notification ==== */
        const notification = await notificationService.create({
            recipient: targetId,
            sender: userId,
            type: "friend_request",
            body: "New friend request"
        });

        /* ==== Emit Realtime ==== */
        const io = getIO();

        io.to(targetId.toString())
            .emit("notification:new", notification);

        console.log("🔔 Notification emitted");

        return relation;
    }

    /* =====================================================
       ACCEPT REQUEST
    ===================================================== */

    async accept(userId: string, targetId: string) {

        const relation = await Friend.findOneAndUpdate(
            {
                requester: { $in: [userId, targetId] },
                recipient: { $in: [userId, targetId] },
                status: "pending"
            },
            { status: "accepted" },
            { new: true }
        );

        if (!relation)
            throw new Error("Request not found");

        console.log("✅ Friend request accepted");

        const notification = await notificationService.create({
            recipient: targetId,
            sender: userId,
            type: "friend_accepted",
            body: "Friend request accepted"
        });

        const io = getIO();

        io.to(targetId.toString())
            .emit("notification:new", notification);

        io.to(targetId.toString())
            .emit("friend:accepted", { userId });

        return relation;
    }

    /* =====================================================
       REMOVE FRIEND
    ===================================================== */

    async remove(userId: string, targetId: string) {

        await Friend.findOneAndDelete({
            requester: { $in: [userId, targetId] },
            recipient: { $in: [userId, targetId] },
            status: "accepted"
        });

        console.log("🗑 Friend removed");

        const io = getIO();

        io.to(targetId.toString())
            .emit("friend:removed", { userId });

        return { success: true };
    }

    /* =====================================================
       BLOCK USER
    ===================================================== */

    async block(userId: string, targetId: string) {

        await User.findByIdAndUpdate(userId, {
            $addToSet: { blockedUsers: targetId }
        });

        await Friend.findOneAndUpdate(
            {
                requester: { $in: [userId, targetId] },
                recipient: { $in: [userId, targetId] }
            },
            { status: "blocked", blockedBy: userId }
        );

        console.log("⛔ User blocked");

        const io = getIO();

        io.to(targetId.toString())
            .emit("friend:blocked", { userId });

        return { success: true };
    }

    /* =====================================================
       UNBLOCK USER
    ===================================================== */

    async unblock(userId: string, targetId: string) {

        await User.findByIdAndUpdate(userId, {
            $pull: { blockedUsers: targetId }
        });

        await Friend.findOneAndDelete({
            requester: { $in: [userId, targetId] },
            recipient: { $in: [userId, targetId] },
            status: "blocked"
        });

        console.log("🔓 User unblocked");

        return { success: true };
    }

    /* =====================================================
     CANCEL FRIEND REQUEST
  ===================================================== */

    async cancelRequest(userId: string, targetId: string) {

        const relation = await Friend.findOneAndDelete({
            requester: userId,         // مهم: فقط المرسل يستطيع الإلغاء
            recipient: targetId,
            status: "pending"
        });

        if (!relation)
            throw new Error("Request not found or already handled");

        console.log("❌ Friend request cancelled");

        const io = getIO();

        io.to(targetId.toString())
            .emit("friend:cancelled", { userId });

        return { success: true };
    }

    /* =====================================================
       GET FRIENDS
    ===================================================== */

    async getFriends(userId: string) {

        return await Friend.find({
            $or: [
                { requester: userId, status: "accepted" },
                { recipient: userId, status: "accepted" }
            ]
        }).populate("requester recipient", "username avatar isOnline");
    }

}

export default new FriendService();
