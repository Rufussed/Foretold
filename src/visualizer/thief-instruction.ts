// What the Thief's winner is told to do next, shown in the announcement box in
// place of the usual "choose how to use it" line. The heist sets it as the
// winner moves through the steps; null when there is nothing to say.
let instruction: string | null = null;

export const thiefInstruction = (): string | null => instruction;

export const setThiefInstruction = (text: string | null): void => {
  instruction = text;
};
