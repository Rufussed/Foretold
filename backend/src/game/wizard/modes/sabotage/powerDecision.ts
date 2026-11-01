import { WIZARD_TIMING } from "../../wizardTiming.js";
import { wizardSessionManager } from "../../services/wizardSessionManager.js";
import { skipPower, usePower } from "./cardPowers.js";
import { chooseSabotagePower, chooseSabotageThief } from "./bots/index.js";
import { chooseSabotageThiefTarget, swapSabotageThiefCards } from "./sabotageThief.js";

// The game runner's step for a Sabotage power (wizardGameRunner.ts): a bot,
// a seat the server plays, or a human whose time ran out decides what the
// winner of a Seer, Trickster or Thief trick does with it. A human who ran out
// of time leaves it unused.
export async function runSabotagePowerDecision(step: {
  roomId: number;
  decisionPlayer: string;
  deadline: number | null;
  timedOutHuman: boolean;
  broadcast: () => void;
  wait: (milliseconds: number) => Promise<void>;
}): Promise<void> {
  const game = wizardSessionManager.getGame(step.roomId);

  // Something changed while the bot was thinking.
  if (
    !game ||
    game.phase !== "power" ||
    game.turnDeadlineAt !== step.deadline ||
    game.players[game.currentPlayerIndex]?.username !== step.decisionPlayer
  ) {
    return;
  }

  const kind = game.currentTrick.sabotagePower?.kind;

  if (step.timedOutHuman) {
    skipPower(game, step.decisionPlayer);
  } else if (kind === "thief") {
    const theft = chooseSabotageThief(game);

    if (!theft) {
      // Nothing to gain: left unused.
      skipPower(game, step.decisionPlayer);
    } else {
      // Named first, so the target is told, then the card is taken.
      chooseSabotageThiefTarget(game, step.decisionPlayer, theft.target);
      wizardSessionManager.saveGame(game);
      step.broadcast();
      await step.wait(WIZARD_TIMING.botTrumpDelayMs);
      swapSabotageThiefCards(game, step.decisionPlayer, theft);
    }
  } else {
    const choice = chooseSabotagePower(game);

    // A Trickster with nobody worth changing is left unused.
    if (kind === "trickster" && choice.target === null) {
      skipPower(game, step.decisionPlayer);
    } else {
      usePower(game, step.decisionPlayer, choice);
    }
  }

  game.turnDeadlineAt = null;
  wizardSessionManager.saveGame(game);
  step.broadcast();
}
