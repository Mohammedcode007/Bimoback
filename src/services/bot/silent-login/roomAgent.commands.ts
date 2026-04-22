import bcrypt from "bcryptjs";
import User from "../../../models/User";
import Room from "../../../models/Room";
import roomService from "../../room.service";

type AgentCommandResult = {
  handled: boolean;
  success?: boolean;
  message?: string;
  meta?: Record<string, any>;
};

function normalize(value?: string) {
  return String(value || "").trim();
}

function splitCommand(raw: string) {
  return normalize(raw).split("@").map((p) => p.trim());
}

function isExitCommand(parts: string[]) {
  return parts[0]?.toLowerCase() === "exit";
}

function buildRoomName(room: any) {
  return String(room?.name || "room");
}

async function findUserByUsername(username: string) {
  return User.findOne({
    atUsername: String(username || "").trim().toLowerCase(),
  }).select("_id username atUsername password");
}

async function ensureAgentNotInAnotherRoom(userId: string, roomId: string) {
  const exists = await Room.findOne({
    "roomAgent.userId": userId,
    _id: { $ne: roomId },
  }).select("_id name");

  if (exists) {
    return {
      ok: false,
      reason: "AGENT_ALREADY_IN_ANOTHER_ROOM",
      roomName: exists.name,
    };
  }

  return { ok: true };
}

async function attachAgentToRoom(room: any, user: any) {
  await Room.updateOne(
    { _id: room._id },
    {
      $set: {
        "roomAgent.enabled": true,
        "roomAgent.userId": user._id,
        "roomAgent.username": user.username,
        "roomAgent.joinedAt": new Date(),
      },
    }
  );
}

async function detachAgentFromRoom(room: any) {
  await Room.updateOne(
    { _id: room._id },
    {
      $set: {
        "roomAgent.enabled": false,
        "roomAgent.userId": null,
        "roomAgent.username": null,
        "roomAgent.joinedAt": null,
      },
    }
  );
}

async function joinRoomAsAgent(roomId: string, userId: string) {
  await roomService.joinRoom(roomId, userId);
}

async function leaveRoomAsAgent(roomId: string, userId: string) {
  await roomService.leaveRoom(roomId, userId);
}

export async function handleRoomAgentCommand(params: {
  roomId: string;
  raw: string;
}): Promise<AgentCommandResult> {
  const { roomId, raw } = params;

  const parts = splitCommand(raw);

  if (parts.length < 3) {
    return { handled: false };
  }

  const room = await Room.findById(roomId).select("name roomAgent type isLocked");
  if (!room) {
    return {
      handled: true,
      success: false,
      message: "الغرفة غير موجودة",
    };
  }

  // exit@username@room
  if (isExitCommand(parts)) {
    const username = parts[1];

    if (!username) {
      return {
        handled: true,
        success: false,
        message: "صيغة الخروج غير صحيحة",
      };
    }

    const agent = (room as any)?.roomAgent;

    if (!agent?.enabled || !agent?.userId) {
      return {
        handled: true,
        success: false,
        message: "لا يوجد بوت مرتبط بهذه الغرفة",
      };
    }

    const agentUser = await User.findById(agent.userId).select("_id username atUsername");
    if (!agentUser) {
      return {
        handled: true,
        success: false,
        message: "حساب البوت غير موجود",
      };
    }

    const wanted = String(username || "").trim().toLowerCase();
    const actual =
      String((agentUser as any).atUsername || agentUser.username || "")
        .trim()
        .toLowerCase();

    if (wanted !== actual) {
      return {
        handled: true,
        success: false,
        message: "هذا الحساب ليس بوت هذه الغرفة",
      };
    }

    await leaveRoomAsAgent(roomId, String(agentUser._id));
    await detachAgentFromRoom(room);

    return {
      handled: true,
      success: true,
      message: `تم خروج البوت من الغرفة ${buildRoomName(room)}`,
      meta: {
        action: "agent_exit",
        userId: String(agentUser._id),
      },
    };
  }

  // username@password@room
  const username = parts[0];
  const password = parts[1];

  if (!username || !password) {
    return {
      handled: true,
      success: false,
      message: "صيغة الأمر غير صحيحة",
    };
  }

  const user = await findUserByUsername(username);

  if (!user) {
    return {
      handled: true,
      success: false,
      message: "المستخدم غير موجود",
    };
  }

  if (!user.password) {
    return {
      handled: true,
      success: false,
      message: "هذا الحساب لا يدعم تسجيل الدخول بكلمة مرور",
    };
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return {
      handled: true,
      success: false,
      message: "كلمة المرور غير صحيحة",
    };
  }

  if ((room as any)?.roomAgent?.enabled) {
    return {
      handled: true,
      success: false,
      message: "يوجد بالفعل بوت داخل هذه الغرفة",
    };
  }

  const check = await ensureAgentNotInAnotherRoom(String(user._id), roomId);

  if (!check.ok) {
    return {
      handled: true,
      success: false,
      message: `هذا الحساب مستخدم كبوت في غرفة أخرى (${check.roomName})`,
    };
  }

  try {
    await joinRoomAsAgent(roomId, String(user._id));
  } catch (e: any) {
    return {
      handled: true,
      success: false,
      message: e?.message || "فشل دخول البوت إلى الغرفة",
    };
  }

  await attachAgentToRoom(room, user);

  return {
    handled: true,
    success: true,
    message: `تم ربط البوت ${user.username} بالغرفة ${buildRoomName(room)}`,
    meta: {
      action: "agent_login",
      userId: String(user._id),
    },
  };
}