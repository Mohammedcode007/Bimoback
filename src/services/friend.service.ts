import Friend from "../models/Friend";
import User from "../models/User";
import notificationService from "./notification.service";
import mongoose from "mongoose";

class FriendService {

  /* =====================================================
     SEND FRIEND REQUEST
  ===================================================== */

 async sendRequest(userId: string, targetId: string) {

  console.log("📌 [FriendService] sendRequest called");
  console.log("👤 Sender:", userId);
  console.log("🎯 Target:", targetId);

  if (userId === targetId)
    throw new Error("Invalid operation");

  const user = await User.findById(userId);
  const target = await User.findById(targetId);

  if (!user) throw new Error("Sender not found");
  if (!target) throw new Error("User not found");

  /* ================= BLOCK CHECK ================= */

  if (user.blockedUsers.includes(target._id))
    throw new Error("You blocked this user");

  if (target.blockedUsers.includes(user._id))
    throw new Error("You are blocked");

  /* ================= CHECK EXISTING RELATION ================= */

  const existing = await Friend.findOne({
    $or: [
      { requester: userId, recipient: targetId },
      { requester: targetId, recipient: userId }
    ]
  });

  console.log("📦 Existing relation:", existing);

  /* =====================================================
     CASE 1: RELATION EXISTS
  ===================================================== */

  if (existing) {

    /* ===== Already Friends ===== */
    if (existing.status === "accepted")
      throw new Error("Already friends");

    /* ===== Already Pending ===== */
    if (existing.status === "pending") {

      if (existing.requester.toString() === userId) {
        throw new Error("Request already sent");
      }

      // لو هو اللي كان باعت الطلب → نقبل بدلاً من إنشاء طلب جديد
      existing.status = "accepted";
      await existing.save();

      console.log("✅ Auto-accepted reverse request");

      await notificationService.create({
        recipient: targetId,
        sender: userId,
        type: "friend_accepted",
        body: "Friend request accepted"
      });

      return existing;
    }

    /* ===== If rejected / cancelled ===== */
    if (["rejected", "cancelled"].includes(existing.status)) {

      existing.requester = new mongoose.Types.ObjectId(userId);
      existing.recipient = new mongoose.Types.ObjectId(targetId);
      existing.status = "pending";

      await existing.save();

      console.log("♻️ Reused old relation as pending");

      await notificationService.create({
        recipient: targetId,
        sender: userId,
        type: "friend_request",
        body: "New friend request"
      });

      return existing;
    }

    /* ===== If blocked ===== */
    if (existing.status === "blocked")
      throw new Error("Cannot send request");
  }

  /* =====================================================
     CASE 2: NO RELATION EXISTS
  ===================================================== */

  const relation = await Friend.create({
    requester: userId,
    recipient: targetId,
    status: "pending"
  });

  console.log("🔥 After create requester:", relation.requester.toString());
console.log("🔥 After create recipient:", relation.recipient.toString());
  console.log("✅ New relation created:", relation);

  await notificationService.create({
    recipient: targetId,
    sender: userId,
    type: "friend_request",
    body: "New friend request"
  });

  return relation;
}



  /* =====================================================
     ACCEPT REQUEST
  ===================================================== */

  async accept(userId: string, targetId: string) {

    console.log("📌 [FriendService] accept called");
    console.log("👤 Accepter:", userId);
    console.log("🎯 Requester:", targetId);

    const relation = await Friend.findOne({
      requester: targetId,
      recipient: userId,
      status: "pending"
    });

    console.log("📦 Relation found:", relation);

    if (!relation)
      throw new Error("Request not found");

    relation.status = "accepted";
    await relation.save();

    console.log("✅ Relation accepted");

    await notificationService.create({
      recipient: targetId,
      sender: userId,
      type: "friend_accepted",
      body: "Friend request accepted"
    });

    console.log("🚀 Notification created for friend_accepted");

    return relation;
  }



  /* =====================================================
     REJECT REQUEST
  ===================================================== */

  async reject(userId: string, targetId: string) {

    console.log("📌 [FriendService] reject called");
    console.log("👤 Rejector:", userId);
    console.log("🎯 Requester:", targetId);

    const relation = await Friend.findOne({
      requester: targetId,
      recipient: userId,
      status: "pending"
    });

    console.log("📦 Relation found:", relation);

    if (!relation)
      throw new Error("Request not found");

    relation.status = "rejected";
    await relation.save();

    console.log("❌ Relation rejected");

    await notificationService.create({
      recipient: targetId,
      sender: userId,
      type: "system",
      body: "Friend request rejected"
    });

    console.log("🚀 Notification created for rejection");

    return { success: true };
  }



  /* =====================================================
     CANCEL REQUEST
  ===================================================== */

  async cancelRequest(userId: string, targetId: string) {

    console.log("📌 [FriendService] cancelRequest called");
    console.log("👤 Sender:", userId);
    console.log("🎯 Target:", targetId);

    const relation = await Friend.findOne({
      requester: userId,
      recipient: targetId,
      status: "pending"
    });

    console.log("📦 Relation found:", relation);

    if (!relation)
      throw new Error("Request not found");

    relation.status = "cancelled";
    await relation.save();

    console.log("🚫 Request cancelled");

    return { success: true };
  }


/* =====================================================
   GET FRIENDS
===================================================== */

// async getFriends(userId: string) {

//   console.log("📌 [FriendService] getFriends called");
//   console.log("👤 User ID:", userId);

//   const relations = await Friend.find({
//     status: "accepted",
//     $or: [
//       { requester: userId },
//       { recipient: userId }
//     ]
//   })
//     .populate("requester recipient", "username avatar isOnline lastSeen");

//   console.log("📦 Relations found:", relations);

//   const friends = relations.map((relation: any) => {
//     return relation.requester._id.toString() === userId
//       ? relation.recipient
//       : relation.requester;
//   });

//   console.log("👥 Final friends list:", friends);

//   return friends;
// }

async getFriends(userId: string) {

  console.log("📌 [FriendService] getFriends called");
  console.log("👤 User ID:", userId);

  const relations = await Friend.find({
    status: "accepted",
    $or: [
      { requester: userId },
      { recipient: userId }
    ]
  })
    // 🔥 إزالة تحديد الحقول لإرجاع كل بيانات اليوزر
    .populate("requester")
    .populate("recipient")
    .lean();

  console.log("📦 Relations found:", JSON.stringify(relations, null, 2));

  const friends = relations.map((relation: any) => {

    const friend =
      relation.requester._id.toString() === userId
        ? relation.recipient
        : relation.requester;

    return friend;
  });

  console.log("👥 Final friends list:", JSON.stringify(friends, null, 2));

  return friends;
}

/* =====================================================
   UNBLOCK USER
===================================================== */

async unblock(userId: string, targetId: string) {

  console.log("📌 [FriendService] unblock called");
  console.log("👤 User:", userId);
  console.log("🎯 Target:", targetId);

  await User.findByIdAndUpdate(userId, {
    $pull: { blockedUsers: targetId }
  });

  console.log("✅ User removed from blockedUsers");

  return { success: true };
}

/* =====================================================
   BLOCK USER
===================================================== */

async block(userId: string, targetId: string) {

  console.log("📌 [FriendService] block called");
  console.log("👤 Blocker:", userId);
  console.log("🎯 Target:", targetId);

  if (userId === targetId)
    throw new Error("Cannot block yourself");

  // إضافة المستخدم إلى blockedUsers
  await User.findByIdAndUpdate(userId, {
    $addToSet: { blockedUsers: targetId }
  });

  console.log("🚫 User added to blockedUsers");

  // حذف أي علاقة صداقة موجودة
  await Friend.deleteMany({
    $or: [
      { requester: userId, recipient: targetId },
      { requester: targetId, recipient: userId }
    ]
  });

  console.log("🗑 Any existing friendship removed");

  return { success: true };
}

  /* =====================================================
     REMOVE FRIEND
  ===================================================== */

  async remove(userId: string, targetId: string) {

    console.log("📌 [FriendService] remove called");

    const relation = await Friend.findOneAndDelete({
      $or: [
        { requester: userId, recipient: targetId },
        { requester: targetId, recipient: userId }
      ],
      status: "accepted"
    });

    console.log("🗑 Removed relation:", relation);

    if (!relation)
      throw new Error("Friend relation not found");

    return { success: true };
  }

}

export default new FriendService();
