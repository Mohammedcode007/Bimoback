// export type BotLang = "ar" | "en";

// export type BotIntent =
//   | "start"
//   | "help"
//   | "unknown"
//   | "rooms"
//   | "account"
//   | "contact_support"
//   | "password_protected_room"
//   | "change_language"
//   | "join_room_by_credentials"
//   | "leave_room_by_credentials"
//   | "create_user"
//   | "room_bot_command";

// export type BotReplyPayload = {
//   handled: boolean;
//   intent: BotIntent;
//   text: string;
//   meta?: Record<string, any>;
// };

// export type JoinRoomByCredentialsPayload = {
//   username: string;
//   password: string;
//   roomName: string;
//   source: "bot" | "silent";
// };

// export type LeaveRoomByCredentialsPayload = {
//   username: string;
//   roomName: string;
//   source: "bot" | "silent";
// };

// export type CreateUserPayload = {
//   username: string;
//   password: string;
// };

// export type RoomBotCommandPayload = {
//   raw: string;
// };

// export type ParsedBotCommand =
//   | {
//       type: "join_room_by_credentials";
//       payload: JoinRoomByCredentialsPayload;
//     }
//   | {
//       type: "leave_room_by_credentials";
//       payload: LeaveRoomByCredentialsPayload;
//     }
//   | {
//       type: "create_user";
//       payload: CreateUserPayload;
//     }
//   | {
//       type: "room_bot_command";
//       payload: RoomBotCommandPayload;
//     }
//   | {
//       type: "text";
//       payload: {
//         text: string;
//       };
//     };

export type BotLang = "ar" | "en";

export type BotIntent =
  | "start"
  | "help"
  | "unknown"
  | "rooms"
  | "account"
  | "contact_support"
  | "password_protected_room"
  | "change_language"
  | "join_room_by_credentials"
  | "leave_room_by_credentials"
  | "create_user"
  | "transfer_coinz"
  | "room_bot_command";

export type BotReplyPayload = {
  handled: boolean;
  intent: BotIntent;
  text: string;
  meta?: Record<string, any>;
};

export type JoinRoomByCredentialsPayload = {
  username: string;
  password: string;
  roomName: string;
  source: "bot" | "silent";
};

export type LeaveRoomByCredentialsPayload = {
  username: string;
  roomName: string;
  source: "bot" | "silent";
};

export type CreateUserPayload = {
  username: string;
  password: string;
};

export type TransferCoinzPayload = {
  username: string;
  amount: number;
};

export type RoomBotCommandPayload = {
  raw: string;
};

export type ParsedBotCommand =
  | {
      type: "join_room_by_credentials";
      payload: JoinRoomByCredentialsPayload;
    }
  | {
      type: "leave_room_by_credentials";
      payload: LeaveRoomByCredentialsPayload;
    }
  | {
      type: "create_user";
      payload: CreateUserPayload;
    }
  | {
      type: "transfer_coinz";
      payload: TransferCoinzPayload;
    }
  | {
      type: "room_bot_command";
      payload: RoomBotCommandPayload;
    }
  | {
      type: "text";
      payload: {
        text: string;
      };
    };