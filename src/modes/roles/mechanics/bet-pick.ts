import * as THREE from "three";
import type { Card } from "../../../../backend/src/game/wizard/models/card";
import { canBet } from "../../../../backend/src/game/wizard/modes/roles/gambler";
import { canLower } from "../../../../backend/src/game/wizard/modes/roles/prophet";
import { isLocalTurn, localPlayer, type GameConnection } from "../../../visualizer/game-connection";
import type { TableCards } from "../../../visualizer/table-cards";
import { t } from "../../../i18n";
import type { ChoiceTimer } from "../choice-timer";

// Roles mode only. A Gambler's bet: when you play your 10 with its power on,
// it waits where it was played while two buttons under it ask "Bet" or
// "Don't bet", like a blackjack player deciding. The answer goes to the
// server with the card, as play_card's bet. A Prophet's 12 asks the same
// way, "Lower bid" or "Keep bid", and the answer goes as the same bet.

export interface BetPick {
  // Before the local player's card is sent: whether they bet on it. Undefined
  // when there is nothing to choose, null when the turn passed first.
  ask(cardIndex: number): Promise<boolean | null | undefined>;
  // Call after every game-state update; closes the choice once the turn has
  // passed, e.g. when time ran out.
  applyState(): void;
  dispose(): void;
}

export interface BetPickOptions {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  cards: TableCards;
  game: GameConnection;
  // Where the buttons go: the game page, over the canvas.
  page: HTMLElement;
  // Times the choice on the hourglass; when time runs out, no bet and the
  // prediction kept (../choice-timer.ts).
  timer?: ChoiceTimer;
}

// What the local player's card, played now, asks: a Gambler's bet, a
// Prophet's lower bid, or nothing.
function choiceFor(game: GameConnection, card: Card): "bet" | "lower" | null {
  const state = game.state();
  const player = localPlayer(game);
  if (!state || !player) return null;
  const local = game.localUsername;
  const roleOf = (username: string) => state.players.find((player) => player.username === username)?.role ?? undefined;
  const trick = [...state.currentTrick.playedCards, { username: local, playedBy: local, card }];
  if (canBet(trick, trick.length - 1, state.trumpSuit, roleOf)) return "bet";
  return canLower(trick, trick.length - 1, state.trumpSuit, roleOf, player) ? "lower" : null;
}

export function createBetPick({ canvas, camera, cards, game, page, timer }: BetPickOptions): BetPick {
  const choice = document.createElement("div");
  choice.className = "bet-pick";
  choice.hidden = true;
  choice.innerHTML = `
    <button type="button" class="bet-pick-yes"></button>
    <button type="button" class="bet-pick-no"></button>
  `;
  page.append(choice);
  const yes = choice.querySelector<HTMLButtonElement>(".bet-pick-yes")!;
  const no = choice.querySelector<HTMLButtonElement>(".bet-pick-no")!;

  let answer: ((bet: boolean | null) => void) | null = null;
  const finish = (bet: boolean | null) => {
    timer?.stop();
    choice.hidden = true;
    const resolve = answer;
    answer = null;
    resolve?.(bet);
  };
  choice.querySelector(".bet-pick-yes")!.addEventListener("click", () => finish(true));
  choice.querySelector(".bet-pick-no")!.addEventListener("click", () => finish(false));

  // The buttons sit centred just under the waiting card.
  const box = new THREE.Box3();
  const corner = new THREE.Vector3();
  let frame = 0;
  const follow = () => {
    frame = requestAnimationFrame(follow);
    const object = answer ? cards.pendingCardObject() : null;
    if (!object) return;
    const rect = canvas.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();
    box.setFromObject(object);
    let left = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      corner.project(camera);
      const x = rect.left + ((corner.x + 1) / 2) * rect.width;
      left = Math.min(left, x);
      right = Math.max(right, x);
      bottom = Math.max(bottom, rect.top + ((1 - corner.y) / 2) * rect.height);
    }
    choice.style.left = `${(left + right) / 2 - pageRect.left}px`;
    choice.style.top = `${bottom - pageRect.top + 12}px`;
  };
  frame = requestAnimationFrame(follow);

  return {
    ask(cardIndex) {
      const card = localPlayer(game)?.hand[cardIndex];
      const kind = card ? choiceFor(game, card) : null;
      if (!kind) return Promise.resolve(undefined);
      finish(null);
      yes.textContent = t(kind === "bet" ? "pick.bet" : "pick.lower");
      no.textContent = t(kind === "bet" ? "pick.noBet" : "pick.keepBid");
      choice.hidden = false;
      const promise = new Promise<boolean | null>((resolve) => {
        answer = resolve;
      });
      timer?.start(() => finish(false));
      return promise;
    },

    applyState() {
      if (answer && (game.state()?.phase !== "playing" || !isLocalTurn(game))) finish(null);
    },

    dispose() {
      cancelAnimationFrame(frame);
      finish(null);
      choice.remove();
    },
  };
}
