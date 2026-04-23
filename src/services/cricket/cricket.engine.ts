// // src/services/cricket/cricket.engine.ts

// import {
//   CRICKET_BALLS_PER_OVER,
//   CRICKET_MAX_OVERS,
// } from "./cricket.constants";
// import type {
//   CricketBallResult,
//   CricketGame,
//   CricketPlayerRef,
//   CricketPlayerScore,
// } from "./cricket.types";

// function randomBall(): CricketBallResult {
//   const pool: CricketBallResult[] = [0, 1, 1, 2, 3, 4, 6, "W", 1, 2, 4, 0];
//   return pool[Math.floor(Math.random() * pool.length)];
// }

// function createPlayerScore(player: CricketPlayerRef): CricketPlayerScore {
//   return {
//     userId: player.userId,
//     username: player.username,
//     runs: 0,
//     balls: 0,
//     fours: 0,
//     sixes: 0,
//     isOut: false,
//   };
// }

// export class CricketEngine {
//   createInitialInnings(players: CricketPlayerRef[]) {
//     return {
//       strikerUserId: players[0]?.userId || null,
//       currentPlayerIndex: 0,
//       wickets: 0,
//       totalRuns: 0,
//       totalBalls: 0,
//       overBalls: 0,
//       overNumber: 0,
//       battingOrder: players.map((p) => p.userId),
//       playerScores: players.map(createPlayerScore),
//       timeline: [],
//     };
//   }

//   startGame(game: CricketGame): CricketGame {
//     game.status = "live";
//     game.startedAt = new Date().toISOString();
//     game.innings = this.createInitialInnings(game.players);
//     return game;
//   }

//   private getCurrentPlayer(game: CricketGame) {
//     const userId = game.innings.battingOrder[game.innings.currentPlayerIndex];
//     return game.players.find((p) => p.userId === userId) || null;
//   }

//   private getCurrentPlayerScore(game: CricketGame) {
//     const current = this.getCurrentPlayer(game);
//     if (!current) return null;
//     return game.innings.playerScores.find((x) => x.userId === current.userId) || null;
//   }

//   private moveToNextBatsman(game: CricketGame) {
//     game.innings.currentPlayerIndex += 1;
//     const nextUserId = game.innings.battingOrder[game.innings.currentPlayerIndex] || null;
//     game.innings.strikerUserId = nextUserId;
//   }

//   private finalizeIfNeeded(game: CricketGame) {
//     const allOut =
//       game.innings.currentPlayerIndex >= game.players.length ||
//       game.innings.wickets >= game.players.length;

//     const oversEnded = game.innings.overNumber >= CRICKET_MAX_OVERS;

//     if (allOut || oversEnded) {
//       game.status = "finished";
//       game.endedAt = new Date().toISOString();

//       const sorted = [...game.innings.playerScores].sort((a, b) => b.runs - a.runs);
//       const winner = sorted[0];

//       if (winner) {
//         game.winnerUserId = winner.userId;
//         game.winnerUsername = winner.username;
//       }
//     }
//   }

//   playBall(game: CricketGame, actorUserId: string) {
//     if (game.status !== "live") {
//       throw new Error("Game is not live");
//     }

//     if (game.innings.strikerUserId !== actorUserId) {
//       throw new Error("It is not your turn");
//     }

//     const player = this.getCurrentPlayer(game);
//     const score = this.getCurrentPlayerScore(game);

//     if (!player || !score) {
//       throw new Error("Current player not found");
//     }

//     const result = randomBall();

//     score.balls += 1;
//     game.innings.totalBalls += 1;
//     game.innings.overBalls += 1;

//     if (result === "W") {
//       score.isOut = true;
//       game.innings.wickets += 1;
//       game.innings.timeline.push({
//         ballNo: game.innings.totalBalls,
//         playerId: player.userId,
//         result,
//         at: new Date().toISOString(),
//       });

//       if (game.innings.overBalls >= CRICKET_BALLS_PER_OVER) {
//         game.innings.overBalls = 0;
//         game.innings.overNumber += 1;
//       }

//       this.moveToNextBatsman(game);
//       this.finalizeIfNeeded(game);

//       return {
//         game,
//         result,
//         player,
//         score,
//       };
//     }

//     score.runs += result;
//     game.innings.totalRuns += result;

//     if (result === 4) score.fours += 1;
//     if (result === 6) score.sixes += 1;

//     game.innings.timeline.push({
//       ballNo: game.innings.totalBalls,
//       playerId: player.userId,
//       result,
//       at: new Date().toISOString(),
//     });

//     if (game.innings.overBalls >= CRICKET_BALLS_PER_OVER) {
//       game.innings.overBalls = 0;
//       game.innings.overNumber += 1;
//     }

//     if (game.innings.overNumber >= CRICKET_MAX_OVERS) {
//       this.finalizeIfNeeded(game);
//     }

//     return {
//       game,
//       result,
//       player,
//       score,
//     };
//   }
// }

// export const cricketEngine = new CricketEngine();

// src/services/cricket/cricket.engine.ts

import {
  CRICKET_BALLS_PER_OVER,
  CRICKET_MAX_OVERS,
} from "./cricket.constants";
import type {
  CricketBallEvent,
  CricketBallResult,
  CricketGame,
  CricketInningsState,
  CricketPlayerRef,
  CricketPlayerScore,
  CricketSide,
} from "./cricket.types";

function randomBall(): CricketBallResult {
  const pool: CricketBallResult[] = [
    0, 0, 1, 1, 1, 2, 2, 3, 4, 4, 6, "W",
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

function safeStrikeRate(runs: number, balls: number) {
  if (!balls || balls <= 0) return 0;
  return Number(((runs / balls) * 100).toFixed(2));
}

function createPlayerScore(player: CricketPlayerRef): CricketPlayerScore {
  return {
    userId: player.userId,
    username: player.username,
    team: player.team || null,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    isOut: false,
    strikeRate: 0,
  };
}

function cloneInnings(innings: CricketInningsState): CricketInningsState {
  return JSON.parse(JSON.stringify(innings));
}

export class CricketEngine {
  private now() {
    return new Date().toISOString();
  }

  private getOvers(game: CricketGame) {
    return Number(game.overs || CRICKET_MAX_OVERS || 1);
  }

  private getBallsPerOver(game: CricketGame) {
    return Number(game.ballsPerOver || CRICKET_BALLS_PER_OVER || 6);
  }

  private getPlayersForSide(game: CricketGame, side: CricketSide): CricketPlayerRef[] {
    if (side === "soloPlayer") {
      return game.players.filter((p) => !p.isBot);
    }

    if (side === "server") {
      return game.players.filter((p) => p.isBot);
    }

    if (side === "teamA" || side === "teamB") {
      return game.players.filter((p) => p.team === side);
    }

    return [];
  }

  private createInningsFromSide(
    game: CricketGame,
    inningsNumber: 1 | 2,
    battingSide: CricketSide,
    bowlingSide: CricketSide
  ): CricketInningsState {
    const sidePlayers = this.getPlayersForSide(game, battingSide);

    return {
      inningsNumber,
      battingSide,
      bowlingSide,
      strikerUserId: sidePlayers[0]?.userId || null,
      currentPlayerIndex: 0,
      wickets: 0,
      totalRuns: 0,
      totalBalls: 0,
      overBalls: 0,
      overNumber: 0,
      battingOrder: sidePlayers.map((p) => p.userId),
      playerScores: sidePlayers.map(createPlayerScore),
      timeline: [],
      isCompleted: false,
    };
  }

  private autoAssignTeams(game: CricketGame) {
    const realPlayers = game.players.filter((p) => !p.isBot);

    const teamA: string[] = [];
    const teamB: string[] = [];

    realPlayers.forEach((p, index) => {
      if (index % 2 === 0) {
        p.team = "teamA";
        teamA.push(p.userId);
      } else {
        p.team = "teamB";
        teamB.push(p.userId);
      }
    });

    game.teams = { teamA, teamB };
  }

  private buildStartingInnings(game: CricketGame): CricketInningsState {
    if (game.mode === "solo") {
      return this.createInningsFromSide(game, 1, "soloPlayer", "server");
    }

    if (game.mode === "team") {
      if (!game.teams?.teamA?.length || !game.teams?.teamB?.length) {
        this.autoAssignTeams(game);
      }
      return this.createInningsFromSide(game, 1, "teamA", "teamB");
    }

    return this.createInningsFromSide(game, 1, "soloPlayer", null);
  }

  startGame(game: CricketGame): CricketGame {
    if (game.mode === "solo") {
      const hasServer = game.players.some((p) => p.isBot);
      if (!hasServer) {
        game.players.push({
          userId: "server",
          username: game.solo?.serverUsername || "Cricket Server",
          roomId: game.createdFromRoomId,
          joinedAt: this.now(),
          isBot: true,
          team: null,
        });
      }

      game.solo = {
        serverEnabled: true,
        serverUserId: "server",
        serverUsername: game.solo?.serverUsername || "Cricket Server",
      };
    }

    if (game.mode === "team") {
      this.autoAssignTeams(game);
    }

    game.status = "live";
    game.startedAt = this.now();
    game.currentInningsNumber = 1;
    game.target = undefined;

    game.innings = this.buildStartingInnings(game);
    game.scoreboard = {
      innings1: undefined,
      innings2: undefined,
      target: undefined,
      winningSide: undefined,
      winningTeamName: undefined,
      bestPlayerUserId: undefined,
      bestPlayerUsername: undefined,
    };

    game.currentTurnUserId = game.innings.strikerUserId || null;

    return game;
  }

  private getCurrentPlayer(game: CricketGame) {
    const userId =
      game.currentTurnUserId ||
      game.innings.strikerUserId ||
      game.innings.battingOrder[game.innings.currentPlayerIndex];

    return game.players.find((p) => p.userId === userId) || null;
  }

  private getCurrentPlayerScore(game: CricketGame) {
    const current = this.getCurrentPlayer(game);
    if (!current) return null;

    return (
      game.innings.playerScores.find((x) => x.userId === current.userId) || null
    );
  }

  private moveToNextBatsman(game: CricketGame) {
    game.innings.currentPlayerIndex += 1;
    const nextUserId =
      game.innings.battingOrder[game.innings.currentPlayerIndex] || null;

    game.innings.strikerUserId = nextUserId;
    game.currentTurnUserId = nextUserId;
  }

  private pushBallEvent(
    game: CricketGame,
    player: CricketPlayerRef,
    result: CricketBallResult
  ) {
    const event: CricketBallEvent = {
      ballNo: game.innings.totalBalls,
      inningsNumber: game.currentInningsNumber as 1 | 2,
      playerId: player.userId,
      username: player.username,
      side: game.innings.battingSide,
      result,
      totalRunsAfterBall: game.innings.totalRuns,
      wicketsAfterBall: game.innings.wickets,
      overNumber: game.innings.overNumber,
      overBalls: game.innings.overBalls,
      at: this.now(),
    };

    game.innings.timeline.push(event);
  }

  private completeCurrentInnings(game: CricketGame) {
    game.innings.isCompleted = true;

    if (game.currentInningsNumber === 1) {
      game.scoreboard.innings1 = cloneInnings(game.innings);
      game.target = game.innings.totalRuns + 1;
      game.scoreboard.target = game.target;

      if (game.mode === "ffa") {
        this.finishGame(game);
        return;
      }

      game.status = "innings_break";
      return;
    }

    game.scoreboard.innings2 = cloneInnings(game.innings);
    this.finishGame(game);
  }

  private shouldEndInnings(game: CricketGame) {
    const allOut =
      game.innings.currentPlayerIndex >= game.innings.battingOrder.length ||
      game.innings.wickets >= game.innings.battingOrder.length;

    const oversEnded = game.innings.overNumber >= this.getOvers(game);

    const chasedTarget =
      game.currentInningsNumber === 2 &&
      !!game.target &&
      game.innings.totalRuns >= Number(game.target);

    return allOut || oversEnded || chasedTarget;
  }

  private determineBestPlayer(game: CricketGame) {
    const scores: CricketPlayerScore[] = [];

    if (game.scoreboard.innings1?.playerScores?.length) {
      scores.push(...game.scoreboard.innings1.playerScores);
    }
    if (game.scoreboard.innings2?.playerScores?.length) {
      for (const p of game.scoreboard.innings2.playerScores) {
        const found = scores.find((x) => x.userId === p.userId);
        if (!found) {
          scores.push({ ...p });
        } else {
          found.runs += p.runs;
          found.balls += p.balls;
          found.fours += p.fours;
          found.sixes += p.sixes;
          found.isOut = found.isOut || p.isOut;
          found.strikeRate = safeStrikeRate(found.runs, found.balls);
        }
      }
    }

    if (!scores.length && game.innings.playerScores?.length) {
      scores.push(...game.innings.playerScores);
    }

    const realScores = scores.filter((p) => p.userId !== "server");
    const sorted = [...realScores].sort((a, b) => {
      if (b.runs !== a.runs) return b.runs - a.runs;
      return b.sixes - a.sixes;
    });

    const best = sorted[0];
    if (best) {
      game.scoreboard.bestPlayerUserId = best.userId;
      game.scoreboard.bestPlayerUsername = best.username;
    }
  }

  private finishGame(game: CricketGame) {
    game.status = "finished";
    game.endedAt = this.now();

    if (game.mode === "ffa") {
      const sorted = [...game.innings.playerScores].sort((a, b) => {
        if (b.runs !== a.runs) return b.runs - a.runs;
        return b.sixes - a.sixes;
      });

      const winner = sorted[0];
      if (winner) {
        game.winnerUserId = winner.userId;
        game.winnerUsername = winner.username;
        game.winnerSide = "soloPlayer";
        game.scoreboard.winningSide = "soloPlayer";
      }

      this.determineBestPlayer(game);
      return;
    }

    const innings1Runs = Number(game.scoreboard.innings1?.totalRuns || 0);
    const innings2Runs = Number(game.scoreboard.innings2?.totalRuns || 0);

    if (game.mode === "solo") {
      if (innings2Runs > innings1Runs) {
        game.winnerUserId = "server";
        game.winnerUsername = game.solo?.serverUsername || "Cricket Server";
        game.winnerSide = "server";
        game.scoreboard.winningSide = "server";
      } else if (innings1Runs > innings2Runs) {
        const user = game.players.find((p) => !p.isBot);
        game.winnerUserId = user?.userId || "";
        game.winnerUsername = user?.username || "";
        game.winnerSide = "soloPlayer";
        game.scoreboard.winningSide = "soloPlayer";
      } else {
        game.winnerUserId = undefined;
        game.winnerUsername = undefined;
        game.winnerSide = null;
        game.scoreboard.winningSide = null;
      }

      this.determineBestPlayer(game);
      return;
    }

    if (game.mode === "team") {
      if (innings1Runs > innings2Runs) {
        game.winnerSide = "teamA";
        game.scoreboard.winningSide = "teamA";
        game.scoreboard.winningTeamName = "الفريق A";
      } else if (innings2Runs > innings1Runs) {
        game.winnerSide = "teamB";
        game.scoreboard.winningSide = "teamB";
        game.scoreboard.winningTeamName = "الفريق B";
      } else {
        game.winnerSide = null;
        game.scoreboard.winningSide = null;
      }

      const winningTeamPlayers =
        game.winnerSide === "teamA"
          ? game.players.filter((p) => p.team === "teamA")
          : game.winnerSide === "teamB"
          ? game.players.filter((p) => p.team === "teamB")
          : [];

      const topWinner = winningTeamPlayers.find((p) => !p.isBot);
      if (topWinner) {
        game.winnerUserId = topWinner.userId;
        game.winnerUsername = topWinner.username;
      }

      this.determineBestPlayer(game);
    }
  }

  startSecondInnings(game: CricketGame): CricketGame {
    if (game.currentInningsNumber !== 1) {
      throw new Error("Second innings cannot start now");
    }

    if (game.status !== "innings_break") {
      throw new Error("Game is not in innings break");
    }

    game.currentInningsNumber = 2;
    game.status = "live";

    if (game.mode === "solo") {
      game.innings = this.createInningsFromSide(game, 2, "server", "soloPlayer");
    } else if (game.mode === "team") {
      game.innings = this.createInningsFromSide(game, 2, "teamB", "teamA");
    } else {
      throw new Error("FFA mode does not have second innings");
    }

    game.currentTurnUserId = game.innings.strikerUserId || null;
    return game;
  }

  playBall(game: CricketGame, actorUserId: string) {
    if (game.status !== "live") {
      throw new Error("Game is not live");
    }

    if (String(game.currentTurnUserId || "") !== String(actorUserId)) {
      throw new Error("It is not your turn");
    }

    const player = this.getCurrentPlayer(game);
    const score = this.getCurrentPlayerScore(game);

    if (!player || !score) {
      throw new Error("Current player not found");
    }

    const result = randomBall();

    score.balls += 1;
    game.innings.totalBalls += 1;
    game.innings.overBalls += 1;

    if (result === "W") {
      score.isOut = true;
      score.strikeRate = safeStrikeRate(score.runs, score.balls);
      game.innings.wickets += 1;
    } else {
      score.runs += Number(result);
      game.innings.totalRuns += Number(result);

      if (result === 4) score.fours += 1;
      if (result === 6) score.sixes += 1;

      score.strikeRate = safeStrikeRate(score.runs, score.balls);
    }

    if (game.innings.overBalls >= this.getBallsPerOver(game)) {
      game.innings.overBalls = 0;
      game.innings.overNumber += 1;
    }

    this.pushBallEvent(game, player, result);

    const shouldEnd = this.shouldEndInnings(game);

    if (result === "W") {
      this.moveToNextBatsman(game);
    }

    if (!shouldEnd && result !== "W") {
      game.currentTurnUserId = player.userId;
      game.innings.strikerUserId = player.userId;
    }

    if (shouldEnd) {
      this.completeCurrentInnings(game);
    }

const statusAfterBall = game.status as CricketGame["status"];
return {
  game,
  result,
  player,
  score,
  inningsEnded:
    statusAfterBall === "innings_break" || statusAfterBall === "finished",
  gameFinished: statusAfterBall === "finished",
  statusAfterBall,
};
  }

  playBotTurn(game: CricketGame) {
    const bot = this.getCurrentPlayer(game);

    if (!bot || !bot.isBot) {
      throw new Error("Current bot player not found");
    }

    return this.playBall(game, bot.userId);
  }
}

export const cricketEngine = new CricketEngine();