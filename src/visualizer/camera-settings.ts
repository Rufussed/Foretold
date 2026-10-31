// The camera's two switches, remembered in this browser, for a settings
// window to come: whether the camera turns by itself toward whoever's move it
// is (turn-camera.ts), and whether you can turn it yourself (look-around.ts).
// Both on unless switched off.
const FOLLOW_KEY = "wizard-camera-follow";
const LOOK_KEY = "wizard-camera-look";

const read = (key: string): boolean => {
  try {
    return localStorage.getItem(key) !== "false";
  } catch {
    return true;
  }
};

const write = (key: string, on: boolean): void => {
  try {
    localStorage.setItem(key, String(on));
  } catch {
    // Storage unavailable: the choice lasts for this visit only.
  }
};

export const isAutoFollowOn = (): boolean => read(FOLLOW_KEY);
export const setAutoFollow = (on: boolean): void => write(FOLLOW_KEY, on);

export const isLookAroundOn = (): boolean => read(LOOK_KEY);
export const setLookAround = (on: boolean): void => write(LOOK_KEY, on);
