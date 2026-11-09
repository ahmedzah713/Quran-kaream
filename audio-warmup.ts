import { clearPreloadedSource, preload } from "expo-audio";
import { Platform } from "react-native";

const MAX_PREWARMED_SOURCES = 4;
const nativeWarmups = new Map<string, Promise<void>>();
const webWarmups = new Map<string, HTMLAudioElement>();
type AudioPrewarmOptions = { webPreload?: "auto" | "metadata" };

function releaseWebAudio(audio: HTMLAudioElement) {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

function trimWebWarmups() {
  while (webWarmups.size > MAX_PREWARMED_SOURCES) {
    const oldest = webWarmups.entries().next().value as [string, HTMLAudioElement] | undefined;
    if (!oldest) return;
    webWarmups.delete(oldest[0]);
    releaseWebAudio(oldest[1]);
  }
}

/** Begin buffering a likely next track without making playback wait for the warm-up. */
export function prewarmAudioSource(uri: string, options: AudioPrewarmOptions = {}) {
  if (!uri) return;

  if (Platform.OS === "web") {
    if (typeof Audio === "undefined") return;
    const existing = webWarmups.get(uri);
    if (existing) {
      if (options.webPreload === "auto" && existing.preload !== "auto") {
        existing.preload = "auto";
        existing.load();
      }
      return;
    }
    const audio = new Audio();
    audio.preload = options.webPreload ?? "auto";
    audio.src = uri;
    audio.dataset.quranWarmUri = uri;
    audio.load();
    webWarmups.set(uri, audio);
    trimWebWarmups();
    return;
  }

  if (nativeWarmups.has(uri)) return;
  const pending = preload({ uri }, { preferredForwardBufferDuration: 10 }).catch(() => {
    nativeWarmups.delete(uri);
  });
  nativeWarmups.set(uri, pending);
  if (nativeWarmups.size > MAX_PREWARMED_SOURCES) {
    const oldestUri = nativeWarmups.keys().next().value as string | undefined;
    if (oldestUri) {
      nativeWarmups.delete(oldestUri);
      void clearPreloadedSource({ uri: oldestUri }).catch(() => undefined);
    }
  }
}

/** Take a warmed HTMLAudioElement so Web playback can reuse its active network buffer. */
export function takePrewarmedWebAudio(uri: string): HTMLAudioElement | null {
  if (Platform.OS !== "web") return null;
  const audio = webWarmups.get(uri) ?? null;
  if (audio) webWarmups.delete(uri);
  return audio;
}

/** Keep a recently played Web element warm as the immediate previous-track buffer. */
export function keepWebAudioWarm(uri: string, audio: HTMLAudioElement) {
  if (Platform.OS !== "web" || !uri) return;
  const existing = webWarmups.get(uri);
  if (existing && existing !== audio) releaseWebAudio(existing);
  audio.pause();
  audio.dataset.quranWarmUri = uri;
  audio.preload = "auto";
  webWarmups.set(uri, audio);
  trimWebWarmups();
}

/** Mark a native preloaded source as consumed by AudioPlayer.replace/createAudioPlayer. */
export function consumePrewarmedAudioSource(uri: string) {
  if (Platform.OS !== "web") nativeWarmups.delete(uri);
}
