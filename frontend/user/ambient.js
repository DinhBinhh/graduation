const bgMusic = document.getElementById("bg-music");
const musicToggle = document.getElementById("music-toggle");
const wandTarget = document.getElementById("wand-lottie");
const wandCorner = document.querySelector(".wand-corner");
const supportsReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)");

let musicEnabled = false;
let musicSuppressed = false;
let pointerMode = false;
let pointerFrame = null;
let pointerX = 0;
let pointerY = 0;

function isLiteEffectsMode() {
  return coarsePointer.matches || supportsReducedMotion.matches;
}

function syncEffectsMode() {
  document.documentElement.classList.toggle("lite-effects", isLiteEffectsMode());
}

function bindMediaChange(mediaQuery, listener) {
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", listener);
    return;
  }

  if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(listener);
  }
}

function updateMusicButton() {
  if (!musicToggle) return;

  musicToggle.textContent = musicEnabled ? "Tat nhac" : "Bat nhac";
  musicToggle.setAttribute("aria-pressed", String(musicEnabled));
  musicToggle.classList.toggle("is-playing", musicEnabled);
}

async function enableMusic() {
  if (!bgMusic || musicSuppressed) return false;

  try {
    bgMusic.volume = 0.4;
    bgMusic.muted = false;
    await bgMusic.play();
    musicEnabled = true;
    updateMusicButton();
    return true;
  } catch (error) {
    musicEnabled = false;
    updateMusicButton();
    return false;
  }
}

function pauseMusicForPriorityAudio() {
  if (!bgMusic) return;

  musicSuppressed = true;
  bgMusic.pause();
  musicEnabled = false;
  updateMusicButton();
}

async function resumeMusicAfterPriorityAudio() {
  musicSuppressed = false;
  await enableMusic();
}

function disableMusicByUser() {
  if (!bgMusic) return;

  musicSuppressed = true;
  bgMusic.pause();
  musicEnabled = false;
  updateMusicButton();
}

function bindFirstInteractionForMusic() {
  const startOnGesture = async () => {
    if (!musicEnabled && !musicSuppressed) {
      await enableMusic();
    }
    window.removeEventListener("pointerdown", startOnGesture);
    window.removeEventListener("keydown", startOnGesture);
  };

  window.addEventListener("pointerdown", startOnGesture, { once: true });
  window.addEventListener("keydown", startOnGesture, { once: true });
}

function initWandAnimation() {
  if (!wandTarget || !window.lottie || isLiteEffectsMode()) return;

  window.lottie.loadAnimation({
    container: wandTarget,
    renderer: "svg",
    loop: true,
    autoplay: true,
    path: "./magic%20wand.json"
  });
}

function renderPointer() {
  if (!wandCorner || !pointerMode) return;

  wandCorner.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;
  pointerFrame = null;
}

function handlePointerMove(event) {
  if (!pointerMode || !wandCorner) return;

  pointerX = event.clientX;
  pointerY = event.clientY;

  if (!pointerFrame) {
    pointerFrame = window.requestAnimationFrame(renderPointer);
  }
}

function setPointerMode() {
  const desktop = window.matchMedia("(min-width: 861px)").matches && !coarsePointer.matches;
  pointerMode = desktop;

  if (!wandCorner) return;

  document.documentElement.classList.toggle("has-wand-cursor", desktop);
  wandCorner.classList.toggle("wand-corner--cursor", desktop);

  if (desktop) {
    pointerX = window.innerWidth / 2;
    pointerY = window.innerHeight / 2;
    renderPointer();
    window.addEventListener("pointermove", handlePointerMove);
  } else {
    window.removeEventListener("pointermove", handlePointerMove);
    if (pointerFrame) {
      window.cancelAnimationFrame(pointerFrame);
      pointerFrame = null;
    }
    wandCorner.style.transform = "";
  }
}

musicToggle?.addEventListener("click", async () => {
  if (musicEnabled) {
    disableMusicByUser();
    return;
  }

  musicSuppressed = false;
  await enableMusic();
});

window.addEventListener("load", initWandAnimation);
window.addEventListener("load", syncEffectsMode);
window.addEventListener("load", setPointerMode);
window.addEventListener("resize", setPointerMode);
bindMediaChange(coarsePointer, () => {
  syncEffectsMode();
  setPointerMode();
});
bindMediaChange(supportsReducedMotion, syncEffectsMode);
updateMusicButton();
enableMusic();
bindFirstInteractionForMusic();

window.appAudio = {
  enableMusic,
  pauseMusicForPriorityAudio,
  resumeMusicAfterPriorityAudio
};
