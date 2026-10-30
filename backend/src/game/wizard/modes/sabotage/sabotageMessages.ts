import type { CardValue } from "../../models/card.js";
import type { WizardGameState } from "../../models/wizardGame.js";
import { normalizeGameOptions } from "../../gameOptions.js";
import { SABOTAGE_THIEF_VALUE, SEER_VALUE, TRICKSTER_VALUE, skipPower, usePower } from "./cardPowers.js";
import { devBotThief, devGiveCard } from "./devTools.js";
import { chooseSabotageThiefTarget, swapSabotageThiefCards } from "./sabotageThief.js";

// The socket messages of a Sabotage game (websocket/wizardSocket.ts):
//   { type: "use_power", target?, prediction }  a Seer's or Trickster's choice;
//                                               target only for the Trickster
//   { type: "skip_power" }                      leave the power unused
//   { type: "sabotage_thief_target", target }   the Thief's player to rob
//   { type: "sabotage_thief_swap", ownIndex, targetIndex }
//   { type: "dev_give_card", value, cardIndex? }   WIZARD_DEV_TOOLS only
//   { type: "dev_bot_thief", mode: "me" | "other" } WIZARD_DEV_TOOLS only
export interface SabotageMessage {
  type?: string;
  prediction?: number;
  cardIndex?: number;
  target?: string;
  ownIndex?: number;
  targetIndex?: number;
  value?: number;
  mode?: string;
}

const isSabotage = (game: WizardGameState): boolean => normalizeGameOptions(game.options).mode === "sabotage";

const devToolsOn = (game: WizardGameState): boolean => !!process.env.WIZARD_DEV_TOOLS && isSabotage(game);

// The test shortcut that swaps a card in your hand for a special one, at any
// time, whoever's move it is, leaving the move's clock alone. True when the
// message was this one and the card was given; an error says why not.
export function handleSabotageDevCard(game: WizardGameState, username: string, message: SabotageMessage): boolean {
  if (message.type !== "dev_give_card" || !devToolsOn(game)) return false;

  const wanted: number[] = [0, SABOTAGE_THIEF_VALUE, TRICKSTER_VALUE, SEER_VALUE, 14];
  if (message.value === undefined || !wanted.includes(message.value)) {
    throw new Error("Invalid card");
  }

  devGiveCard(game, username, message.value as CardValue, typeof message.cardIndex === "number" ? message.cardIndex : 0);
  return true;
}

// A move of a Sabotage game. False when the message is not one of them.
export function handleSabotageMove(
  game: WizardGameState,
  username: string,
  message: SabotageMessage,
  playCard: (game: WizardGameState, cardIndex: number) => void,
): boolean {
  if (message.type === "skip_power") {
    skipPower(game, username);
  } else if (message.type === "use_power") {
    if (typeof message.prediction !== "number" || !Number.isInteger(message.prediction) || message.prediction < 0) {
      throw new Error("Invalid prediction");
    }

    usePower(game, username, {
      target: typeof message.target === "string" ? message.target : null,
      prediction: message.prediction,
    });
  } else if (message.type === "sabotage_thief_target") {
    if (typeof message.target !== "string") {
      throw new Error("Invalid target");
    }

    chooseSabotageThiefTarget(game, username, message.target);
  } else if (message.type === "sabotage_thief_swap") {
    if (typeof message.ownIndex !== "number" || typeof message.targetIndex !== "number") {
      throw new Error("Invalid card index");
    }

    swapSabotageThiefCards(game, username, { ownIndex: message.ownIndex, targetIndex: message.targetIndex });
  } else if (message.type === "dev_bot_thief" && devToolsOn(game)) {
    devBotThief(game, username, message.mode === "other" ? "other" : "me", playCard);
  } else {
    return false;
  }

  return true;
}
