// // src/services/cricket/cricket.service.ts

// import crypto from "crypto";
// import {
//   CRICKET_JOIN_WINDOW_MS,
//   CRICKET_MAX_PLAYERS,
//   CRICKET_MIN_PLAYERS,
// } from "./cricket.constants";
// import { cricketEngine } from "./cricket.engine";
// import { cricketMessageBuilder } from "./cricket.messages";
// import { cricketStateRepository } from "./cricket.state";
// import { cricketStatsRepository } from "./cricket.stats";
// import type { CricketGame, CricketPlayerRef } from "./cricket.types";

// export type CricketOutgoingMessage = {
//   roomId: string;
//   content: string;
//   type?: "game" | "system" | "text";
//   gameType?: "cricket";
//   game?: any;
// };

// type UserContext = {
//   userId: string;
//   username: string;
//   roomId: string;
// };

// export class CricketService {
//   private makeGameId() {
//     return `cr_${crypto.randomBytes(4).toString("hex")}`;
//   }

//   private makePlayerRef(user: UserContext): CricketPlayerRef {
//     return {
//       userId: user.userId,
//       username: user.username,
//       roomId: user.roomId,
//       joinedAt: new Date().toISOString(),
//     };
//   }

//   private serializeGameMessage(game: CricketGame, content: string): CricketOutgoingMessage[] {
//     const uniqueRooms = [...new Set(game.broadcastRoomIds)];
//     return uniqueRooms.map((roomId) => ({
//       roomId,
//       content,
//       type: "game",
//       gameType: "cricket",
//       game: {
//         gameId: game.gameId,
//         title: "Cricket",
//         state: game.status,
//         turnUserId: game.innings.strikerUserId || "",
//         winnerUserId: game.winnerUserId || "",
//         payload: game,
//       },
//     }));
//   }

//   startGameLobby(user: UserContext, playersRequired: number, allRoomIds: string[]) {
//     if (playersRequired < CRICKET_MIN_PLAYERS || playersRequired > CRICKET_MAX_PLAYERS) {
//       throw new Error("Players count must be between 1 and 6");
//     }

//     const locked = cricketStateRepository.getPlayerLockedGame(user.userId);
//     if (locked) {
//       throw new Error("You are already in another cricket game");
//     }

//     const gameId = this.makeGameId();

//     const players = [this.makePlayerRef(user)];

//     const game: CricketGame = {
//       gameId,
//       hostUserId: user.userId,
//       hostUsername: user.username,
//       createdFromRoomId: user.roomId,
//       playersRequired,
//       players,
//       status: "waiting",
//       createdAt: new Date().toISOString(),
//       joinDeadlineAt: new Date(Date.now() + CRICKET_JOIN_WINDOW_MS).toISOString(),
//       broadcastRoomIds: [...new Set(allRoomIds)],
//       innings: {
//         strikerUserId: null,
//         currentPlayerIndex: 0,
//         wickets: 0,
//         totalRuns: 0,
//         totalBalls: 0,
//         overBalls: 0,
//         overNumber: 0,
//         battingOrder: [],
//         playerScores: [],
//         timeline: [],
//       },
//     };

//     cricketStateRepository.upsertGame(game);
//     cricketStateRepository.lockPlayer(user.userId, game.gameId);

//     return this.serializeGameMessage(
//       game,
//       cricketMessageBuilder.buildLobbyAnnouncement(game)
//     );
//   }

//   joinGame(user: UserContext, gameId: string) {
//     const game = cricketStateRepository.findGameById(gameId);
//     if (!game) throw new Error("Game not found");
//     if (game.status !== "waiting") throw new Error("Game is not waiting for players");

//     const locked = cricketStateRepository.getPlayerLockedGame(user.userId);
//     if (locked && locked !== gameId) {
//       throw new Error("You are already in another cricket game");
//     }

//     const exists = game.players.some((p) => p.userId === user.userId);
//     if (exists) throw new Error("You are already joined");

//     if (game.players.length >= game.playersRequired) {
//       throw new Error("Game is already full");
//     }

//     const player = this.makePlayerRef(user);
//     game.players.push(player);

//     if (!game.broadcastRoomIds.includes(user.roomId)) {
//       game.broadcastRoomIds.push(user.roomId);
//     }

//     cricketStateRepository.upsertGame(game);
//     cricketStateRepository.lockPlayer(user.userId, game.gameId);

//     const messages: CricketOutgoingMessage[] = [
//       ...this.serializeGameMessage(
//         game,
//         cricketMessageBuilder.buildJoinSuccess(game, user.username)
//       ),
//     ];

//     if (game.players.length >= game.playersRequired) {
//       cricketEngine.startGame(game);
//       cricketStateRepository.upsertGame(game);

//       messages.push(
//         ...this.serializeGameMessage(
//           game,
//           cricketMessageBuilder.buildGameStarted(game)
//         )
//       );
//     }

//     return messages;
//   }

//   hitBall(user: UserContext, gameId: string) {
//     const game = cricketStateRepository.findGameById(gameId);
//     if (!game) throw new Error("Game not found");

//     const member = game.players.find((p) => p.userId === user.userId);
//     if (!member) throw new Error("You are not in this game");

//     const { result } = cricketEngine.playBall(game, user.userId);

//     cricketStateRepository.upsertGame(game);

//     const messages: CricketOutgoingMessage[] = [
//       ...this.serializeGameMessage(
//         game,
//         cricketMessageBuilder.buildBallResult(game, user.username, String(result))
//       ),
//     ];

//     if (game.status === "finished") {
//       cricketStatsRepository.applyFinishedGame(game);
//       cricketStateRepository.unlockPlayers(game.players.map((p) => p.userId));

//       messages.push(
//         ...this.serializeGameMessage(game, cricketMessageBuilder.buildFinished(game))
//       );
//     } else {
//       messages.push(
//         ...this.serializeGameMessage(game, cricketMessageBuilder.buildTurnPrompt(game))
//       );
//     }

//     return messages;
//   }

//   topWins(roomId: string) {
//     const rows = cricketStatsRepository.getLeaderboard();

//     return [
//       {
//         roomId,
//         content: cricketMessageBuilder.buildTopWins(rows),
//         type: "game" as const,
//         gameType: "cricket" as const,
//         game: {
//           gameId: "",
//           title: "Cricket Leaderboard",
//           state: "stats",
//           turnUserId: "",
//           winnerUserId: "",
//           payload: rows,
//         },
//       },
//     ];
//   }

//   getMyGame(userId: string) {
//     const gameId = cricketStateRepository.getPlayerLockedGame(userId);
//     if (!gameId) return null;
//     return cricketStateRepository.findGameById(gameId);
//   }
// }

// export const cricketService = new CricketService();
/// src/services/cricket/cricket.service.ts

import crypto from "crypto";
import {
  CRICKET_BALLS_PER_OVER,
  CRICKET_DEFAULT_OVERS,
  CRICKET_JOIN_WINDOW_MS,
  CRICKET_MAX_FINISHED_GAMES_TO_KEEP,
  CRICKET_SERVER_USERNAME,
} from "./cricket.constants";
import { cricketEngine } from "./cricket.engine";
import { cricketMessageBuilder } from "./cricket.messages";
import { cricketStateRepository } from "./cricket.state";
import { cricketStatsRepository } from "./cricket.stats";
import type {
  CricketGame,
  CricketGameMode,
  CricketPlayerRef,
} from "./cricket.types";

export type CricketOutgoingMessage = {
  roomId: string;
  content: string;
  type?: "game" | "system" | "text";
  gameType?: "cricket";
  game?: any;
};

type UserContext = {
  userId: string;
  username: string;
  roomId: string;
};

export class CricketService {
  private makeGameId() {
    return `cr_${crypto.randomBytes(4).toString("hex")}`;
  }

  private makePlayerRef(
    user: UserContext,
    extra?: Partial<CricketPlayerRef>
  ): CricketPlayerRef {
    return {
      userId: user.userId,
      username: user.username,
      roomId: user.roomId,
      joinedAt: new Date().toISOString(),
      isBot: false,
      team: null,
      ...extra,
    };
  }

  private serializeGameMessage(
    game: CricketGame,
    content: string
  ): CricketOutgoingMessage[] {
    const uniqueRooms = [...new Set(game.broadcastRoomIds || [])];

    return uniqueRooms.map((roomId) => ({
      roomId,
      content,
      type: "game" as const,
      gameType: "cricket" as const,
      game: {
        gameId: game.gameId,
        title: "Cricket",
        state: game.status,
        turnUserId:
          game.currentTurnUserId || game.innings?.strikerUserId || "",
        winnerUserId: game.winnerUserId || "",
        payload: game,
      },
    }));
  }

  private serializeAnnouncementMessage(
    game: CricketGame,
    content: string
  ): CricketOutgoingMessage[] {
    const uniqueRooms = [...new Set(game.announcementRoomIds || [])];

    return uniqueRooms.map((roomId) => ({
      roomId,
      content,
      type: "game" as const,
      gameType: "cricket" as const,
      game: {
        gameId: game.gameId,
        title: "Cricket",
        state: game.status,
        turnUserId:
          game.currentTurnUserId || game.innings?.strikerUserId || "",
        winnerUserId: game.winnerUserId || "",
        payload: game,
      },
    }));
  }

  private createEmptyGame(
    user: UserContext,
    mode: CricketGameMode,
    playersRequired: number,
    overs: number,
    allRoomIds: string[]
  ): CricketGame {
    return {
      gameId: this.makeGameId(),
      mode,
      status: "waiting",
      hostUserId: user.userId,
      hostUsername: user.username,
      createdFromRoomId: user.roomId,
      playersRequired,
      players: [this.makePlayerRef(user)],
      teams: null,
      solo:
        mode === "solo"
          ? {
              serverEnabled: true,
              serverUserId: "server",
              serverUsername: CRICKET_SERVER_USERNAME,
            }
          : null,
      overs: Number(overs || CRICKET_DEFAULT_OVERS),
      ballsPerOver: CRICKET_BALLS_PER_OVER,
      rounds: 1,
      currentInningsNumber: 1,
      currentTurnUserId: null,
      target: undefined,
      createdAt: new Date().toISOString(),
      joinDeadlineAt: new Date(
        Date.now() + CRICKET_JOIN_WINDOW_MS
      ).toISOString(),
      startedAt: undefined,
      endedAt: undefined,
      winnerUserId: undefined,
      winnerUsername: undefined,
      winnerSide: null,

      // ✅ أول إعلان لكل الغرف
      announcementRoomIds: [...new Set(allRoomIds)],
      // ✅ اللعب نفسه فقط لغرفة المنشئ بالبداية
      broadcastRoomIds: [user.roomId],

      innings: {
        inningsNumber: 1,
        battingSide:
          mode === "ffa"
            ? "soloPlayer"
            : mode === "solo"
            ? "soloPlayer"
            : "teamA",
        bowlingSide:
          mode === "solo" ? "server" : mode === "team" ? "teamB" : null,
        strikerUserId: null,
        currentPlayerIndex: 0,
        wickets: 0,
        totalRuns: 0,
        totalBalls: 0,
        overBalls: 0,
        overNumber: 0,
        battingOrder: [],
        playerScores: [],
        timeline: [],
        isCompleted: false,
      },
      scoreboard: {
        innings1: undefined,
        innings2: undefined,
        target: undefined,
        winningSide: undefined,
        winningTeamName: undefined,
        bestPlayerUserId: undefined,
        bestPlayerUsername: undefined,
      },
    };
  }

  private validateStartInput(
    mode: CricketGameMode,
    playersRequired: number,
    overs: number
  ) {
    if (mode === "solo" && playersRequired !== 1) {
      throw new Error("Solo mode requires exactly 1 player");
    }

    if (mode === "team" && playersRequired % 2 !== 0) {
      throw new Error("Team mode requires an even number of players");
    }

    if (overs <= 0) {
      throw new Error("Overs must be greater than 0");
    }
  }

  private maybeAutoStartAfterJoin(game: CricketGame) {
    if (game.players.length < game.playersRequired) return null;

    cricketEngine.startGame(game);
    cricketStateRepository.upsertGame(game);
    cricketStateRepository.lockPlayers(
      game.players.filter((p) => !p.isBot).map((p) => p.userId),
      game.gameId
    );

    return [
      ...this.serializeGameMessage(
        game,
        cricketMessageBuilder.buildGameStarted(game)
      ),
    ];
  }

  private maybeHandleBotTurn(game: CricketGame): CricketOutgoingMessage[] {
    const messages: CricketOutgoingMessage[] = [];

    while (
      String(game.currentTurnUserId || "") === "server" &&
      game.status === "live"
    ) {
      const botResult = cricketEngine.playBotTurn(game);

      cricketStateRepository.upsertGame(game);

      messages.push(
        ...this.serializeGameMessage(
          game,
          cricketMessageBuilder.buildBotTurnResult(
            game,
            String(botResult.result),
            botResult.batterChoice,
            botResult.bowlerChoice
          )
        )
      );

      if (botResult.gameFinished) {
        cricketStatsRepository.applyFinishedGame(game);
        cricketStateRepository.unlockPlayers(
          game.players.filter((p) => !p.isBot).map((p) => p.userId)
        );

        messages.push(
          ...this.serializeGameMessage(
            game,
            cricketMessageBuilder.buildFinished(game)
          )
        );

        break;
      }

      if (botResult.inningsEnded) {
        messages.push(
          ...this.serializeGameMessage(
            game,
            cricketMessageBuilder.buildInningsBreak(game)
          )
        );

        cricketEngine.startSecondInnings(game);
        cricketStateRepository.upsertGame(game);

        messages.push(
          ...this.serializeGameMessage(
            game,
            cricketMessageBuilder.buildGameStarted(game)
          )
        );

        continue;
      }

      messages.push(
        ...this.serializeGameMessage(
          game,
          cricketMessageBuilder.buildTurnPrompt(game)
        )
      );
    }

    return messages;
  }

  startGameLobby(
    user: UserContext,
    mode: CricketGameMode,
    playersRequired: number,
    overs: number,
    allRoomIds: string[]
  ) {
    cricketStateRepository.cleanupStaleLocks();
    cricketStateRepository.cleanupFinishedGames(
      CRICKET_MAX_FINISHED_GAMES_TO_KEEP
    );

    this.validateStartInput(mode, playersRequired, overs);

    const locked = cricketStateRepository.getPlayerLockedGame(user.userId);
    if (locked) {
      throw new Error("You are already in another cricket game");
    }

    const existingActive = cricketStateRepository.findActiveGameByUserId(
      user.userId
    );
    if (existingActive) {
      throw new Error("You are already in another cricket game");
    }

    const game = this.createEmptyGame(
      user,
      mode,
      playersRequired,
      overs,
      allRoomIds
    );

    cricketStateRepository.upsertGame(game);
    cricketStateRepository.lockPlayer(user.userId, game.gameId);

    // ✅ إعلان البداية لكل الغرف
    const messages: CricketOutgoingMessage[] = [
      ...this.serializeAnnouncementMessage(
        game,
        cricketMessageBuilder.buildLobbyAnnouncement(game)
      ),
    ];

    if (mode === "solo" && playersRequired === 1) {
      cricketEngine.startGame(game);
      cricketStateRepository.upsertGame(game);

      messages.push(
        ...this.serializeGameMessage(
          game,
          cricketMessageBuilder.buildGameStarted(game)
        )
      );

      messages.push(...this.maybeHandleBotTurn(game));
    }

    return messages;
  }

  joinGame(user: UserContext, gameId: string) {
    cricketStateRepository.cleanupStaleLocks();

    const game = cricketStateRepository.findGameById(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "waiting") {
      throw new Error("Game is not waiting for players");
    }

    if (game.mode === "solo") {
      throw new Error("Solo game does not accept more players");
    }

    const locked = cricketStateRepository.getPlayerLockedGame(user.userId);
    if (locked && locked !== gameId) {
      throw new Error("You are already in another cricket game");
    }

    const exists = game.players.some((p) => p.userId === user.userId);
    if (exists) {
      throw new Error("You are already joined");
    }

    if (game.players.length >= game.playersRequired) {
      throw new Error("Game is already full");
    }

    game.players.push(this.makePlayerRef(user));

    // ✅ من هنا فصاعدًا البث فقط لغرف المشتركين
    if (!game.broadcastRoomIds.includes(user.roomId)) {
      game.broadcastRoomIds.push(user.roomId);
    }

    cricketStateRepository.upsertGame(game);
    cricketStateRepository.lockPlayer(user.userId, game.gameId);

    const messages: CricketOutgoingMessage[] = [
      ...this.serializeGameMessage(
        game,
        cricketMessageBuilder.buildJoinSuccess(game, user.username)
      ),
    ];

    const startedMessages = this.maybeAutoStartAfterJoin(game);
    if (startedMessages?.length) {
      messages.push(...startedMessages);
      messages.push(...this.maybeHandleBotTurn(game));
    }

    return messages;
  }

  playNumber(user: UserContext, gameId: string, choice: number) {
    const game = cricketStateRepository.findGameById(gameId);
    if (!game) throw new Error("Game not found");

    const member = game.players.find((p) => p.userId === user.userId);
    if (!member) throw new Error("You are not in this game");

    if (String(game.currentTurnUserId || "") !== String(user.userId)) {
      throw new Error("It is not your turn");
    }

    const playResult = cricketEngine.playChosenBall(game, user.userId, choice);
    cricketStateRepository.upsertGame(game);

    const messages: CricketOutgoingMessage[] = [
      ...this.serializeGameMessage(
        game,
        cricketMessageBuilder.buildBallResult(
          game,
          user.username,
          String(playResult.result),
          playResult.batterChoice,
          playResult.bowlerChoice
        )
      ),
    ];

    if (playResult.gameFinished) {
      cricketStatsRepository.applyFinishedGame(game);
      cricketStateRepository.unlockPlayers(
        game.players.filter((p) => !p.isBot).map((p) => p.userId)
      );

      messages.push(
        ...this.serializeGameMessage(
          game,
          cricketMessageBuilder.buildFinished(game)
        )
      );

      return messages;
    }

    if (playResult.inningsEnded && !playResult.gameFinished) {
      messages.push(
        ...this.serializeGameMessage(
          game,
          cricketMessageBuilder.buildInningsBreak(game)
        )
      );

      cricketEngine.startSecondInnings(game);
      cricketStateRepository.upsertGame(game);

      messages.push(
        ...this.serializeGameMessage(
          game,
          cricketMessageBuilder.buildGameStarted(game)
        )
      );

      messages.push(...this.maybeHandleBotTurn(game));
      return messages;
    }

  if (game.mode !== "ffa") {
  messages.push(
    ...this.serializeGameMessage(
      game,
      cricketMessageBuilder.buildTurnPrompt(game)
    )
  );
}

messages.push(...this.maybeHandleBotTurn(game));
return messages;
  }

  topWins(roomId: string) {
    const rows = cricketStatsRepository.getTopWins(10);

    return [
      {
        roomId,
        content: cricketMessageBuilder.buildTopWins(rows),
        type: "game" as const,
        gameType: "cricket" as const,
        game: {
          gameId: "",
          title: "Cricket Leaderboard",
          state: "stats",
          turnUserId: "",
          winnerUserId: "",
          payload: rows,
        },
      },
    ];
  }

  topRuns(roomId: string) {
    const rows = cricketStatsRepository.getTopRuns(10);

    return [
      {
        roomId,
        content: cricketMessageBuilder.buildTopRuns(rows),
        type: "game" as const,
        gameType: "cricket" as const,
        game: {
          gameId: "",
          title: "Cricket Top Runs",
          state: "stats",
          turnUserId: "",
          winnerUserId: "",
          payload: rows,
        },
      },
    ];
  }

  topSixes(roomId: string) {
    const rows = cricketStatsRepository.getTopSixes(10);

    return [
      {
        roomId,
        content: cricketMessageBuilder.buildTopSixes(rows),
        type: "game" as const,
        gameType: "cricket" as const,
        game: {
          gameId: "",
          title: "Cricket Top Sixes",
          state: "stats",
          turnUserId: "",
          winnerUserId: "",
          payload: rows,
        },
      },
    ];
  }

  topStrikeRate(roomId: string) {
    const rows = cricketStatsRepository.getTopStrikeRate(10);

    return [
      {
        roomId,
        content: cricketMessageBuilder.buildTopStrikeRate(rows),
        type: "game" as const,
        gameType: "cricket" as const,
        game: {
          gameId: "",
          title: "Cricket Strike Rate",
          state: "stats",
          turnUserId: "",
          winnerUserId: "",
          payload: rows,
        },
      },
    ];
  }

  getMyGame(userId: string) {
    const active = cricketStateRepository.findActiveGameByUserId(userId);
    if (active) return active;

    const gameId = cricketStateRepository.getPlayerLockedGame(userId);
    if (!gameId) return null;

    return cricketStateRepository.findGameById(gameId);
  }

  leaveCurrentGame(user: UserContext) {
    const game = this.getMyGame(user.userId);

    if (!game) {
      return [
        {
          roomId: user.roomId,
          content: "لا توجد لعبة كريكت حالية لك",
          type: "game" as const,
          gameType: "cricket" as const,
          game: {
            gameId: "",
            title: "Cricket",
            state: "none",
            turnUserId: "",
            winnerUserId: "",
            payload: null,
          },
        },
      ];
    }

    game.players = game.players.filter((p) => p.userId !== user.userId);

    cricketStateRepository.unlockPlayer(user.userId);

    if (!game.players.length || game.status === "waiting") {
      game.status = "cancelled";
      game.endedAt = new Date().toISOString();
      cricketStateRepository.upsertGame(game);

      return [
        ...this.serializeGameMessage(
          game,
          cricketMessageBuilder.buildCancelled(
            game,
            `${user.username} خرج من اللعبة`
          )
        ),
      ];
    }

    const currentStatus = game.status as CricketGame["status"];

    if (currentStatus === "live" || currentStatus === "innings_break") {
      game.status = "cancelled";
      game.endedAt = new Date().toISOString();

      cricketStateRepository.unlockPlayers(
        game.players.filter((p) => !p.isBot).map((p) => p.userId)
      );
      cricketStateRepository.upsertGame(game);

      return [
        ...this.serializeGameMessage(
          game,
          cricketMessageBuilder.buildCancelled(
            game,
            `${user.username} خرج من اللعبة أثناء اللعب`
          )
        ),
      ];
    }

    cricketStateRepository.upsertGame(game);

    return [
      {
        roomId: user.roomId,
        content: "تم الخروج من لعبة الكريكت الحالية",
        type: "game" as const,
        gameType: "cricket" as const,
        game: {
          gameId: game.gameId,
          title: "Cricket",
          state: "left",
          turnUserId: "",
          winnerUserId: "",
          payload: null,
        },
      },
    ];
  }
}

export const cricketService = new CricketService();