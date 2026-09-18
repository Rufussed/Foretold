import { MUSIC } from "./config";

export interface BackgroundMusic {
  readonly muted: boolean;
  setMuted(muted: boolean): void;
  dispose(): void;
}

const MUTED_KEY = "wizard-music-muted";

const readMuted = (): boolean => {
  try {
    return localStorage.getItem(MUTED_KEY) === "true";
  } catch {
    return false;
  }
};

const saveMuted = (muted: boolean): void => {
  try {
    localStorage.setItem(MUTED_KEY, String(muted));
  } catch {
    // Storage unavailable: the choice lasts for this visit only.
  }
};

export function createBackgroundMusic(): BackgroundMusic {
  let currentIndex = 0;
  let disposed = false;
  let muted = readMuted();

  const audio = new Audio(MUSIC.urls[currentIndex]);
  audio.loop = false;
  audio.volume = MUSIC.volume;
  audio.preload = "auto";

  const unlockEvents = ["pointerdown", "keydown"] as const;

  const start = (): void => {
    if (disposed || muted) {
      return;
    }

    audio.play().catch(() => {
      for (const type of unlockEvents) {
        window.addEventListener(
          type,
          retryOnInteraction,
          true,
        );
      }
    });
  };

  const retryOnInteraction = (): void => {
    for (const type of unlockEvents) {
      window.removeEventListener(
        type,
        retryOnInteraction,
        true,
      );
    }

    start();
  };

  const playNext = (): void => {
    if (disposed || muted) {
      return;
    }

    currentIndex =
      (currentIndex + 1) % MUSIC.urls.length;

    audio.src = MUSIC.urls[currentIndex];
    start();
  };

  audio.addEventListener("ended", playNext);
  start();

  return {
    get muted() {
      return muted;
    },

    setMuted(next: boolean): void {
      muted = next;
      saveMuted(next);

      if (next) {
        audio.pause();
      } else {
        start();
      }
    },

    dispose(): void {
      disposed = true;
      audio.removeEventListener("ended", playNext);

      for (const type of unlockEvents) {
        window.removeEventListener(
          type,
          retryOnInteraction,
          true,
        );
      }

      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    },
  };
}

// import { MUSIC } from "./config";

// export interface BackgroundMusic {
//   readonly muted: boolean;
//   setMuted(muted: boolean): void;
//   dispose(): void;
// }

// const MUTED_KEY = "wizard-music-muted";

// const readMuted = (): boolean => {
//   try {
//     return localStorage.getItem(MUTED_KEY) === "true";
//   } catch {
//     return false;
//   }
// };

// const saveMuted = (muted: boolean) => {
//   try {
//     localStorage.setItem(MUTED_KEY, String(muted));
//   } catch {
//     // Storage unavailable: the choice lasts for this visit only.
//   }
// };

// // The ambient track, looping while the 3D view is open. Muting is remembered
// // in this browser. Browsers may refuse to start audio before the page has been
// // interacted with; then it starts on the first click, tap or key press.
// export function createBackgroundMusic(): BackgroundMusic {
//   const audio = new Audio(MUSIC.url);
//   audio.loop = true;
//   audio.volume = MUSIC.volume;
//   audio.preload = "auto";

//   let muted = readMuted();
//   let disposed = false;

//   const unlockEvents = ["pointerdown", "keydown"] as const;
//   const retryOnInteraction = () => {
//     for (const type of unlockEvents) window.removeEventListener(type, retryOnInteraction, true);
//     start();
//   };

//   const start = () => {
//     if (disposed || muted) return;
//     audio.play().catch(() => {
//       // Not allowed yet: wait for the player to interact with the page.
//       for (const type of unlockEvents) window.addEventListener(type, retryOnInteraction, true);
//     });
//   };

//   start();

//   return {
//     get muted() {
//       return muted;
//     },

//     setMuted(next) {
//       muted = next;
//       saveMuted(next);
//       if (next) audio.pause();
//       else start();
//     },

//     dispose() {
//       disposed = true;
//       for (const type of unlockEvents) window.removeEventListener(type, retryOnInteraction, true);
//       audio.pause();
//       audio.removeAttribute("src");
//       audio.load();
//     },
//   };
// }
