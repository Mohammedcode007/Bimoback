// // src/services/cricket/commands-runner.ts

// import { parseCricketCommand } from "./cricket.commands";
// import { cricketService } from "./cricket.service";

// type HandleInput = {
//   text: string;
//   userId: string;
//   username: string;
//   roomId: string;
//   allRoomIds: string[];
// };

// export async function handleCricketCommand(input: HandleInput) {
//   const parsed = parseCricketCommand(input.text);
//   if (!parsed) return null;

//   const user = {
//     userId: input.userId,
//     username: input.username,
//     roomId: input.roomId,
//   };

//   if (parsed.action === "start") {
//     return cricketService.startGameLobby(user, parsed.playersRequired, input.allRoomIds);
//   }

//   if (parsed.action === "join") {
//     return cricketService.joinGame(user, parsed.gameId);
//   }

//   if (parsed.action === "hit") {
//     return cricketService.hitBall(user, parsed.gameId);
//   }

//   if (parsed.action === "top") {
//     return cricketService.topWins(input.roomId);
//   }

//   if (parsed.action === "mygame") {
//     const game = cricketService.getMyGame(input.userId);
//     return [
//       {
//         roomId: input.roomId,
//         content: game
//           ? `🎮 مباراتك الحالية: ${game.gameId} | الحالة: ${game.status}`
//           : "لا توجد لك مباراة كريكت حالية",
//         type: "game" as const,
//         gameType: "cricket" as const,
//         game: {
//           gameId: game?.gameId || "",
//           title: "Cricket",
//           state: game?.status || "none",
//           turnUserId: game?.innings?.strikerUserId || "",
//           winnerUserId: game?.winnerUserId || "",
//           payload: game || null,
//         },
//       },
//     ];
//   }

//   return [
//     {
//       roomId: input.roomId,
//       content: `أوامر الكريكت:
// !cricket start 2
// !cricket start 6
// !cricket join GAME_ID
// !cricket hit GAME_ID
// !cricket top
// !cricket mygame`,
//       type: "game" as const,
//       gameType: "cricket" as const,
//       game: {
//         gameId: "",
//         title: "Cricket Help",
//         state: "help",
//         turnUserId: "",
//         winnerUserId: "",
//         payload: null,
//       },
//     },
//   ];
// }
// src/services/cricket/commands-runner.ts

import { parseCricketCommand } from "./cricket.commands";
import { cricketMessageBuilder } from "./cricket.messages";
import { cricketService } from "./cricket.service";
import { cricketStateRepository } from "./cricket.state";

type HandleInput = {
  text: string;
  userId: string;
  username: string;
  roomId: string;
  allRoomIds: string[];
};

export async function handleCricketCommand(input: HandleInput) {
  cricketStateRepository.cleanupStaleLocks();

  const parsed = parseCricketCommand(input.text);
  if (!parsed) return null;

  const user = {
    userId: input.userId,
    username: input.username,
    roomId: input.roomId,
  };

  if (parsed.action === "start") {
    return cricketService.startGameLobby(
      user,
      parsed.mode,
      parsed.playersRequired,
      parsed.overs,
      input.allRoomIds
    );
  }

  if (parsed.action === "join") {
    return cricketService.joinGame(user, parsed.gameId);
  }

  if (parsed.action === "play") {
    return cricketService.playNumber(user, parsed.gameId, parsed.choice);
  }

  if (parsed.action === "top") {
    return cricketService.topWins(input.roomId);
  }

  if (parsed.action === "topruns") {
    return cricketService.topRuns(input.roomId);
  }

  if (parsed.action === "topsixes") {
    return cricketService.topSixes(input.roomId);
  }

  if (parsed.action === "topsr") {
    return cricketService.topStrikeRate(input.roomId);
  }

  if (parsed.action === "mygame") {
    const game = cricketService.getMyGame(input.userId);

    return [
      {
        roomId: input.roomId,
        content: game
          ? cricketMessageBuilder.buildMyGame(game)
          : "لا توجد لك مباراة كريكت حالية",
        type: "game" as const,
        gameType: "cricket" as const,
        game: {
          gameId: game?.gameId || "",
          title: "Cricket",
          state: game?.status || "none",
          turnUserId:
            game?.currentTurnUserId || game?.innings?.strikerUserId || "",
          winnerUserId: game?.winnerUserId || "",
          payload: game || null,
        },
      },
    ];
  }

  if (parsed.action === "leavegame") {
    return cricketService.leaveCurrentGame(user);
  }

  return [
    {
      roomId: input.roomId,
      content: cricketMessageBuilder.buildHelp(),
      type: "game" as const,
      gameType: "cricket" as const,
      game: {
        gameId: "",
        title: "Cricket Help",
        state: "help",
        turnUserId: "",
        winnerUserId: "",
        payload: null,
      },
    },
  ];
}