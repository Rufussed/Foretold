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

  // Plays the live stream while it works, trying each mirror, then the tracks.
  let streamIndex = 0;
  let streaming = MUSIC.streams.length > 0;

  const audio = new Audio(streaming ? MUSIC.streams[streamIndex] : MUSIC.urls[currentIndex]);
  audio.loop = false;
  audio.volume = 0;
  audio.preload = "auto";

  // Rises from silence to full volume once the music actually starts playing: the
  // first time, when the stream connects or the tracks begin, and again after
  // being unmuted. The next track in a playlist carries on at full volume.
  let needsFade = true;
  let fadeFrame = 0;
  const stopFade = (): void => {
    cancelAnimationFrame(fadeFrame);
    fadeFrame = 0;
  };
  const fadeIn = (): void => {
    stopFade();
    const seconds = MUSIC.fadeInSeconds;
    if (seconds <= 0) {
      audio.volume = MUSIC.volume;
      return;
    }
    audio.volume = 0;
    const startedAt = performance.now();
    const step = (now: number): void => {
      const progress = Math.min((now - startedAt) / (seconds * 1000), 1);
      audio.volume = MUSIC.volume * progress;
      fadeFrame = progress < 1 ? requestAnimationFrame(step) : 0;
    };
    fadeFrame = requestAnimationFrame(step);
  };

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

  const fallBackToTracks = (): void => {
    if (!streaming || disposed) {
      return;
    }

    needsFade = true;
    streamIndex += 1;
    if (streamIndex < MUSIC.streams.length) {
      console.warn(`[music] a stream failed; trying ${MUSIC.streams[streamIndex]}`);
      audio.src = MUSIC.streams[streamIndex];
    } else {
      console.warn("[music] the streams failed; playing the tracks");
      streaming = false;
      audio.src = MUSIC.urls[currentIndex];
    }
    start();
  };

  audio.addEventListener("playing", () => {
    console.info(`[music] playing ${audio.currentSrc}`);
    if (needsFade) {
      needsFade = false;
      fadeIn();
    }
  });
  audio.addEventListener("error", () =>
    console.warn(`[music] could not play ${audio.currentSrc} (media error ${audio.error?.code ?? "?"})`),
  );

  // A stream only "ends" if the connection drops.
  audio.addEventListener("ended", () => (streaming ? fallBackToTracks() : playNext()));
  audio.addEventListener("error", fallBackToTracks);
  start();

  return {
    get muted() {
      return muted;
    },

    setMuted(next: boolean): void {
      muted = next;
      saveMuted(next);

      if (next) {
        stopFade();
        audio.pause();
        if (streaming) {
          // Stop downloading the stream; it comes back live, not from where it paused.
          audio.removeAttribute("src");
          audio.load();
        }
      } else {
        needsFade = true;
        if (streaming) {
          audio.src = MUSIC.streams[streamIndex];
        }
        start();
      }
    },

    dispose(): void {
      disposed = true;
      stopFade();
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
