// Balance check for the Roles mode: full 5-player games of bots, one role
// each, in a shuffled seat order every game, next to as many Classic games as
// a baseline. Not a test: no pass or fail, only numbers to compare after a
// rule change. Run from backend/: npm run sim -- 10000 [adept|apprentice|mixed]
// Mixed gives each seat a random personality every game, and splits each
// role's line by it.

import { normalizeBotLevel, type BotLevel } from "../game/wizard/botLevels.js";
import { assignBotPersonalities } from "../game/wizard/bots/index.js";
import { DEFAULT_GAME_OPTIONS } from "../game/wizard/gameOptions.js";
import type { GamePlayer } from "../game/wizard/models/wizardGame.js";
import type { GameMode } from "../game/wizard/modes/modes.js";
import { botFishingSpot } from "../game/wizard/modes/roles/rolePowers.js";
import { ROLES, type RoleId } from "../game/wizard/modes/roles/roles.js";
import { WizardBotService } from "../game/wizard/services/wizardBotService.js";
import { WizardGameService } from "../game/wizard/services/wizardGameService.js";

type Seat = RoleId | "classic";

interface Stat {
  games: number;
  wins: number;
  scores: number[];
  rounds: number;
  hits: number;
  tricks: number;
  gained: number;
  lost: number;
}

const service = new WizardGameService();
const bots = new WizardBotService(service);

const shuffled = <T>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
};

// One whole game, every move made as the server makes a bot's.
function playGame(mode: GameMode, seats: Seat[], level: BotLevel): GamePlayer[] {
  const names = seats.map((seat, i) => `${seat}${i} NPC`);
  const game = service.createGame(1, names, new Map(), undefined, 1, { ...DEFAULT_GAME_OPTIONS, mode });

  assignBotPersonalities(game.players, level);
  game.players.forEach((player, i) => {
    const seat = seats[i];
    if (mode === "roles" && seat && seat !== "classic") player.role = seat;
  });

  while (game.status !== "finished") {
    const player = game.players[game.currentPlayerIndex]!;

    if (game.phase === "trump-selection") {
      service.chooseTrumpSuit(game, player.username, bots.chooseTrumpSuit(game));
    } else if (game.phase === "predictions") {
      service.submitPrediction(game, player.username, bots.choosePrediction(game));
    } else if (game.phase === "fishing") {
      service.fishCard(game, player.username, botFishingSpot(game));
    } else if (game.currentTrick.winnerUsername) {
      service.advanceAfterTrick(game);
    } else {
      const cardIndex = bots.chooseCardIndex(game);
      service.playCard(game, cardIndex, false, bots.chooseStealSpot(game, cardIndex));
    }
  }

  return game.players;
}

// Each seat's results over many games; a shared win counts as a part.
function run(mode: GameMode, seats: Seat[], games: number, level: BotLevel): Map<string, Stat> {
  const stats = new Map<string, Stat>();

  for (let g = 0; g < games; g++) {
    const order = shuffled(seats);
    const players = playGame(mode, order, level);
    const best = Math.max(...players.map((player) => player.score));
    const winners = players.filter((player) => player.score === best).length;

    players.forEach((player, i) => {
      const seat = level === "mixed" ? `${order[i]}/${player.botPersonality}` : order[i]!;
      const stat = stats.get(seat) ?? { games: 0, wins: 0, scores: [], rounds: 0, hits: 0, tricks: 0, gained: 0, lost: 0 };

      stat.games++;
      stat.scores.push(player.score);
      if (player.score === best) stat.wins += 1 / winners;
      for (const round of player.roundScores) {
        stat.rounds++;
        stat.tricks += round.tricksWon;
        if (round.tricksWon === round.prediction) stat.hits++;
        for (const points of Object.values(round.roleBonuses ?? {})) {
          if (points > 0) stat.gained += points;
          else stat.lost += points;
        }
      }
      stats.set(seat, stat);
    });
  }

  return stats;
}

const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
const perGame = (n: number, stat: Stat) => (n / stat.games).toFixed(1);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

function row(seat: string, stat: Stat): string {
  return [
    seat.padEnd(19),
    percent(stat.wins / stat.games).padStart(8),
    perGame(stat.scores.reduce((a, b) => a + b, 0), stat).padStart(9),
    String(median(stat.scores)).padStart(6),
    percent(stat.hits / stat.rounds).padStart(7),
    perGame(stat.tricks, stat).padStart(11),
    perGame(stat.gained, stat).padStart(10),
    perGame(stat.lost, stat).padStart(8),
  ].join(" | ");
}

const games = Number(process.argv[2] ?? 1000);
const level = normalizeBotLevel(process.argv[3] ?? "adept");
const roles = ROLES.map((role) => role.id);
const byWins = (stats: Map<string, Stat>) => [...stats].sort((a, b) => b[1].wins / b[1].games - a[1].wins / a[1].games);

console.log(`${games} games per mode, ${roles.length} bots (${level}), a full game each\n`);
console.log(`${"role".padEnd(19)} | win rate | avg score | median | bid hit | tricks/game | role gain | role loss`);
for (const [seat, stat] of byWins(run("roles", roles, games, level))) {
  console.log(row(seat, stat));
}
for (const [seat, stat] of byWins(run("classic", roles.map(() => "classic" as const), games, level))) {
  console.log(row(seat, stat));
}
