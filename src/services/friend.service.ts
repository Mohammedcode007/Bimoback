import Friend from "../models/Friend";
import User from "../models/User";
import notificationService from "./notification.service";
import mongoose from "mongoose";

class FriendService {
  async getFriendIds(userId: string): Promise<string[]> {
    const rels = await Friend.find({
      status: "accepted",
      $or: [{ requester: userId }, { recipient: userId }],
    }).select("requester recipient");

    const ids = rels.map((r: any) => {
      const a = String(r.requester);
      const b = String(r.recipient);
      return a === String(userId) ? b : a;
    });

    // unique
    return Array.from(new Set(ids));
  }
  /* =====================================================
     SEND FRIEND REQUEST
  ===================================================== */

 async sendRequest(userId: string, targetId: string) {

 

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


    const relation = await Friend.findOne({
      requester: targetId,
      recipient: userId,
      status: "pending"
    });


    if (!relation)
      throw new Error("Request not found");

    relation.status = "accepted";
    await relation.save();


    await notificationService.create({
      recipient: targetId,
      sender: userId,
      type: "friend_accepted",
      body: "Friend request accepted"
    });


    return relation;
  }



  /* =====================================================
     REJECT REQUEST
  ===================================================== */

  async reject(userId: string, targetId: string) {

 

    const relation = await Friend.findOne({
      requester: targetId,
      recipient: userId,
      status: "pending"
    });


    if (!relation)
      throw new Error("Request not found");

    relation.status = "rejected";
    await relation.save();


    await notificationService.create({
      recipient: targetId,
      sender: userId,
      type: "system",
      body: "Friend request rejected"
    });


    return { success: true };
  }



  /* =====================================================
     CANCEL REQUEST
  ===================================================== */

  async cancelRequest(userId: string, targetId: string) {


    const relation = await Friend.findOne({
      requester: userId,
      recipient: targetId,
      status: "pending"
    });


    if (!relation)
      throw new Error("Request not found");

    relation.status = "cancelled";
    await relation.save();


    return { success: true };
  }


// async getFriends(userId: string) {

 

//   const relations = await Friend.find({
//     status: "accepted",
//     $or: [
//       { requester: userId },
//       { recipient: userId }
//     ]
//   })
//     // 🔥 إزالة تحديد الحقول لإرجاع كل بيانات اليوزر
//     .populate("requester")
//     .populate("recipient")
//     .lean();


//   const friends = relations.map((relation: any) => {

//     const friend =
//       relation.requester._id.toString() === userId
//         ? relation.recipient
//         : relation.requester;

//     return friend;
//   });


//   return friends;
// }
async getFriends(userId: string) {

  const relations = await Friend.find({
    status: "accepted",
    $or: [
      { requester: userId },
      { recipient: userId }
    ]
  })
    .populate("requester")
    .populate("recipient")
    .lean();

  const friends = relations.map((relation: any) => {

    const friend =
      relation.requester._id.toString() === userId
        ? relation.recipient
        : relation.requester;

    return friend;
  });

  // 🔥 ترتيب الأصدقاء: المتصلين أولاً
  friends.sort((a: any, b: any) => {
    if (a.isOnline === b.isOnline) return 0;
    return a.isOnline ? -1 : 1;
  });

  return friends;
}
/* =====================================================
   UNBLOCK USER
===================================================== */

async unblock(userId: string, targetId: string) {


  await User.findByIdAndUpdate(userId, {
    $pull: { blockedUsers: targetId }
  });


  return { success: true };
}

/* =====================================================
   BLOCK USER
===================================================== */

async block(userId: string, targetId: string) {

 
  if (userId === targetId)
    throw new Error("Cannot block yourself");

  // إضافة المستخدم إلى blockedUsers
  await User.findByIdAndUpdate(userId, {
    $addToSet: { blockedUsers: targetId }
  });


  // حذف أي علاقة صداقة موجودة
  await Friend.deleteMany({
    $or: [
      { requester: userId, recipient: targetId },
      { requester: targetId, recipient: userId }
    ]
  });


  return { success: true };
}

  /* =====================================================
     REMOVE FRIEND
  ===================================================== */

  async remove(userId: string, targetId: string) {


    const relation = await Friend.findOneAndDelete({
      $or: [
        { requester: userId, recipient: targetId },
        { requester: targetId, recipient: userId }
      ],
      status: "accepted"
    });


    if (!relation)
      throw new Error("Friend relation not found");

    return { success: true };
  }

}

export default new FriendService();
