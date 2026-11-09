export type WebAudioElement = Pick<
  HTMLAudioElement,
  "currentTime" | "getAttribute" | "load" | "pause" | "play" | "removeAttribute" | "setAttribute"
>;

/** Reuse one media element across sources and catch browser autoplay-policy rejections. */
export async function playWebAudioSource(
  audio: WebAudioElement,
  uri: string,
  restartCurrentSource = true,
): Promise<boolean> {
  const currentSource = audio.getAttribute("src");
  if (currentSource !== uri) {
    audio.pause();
    audio.setAttribute("src", uri);
    audio.load();
  } else if (restartCurrentSource) {
    audio.currentTime = 0;
  }

  try {
    await audio.play();
    return true;
  } catch {
    // Media play() is promise-based on the Web; a denied request must never escape as an uncaught rejection.
    return false;
  }
}

export function stopWebAudioSource(audio: WebAudioElement, clearSource = false) {
  audio.pause();
  if (clearSource) {
    audio.removeAttribute("src");
    audio.load();
  } else {
    audio.currentTime = 0;
  }
}
