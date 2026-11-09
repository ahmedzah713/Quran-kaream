import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useEvent } from "expo";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { useLanguage } from "@/lib/language-provider";
import { SHAAWARI_AUDIO_TRACKS, SHAAWARI_BOOK_PAGE_COUNTS, shaarawiBookPageUrl, shaarawiOcrUrl } from "@/lib/shaarawi-sources";
import { SHAAWARI_AUDIO_TRACK_KEY, SHAAWARI_BOOK_PAGE_KEY, SHAAWARI_BOOK_VOLUME_KEY, SHAAWARI_VIDEO_EPISODE_KEY, SHAAWARI_VIDEO_POSITION_KEY, normalizeShaarawiVideoProgress, shaarawiAudioPositionKey } from "@/lib/shaarawi-progress";
import { findOcrPageMatches, highlightTextParts, type OcrPageMatch } from "@/lib/shaarawi-search";
import { SHAAWARI_INTERVIEWS, SHAAWARI_OFFICIAL_CHANNEL, SHAAWARI_TV_TAFSIR, type ShaarawiVideoItem } from "@/lib/shaarawi-video";
import { SURAS } from "@/lib/quran-data";
import { consumePrewarmedAudioSource, prewarmAudioSource } from "@/lib/audio-warmup";
import { downloadShaarawiMedia, getShaarawiMediaUri } from "@/lib/shaarawi-media-cache";
import { mediaDownloadPercent } from "@/lib/media-download-progress";

function normalizeSurahLabel(value: string) {
  return value.normalize("NFKC").replace(/[ًٌٍَُِّْـٰ]/g, "").replace(/[ٱأإآ]/g, "ا").replace("ال عمران", "ال عمران").replace("سبإ", "سبأ").replace("المائـدة", "المائدة").replace("هودٍ", "هود").trim();
}

function displaySurahLabel(value: string) {
  return value.normalize("NFKC").replace(/[ًٌٍَُِّْـٰ]/g, "").replace("ٱ", "ا").replace("ال عمران", "آل عمران").replace("سبإ", "سبأ").replace("المائـدة", "المائدة").replace("هودٍ", "هود").trim();
}

type DownloadState = "idle" | "downloading" | "saved" | "error";
type Localize = (arabic: string, english: string) => string;

function MediaDownloadAction({ state, percent, disabled, onPress, t }: { state: DownloadState; percent: number | null; disabled: boolean; onPress: () => void; t: Localize }) {
  const label = state === "saved"
    ? t("محفوظ على الهاتف", "Saved on this phone")
    : state === "downloading"
      ? `${t("جارٍ تنزيل الملف", "Downloading file")}${percent === null ? "…" : ` · ${percent}%`}`
      : state === "error"
        ? t("إعادة محاولة التنزيل", "Retry download")
        : t("تنزيل هذا الملف للاستخدام دون إنترنت", "Download this file for offline playback");
  const icon = state === "saved" ? "download-done" : state === "error" ? "refresh" : "download";
  return (
    <View style={{ marginTop: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled || state === "downloading" || state === "saved"} onPress={onPress} style={{ minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: "#80663B", backgroundColor: "#222642", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14, opacity: disabled || state === "saved" ? 0.55 : 1 }}>
        {state === "downloading" && percent === null ? <ActivityIndicator size="small" color="#F0B64A" /> : <MaterialIcons name={icon as never} size={19} color="#F0B64A" />}
        <Text style={{ color: "#F0D28E", fontSize: 13, fontWeight: "700" }}>{label}</Text>
      </Pressable>
      {state === "downloading" && percent !== null ? <View style={{ height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "#30334F", marginTop: 8 }}><View style={{ height: "100%", width: `${percent}%`, backgroundColor: "#F0B64A" }} /></View> : null}
    </View>
  );
}

export function ShaarawiFlow() {
  const router = useRouter();
  const { t, direction } = useLanguage();
  const [tab, setTab] = useState<"audio" | "book" | "video">("audio");
  const [videoFilter, setVideoFilter] = useState<"tafsir" | "interview">("tafsir");
  const [videoIndex, setVideoIndex] = useState(0);
  const [videoSearch, setVideoSearch] = useState("");
  const [selectedSurah, setSelectedSurah] = useState("all");
  const [trackIndex, setTrackIndex] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState("");
  const [audioDownloadTrackIndex, setAudioDownloadTrackIndex] = useState<number | null>(null);
  const [audioDownloadState, setAudioDownloadState] = useState<DownloadState>("idle");
  const [audioDownloadPercent, setAudioDownloadPercent] = useState<number | null>(null);
  const [audioDownloadError, setAudioDownloadError] = useState("");
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [volumePage, setVolumePage] = useState(1);
  const [page, setPage] = useState(0);
  const [pageZoom, setPageZoom] = useState(1);
  const [restored, setRestored] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<OcrPageMatch & { volume: number }>>([]);
  const [searchStatus, setSearchStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [focusedSearchPage, setFocusedSearchPage] = useState<{ volume: number; page: number } | null>(null);
  const [videoPosition, setVideoPosition] = useState(0);
  const [videoResumeReady, setVideoResumeReady] = useState(false);
  const [videoDownloadItemId, setVideoDownloadItemId] = useState<string | null>(null);
  const [videoDownloadState, setVideoDownloadState] = useState<DownloadState>("idle");
  const [videoDownloadPercent, setVideoDownloadPercent] = useState<number | null>(null);
  const [videoDownloadError, setVideoDownloadError] = useState("");
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const audioStatusSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const audioPlaybackRequestedRef = useRef(false);
  const audioPlaybackStartedRef = useRef(false);
  const activeAudioDownloadRef = useRef<number | null>(null);
  const positionRef = useRef(0);
  const audioPositionsRef = useRef(new Map<number, number>());
  const audioRequestRef = useRef(0);
  const lastAudioPositionWriteAtRef = useRef(0);
  const pageRef = useRef(0);
  const volumePageRef = useRef(1);
  const trackIndexRef = useRef(1);
  const track = SHAAWARI_AUDIO_TRACKS[trackIndex];
  const audioActionIsPause = playing || (buffering && audioPlaybackRequestedRef.current);
  const videoItems = videoFilter === "tafsir" ? SHAAWARI_TV_TAFSIR : SHAAWARI_INTERVIEWS;
  const availableSurahCounts = useMemo(() => videoItems.reduce<Record<string, number>>((counts, item) => { if (item.surah) { const key = normalizeSurahLabel(item.surah); counts[key] = (counts[key] ?? 0) + 1; } return counts; }, {}), [videoItems]);
  const visibleVideoItems = useMemo(() => {
    const query = videoSearch.trim().toLowerCase();
    const bySurah = selectedSurah === "all" ? videoItems : videoItems.filter((item) => normalizeSurahLabel(item.surah ?? "") === normalizeSurahLabel(selectedSurah));
    const filtered = query ? bySurah.filter((item) => `${item.title} ${item.surah ?? ""}`.toLowerCase().includes(query)) : bySurah;
    return query || selectedSurah !== "all" ? filtered : filtered.slice(0, 120);
  }, [videoItems, videoSearch, selectedSurah]);
  const selectedVideo = visibleVideoItems[videoIndex] ?? visibleVideoItems[0];
  const videoPlayer = useVideoPlayer(null);
  const videoRequestRef = useRef(0);
  const videoPositionRef = useRef(0);
  const videoLoadedSourceRef = useRef<{ id: string; uri: string } | null>(null);
  const pendingVideoStartRef = useRef<string | null>(null);
  const videoSourceUriRef = useRef<{ id: string; uri: string } | null>(null);
  const activeVideoDownloadRef = useRef<string | null>(null);
  const pendingVideoIdRef = useRef<string | null>(null);
  const videoRestoreAppliedRef = useRef(false);
  const { isPlaying: videoPlaying } = useEvent(videoPlayer, "playingChange", { isPlaying: videoPlayer.playing });
  const videoStatusEvent = useEvent(videoPlayer, "statusChange", { status: videoPlayer.status });
  const videoTimeUpdate = useEvent(videoPlayer, "timeUpdate", { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const currentVideoIsLoaded = videoLoadedSourceRef.current?.id === selectedVideo?.id;
  const currentVideoIsLoading = currentVideoIsLoaded && videoStatusEvent.status !== "error" && (videoStatusEvent.status === "loading" || (pendingVideoStartRef.current === selectedVideo?.id && !videoPlaying));
  const currentVideoIsPlaying = currentVideoIsLoaded && videoStatusEvent.status === "readyToPlay" && videoPlaying;
  const currentAudioDownloadState = audioDownloadTrackIndex === trackIndex ? audioDownloadState : "idle";
  const currentAudioDownloadPercent = audioDownloadTrackIndex === trackIndex ? audioDownloadPercent : null;
  const currentVideoDownloadState = videoDownloadItemId === selectedVideo?.id ? videoDownloadState : "idle";
  const currentVideoDownloadPercent = videoDownloadItemId === selectedVideo?.id ? videoDownloadPercent : null;
  const currentVideoHasError = currentVideoIsLoaded && videoStatusEvent.status === "error";
  useEffect(() => {
    const pendingId = pendingVideoStartRef.current;
    if (!pendingId || pendingId !== selectedVideo?.id) return;
    if (videoStatusEvent.status === "error") {
      pendingVideoStartRef.current = null;
      return;
    }
    if (videoStatusEvent.status !== "readyToPlay") return;
    pendingVideoStartRef.current = null;
    videoPlayer.currentTime = videoPositionRef.current;
    videoPlayer.play();
  }, [videoStatusEvent.status, selectedVideo?.id, videoPlayer]);
  const pageUrl = useMemo(() => shaarawiBookPageUrl(volumePage, page), [volumePage, page]);
  const activePageMatch = useMemo(() => searchResults.find((result) => result.volume === volumePage && result.page === page), [searchResults, volumePage, page]);
  const ocrFetchUrl = (volume: number) => Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname ? `${window.location.protocol}//${window.location.hostname.replace(/^8081-/, "3000-")}/api/shaarawi/ocr/${volume}` : shaarawiOcrUrl(volume, true);

  const saveVideoProgress = async (item = selectedVideo, position = videoPositionRef.current) => {
    if (!item) return;
    await AsyncStorage.multiSet([
      [SHAAWARI_VIDEO_EPISODE_KEY, JSON.stringify({ id: item.id, filter: videoFilter, surah: item.surah ?? undefined, position: Math.max(0, position) })],
      [SHAAWARI_VIDEO_POSITION_KEY, String(Math.max(0, position))],
    ]).catch(() => undefined);
  };

  useEffect(() => {
    videoPlayer.timeUpdateEventInterval = 1;
    return () => { videoPlayer.timeUpdateEventInterval = 0; };
  }, [videoPlayer]);

  useEffect(() => {
    const nextPosition = Number(videoTimeUpdate?.currentTime ?? videoPlayer.currentTime ?? 0);
    if (!Number.isFinite(nextPosition) || nextPosition < 0 || !selectedVideo) return;
    videoPositionRef.current = nextPosition;
    const frame = requestAnimationFrame(() => setVideoPosition(nextPosition));
    if (videoPlaying) void saveVideoProgress(selectedVideo, nextPosition);
    return () => cancelAnimationFrame(frame);
  }, [videoTimeUpdate?.currentTime, videoPlaying, selectedVideo?.id]);

  useEffect(() => {
    AsyncStorage.multiGet([SHAAWARI_VIDEO_EPISODE_KEY, SHAAWARI_VIDEO_POSITION_KEY]).then(([savedEpisode, savedPosition]) => {
      const progress = normalizeShaarawiVideoProgress(savedEpisode[1]);
      const position = Number(savedPosition[1]);
      if (progress) {
        pendingVideoIdRef.current = progress.id;
        setVideoFilter(progress.filter);
        if (progress.surah) setSelectedSurah(progress.surah);
        videoPositionRef.current = Number.isFinite(position) && position >= 0 ? position : progress.position;
        setVideoPosition(videoPositionRef.current);
        setVideoResumeReady(true);
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!pendingVideoIdRef.current || videoRestoreAppliedRef.current) return;
    const index = visibleVideoItems.findIndex((item) => item.id === pendingVideoIdRef.current);
    if (index < 0) return;
    setVideoIndex(index);
    videoRestoreAppliedRef.current = true;
  }, [visibleVideoItems]);

  useEffect(() => {
    const requestId = ++videoRequestRef.current;
    videoPlayer.pause();
    pendingVideoStartRef.current = null;
    videoLoadedSourceRef.current = null;
    if (tab !== "video" || selectedVideo?.source !== "archive") {
      videoSourceUriRef.current = null;
      videoPlayer.replace(null);
      return;
    }
    let active = true;
    void getShaarawiMediaUri("video", selectedVideo.id).then((localUri) => {
      if (!active || requestId !== videoRequestRef.current) return;
      const uri = localUri ?? selectedVideo.url;
      videoSourceUriRef.current = { id: selectedVideo.id, uri };
      const downloadingThisEpisode = activeVideoDownloadRef.current === selectedVideo.id;
      setVideoDownloadItemId(selectedVideo.id);
      setVideoDownloadState(localUri ? "saved" : downloadingThisEpisode ? "downloading" : "idle");
      setVideoDownloadPercent((current) => localUri ? 100 : downloadingThisEpisode ? current : null);
      if (Platform.OS === "web") {
        // Expo Video's web replace() calls HTMLVideoElement.play(); wait for a user gesture.
        videoPlayer.replace(null);
      } else {
        videoLoadedSourceRef.current = { id: selectedVideo.id, uri };
        videoPlayer.replace(uri);
      }
      const shouldResume = pendingVideoIdRef.current === selectedVideo.id && videoPositionRef.current > 0;
      videoPositionRef.current = shouldResume ? videoPositionRef.current : 0;
      setVideoPosition(videoPositionRef.current);
      if (Platform.OS !== "web") videoPlayer.currentTime = videoPositionRef.current;
      void saveVideoProgress(selectedVideo, videoPositionRef.current);
    }).catch(() => undefined);
    return () => {
      active = false;
      if (videoRequestRef.current === requestId) videoPlayer.pause();
    };
  }, [tab, selectedVideo?.id]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    const audioPositionKeys = SHAAWARI_AUDIO_TRACKS.map((_, index) => shaarawiAudioPositionKey(index));
    AsyncStorage.multiGet([SHAAWARI_BOOK_VOLUME_KEY, SHAAWARI_BOOK_PAGE_KEY, SHAAWARI_AUDIO_TRACK_KEY, ...audioPositionKeys]).then((values) => {
      const [savedVolume, savedPage, savedTrack] = values;
      const nextVolume = Number(savedVolume?.[1]);
      const nextPage = Number(savedPage?.[1]);
      const savedTrackIndex = savedTrack?.[1] === null ? Number.NaN : Number(savedTrack?.[1]);
      values.slice(3).forEach(([, storedPosition], index) => {
        const storedValue = Number(storedPosition);
        if (storedPosition !== null && Number.isFinite(storedValue) && storedValue >= 0) audioPositionsRef.current.set(index, storedValue);
      });
      const nextTrack = Number.isInteger(savedTrackIndex) && savedTrackIndex >= 0 && savedTrackIndex < SHAAWARI_AUDIO_TRACKS.length ? savedTrackIndex : 1;
      const nextPosition = audioPositionsRef.current.get(nextTrack) ?? 0;
      if (nextVolume >= 1 && nextVolume <= 3) setVolumePage(nextVolume);
      if (nextPage >= 0) setPage(nextPage);
      setTrackIndex(nextTrack);
      if (nextVolume >= 1 && nextVolume <= 3) volumePageRef.current = nextVolume;
      if (nextPage >= 0) pageRef.current = nextPage;
      trackIndexRef.current = nextTrack;
      positionRef.current = nextPosition;
      setPosition(nextPosition);
      setRestored(true);
    }).catch(() => setRestored(true));
    return () => {
      audioRequestRef.current += 1;
      audioPlaybackRequestedRef.current = false;
      audioStatusSubscriptionRef.current?.remove();
      audioStatusSubscriptionRef.current = null;
      const player = playerRef.current;
      if (player) {
        const currentPosition = player.currentTime;
        if (Number.isFinite(currentPosition) && currentPosition >= 0) positionRef.current = currentPosition;
      }
      void savePosition();
      try { player?.pause(); player?.remove(); } catch { /* already released */ }
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!restored) return;
    let active = true;
    const audioTrack = SHAAWARI_AUDIO_TRACKS[trackIndex];
    if (!audioTrack) return;
    void getShaarawiMediaUri("audio", audioTrack.file).then((uri) => {
      if (!active) return;
      setAudioDownloadTrackIndex(trackIndex);
      setAudioDownloadState(uri ? "saved" : "idle");
      setAudioDownloadPercent(uri ? 100 : null);
    });
    return () => { active = false; };
  }, [restored, trackIndex]);

  useEffect(() => {
    if (!restored || tab !== "audio") return;
    const trackCount = SHAAWARI_AUDIO_TRACKS.length;
    for (const delta of [-1, 0, 1]) {
      const index = (trackIndex + delta + trackCount) % trackCount;
      prewarmAudioSource(SHAAWARI_AUDIO_TRACKS[index].url, { webPreload: "metadata" });
    }
  }, [restored, tab, trackIndex]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const current = playerRef.current as unknown as { currentTime?: number; duration?: number } | null;
      if (current) {
        const nextPosition = current.currentTime ?? 0;
        positionRef.current = nextPosition;
        audioPositionsRef.current.set(trackIndexRef.current, nextPosition);
        setPosition(nextPosition);
        setDuration(current.duration ?? 0);
        const now = Date.now();
        if (now - lastAudioPositionWriteAtRef.current >= 5000) {
          lastAudioPositionWriteAtRef.current = now;
          void savePosition(trackIndexRef.current, nextPosition);
        }
      }
    }, 500);
    return () => clearInterval(timer);
  }, [playing]);

  async function savePosition(audioTrackIndex = trackIndexRef.current, audioPosition = positionRef.current, persistTrackSelection = true) {
    const safePosition = Number.isFinite(audioPosition) && audioPosition >= 0 ? audioPosition : 0;
    audioPositionsRef.current.set(audioTrackIndex, safePosition);
    const updates: [string, string][] = [
      [SHAAWARI_BOOK_VOLUME_KEY, String(volumePageRef.current)],
      [SHAAWARI_BOOK_PAGE_KEY, String(pageRef.current)],
    ];
    if (persistTrackSelection) updates.push([SHAAWARI_AUDIO_TRACK_KEY, String(audioTrackIndex)]);
    updates.push([shaarawiAudioPositionKey(audioTrackIndex), String(safePosition)]);
    await AsyncStorage.multiSet(updates).catch(() => undefined);
  }
  const playTrack = async (nextIndex = trackIndex) => {
    const next = SHAAWARI_AUDIO_TRACKS[nextIndex];
    if (!next) return;
    const requestId = ++audioRequestRef.current;
    try {
      setLoading(true); setBuffering(false); setPlaying(false); setError("");
      audioPlaybackRequestedRef.current = true;
      audioPlaybackStartedRef.current = false;
      audioStatusSubscriptionRef.current?.remove();
      audioStatusSubscriptionRef.current = null;
      const previousIndex = trackIndexRef.current;
      const previousPlayer = playerRef.current;
      if (previousPlayer) {
        const previousPosition = previousPlayer.currentTime;
        if (Number.isFinite(previousPosition) && previousPosition >= 0) {
          positionRef.current = previousPosition;
          audioPositionsRef.current.set(previousIndex, previousPosition);
          void savePosition(previousIndex, previousPosition, false);
        }
        previousPlayer.pause();
      }
      const cachedPosition = audioPositionsRef.current.get(nextIndex);
      const savedPositionPromise = cachedPosition !== undefined
        ? Promise.resolve(cachedPosition)
        : AsyncStorage.getItem(shaarawiAudioPositionKey(nextIndex)).then((stored) => Number(stored)).catch(() => 0);
      const [rawSavedPosition, localUri] = await Promise.all([
        savedPositionPromise,
        getShaarawiMediaUri("audio", next.file).catch(() => null),
      ]);
      if (requestId !== audioRequestRef.current) return;
      const sourceUri = localUri ?? next.url;
      const player = previousPlayer ?? createAudioPlayer({ uri: sourceUri }, { updateInterval: 250, preferredForwardBufferDuration: 3 });
      if (previousPlayer) player.replace({ uri: sourceUri });
      player.volume = volume;
      playerRef.current = player;
      setAudioDownloadTrackIndex(nextIndex);
      setAudioDownloadState(localUri ? "saved" : "idle");
      setAudioDownloadPercent(localUri ? 100 : null);
      consumePrewarmedAudioSource(next.url);
      trackIndexRef.current = nextIndex;
      setTrackIndex(nextIndex);
      audioStatusSubscriptionRef.current = player.addListener("playbackStatusUpdate", (status) => {
        if (requestId !== audioRequestRef.current || playerRef.current !== player) return;
        setBuffering(audioPlaybackRequestedRef.current && (status.isBuffering || (!status.playing && !audioPlaybackStartedRef.current)));
        if (status.duration > 0) setDuration(status.duration);
        if (status.error) {
          audioPlaybackRequestedRef.current = false;
          audioPlaybackStartedRef.current = false;
          setPlaying(false);
          setBuffering(false);
          setError(t("تعذر تحميل الملف من المصدر. تحقق من الاتصال أو نزّل الملف على الهاتف ثم أعد المحاولة.", "Could not load the file from its source. Check your connection or download it to your phone and retry."));
        } else if (status.playing) {
          audioPlaybackStartedRef.current = true;
          setPlaying(true);
          setError("");
        } else if (status.didJustFinish) {
          audioPlaybackRequestedRef.current = false;
          audioPlaybackStartedRef.current = false;
          setPlaying(false);
          setBuffering(false);
        } else {
          if (audioPlaybackRequestedRef.current && audioPlaybackStartedRef.current && status.isLoaded && !status.isBuffering) {
            audioPlaybackRequestedRef.current = false;
            audioPlaybackStartedRef.current = false;
          }
          setPlaying(false);
          setBuffering(audioPlaybackRequestedRef.current && (status.isBuffering || !status.playing));
        }
      });
      const savedPosition = Number.isFinite(rawSavedPosition) && rawSavedPosition > 0 ? rawSavedPosition : 0;
      if (savedPosition > 0) void player.seekTo(savedPosition).catch(() => undefined);
      if (requestId !== audioRequestRef.current || playerRef.current !== player) return;
      positionRef.current = savedPosition;
      audioPositionsRef.current.set(nextIndex, savedPosition);
      setPosition(savedPosition);
      setDuration(0);
      audioPlaybackRequestedRef.current = true;
      audioPlaybackStartedRef.current = false;
      setBuffering(true);
      player.play();
      lastAudioPositionWriteAtRef.current = Date.now();
      void savePosition(nextIndex, savedPosition);
    } catch {
      if (requestId === audioRequestRef.current) {
        audioPlaybackRequestedRef.current = false;
        setPlaying(false);
        setBuffering(false);
        setError(t("تعذر تشغيل التفسير الصوتي. تحقق من الاتصال وحاول مرة أخرى.", "Unable to play the audio tafsir. Check your connection and try again."));
      }
    } finally {
      if (requestId === audioRequestRef.current) setLoading(false);
    }
  };
  const changeTrack = (delta: number) => {
    if (activeAudioDownloadRef.current !== null) return;
    const next = (trackIndexRef.current + delta + SHAAWARI_AUDIO_TRACKS.length) % SHAAWARI_AUDIO_TRACKS.length;
    void playTrack(next);
  };
  const seekBy = (seconds: number) => {
    const rawCurrent = playerRef.current?.currentTime ?? positionRef.current;
    const current = Number.isFinite(rawCurrent) && rawCurrent >= 0 ? rawCurrent : 0;
    const next = Math.max(0, Math.min(duration > 0 ? duration : Number.POSITIVE_INFINITY, current + seconds));
    if (playerRef.current) void playerRef.current.seekTo(next).catch(() => undefined);
    positionRef.current = next;
    audioPositionsRef.current.set(trackIndexRef.current, next);
    setPosition(next);
    lastAudioPositionWriteAtRef.current = Date.now();
    void savePosition(trackIndexRef.current, next);
  };
  const changeVolume = () => { const next = volume >= 1 ? 0.55 : volume >= 0.55 ? 0.2 : 1; setVolume(next); if (playerRef.current) playerRef.current.volume = next; };
  const downloadCurrentAudio = async () => {
    if (Platform.OS === "web") return;
    const index = trackIndexRef.current;
    const item = SHAAWARI_AUDIO_TRACKS[index];
    if (!item || activeAudioDownloadRef.current !== null) return;
    activeAudioDownloadRef.current = index;
    setAudioDownloadTrackIndex(index);
    setAudioDownloadState("downloading");
    setAudioDownloadPercent(null);
    setAudioDownloadError("");
    const currentPosition = playerRef.current?.currentTime ?? positionRef.current;
    if (Number.isFinite(currentPosition) && currentPosition >= 0) {
      positionRef.current = currentPosition;
      audioPositionsRef.current.set(index, currentPosition);
      playerRef.current?.pause();
      audioPlaybackRequestedRef.current = false;
      setPlaying(false);
      setBuffering(false);
      void savePosition(index, currentPosition);
    }
    try {
      const uri = await downloadShaarawiMedia("audio", item.file, item.url, (progress) => {
        if (activeAudioDownloadRef.current === index) setAudioDownloadPercent(mediaDownloadPercent(progress));
      });
      setAudioDownloadPercent(100);
      setAudioDownloadState("saved");
      if (trackIndexRef.current === index && playerRef.current) {
        playerRef.current.pause();
        playerRef.current.replace({ uri });
        void playerRef.current.seekTo(positionRef.current).catch(() => undefined);
        setDuration(0);
      }
    } catch {
      setAudioDownloadState("error");
      setAudioDownloadError(t("تعذر تنزيل الملف. تحقق من الاتصال ومساحة الجهاز ثم أعد المحاولة.", "Download failed. Check your connection and device storage, then retry."));
    } finally {
      if (activeAudioDownloadRef.current === index) activeAudioDownloadRef.current = null;
    }
  };
  const togglePlayback = () => {
    if (loading || activeAudioDownloadRef.current !== null) return;
    const player = playerRef.current;
    if (audioActionIsPause) {
      const currentPosition = player?.currentTime ?? positionRef.current;
      positionRef.current = currentPosition;
      audioPositionsRef.current.set(trackIndexRef.current, currentPosition);
      audioPlaybackRequestedRef.current = false;
      audioPlaybackStartedRef.current = false;
      player?.pause();
      setPlaying(false);
      setBuffering(false);
      void savePosition(trackIndexRef.current, currentPosition);
    } else if (player) {
      audioPlaybackRequestedRef.current = true;
      audioPlaybackStartedRef.current = false;
      setBuffering(true);
      setError("");
      player.play();
    } else void playTrack(trackIndexRef.current);
  };
  const searchBooks = async () => {
    const query = searchQuery.trim();
    if (!query) { setSearchResults([]); setSearchStatus("idle"); return; }
    try {
      setSearchStatus("loading");
      const results: Array<OcrPageMatch & { volume: number }> = [];
      await Promise.all([1, 2, 3].map(async (volume) => {
        const cacheKey = `shaarawi.ocr.xml.v2.${volume}`;
        let xml = await AsyncStorage.getItem(cacheKey);
        if (!xml) { const response = await fetch(ocrFetchUrl(volume)); if (!response.ok) throw new Error("ocr"); xml = await response.text(); try { await AsyncStorage.setItem(cacheKey, xml); } catch { /* web storage may be full; search still works */ } }
        findOcrPageMatches(xml, query, 50).forEach((match) => results.push({ volume, ...match }));
      }));
      results.sort((a, b) => a.volume - b.volume || a.page - b.page);
      setSearchResults(results.slice(0, 50)); setSearchStatus("ready");
    } catch { setSearchResults([]); setSearchStatus("error"); }
  };
  const openSearchResult = (result: { volume: number; page: number }) => { volumePageRef.current = result.volume; pageRef.current = result.page; setVolumePage(result.volume); setPage(result.page); setFocusedSearchPage(result); setTab("book"); void savePosition(); };

  const selectVideo = (item: ShaarawiVideoItem, index: number) => {
    pendingVideoStartRef.current = null;
    setVideoIndex(index);
    videoPositionRef.current = item.id === pendingVideoIdRef.current ? videoPositionRef.current : 0;
    setVideoPosition(videoPositionRef.current);
    void saveVideoProgress(item, videoPositionRef.current);
  };
  const downloadCurrentVideo = async () => {
    const item = selectedVideo;
    if (!item || item.source !== "archive" || Platform.OS === "web" || activeVideoDownloadRef.current !== null) return;
    activeVideoDownloadRef.current = item.id;
    setVideoDownloadItemId(item.id);
    setVideoDownloadState("downloading");
    setVideoDownloadPercent(null);
    setVideoDownloadError("");
    const currentPosition = Number.isFinite(videoPlayer.currentTime) && videoPlayer.currentTime >= 0 ? videoPlayer.currentTime : videoPositionRef.current;
    videoPlayer.pause();
    videoPositionRef.current = currentPosition;
    setVideoPosition(currentPosition);
    void saveVideoProgress(item, currentPosition);
    try {
      const uri = await downloadShaarawiMedia("video", item.id, item.url, (progress) => {
        if (activeVideoDownloadRef.current === item.id) setVideoDownloadPercent(mediaDownloadPercent(progress));
      });
      setVideoDownloadPercent(100);
      setVideoDownloadState("saved");
      if (videoSourceUriRef.current?.id === item.id) {
        videoSourceUriRef.current = { id: item.id, uri };
        videoLoadedSourceRef.current = null;
        videoPlayer.pause();
        videoPlayer.replace(null);
      }
    } catch {
      setVideoDownloadState("error");
      setVideoDownloadError(t("تعذر تنزيل الحلقة. تحقق من الاتصال ومساحة الجهاز ثم أعد المحاولة.", "Episode download failed. Check your connection and device storage, then retry."));
    } finally {
      if (activeVideoDownloadRef.current === item.id) activeVideoDownloadRef.current = null;
    }
  };
  const resumeVideo = () => {
    if (!selectedVideo || selectedVideo.source !== "archive") return;
    pendingVideoIdRef.current = selectedVideo.id;
    const uri = videoSourceUriRef.current?.id === selectedVideo.id ? videoSourceUriRef.current.uri : selectedVideo.url;
    videoSourceUriRef.current = { id: selectedVideo.id, uri };
    const needsSource = videoLoadedSourceRef.current?.id !== selectedVideo.id || videoLoadedSourceRef.current.uri !== uri || videoStatusEvent.status === "error";
    try {
      if (needsSource) {
        pendingVideoStartRef.current = selectedVideo.id;
        videoLoadedSourceRef.current = { id: selectedVideo.id, uri };
        videoPlayer.replace(uri);
        return;
      }
      videoPlayer.currentTime = videoPositionRef.current;
      if (videoStatusEvent.status === "readyToPlay") {
        pendingVideoStartRef.current = null;
        videoPlayer.play();
      } else {
        pendingVideoStartRef.current = selectedVideo.id;
      }
    } catch {
      pendingVideoStartRef.current = null;
      videoLoadedSourceRef.current = null;
    }
  };

  return (
    <ScreenContainer edges={["bottom", "left", "right"]}>
      <View style={styles.root}>
        <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-forward" size={21} color="#F0B64A" /></Pressable><Text style={styles.headerTitle}>{t("الشيخ محمد متولي الشعراوي", "Sheikh Muhammad Metwally Al-Shaarawi")}</Text></View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}><View style={styles.heroIcon}><MaterialIcons name="auto-stories" size={35} color="#F0B64A" /></View><Text style={styles.heroTitle}>{t("مكتبة الشيخ الشعراوي", "Al-Shaarawi Library")}</Text><Text style={[styles.heroText, { writingDirection: direction }]}>{t("استمع إلى التفسير الصوتي وشاهد الحلقات المرئية واقرأ صفحات الكتب المصورة داخل التطبيق.", "Listen to the audio tafsir, watch video episodes, and read scanned book pages inside the app.")}</Text></View>
          <View style={styles.tabs}><Pressable onPress={() => setTab("audio")} style={[styles.tab, tab === "audio" && styles.tabActive]}><MaterialIcons name="headphones" size={18} color={tab === "audio" ? "#171A35" : "#F0B64A"} /><Text style={[styles.tabText, tab === "audio" && styles.tabTextActive]}>{t("التفسير الصوتي", "Audio tafsir")}</Text></Pressable><Pressable onPress={() => setTab("video")} style={[styles.tab, tab === "video" && styles.tabActive]}><MaterialIcons name="ondemand-video" size={18} color={tab === "video" ? "#171A35" : "#F0B64A"} /><Text style={[styles.tabText, tab === "video" && styles.tabTextActive]}>{t("التفسير المرئي", "Video tafsir")}</Text></Pressable><Pressable onPress={() => setTab("book")} style={[styles.tab, tab === "book" && styles.tabActive]}><MaterialIcons name="menu-book" size={18} color={tab === "book" ? "#171A35" : "#F0B64A"} /><Text style={[styles.tabText, tab === "book" && styles.tabTextActive]}>{t("الكتب المصورة", "Scanned books")}</Text></Pressable></View>
          {tab === "audio" ? <>
            <View style={styles.audioCard}>
              <Text style={styles.sectionTitle}>{t("التفسير الصوتي داخل المشغل", "Audio tafsir in the player")}</Text>
              <Text style={[styles.trackTitle, { writingDirection: direction }]}>{track.title}</Text>
              <Text style={styles.source}>{t("ملفات الصوت غير مضمّنة مع التطبيق؛ تُبث من Internet Archive.", "Audio files are not bundled with the app; they stream from Internet Archive.")}</Text>
              <View style={styles.progress}><View style={[styles.progressFill, { width: `${duration ? Math.min(100, position / duration * 100) : 0}%` }]} /></View>
              <View style={styles.time}><Text style={styles.muted}>{formatTime(position)}</Text><Text style={styles.muted}>{duration ? formatTime(duration) : "--:--"}</Text></View>
              <View style={styles.controls}>
                <Pressable accessibilityRole="button" accessibilityLabel={t("التسجيل السابق", "Previous recording")} onPress={() => changeTrack(-1)} disabled={loading || activeAudioDownloadRef.current !== null} style={styles.smallControl}>
                  <MaterialIcons name="skip-next" size={24} color="#F0B64A" />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={audioActionIsPause ? t("إيقاف مؤقت", "Pause playback") : loading ? t("جارٍ تجهيز الصوت", "Preparing audio") : t("تشغيل التفسير الصوتي", "Play audio tafsir")} onPress={togglePlayback} disabled={loading || activeAudioDownloadRef.current !== null} style={styles.play}>
                  <MaterialIcons name={loading ? "hourglass-top" : audioActionIsPause ? "pause" : "play-arrow"} size={30} color="#171A35" />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={t("التسجيل التالي", "Next recording")} onPress={() => changeTrack(1)} disabled={loading || activeAudioDownloadRef.current !== null} style={styles.smallControl}>
                  <MaterialIcons name="skip-previous" size={24} color="#F0B64A" />
                </Pressable>
              </View>
              {buffering ? <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}><ActivityIndicator size="small" color="#F0B64A" /><Text style={styles.muted}>{t("جارٍ تحميل الصوت من المصدر الخارجي…", "Buffering audio from the external source…")}</Text></View> : null}
              <View style={styles.toolRow}>
                <Pressable accessibilityRole="button" accessibilityLabel={t("تغيير مستوى الصوت", "Change volume")} onPress={changeVolume} style={styles.tool}>
                  <MaterialIcons name={volume === 0 ? "volume-off" : "volume-up"} size={19} color="#F0B64A" /><Text style={styles.toolText}>{t("الصوت", "Volume")} {Math.round(volume * 100)}%</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={t("تقديم ٣٠ ثانية", "Forward 30 seconds")} onPress={() => seekBy(30)} style={styles.tool}>
                  <MaterialIcons name="forward-30" size={19} color="#F0B64A" /><Text style={styles.toolText}>{t("تقديم", "Forward")}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={t("ترجيع ٣٠ ثانية", "Rewind 30 seconds")} onPress={() => seekBy(-30)} style={styles.tool}>
                  <MaterialIcons name="replay-30" size={19} color="#F0B64A" /><Text style={styles.toolText}>{t("ترجيع", "Rewind")}</Text>
                </Pressable>
              </View>
              {Platform.OS !== "web" ? <MediaDownloadAction state={currentAudioDownloadState} percent={currentAudioDownloadPercent} disabled={activeAudioDownloadRef.current !== null} onPress={() => void downloadCurrentAudio()} t={t} /> : <Text style={[styles.source, { marginTop: 10 }]}>{t("التنزيل دون إنترنت متاح في تطبيق الهاتف؛ تشغيل الويب يبقى بثًا خارجيًا.", "Offline downloads are available in the mobile app; web playback remains an external stream.")}</Text>}
              {Platform.OS !== "web" ? <Text style={[styles.source, { marginTop: 6 }]}>{t("التنزيل يدوي وقد يستهلك بيانات ومساحة من الجهاز.", "Downloads are manual and may use mobile data and device storage.")}</Text> : null}
              {audioDownloadError && audioDownloadTrackIndex === trackIndex ? <Text style={styles.error}>{audioDownloadError}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
            <Text style={styles.sectionTitle}>{t("الفهرس الصوتي المتاح", "Available audio index")}</Text>
            <View style={styles.trackList}>
              {SHAAWARI_AUDIO_TRACKS.map((item, index) => <Pressable key={item.file} disabled={loading || activeAudioDownloadRef.current !== null} onPressIn={() => prewarmAudioSource(item.url, { webPreload: "metadata" })} onPress={() => void playTrack(index)} style={[styles.trackRow, index === trackIndex && styles.trackRowActive, activeAudioDownloadRef.current !== null && styles.disabled]}>
                <Text style={[styles.trackRowText, index === trackIndex && styles.trackRowTextActive]}>{item.title}</Text>
                <MaterialIcons name={index === trackIndex && (loading || buffering) ? "hourglass-top" : index === trackIndex && playing ? "graphic-eq" : "play-circle-outline"} size={21} color={index === trackIndex ? "#171A35" : "#F0B64A"} />
              </Pressable>)}
            </View>
          </> : tab === "video" ? <>
            <View style={styles.videoCard}>
              <Text style={styles.sectionTitle}>{t("التفسير المرئي داخل التطبيق", "Video tafsir inside the app")}</Text>
              <Text style={[styles.bookHint, { writingDirection: direction }]}>{t("ملفات الفيديو غير مضمّنة مع التطبيق؛ حلقات التفسير تُبث مباشرة من Internet Archive، ولقاءات القناة الرسمية تُفتح من مصدرها.", "Video files are not bundled with the app. Tafsir episodes stream from Internet Archive, and official-channel interviews open at their source.")}</Text>
              {selectedVideo?.source === "archive" ? <>
                <VideoView style={styles.videoPlayer} player={videoPlayer} contentFit="contain" nativeControls={activeVideoDownloadRef.current === null} fullscreenOptions={{ enable: true }} allowsPictureInPicture />
                <Text style={styles.videoNow}>{selectedVideo.title}</Text>
                <Text style={styles.videoSource}>
                  {currentVideoIsLoading ? t("جارٍ تحميل الحلقة من المصدر الخارجي…", "Loading episode from the external source…") : currentVideoIsPlaying ? t("قيد التشغيل · بث خارجي من Internet Archive", "Playing · external stream from Internet Archive") : t("مصدر خارجي · Internet Archive", "External source · Internet Archive")}
                </Text>
                {videoResumeReady && pendingVideoIdRef.current === selectedVideo.id && videoPosition > 0 ? <Pressable disabled={currentVideoIsLoading || activeVideoDownloadRef.current !== null} onPress={resumeVideo} style={styles.resumeCard}><MaterialIcons name="history" size={18} color="#171A35" /><Text style={styles.resumeText}>{t(`متابعة من ${formatTime(videoPosition)}`, `Resume from ${formatTime(videoPosition)}`)}</Text></Pressable> : null}
                <Pressable accessibilityRole="button" accessibilityLabel={currentVideoIsLoading ? t("إيقاف التحميل", "Stop loading") : currentVideoIsPlaying ? t("إيقاف مؤقت", "Pause") : currentVideoHasError ? t("إعادة محاولة التشغيل", "Retry playback") : t("تشغيل الحلقة", "Play episode")} disabled={activeVideoDownloadRef.current !== null} onPress={() => {
                  if (currentVideoIsLoading) {
                    videoPlayer.pause();
                    pendingVideoStartRef.current = null;
                    videoLoadedSourceRef.current = null;
                    videoPlayer.replace(null);
                  } else if (currentVideoIsPlaying) {
                    pendingVideoStartRef.current = null;
                    videoPositionRef.current = videoPlayer.currentTime;
                    setVideoPosition(videoPositionRef.current);
                    videoPlayer.pause();
                    void saveVideoProgress(selectedVideo, videoPositionRef.current);
                  } else resumeVideo();
                }} style={styles.videoPlayButton}>
                  {currentVideoIsLoading ? <ActivityIndicator color="#171A35" size="small" /> : <MaterialIcons name={currentVideoIsPlaying ? "pause" : currentVideoHasError ? "refresh" : "play-arrow"} size={22} color="#171A35" />}
                  <Text style={styles.videoPlayText}>{currentVideoIsLoading ? t("إيقاف التحميل", "Stop loading") : currentVideoIsPlaying ? t("إيقاف مؤقت", "Pause") : currentVideoHasError ? t("تعذر التحميل · أعد المحاولة", "Load failed · retry") : t("تشغيل الحلقة", "Play episode")}</Text>
                </Pressable>
                {currentVideoHasError ? <Text style={styles.error}>{t("تعذر تحميل الحلقة من المصدر. تحقق من الاتصال أو نزّلها على الهاتف ثم أعد المحاولة.", "Could not load the episode from its source. Check your connection or download it to your phone and retry.")}</Text> : null}
                {Platform.OS !== "web" ? <MediaDownloadAction state={currentVideoDownloadState} percent={currentVideoDownloadPercent} disabled={activeVideoDownloadRef.current !== null} onPress={() => void downloadCurrentVideo()} t={t} /> : <Text style={[styles.videoSource, { marginTop: 10 }]}>{t("التنزيل دون إنترنت متاح في تطبيق الهاتف؛ تشغيل الويب يبقى بثًا خارجيًا.", "Offline downloads are available in the mobile app; web playback remains an external stream.")}</Text>}
                {Platform.OS !== "web" ? <Text style={[styles.videoSource, { marginTop: 6 }]}>{t("التنزيل يدوي وقد يستهلك بيانات ومساحة من الجهاز.", "Downloads are manual and may use mobile data and device storage.")}</Text> : null}
                {videoDownloadError && videoDownloadItemId === selectedVideo.id ? <Text style={styles.error}>{videoDownloadError}</Text> : null}
              </> : <View style={styles.officialCard}><MaterialIcons name="verified" size={28} color="#F0B64A" /><Text style={styles.officialTitle}>{t("محتوى من القناة الرسمية", "Official channel content")}</Text><Text style={styles.officialText}>{t("هذا اللقاء محفوظ في فهرس القناة الرسمية. يمكن فتحه من داخل نافذة التطبيق عبر YouTube لأن المصدر لا يوفر ملف MP4 مباشرًا للتضمين في VideoView.", "This interview is indexed from the official channel. It opens in the app's browser window because the source does not provide a direct MP4 file for VideoView embedding.")}</Text><Pressable onPress={() => WebBrowser.openBrowserAsync(selectedVideo.url)} style={styles.officialButton}><MaterialIcons name="open-in-new" size={18} color="#171A35" /><Text style={styles.videoPlayText}>{t("فتح المصدر الرسمي", "Open official source")}</Text></Pressable></View>}
            </View>
            <View style={styles.videoSearchRow}><TextInput value={videoSearch} onChangeText={(value) => { setVideoSearch(value); setVideoIndex(0); }} placeholder={t("ابحث باسم السورة أو الحلقة…", "Search by surah or episode...")} placeholderTextColor="#9C8A6D" style={styles.videoSearchInput} textAlign="right" /><MaterialIcons name="search" size={19} color="#80663B" /></View><Text style={styles.videoCount}>{t(`يعرض ${visibleVideoItems.length} من ${videoItems.length} حلقة متاحة`, `Showing ${visibleVideoItems.length} of ${videoItems.length} available episodes`)}</Text>
            <View style={styles.videoFilters}><Pressable onPress={() => { setVideoFilter("tafsir"); setVideoIndex(0); setVideoSearch(""); setSelectedSurah("all"); }} style={[styles.videoFilter, videoFilter === "tafsir" && styles.videoFilterActive]}><Text style={[styles.videoFilterText, videoFilter === "tafsir" && styles.videoFilterTextActive]}>{t("حلقات التفسير التلفزيوني", "TV tafsir episodes")}</Text></Pressable><Pressable onPress={() => { setVideoFilter("interview"); setVideoIndex(0); setVideoSearch(""); setSelectedSurah("all"); }} style={[styles.videoFilter, videoFilter === "interview" && styles.videoFilterActive]}><Text style={[styles.videoFilterText, videoFilter === "interview" && styles.videoFilterTextActive]}>{t("لقاءات ومختارات", "Interviews & selections")}</Text></Pressable></View>
            <Text style={styles.sectionTitle}>{videoFilter === "tafsir" ? t("فهرس التفسير المرئي حسب السورة", "Video tafsir index by surah") : t("فهرس لقاءات الشيخ", "Sheikh interview index")}</Text>
            {videoFilter === "tafsir" ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.surahPicker}>
              <Pressable onPress={() => { setSelectedSurah("all"); setVideoSearch(""); setVideoIndex(0); }} style={[styles.surahChip, selectedSurah === "all" && styles.surahChipActive]}><Text style={[styles.surahChipText, selectedSurah === "all" && styles.surahChipTextActive]}>{t("كل السور", "All surahs")}</Text></Pressable>
              {SURAS.map((surah) => { const label = displaySurahLabel(surah.name); const count = availableSurahCounts[normalizeSurahLabel(label)] ?? 0; return <Pressable key={surah.id} disabled={count === 0} onPress={() => { setSelectedSurah(label); setVideoSearch(""); setVideoIndex(0); }} style={[styles.surahChip, selectedSurah === label && styles.surahChipActive, count === 0 && styles.surahChipDisabled]}><Text style={[styles.surahChipText, selectedSurah === label && styles.surahChipTextActive, count === 0 && styles.surahChipTextDisabled]}>{label}{count > 0 ? ` (${count})` : ""}</Text></Pressable>; })}
            </ScrollView> : null}
            <Text style={styles.videoCount}>{selectedSurah === "all" ? t("اختر السورة لعرض جميع حلقاتها، أو استخدم البحث للوصول إلى أي حلقة.", "Choose a surah to see all its episodes, or use search to reach any episode.") : t(`حلقات ${selectedSurah}: ${visibleVideoItems.length}`, `${selectedSurah}: ${visibleVideoItems.length} episodes`)}</Text>
            {videoFilter === "tafsir" ? <Text style={styles.videoAvailabilityNote}>{t("الأزرار الرمادية تعني أنني لم أجد لها حلقة فيديو مباشرة في الأرشيف أو القناة الرسمية التي تم التحقق منها. لن أضع روابط غير موثوقة مكانها.", "Gray buttons mean no direct video episode was found in the verified archive or official channel. Unverified links are not substituted.")}</Text> : null}
            <View style={styles.videoList}>{visibleVideoItems.map((item, index) => <Pressable key={item.id} onPress={() => selectVideo(item, index)} style={[styles.videoRow, index === videoIndex && styles.videoRowActive]}><View style={styles.videoRowIcon}><MaterialIcons name={item.source === "archive" ? "play-circle-outline" : "open-in-new"} size={22} color={index === videoIndex ? "#171A35" : "#F0B64A"} /></View><View style={styles.videoRowCopy}><Text style={[styles.videoRowTitle, index === videoIndex && styles.videoRowTitleActive]}>{item.title}</Text><Text style={[styles.videoRowMeta, index === videoIndex && styles.videoRowTitleActive]}>{item.source === "archive" ? `${item.duration ?? ""} · Internet Archive` : `${item.note ?? ""} · YouTube`}</Text></View></Pressable>)}</View>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(SHAAWARI_OFFICIAL_CHANNEL)} style={styles.channelLink}><MaterialIcons name="verified" size={17} color="#F0B64A" /><Text style={styles.channelLinkText}>{t("زيارة القناة الرسمية للشعراوي", "Visit the official Al-Shaarawi channel")}</Text></Pressable>
          </> : <>
            <View style={styles.bookCard}><Text style={styles.sectionTitle}>{t("صفحات الكتاب الأصلية", "Original book pages")}</Text><Text style={[styles.bookHint, { writingDirection: direction }]}>{t("هذه صفحات مصورة من النسخ الأصلية، ويمكن تقليبها بالسهمين داخل التطبيق.", "These are scanned pages from the original editions. Turn pages with the arrows inside the app.")}</Text><View style={styles.volumeRow}>{[1, 2, 3].map((item) => <Pressable key={item} onPress={() => { volumePageRef.current = item; pageRef.current = 0; setVolumePage(item); setPage(0); setFocusedSearchPage(null); void savePosition(); }} style={[styles.volumeButton, volumePage === item && styles.volumeButtonActive]}><Text style={[styles.volumeText, volumePage === item && styles.volumeTextActive]}>{t(`المجلد ${item}`, `Volume ${item}`)}</Text></Pressable>)}</View><View style={styles.bookSearch}><Text style={styles.searchTitle}>{t("بحث داخل نصوص الكتب", "Search inside book text")}</Text><View style={styles.searchRow}><TextInput value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={() => void searchBooks()} placeholder={t("اكتب كلمة أو عبارة…", "Type a word or phrase…")} placeholderTextColor="#9C8A6D" style={styles.searchInput} returnKeyType="search" textAlign="right" /><Pressable onPress={() => void searchBooks()} disabled={searchStatus === "loading"} style={styles.searchButton}>{searchStatus === "loading" ? <ActivityIndicator color="#171A35" size="small" /> : <MaterialIcons name="search" size={20} color="#171A35" />}</Pressable></View>{searchStatus === "error" ? <Text style={styles.searchError}>{t("تعذر تحميل نصوص OCR. تحقق من الاتصال وحاول مرة أخرى.", "Could not load OCR text. Check your connection and try again.")}</Text> : null}{searchStatus === "ready" && searchResults.length === 0 ? <Text style={styles.searchEmpty}>{t("لا توجد نتائج مطابقة في المجلدات الثلاثة.", "No matching results were found in the three volumes.")}</Text> : null}{searchResults.length > 0 ? <View style={styles.results}>{searchResults.map((result, index) => <Pressable key={`${result.volume}-${result.page}-${index}`} onPress={() => openSearchResult(result)} style={styles.resultRow}><View style={styles.resultMeta}><Text style={styles.resultTitle}>{t(`المجلد ${result.volume} · الصفحة ${result.page + 1}`, `Volume ${result.volume} · Page ${result.page + 1}`)}</Text><MaterialIcons name="open-in-new" size={16} color="#80663B" /></View><HighlightedText text={result.snippet} query={searchQuery} /></Pressable>)}</View> : null}</View><View style={styles.zoomToolbar}><Pressable onPress={() => setPageZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))))} disabled={pageZoom <= 1} style={[styles.zoomButton, pageZoom <= 1 && styles.disabled]}><MaterialIcons name="remove" size={20} color="#F0B64A" /></Pressable><Text style={styles.zoomLabel}>{Math.round(pageZoom * 100)}%</Text><Pressable onPress={() => setPageZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))} disabled={pageZoom >= 3} style={[styles.zoomButton, pageZoom >= 3 && styles.disabled]}><MaterialIcons name="add" size={20} color="#F0B64A" /></Pressable><Pressable onPress={() => setPageZoom(1)} style={styles.zoomReset}><MaterialIcons name="fit-screen" size={17} color="#80663B" /><Text style={styles.zoomResetText}>{t("ملاءمة", "Fit")}</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={pageZoom > 1} contentContainerStyle={styles.zoomScroll}><ScrollView nestedScrollEnabled showsVerticalScrollIndicator={pageZoom > 1} contentContainerStyle={styles.zoomScroll}><View style={[styles.pageFrame, { width: 330 * pageZoom }]}><View style={{ width: 320 * pageZoom, height: 430 * pageZoom, position: "relative" }}><Image source={{ uri: pageUrl }} style={[styles.pageImage, { width: 320 * pageZoom, height: 430 * pageZoom }]} resizeMode="contain" />{activePageMatch?.rects.map((rect, index) => <View key={`${rect.left}-${rect.top}-${index}`} style={[styles.ocrHighlight, { left: rect.left * (320 * pageZoom / activePageMatch.width), top: rect.top * (430 * pageZoom / activePageMatch.height), width: rect.width * (320 * pageZoom / activePageMatch.width), height: rect.height * (430 * pageZoom / activePageMatch.height) }]} />)}</View><Text style={styles.pageLabel}>{t(`المجلد ${volumePage} · الصفحة ${page + 1}`, `Volume ${volumePage} · Page ${page + 1}`)}</Text></View></ScrollView></ScrollView>{focusedSearchPage && focusedSearchPage.volume === volumePage && focusedSearchPage.page === page && searchQuery.trim() ? <View style={styles.pageSearchBadge}><MaterialIcons name="find-in-page" size={16} color="#171A35" /><Text style={styles.pageSearchText}>{t("نتيجة البحث في هذه الصفحة: ", "Search result on this page: ")}</Text><HighlightedText text={searchQuery.trim()} query={searchQuery.trim()} /></View> : null}<View style={styles.pageControls}><Pressable onPress={() => { pageRef.current = Math.max(0, pageRef.current - 1); setPage(pageRef.current); void savePosition(); }} disabled={page === 0} style={[styles.pageButton, page === 0 && styles.disabled]}><MaterialIcons name="arrow-forward" size={22} color="#F0B64A" /></Pressable><Text style={styles.pageCount}>{t("تنقل داخل صفحات النسخة المصورة", "Navigate scanned pages")}</Text><Pressable onPress={() => { pageRef.current += 1; setPage(pageRef.current); void savePosition(); }} style={styles.pageButton}><MaterialIcons name="arrow-back" size={22} color="#F0B64A" /></Pressable></View></View>
          </>}
          <Text style={[styles.footer, { writingDirection: direction }]}>{t("الصوت والفيديو ليسا مضمّنين في التطبيق؛ يُبثّان من Internet Archive أو روابط القناة الرسمية. يمكنك حفظ ملف تختاره يدويًا على الهاتف للتشغيل دون إنترنت.", "Audio and video are not bundled with the app; they stream from Internet Archive or official-channel links. You can manually save a selected file to your phone for offline playback.")}</Text>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
function HighlightedText({ text, query }: { text: string; query: string }) {
  return <Text style={styles.resultSnippet}>{highlightTextParts(text, query).map((part, index) => <Text key={`${part.text}-${index}`} style={part.highlighted ? styles.searchHighlight : undefined}>{part.text}</Text>)}</Text>;
}
function formatTime(value: number) { return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`; }
function normalizeBookText(value: string) { return value.normalize("NFKC").replace(/[ًٌٍَُِّْـٰ]/g, "").replace(/[إأآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").toLowerCase(); }
function decodeXml(value: string) { return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: "#080A1F" }, header: { height: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#292D4D" }, back: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#151B3D", alignItems: "center", justifyContent: "center" }, headerTitle: { flex: 1, color: "#F7F4EC", fontSize: 16, fontWeight: "800", textAlign: "right", marginLeft: 12 }, content: { padding: 12, paddingBottom: 34 }, hero: { backgroundColor: "#11152F", borderRadius: 20, padding: 18, alignItems: "center" }, heroIcon: { width: 62, height: 62, borderRadius: 20, backgroundColor: "#20274E", alignItems: "center", justifyContent: "center", marginBottom: 9 }, heroTitle: { color: "#F7F4EC", fontSize: 20, fontWeight: "800", textAlign: "center" }, heroText: { color: "#A6ABC7", fontSize: 13, lineHeight: 21, textAlign: "center", marginTop: 8 }, tabs: { flexDirection: "row-reverse", gap: 8, marginTop: 10 }, tab: { flex: 1, minHeight: 43, borderRadius: 11, backgroundColor: "#121630", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6 }, tabActive: { backgroundColor: "#F0B64A" }, tabText: { color: "#F0B64A", fontSize: 12, fontWeight: "800" }, tabTextActive: { color: "#171A35" }, audioCard: { backgroundColor: "#121630", borderRadius: 16, padding: 15, marginTop: 10 }, bookCard: { backgroundColor: "#F7F0DF", borderRadius: 16, padding: 12, marginTop: 10 }, sectionTitle: { color: "#F0B64A", fontSize: 15, fontWeight: "800", textAlign: "right", marginBottom: 8 }, trackTitle: { color: "#F7F4EC", fontSize: 18, fontWeight: "800", textAlign: "right" }, source: { color: "#A6ABC7", fontSize: 10, textAlign: "right", marginTop: 4 }, progress: { height: 7, backgroundColor: "#292D4D", borderRadius: 5, overflow: "hidden", marginTop: 18 }, progressFill: { height: 7, backgroundColor: "#F0B64A" }, time: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 }, muted: { color: "#A6ABC7", fontSize: 11 }, controls: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 13 }, smallControl: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#292D4D", alignItems: "center", justifyContent: "center" }, play: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#F0B64A", alignItems: "center", justifyContent: "center" }, toolRow: { flexDirection: "row-reverse", justifyContent: "center", gap: 18, marginTop: 12 }, tool: { alignItems: "center", gap: 3 }, toolText: { color: "#A6ABC7", fontSize: 10 }, error: { color: "#F08B8B", textAlign: "center", marginTop: 10, lineHeight: 20 }, trackList: { backgroundColor: "#121630", borderRadius: 14, overflow: "hidden" }, trackRow: { minHeight: 42, paddingHorizontal: 11, borderBottomWidth: 1, borderBottomColor: "#292D4D", flexDirection: "row-reverse", alignItems: "center", gap: 8 }, trackRowActive: { backgroundColor: "#F0B64A" }, trackRowText: { flex: 1, color: "#F7F4EC", textAlign: "right", fontSize: 12 }, trackRowTextActive: { color: "#171A35", fontWeight: "800" }, bookHint: { color: "#80663B", fontSize: 11, lineHeight: 18, textAlign: "right" }, volumeRow: { flexDirection: "row-reverse", gap: 6, marginTop: 10 }, volumeButton: { flex: 1, minHeight: 34, borderRadius: 8, backgroundColor: "#E5D5B2", alignItems: "center", justifyContent: "center" }, volumeButtonActive: { backgroundColor: "#F0B64A" }, volumeText: { color: "#80663B", fontSize: 11, fontWeight: "800" }, volumeTextActive: { color: "#171A35" }, pageFrame: { backgroundColor: "#E4D6B9", borderWidth: 1, borderColor: "#C9A96A", minHeight: 440, marginTop: 10, alignItems: "center", justifyContent: "center", padding: 5 }, pageImage: { width: "100%", height: 430 }, ocrHighlight: { position: "absolute", backgroundColor: "rgba(240,182,74,0.55)", borderColor: "#B56B00", borderWidth: 1, borderRadius: 2 }, pageLabel: { color: "#80663B", fontSize: 10, marginTop: 4 }, pageControls: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 10 }, pageButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#292D4D", alignItems: "center", justifyContent: "center" }, disabled: { opacity: 0.35 }, pageCount: { color: "#80663B", fontSize: 10 }, bookSearch: { backgroundColor: "#E9DFC9", borderRadius: 11, padding: 9, marginTop: 9 }, searchTitle: { color: "#80663B", fontSize: 13, fontWeight: "800", textAlign: "right", marginBottom: 6 }, searchRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 }, searchInput: { flex: 1, minHeight: 38, backgroundColor: "#FFF9EC", borderRadius: 8, paddingHorizontal: 10, color: "#43351F", fontSize: 12 }, searchButton: { width: 38, height: 38, borderRadius: 8, backgroundColor: "#F0B64A", alignItems: "center", justifyContent: "center" }, searchError: { color: "#A43F3F", fontSize: 11, textAlign: "right", marginTop: 6 }, searchEmpty: { color: "#80663B", fontSize: 11, textAlign: "right", marginTop: 6 }, results: { marginTop: 7, gap: 5 }, resultRow: { backgroundColor: "#FFF9EC", borderRadius: 8, padding: 8 }, resultMeta: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }, resultTitle: { color: "#80663B", fontSize: 11, fontWeight: "800" }, resultSnippet: { color: "#43351F", fontSize: 11, lineHeight: 18, textAlign: "right", marginTop: 4 }, searchHighlight: { backgroundColor: "#F0B64A", color: "#171A35", fontWeight: "900" }, pageSearchBadge: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "#F0B64A", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, marginTop: 8 }, pageSearchText: { color: "#171A35", fontSize: 11, fontWeight: "800" }, zoomToolbar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 9 }, zoomButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#292D4D", alignItems: "center", justifyContent: "center" }, zoomLabel: { minWidth: 45, color: "#80663B", fontSize: 12, fontWeight: "800", textAlign: "center" }, zoomReset: { flexDirection: "row", alignItems: "center", gap: 3, marginLeft: 7 }, zoomResetText: { color: "#80663B", fontSize: 10, fontWeight: "700" }, zoomScroll: { alignItems: "center", justifyContent: "center" }, videoSearchRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: "#FFF9EC", borderRadius: 9, minHeight: 38, paddingHorizontal: 10, marginTop: 9 }, videoSearchInput: { flex: 1, color: "#43351F", fontSize: 12, minHeight: 36 }, videoCount: { color: "#80663B", fontSize: 10, textAlign: "right", marginTop: 5 }, videoAvailabilityNote: { color: "#9C8A6D", fontSize: 10, lineHeight: 16, textAlign: "right", marginTop: 3 }, surahPicker: { flexDirection: "row", gap: 6, paddingVertical: 7 }, surahChip: { minHeight: 31, paddingHorizontal: 10, borderRadius: 16, backgroundColor: "#FFF9EC", borderWidth: 1, borderColor: "#E1C98E", justifyContent: "center" }, surahChipActive: { backgroundColor: "#F0B64A", borderColor: "#F0B64A" }, surahChipDisabled: { opacity: 0.38 }, surahChipText: { color: "#80663B", fontSize: 10, fontWeight: "700" }, surahChipTextActive: { color: "#171A35" }, surahChipTextDisabled: { color: "#9C8A6D" }, videoCard: { backgroundColor: "#F7F0DF", borderRadius: 16, padding: 12, marginTop: 10 }, videoPlayer: { width: "100%", height: 220, backgroundColor: "#080A1F", borderRadius: 10, marginTop: 8 }, videoNow: { color: "#43351F", fontSize: 15, fontWeight: "800", textAlign: "right", marginTop: 9 }, videoSource: { color: "#80663B", fontSize: 10, textAlign: "right", marginTop: 3 }, resumeCard: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "#F0B64A", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, marginTop: 8 }, resumeText: { color: "#171A35", fontSize: 11, fontWeight: "800" }, videoPlayButton: { alignSelf: "center", flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: "#F0B64A", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, marginTop: 10 }, videoPlayText: { color: "#171A35", fontSize: 12, fontWeight: "800" }, videoFilters: { flexDirection: "row-reverse", gap: 6, marginTop: 10 }, videoFilter: { flex: 1, minHeight: 38, borderRadius: 9, backgroundColor: "#121630", alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }, videoFilterActive: { backgroundColor: "#F0B64A" }, videoFilterText: { color: "#F0B64A", fontSize: 10, fontWeight: "800", textAlign: "center" }, videoFilterTextActive: { color: "#171A35" }, videoList: { backgroundColor: "#121630", borderRadius: 13, overflow: "hidden", marginBottom: 10 }, videoRow: { minHeight: 54, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#292D4D", flexDirection: "row-reverse", alignItems: "center", gap: 8 }, videoRowActive: { backgroundColor: "#F0B64A" }, videoRowIcon: { width: 28, alignItems: "center" }, videoRowCopy: { flex: 1 }, videoRowTitle: { color: "#F7F4EC", fontSize: 12, fontWeight: "800", textAlign: "right" }, videoRowMeta: { color: "#A6ABC7", fontSize: 10, textAlign: "right", marginTop: 3 }, videoRowTitleActive: { color: "#171A35" }, officialCard: { alignItems: "center", backgroundColor: "#121630", borderRadius: 12, padding: 15, marginTop: 8 }, officialTitle: { color: "#F7F4EC", fontSize: 15, fontWeight: "800", marginTop: 6, textAlign: "center" }, officialText: { color: "#A6ABC7", fontSize: 11, lineHeight: 18, textAlign: "right", marginTop: 6 }, officialButton: { flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: "#F0B64A", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, marginTop: 10 }, channelLink: { flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", gap: 5, marginTop: 7 }, channelLinkText: { color: "#F0B64A", fontSize: 11, fontWeight: "800" }, footer: { color: "#737891", fontSize: 11, lineHeight: 18, textAlign: "right", marginTop: 14 }, });
