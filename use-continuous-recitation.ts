import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { AYAH_RECITERS, getAyahAudioUrl, readAyahAudioUrl } from "@/lib/verse-services";
import { audioStatusHasEnded, needsSeparateBasmalaTrack, nextAyahInQuran, upcomingAyahsInQuran, type RecitationAyah } from "@/lib/continuous-recitation";
import { SURAS } from "@/lib/quran-data";
import { consumePrewarmedAudioSource, keepWebAudioWarm, prewarmAudioSource, takePrewarmedWebAudio } from "@/lib/audio-warmup";
import { playWebAudioSource, stopWebAudioSource } from "@/lib/web-audio";

type PlayAyah = (ayah: RecitationAyah, reciterId: string, sessionId: number, continuousTransition?: boolean, skipBasmala?: boolean) => Promise<void>;
type AudioPlayer = ReturnType<typeof createAudioPlayer>;
type RemovableSubscription = { remove: () => void };
type ActiveTrack = { id: number; ayah: RecitationAyah; reciterId: string; sessionId: number; continuousTransition: boolean; phase: "basmala" | "ayah" };

export function useContinuousRecitation() {
  const [currentAyah, setCurrentAyah] = useState<RecitationAyah | null>(null);
  const [selectedReciterId, setSelectedReciterId] = useState(AYAH_RECITERS[0].id);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayingBasmala, setIsPlayingBasmala] = useState(false);
  const [hasError, setHasError] = useState(false);

  const playerRef = useRef<AudioPlayer | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const webAudioUriRef = useRef<string | null>(null);
  const webAudioBoundRef = useRef(new WeakSet<HTMLAudioElement>());
  const playerSubscriptionRef = useRef<RemovableSubscription | null>(null);
  const activeTrackRef = useRef<ActiveTrack | null>(null);
  const currentAyahRef = useRef<RecitationAyah | null>(null);
  const selectedReciterIdRef = useRef(AYAH_RECITERS[0].id);
  const isLoadingRef = useRef(false);
  const isPlayingRef = useRef(false);
  const mountedRef = useRef(true);
  const sessionIdRef = useRef(0);
  const nextTrackIdRef = useRef(0);
  const startedTrackIdRef = useRef<number | null>(null);
  const completedTrackIdRef = useRef<number | null>(null);
  const audioModePromiseRef = useRef<Promise<void> | null>(null);
  const audioUrlCacheRef = useRef(new Map<string, Promise<string>>());
  const playAyahRef = useRef<PlayAyah>(() => Promise.resolve());
  const completionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completeTrackRef = useRef<(track: ActiveTrack) => void>(() => undefined);

  const clearCompletionPoll = useCallback(() => {
    if (completionPollRef.current) clearInterval(completionPollRef.current);
    completionPollRef.current = null;
  }, []);

  const releasePlayer = useCallback(() => {
    clearCompletionPoll();
    try { webAudioRef.current?.pause(); } catch { /* browser audio may already be stopped */ }
    playerSubscriptionRef.current?.remove();
    playerSubscriptionRef.current = null;
    const player = playerRef.current;
    playerRef.current = null;
    if (!player) return;
    try { player.pause(); } catch { /* player may already be finished */ }
    try { player.remove(); } catch { /* player may already be released */ }
  }, [clearCompletionPoll]);

  const ensureAudioMode = useCallback(() => {
    if (audioModePromiseRef.current) return audioModePromiseRef.current;
    const request = setAudioModeAsync({ playsInSilentMode: true });
    audioModePromiseRef.current = request;
    void request.catch(() => {
      if (audioModePromiseRef.current === request) audioModePromiseRef.current = null;
    });
    return request;
  }, []);

  const loadAudioUrl = useCallback((ayah: RecitationAyah, reciterId: string) => {
    const key = `${reciterId}:${ayah.suraId}:${ayah.ayahNumber}`;
    const cache = audioUrlCacheRef.current;
    const cached = cache.get(key);
    if (cached) {
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }

    const reciter = AYAH_RECITERS.find((item) => item.id === reciterId);
    if (!reciter) return Promise.reject(new Error("Unknown reciter"));

    const request = (async () => {
      const response = await fetch(getAyahAudioUrl(ayah.suraId, ayah.ayahNumber, reciter.edition));
      if (!response.ok) throw new Error("Ayah audio request failed");
      const audioUrl = readAyahAudioUrl(await response.json());
      if (!audioUrl) throw new Error("Ayah audio URL is missing");
      return audioUrl;
    })();

    cache.set(key, request);
    while (cache.size > 12) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey === undefined) break;
      cache.delete(oldestKey);
    }
    void request.catch(() => {
      if (cache.get(key) === request) cache.delete(key);
    });
    return request;
  }, []);

  const ensureCurrentSession = useCallback((sessionId: number) =>
    mountedRef.current && sessionId === sessionIdRef.current, []);

  const failTrack = useCallback((track: ActiveTrack) => {
    if (!ensureCurrentSession(track.sessionId) || activeTrackRef.current?.id !== track.id) return;
    activeTrackRef.current = null;
    startedTrackIdRef.current = null;
    clearCompletionPoll();
    releasePlayer();
    isLoadingRef.current = false;
    isPlayingRef.current = false;
    setIsLoading(false);
    setIsPlaying(false);
    setIsPlayingBasmala(false);
    setHasError(true);
  }, [clearCompletionPoll, ensureCurrentSession, releasePlayer]);

  const bindWebAudioElement = useCallback((audio: HTMLAudioElement) => {
    if (webAudioBoundRef.current.has(audio)) return;
    webAudioBoundRef.current.add(audio);
    audio.onwaiting = () => {
      const track = activeTrackRef.current;
      if (audio !== webAudioRef.current || audio.getAttribute("src") !== webAudioUriRef.current || !track) return;
      isLoadingRef.current = true;
      isPlayingRef.current = track.continuousTransition;
      setIsLoading(true);
      setIsPlaying(track.continuousTransition);
    };
    audio.onended = () => {
      const track = activeTrackRef.current;
      if (audio === webAudioRef.current && audio.getAttribute("src") === webAudioUriRef.current && track) {
        completeTrackRef.current(track);
      }
    };
    audio.ontimeupdate = () => {
      const track = activeTrackRef.current;
      if (
        audio === webAudioRef.current && audio.getAttribute("src") === webAudioUriRef.current && track &&
        startedTrackIdRef.current === track.id && audio.duration > 0 &&
        audio.currentTime >= audio.duration - 0.18 && audio.paused
      ) completeTrackRef.current(track);
    };
    audio.onerror = () => {
      const track = activeTrackRef.current;
      if (
        audio !== webAudioRef.current || audio.getAttribute("src") !== webAudioUriRef.current ||
        !track || audio.error?.code === 1
      ) return;
      failTrack(track);
    };
  }, [failTrack]);

  const completeTrack = useCallback((track: ActiveTrack) => {
    if (
      !ensureCurrentSession(track.sessionId) ||
      activeTrackRef.current?.id !== track.id ||
      startedTrackIdRef.current !== track.id ||
      completedTrackIdRef.current === track.id
    ) return;

    completedTrackIdRef.current = track.id;
    startedTrackIdRef.current = null;
    clearCompletionPoll();
    if (track.phase === "basmala") {
      void playAyahRef.current(track.ayah, track.reciterId, track.sessionId, true, true);
      return;
    }
    const nextAyah = nextAyahInQuran(track.ayah, SURAS);
    if (nextAyah) {
      void playAyahRef.current(nextAyah, track.reciterId, track.sessionId, true);
      return;
    }
    activeTrackRef.current = null;
    isLoadingRef.current = false;
    isPlayingRef.current = false;
    setIsLoading(false);
    setIsPlaying(false);
  }, [clearCompletionPoll, ensureCurrentSession]);
  completeTrackRef.current = completeTrack;

  const startCompletionPoll = useCallback((track: ActiveTrack, player: AudioPlayer) => {
    clearCompletionPoll();
    completionPollRef.current = setInterval(() => {
      if (
        !ensureCurrentSession(track.sessionId) ||
        activeTrackRef.current?.id !== track.id ||
        playerRef.current !== player
      ) return;

      const status = player.currentStatus;
      if (status.playing && status.isLoaded && status.duration > 0 && status.currentTime < status.duration - 0.2) {
        startedTrackIdRef.current = track.id;
        isPlayingRef.current = true;
        setIsPlaying(true);
        isLoadingRef.current = false;
        setIsLoading(false);
      }

      // Expo Web may omit didJustFinish from its ended event; status polling is the fallback.
      if (audioStatusHasEnded(status) && startedTrackIdRef.current === track.id) {
        completeTrackRef.current(track);
      }
    }, 120);
  }, [clearCompletionPoll, ensureCurrentSession]);

  const playAyah = useCallback(async (ayah: RecitationAyah, reciterId: string, sessionId: number, continuousTransition = false, skipBasmala = false) => {
    const sura = SURAS.find((item) => item.id === ayah.suraId);
    if (!sura || !ensureCurrentSession(sessionId)) return;

    clearCompletionPoll();
    const startsWithBasmala = !skipBasmala && needsSeparateBasmalaTrack(ayah);
    const audioAyah = startsWithBasmala ? { suraId: 1, ayahNumber: 1 } : ayah;
    const track: ActiveTrack = {
      id: ++nextTrackIdRef.current,
      ayah,
      reciterId,
      sessionId,
      continuousTransition,
      phase: startsWithBasmala ? "basmala" : "ayah",
    };
    activeTrackRef.current = track;
    startedTrackIdRef.current = null;
    completedTrackIdRef.current = null;
    currentAyahRef.current = ayah;
    setCurrentAyah(ayah);
    setIsPlayingBasmala(startsWithBasmala);
    isLoadingRef.current = !continuousTransition;
    isPlayingRef.current = continuousTransition;
    setIsLoading(!continuousTransition);
    setIsPlaying(continuousTransition);
    setHasError(false);
    try { playerRef.current?.pause(); } catch { /* source will be replaced below */ }
    try { webAudioRef.current?.pause(); } catch { /* source will be replaced below */ }

    const isCurrentTrack = () =>
      ensureCurrentSession(sessionId) && activeTrackRef.current?.id === track.id;

    try {
      const [audioUrl] = await Promise.all([loadAudioUrl(audioAyah, reciterId), ensureAudioMode()]);
      if (!isCurrentTrack()) return;

      if (Platform.OS === "web") {
        const warmedAudio = takePrewarmedWebAudio(audioUrl);
        const previousAudio = webAudioRef.current;
        const previousUri = webAudioUriRef.current;
        if (warmedAudio && warmedAudio !== previousAudio) {
          if (previousAudio && previousUri) keepWebAudioWarm(previousUri, previousAudio);
          webAudioRef.current = warmedAudio;
          bindWebAudioElement(warmedAudio);
        }
        const audio = webAudioRef.current;
        if (!audio) throw new Error("Web audio element is unavailable");
        webAudioUriRef.current = audioUrl;
        const didStart = await playWebAudioSource(audio, audioUrl);
        if (!isCurrentTrack()) return;
        if (!didStart) throw new Error("Browser did not allow audio playback");
        startedTrackIdRef.current = track.id;
        isPlayingRef.current = true;
        isLoadingRef.current = false;
        setIsPlaying(true);
        setIsLoading(false);
      } else {
        let player = playerRef.current;
        if (!player) {
          player = createAudioPlayer(
            { uri: audioUrl },
            { updateInterval: 250, preferredForwardBufferDuration: 6 },
          );
          playerRef.current = player;
          playerSubscriptionRef.current = player.addListener("playbackStatusUpdate", (status) => {
            const activeTrack = activeTrackRef.current;
            if (!activeTrack || playerRef.current !== player || !ensureCurrentSession(activeTrack.sessionId)) return;

            if (status.error) {
              failTrack(activeTrack);
              return;
            }

            if (status.isBuffering && !status.playing) {
              isLoadingRef.current = true;
              setIsLoading(true);
            } else if (status.isLoaded) {
              isLoadingRef.current = false;
              setIsLoading(false);
            }

            // Ignore late "playing" events from the source just replaced near its end.
            if (status.playing && status.isLoaded && status.duration > 0 && status.currentTime < status.duration - 0.2) {
              startedTrackIdRef.current = activeTrack.id;
              isPlayingRef.current = true;
              setIsPlaying(true);
            }

            if (status.didJustFinish) completeTrackRef.current(activeTrack);
          });
        } else {
          player.pause();
          player.replace({ uri: audioUrl });
        }

        consumePrewarmedAudioSource(audioUrl);
        player.play();
        startCompletionPoll(track, player);
      }

      const upcoming = track.phase === "basmala"
        ? [ayah, ...upcomingAyahsInQuran(ayah, SURAS, 1)]
        : upcomingAyahsInQuran(ayah, SURAS, 2);
      void Promise.all(upcoming.map(async (upcomingAyah, index) => {
        const upcomingUrl = await loadAudioUrl(upcomingAyah, reciterId);
        prewarmAudioSource(upcomingUrl, { webPreload: index === 0 ? "auto" : "metadata" });
      })).catch(() => undefined);
    } catch {
      if (!isCurrentTrack()) return;
      failTrack(track);
    }
  }, [bindWebAudioElement, clearCompletionPoll, ensureAudioMode, ensureCurrentSession, failTrack, loadAudioUrl, releasePlayer, startCompletionPoll]);
  playAyahRef.current = playAyah;

  const togglePlayback = useCallback((initialAyah?: RecitationAyah | null) => {
    if (isLoadingRef.current && !isPlayingRef.current) {
      sessionIdRef.current += 1;
      activeTrackRef.current = null;
      startedTrackIdRef.current = null;
      releasePlayer();
      try { if (Platform.OS === "web") stopWebAudioSource(webAudioRef.current!, true); } catch { /* already cleared */ }
      webAudioUriRef.current = null;
      isLoadingRef.current = false;
      setIsLoading(false);
      setIsPlaying(false);
      setIsPlayingBasmala(false);
      return;
    }

    if (isPlayingRef.current) {
      try { playerRef.current?.pause(); } catch { /* retain a usable control state */ }
      try { webAudioRef.current?.pause(); } catch { /* retain a usable control state */ }
      clearCompletionPoll();
      isPlayingRef.current = false;
      setIsPlaying(false);
      return;
    }

    const ayah = currentAyahRef.current ?? initialAyah ?? null;
    if (!ayah) return;

    const activeTrack = activeTrackRef.current;
    const player = playerRef.current;
    if (
      Platform.OS === "web" &&
      webAudioRef.current &&
      webAudioUriRef.current &&
      activeTrack &&
      activeTrack.sessionId === sessionIdRef.current &&
      activeTrack.reciterId === selectedReciterIdRef.current &&
      activeTrack.ayah.suraId === ayah.suraId &&
      activeTrack.ayah.ayahNumber === ayah.ayahNumber
    ) {
      const audio = webAudioRef.current;
      const audioUri = webAudioUriRef.current;
      isLoadingRef.current = true;
      setIsLoading(true);
      void playWebAudioSource(audio, audioUri, false).then((didStart) => {
        if (!ensureCurrentSession(activeTrack.sessionId) || activeTrackRef.current?.id !== activeTrack.id) return;
        if (!didStart) {
          failTrack(activeTrack);
          return;
        }
        startedTrackIdRef.current = activeTrack.id;
        isPlayingRef.current = true;
        isLoadingRef.current = false;
        setIsPlaying(true);
        setIsLoading(false);
      });
      return;
    }
    if (
      player &&
      activeTrack &&
      activeTrack.sessionId === sessionIdRef.current &&
      activeTrack.reciterId === selectedReciterIdRef.current &&
      activeTrack.ayah.suraId === ayah.suraId &&
      activeTrack.ayah.ayahNumber === ayah.ayahNumber
    ) {
      isLoadingRef.current = true;
      setIsLoading(true);
      try {
        player.play();
        startCompletionPoll(activeTrack, player);
      } catch {
        isLoadingRef.current = false;
        setIsLoading(false);
        setHasError(true);
      }
      return;
    }

    const sessionId = ++sessionIdRef.current;
    void playAyahRef.current(ayah, selectedReciterIdRef.current, sessionId);
  }, [ensureCurrentSession, failTrack, releasePlayer, startCompletionPoll]);

  const selectReciter = useCallback((reciterId: string) => {
    if (!AYAH_RECITERS.some((item) => item.id === reciterId)) return;
    if (reciterId === selectedReciterIdRef.current) return;

    selectedReciterIdRef.current = reciterId;
    setSelectedReciterId(reciterId);

    const ayah = currentAyahRef.current;
    if (ayah && (isPlayingRef.current || isLoadingRef.current)) {
      const sessionId = ++sessionIdRef.current;
      const skipBasmala = activeTrackRef.current?.phase !== "basmala";
      void playAyahRef.current(ayah, reciterId, sessionId, isPlayingRef.current || isLoadingRef.current, skipBasmala);
    }
  }, []);

  const stop = useCallback(() => {
    sessionIdRef.current += 1;
    activeTrackRef.current = null;
    startedTrackIdRef.current = null;
    releasePlayer();
    try { if (Platform.OS === "web") stopWebAudioSource(webAudioRef.current!, true); } catch { /* already cleared */ }
    webAudioUriRef.current = null;
    currentAyahRef.current = null;
    isLoadingRef.current = false;
    isPlayingRef.current = false;
    setCurrentAyah(null);
    setIsLoading(false);
    setIsPlaying(false);
    setIsPlayingBasmala(false);
    setHasError(false);
  }, [releasePlayer]);

  useEffect(() => {
    mountedRef.current = true;
    let browserAudio: HTMLAudioElement | null = null;
    if (Platform.OS === "web" && typeof Audio !== "undefined") {
      browserAudio = new Audio();
      browserAudio.preload = "auto";
      webAudioRef.current = browserAudio;
      bindWebAudioElement(browserAudio);
    }
    return () => {
      mountedRef.current = false;
      sessionIdRef.current += 1;
      activeTrackRef.current = null;
      releasePlayer();
      if (browserAudio) {
        browserAudio.onwaiting = null;
        browserAudio.onended = null;
        browserAudio.ontimeupdate = null;
        browserAudio.onerror = null;
        stopWebAudioSource(browserAudio, true);
      }
      const activeBrowserAudio = webAudioRef.current;
      if (activeBrowserAudio && activeBrowserAudio !== browserAudio) {
        activeBrowserAudio.onwaiting = null;
        activeBrowserAudio.onended = null;
        activeBrowserAudio.ontimeupdate = null;
        activeBrowserAudio.onerror = null;
        stopWebAudioSource(activeBrowserAudio, true);
      }
      webAudioRef.current = null;
      webAudioUriRef.current = null;
    };
  }, [bindWebAudioElement, failTrack, releasePlayer]);

  return { currentAyah, selectedReciterId, isLoading, isPlaying, isPlayingBasmala, hasError, togglePlayback, selectReciter, stop };
}
