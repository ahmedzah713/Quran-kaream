import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type DimensionValue,
  type ViewProps,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Asset } from "expo-asset";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { SurahInfoSheet } from "@/components/surah-info-sheet";
import { ContinuousRecitationPlayer } from "@/components/continuous-recitation-player";
import { useContinuousRecitation } from "@/hooks/use-continuous-recitation";
import mushafVerseLayoutJson from "../data/mushaf-verse-layout.json";
import { SURAS } from "@/lib/quran-data";
import { isContinueReadingSession, juzForPage, juzNameInArabic, lineIndexForAyah, pageAfterHorizontalSwipe, pageForAyah, pageForJuz, pageForSura, parseMushafPageNumber, PAGES, suraIdForPage, verseTapTargetsForAyahOnPage, verseTapTargetsForPage, type VerseTapTarget } from "@/lib/mushaf";
import { calibratedAreasForAyah, calibratedBasmalaAreaForAyah, pixelRectToPercent, type MushafPixelRect, type MushafVerseLayout } from "@/lib/mushaf-layout";
import { resolveRecitationStart } from "@/lib/continuous-recitation";
import { highlightMatches } from "@/lib/search-utils";
import { AYAH_RECITERS, AYAH_TAFSIRS, getAyahAudioUrl, getAyahTafsirUrl, getAyahTextUrl, readAyahAudioUrl, readAyahTafsir, readAyahText } from "@/lib/verse-services";
import { playWebAudioSource, stopWebAudioSource } from "@/lib/web-audio";

const PAGE_COUNT = PAGES.length;
const PAGE_NUMBERS = Array.from({ length: PAGE_COUNT }, (_, index) => index + 1);
const toArabicDigits = (value: number) => String(value).replace(/[0-9]/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
// The first two URLs are the printed Madinah Mushaf scans, including the original ornate surah plaques.
const pageImageUrl = (page: number) => `https://quran.islam-db.com/data/pages/quranpages_1024/images/page${String(page).padStart(3, "0")}.png`;
const CENTERED_OPENING_PAGE_IMAGES: Record<number, number> = {
  1: require("../assets/images/mushaf-page-001-centered.png"),
  2: require("../assets/images/mushaf-page-002-centered.png"),
};
const CENTERED_OPENING_VERSE_TOPS: Record<number, number[]> = {
  1: [0, 32, 37, 43, 48, 54, 59, 65],
  2: [0, 0, 38, 43, 48, 53, 58, 63],
};
const verseTargetLayout = (target: VerseTapTarget, lineCount: number, pageNumber: number) => {
  const rowHeight = 80 / Math.max(1, lineCount);
  const centeredLineTop = CENTERED_OPENING_VERSE_TOPS[pageNumber]?.[target.lineIndex];
  const segmentWidth = 100 / Math.max(1, target.segmentCount);
  const percent = (value: number): DimensionValue => `${value}%` as DimensionValue;
  return {
    top: percent(centeredLineTop ?? 9 + target.lineIndex * rowHeight),
    height: percent(centeredLineTop === undefined ? Math.max(2.5, rowHeight * 0.92) : 5),
    width: percent(segmentWidth),
    right: percent(target.segmentIndex * segmentWidth),
  };
};
const OPENING_SURA_TITLE_IMAGES: Record<number, number> = {
  1: require("../assets/images/mushaf-sura-title-001.png"),
  2: require("../assets/images/mushaf-sura-title-002.png"),
};
const MUSHAF_ORNAMENT_IMAGE = require("../assets/images/mushaf-ornate-frame.png");
const calibratedLayout = mushafVerseLayoutJson as MushafVerseLayout;
const percentStyleValue = (value: number): DimensionValue => `${value}%` as DimensionValue;
const pixelRectStyle = (rect: MushafPixelRect) => {
  const percentRect = pixelRectToPercent(rect, calibratedLayout.imageWidth, calibratedLayout.imageHeight);
  if (!percentRect) return {};
  return {
    left: percentStyleValue(percentRect.left),
    top: percentStyleValue(percentRect.top),
    width: percentStyleValue(percentRect.width),
    height: percentStyleValue(percentRect.height),
  };
};
const suraIdForBasmalaLine = (lines: ReadonlyArray<{ type: string; verseRange?: string | null }>, lineIndex: number) => {
  for (const line of lines.slice(lineIndex + 1)) {
    const match = line.verseRange?.match(/^(\d+):1-/u);
    if (match) return Number(match[1]);
  }
  return null;
};
type PageTone = "paper" | "night" | "sepia";
type ReaderTouchEvent = Parameters<NonNullable<ViewProps["onTouchStart"]>>[0];
type VerseActionView = "menu" | "tafsir" | "audio";

export default function ReaderScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  const recitation = useContinuousRecitation();
  const { suraId, ayah, highlightQuery, ayahText, page: pageParam, trackProgress } = useLocalSearchParams<{
    suraId?: string;
    ayah?: string;
    highlightQuery?: string;
    ayahText?: string;
    page?: string;
    trackProgress?: string;
  }>();
  const routeSura = SURAS.find((item) => item.id === Number(suraId)) ?? SURAS[0];
  const requestedAyah = Number(ayah);
  const hasRequestedAyah = Number.isInteger(requestedAyah) && requestedAyah > 0;
  const requestedPage = Number(pageParam);
  const hasRequestedPage = Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= PAGE_COUNT;
  const isTrackingProgress = isContinueReadingSession(trackProgress);
  const initialPage = hasRequestedPage
    ? requestedPage
    : hasRequestedAyah
      ? pageForAyah(routeSura.id, requestedAyah)
      : pageForSura(routeSura.id);
  const routeKey = `${routeSura.id}:${hasRequestedPage ? requestedPage : ""}:${hasRequestedAyah ? requestedAyah : ""}:${isTrackingProgress ? "continue" : "independent"}`;

  const [pageNumber, setPageNumber] = useState(initialPage);
  const [initializedRouteKey, setInitializedRouteKey] = useState(routeKey);
  const [tone, setTone] = useState<PageTone>("paper");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [readerAreaHeight, setReaderAreaHeight] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [juzSelectorVisible, setJuzSelectorVisible] = useState(false);
  const [suraSelectorVisible, setSuraSelectorVisible] = useState(false);
  const [surahInfoVisible, setSurahInfoVisible] = useState(false);
  const [pageNumberSelectorVisible, setPageNumberSelectorVisible] = useState(false);
  const [pageNumberInput, setPageNumberInput] = useState(toArabicDigits(initialPage));
  const [pageNumberInputError, setPageNumberInputError] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState<{ suraId: number; ayahNumber: number } | null>(null);
  const [verseActionView, setVerseActionView] = useState<VerseActionView>("menu");
  const [verseText, setVerseText] = useState("");
  const [verseTextLoading, setVerseTextLoading] = useState(false);
  const [tafsirText, setTafsirText] = useState("");
  const [tafsirLoading, setTafsirLoading] = useState(false);
  const [tafsirError, setTafsirError] = useState(false);
  const [selectedTafsirId, setSelectedTafsirId] = useState(AYAH_TAFSIRS[0].id);
  const [selectedAyahReciterId, setSelectedAyahReciterId] = useState(AYAH_RECITERS[0].id);
  const [ayahAudioLoading, setAyahAudioLoading] = useState(false);
  const [ayahAudioPlaying, setAyahAudioPlaying] = useState(false);
  const [ayahAudioError, setAyahAudioError] = useState(false);
  const searchAyahText = typeof ayahText === "string" ? ayahText : "";
  const searchHighlight = typeof highlightQuery === "string" ? highlightQuery : "";
  const touchStartPoint = useRef<{ x: number; y: number } | null>(null);
  const webPointerStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const pageTurnSoundPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const pageTurnSoundWebAudioRef = useRef<HTMLAudioElement | null>(null);
  const pageTurnSoundWebAudioUriRef = useRef<string | null>(null);
  const verseAudioPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const verseAudioWebRef = useRef<HTMLAudioElement | null>(null);
  const lastTouchedAyahRef = useRef<VerseTapTarget | null>(null);
  const pageVerticalScrollRef = useRef<ScrollView | null>(null);
  const audioCleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verseTextRequestIdRef = useRef(0);
  const verseAudioRequestIdRef = useRef(0);
  const previousRouteKeyRef = useRef(routeKey);

  const stopSelectedAyah = useCallback(() => {
    verseAudioRequestIdRef.current += 1;
    try { verseAudioPlayerRef.current?.remove(); } catch { /* already stopped */ }
    verseAudioPlayerRef.current = null;
    if (verseAudioWebRef.current) stopWebAudioSource(verseAudioWebRef.current, true);
    setAyahAudioPlaying(false);
    setAyahAudioLoading(false);
  }, []);

  useFocusEffect(useCallback(() => () => {
    recitation.stop();
    stopSelectedAyah();
  }, [recitation.stop, stopSelectedAyah]));

  useEffect(() => {
    if (previousRouteKeyRef.current === routeKey) return;
    previousRouteKeyRef.current = routeKey;
    recitation.stop();
    stopSelectedAyah();
  }, [recitation.stop, routeKey, stopSelectedAyah]);

  const touchPoint = (event: ReaderTouchEvent, useChangedTouch: boolean) => {
    const nativeEvent = event.nativeEvent as typeof event.nativeEvent & {
      touches?: ReadonlyArray<{ pageX: number; pageY: number }>;
      changedTouches?: ReadonlyArray<{ pageX: number; pageY: number }>;
    };
    const point = (useChangedTouch ? nativeEvent.changedTouches?.[0] : nativeEvent.touches?.[0]) ?? nativeEvent.touches?.[0];
    return point ? { x: point.pageX, y: point.pageY } : { x: nativeEvent.pageX, y: nativeEvent.pageY };
  };

  const handleTouchStart = (event: ReaderTouchEvent) => {
    const nativeEvent = event.nativeEvent as typeof event.nativeEvent & { touches?: ReadonlyArray<{ pageX: number; pageY: number }> };
    if (nativeEvent.touches && nativeEvent.touches.length !== 1) {
      touchStartPoint.current = null;
      return;
    }
    touchStartPoint.current = touchPoint(event, false);
  };

  const handleTouchEnd = (event: ReaderTouchEvent) => {
    const nativeEvent = event.nativeEvent as typeof event.nativeEvent & { touches?: ReadonlyArray<{ pageX: number; pageY: number }> };
    const start = touchStartPoint.current;
    touchStartPoint.current = null;
    if (!start || (nativeEvent.touches?.length ?? 0) > 0 || zoomRef.current > 1) return;
    const end = touchPoint(event, true);
    const nextPage = pageAfterHorizontalSwipe(pageRef.current, end.x - start.x, end.y - start.y);
    if (nextPage !== pageRef.current) goToPageRef.current(nextPage);
  };

  const handleTouchCancel = () => {
    touchStartPoint.current = null;
  };

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const element = document.getElementById("quran-reader-area");
    if (!element) return;
    const previousTouchAction = element.style.touchAction;
    element.style.touchAction = "pan-y";
    const handlePointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
      webPointerStartRef.current = { x: event.pageX, y: event.pageY, pointerId: event.pointerId };
    };
    const handlePointerUp = (event: PointerEvent) => {
      const start = webPointerStartRef.current;
      if (!start || start.pointerId !== event.pointerId) return;
      webPointerStartRef.current = null;
      if (zoomRef.current <= 1) {
        goToPageRef.current(pageAfterHorizontalSwipe(pageRef.current, event.pageX - start.x, event.pageY - start.y));
      }
    };
    const handlePointerCancel = (event: PointerEvent) => {
      if (webPointerStartRef.current?.pointerId === event.pointerId) webPointerStartRef.current = null;
    };
    element.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      element.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      element.style.touchAction = previousTouchAction;
      webPointerStartRef.current = null;
    };
  }, []);

  const playPageTurnSound = useCallback(() => {
    if (Platform.OS === "web" && typeof Audio !== "undefined") {
      try {
        let audio = pageTurnSoundWebAudioRef.current;
        if (!audio) {
          audio = new Audio();
          audio.preload = "auto";
          pageTurnSoundWebAudioRef.current = audio;
          pageTurnSoundWebAudioUriRef.current = Asset.fromModule(require("../assets/audio/mushaf-page-turn.mp3")).uri;
        }
        const uri = pageTurnSoundWebAudioUriRef.current;
        if (uri) void playWebAudioSource(audio, uri).catch(() => false);
      } catch {
        // A browser may deny a non-user-initiated page sound; reading and recitation continue silently.
      }
      return;
    }

    if (audioCleanupTimerRef.current) clearTimeout(audioCleanupTimerRef.current);
    try { pageTurnSoundPlayerRef.current?.remove(); } catch { /* already removed */ }
    try {
      const player = createAudioPlayer(require("../assets/audio/mushaf-page-turn.mp3"));
      pageTurnSoundPlayerRef.current = player;
      player.play();
      audioCleanupTimerRef.current = setTimeout(() => {
        if (pageTurnSoundPlayerRef.current === player) {
          player.remove();
          pageTurnSoundPlayerRef.current = null;
        }
      }, 1800);
    } catch { /* a silent page change is preferable when audio is unavailable */ }
  }, []);

  useEffect(() => () => {
    verseTextRequestIdRef.current += 1;
    if (audioCleanupTimerRef.current) clearTimeout(audioCleanupTimerRef.current);
    try { pageTurnSoundPlayerRef.current?.remove(); } catch { /* unmount cleanup */ }
    try { verseAudioPlayerRef.current?.remove(); } catch { /* unmount cleanup */ }
    if (pageTurnSoundWebAudioRef.current) stopWebAudioSource(pageTurnSoundWebAudioRef.current, true);
    if (verseAudioWebRef.current) stopWebAudioSource(verseAudioWebRef.current, true);
    pageTurnSoundWebAudioRef.current = null;
    pageTurnSoundWebAudioUriRef.current = null;
    verseAudioWebRef.current = null;
  }, []);

  useEffect(() => {
    setPageNumber(initialPage);
    setInitializedRouteKey(routeKey);
    setImageFailed(false);
    setImageLoading(true);
  }, [initialPage, routeKey]);

  useEffect(() => {
    pageVerticalScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [pageNumber]);

  useEffect(() => {
    AsyncStorage.multiGet(["quran.pageTone", "quran.pageZoom"])
      .then(([storedTone, storedZoom]) => {
        if (storedTone[1] === "paper" || storedTone[1] === "night" || storedTone[1] === "sepia") setTone(storedTone[1]);
        if (storedZoom[1]) {
          const storedScale = Number(storedZoom[1]);
          if (Number.isFinite(storedScale) && storedScale >= 0.8 && storedScale <= 1.8) setZoom(storedScale);
        }
      })
      .catch(() => undefined);
  }, []);

  const currentSuraId = suraIdForPage(pageNumber);
  const currentSura = SURAS.find((item) => item.id === currentSuraId) ?? routeSura;
  const pageData = PAGES[pageNumber - 1];
  const pageImageSource = useMemo(
    () => CENTERED_OPENING_PAGE_IMAGES[pageNumber] ?? { uri: pageImageUrl(pageNumber) },
    [pageNumber],
  );
  const lines = useMemo(() => pageData?.lines ?? [], [pageData]);
  const verseTapTargets = useMemo(() => verseTapTargetsForPage(pageNumber), [pageNumber]);
  const activeRecitationTargets = recitation.currentAyah && !recitation.isPlayingBasmala
    ? verseTapTargets.filter((target) => target.suraId === recitation.currentAyah?.suraId && target.ayahNumber === recitation.currentAyah?.ayahNumber)
    : [];
  const requestedAyahTargets = hasRequestedAyah && !recitation.currentAyah
    ? verseTapTargetsForAyahOnPage(pageNumber, routeSura.id, requestedAyah)
    : [];
  const activeRecitationAreas = recitation.currentAyah && !recitation.isPlayingBasmala
    ? calibratedAreasForAyah(calibratedLayout, pageNumber, recitation.currentAyah.suraId, recitation.currentAyah.ayahNumber)
    : [];
  const activeBasmalaAreas = recitation.currentAyah && recitation.isPlayingBasmala
    ? calibratedBasmalaAreaForAyah(calibratedLayout, pageNumber, recitation.currentAyah.suraId, recitation.currentAyah.ayahNumber)
    : [];
  const requestedAyahAreas = hasRequestedAyah && !recitation.currentAyah
    ? calibratedAreasForAyah(calibratedLayout, pageNumber, routeSura.id, requestedAyah)
    : [];
  const textHighlightTargets = activeRecitationTargets.length > 0 ? activeRecitationTargets : requestedAyahTargets;
  const activeHighlightItems = [
    ...(activeRecitationAreas.length > 0
      ? activeRecitationAreas.map((area, index) => ({ key: `active-${index}`, style: pixelRectStyle(area) }))
      : activeRecitationTargets.map((target, index) => ({ key: `active-fallback-${index}`, style: verseTargetLayout(target, lines.length, pageNumber) }))),
    ...activeBasmalaAreas.map((area, index) => ({ key: `active-basmala-${index}`, style: pixelRectStyle(area) })),
  ];
  const requestedHighlightItems = requestedAyahAreas.length > 0
    ? requestedAyahAreas.map((area, index) => ({ key: `requested-${index}`, style: pixelRectStyle(area) }))
    : requestedAyahTargets.map((target, index) => ({ key: `requested-fallback-${index}`, style: verseTargetLayout(target, lines.length, pageNumber) }));
  const verseHotspots = useMemo(() => {
    const seen = new Set<string>();
    return verseTapTargets.flatMap((target): VerseHotspot[] => {
      const key = `${target.suraId}:${target.ayahNumber}`;
      if (seen.has(key)) return [];
      seen.add(key);
      const areas = calibratedAreasForAyah(calibratedLayout, pageNumber, target.suraId, target.ayahNumber);
      return areas.length > 0
        ? areas.map((area, areaIndex) => ({ key: `${key}-${areaIndex}`, target, area, fallbackStyle: null }))
        : [{ key: `${key}-fallback`, target, area: null, fallbackStyle: verseTargetLayout(target, lines.length, pageNumber) }];
    });
  }, [lines.length, pageNumber, verseTapTargets]);

  useEffect(() => {
    if (imageLoading || imageFailed) return;
    const adjacentPages = [pageNumber - 1, pageNumber + 1].filter((page) => page >= 1 && page <= PAGE_COUNT);
    if (adjacentPages.length === 0) return;
    void ExpoImage.prefetch(adjacentPages.map(pageImageUrl), "memory-disk").catch(() => undefined);
  }, [imageFailed, imageLoading, pageNumber]);

  const ayahLineIndex = hasRequestedAyah ? lineIndexForAyah(pageNumber, routeSura.id, requestedAyah) : -1;
  useEffect(() => {
    if (!isTrackingProgress || initializedRouteKey !== routeKey) return;
    const pageSura = suraIdForPage(pageNumber);
    AsyncStorage.multiSet([
      ["quran.lastPage", String(pageNumber)],
      ["quran.lastPageSura", String(pageSura)],
      ["quran.lastSura", String(pageSura)],
    ]).catch(() => undefined);
  }, [initializedRouteKey, isTrackingProgress, pageNumber, routeKey]);

  const goToPage = useCallback((nextPage: number, preserveRecitation = false) => {
    if (nextPage < 1 || nextPage > PAGE_COUNT || nextPage === pageNumber) return;
    playPageTurnSound();
    if (!preserveRecitation) {
      if (recitation.currentAyah) recitation.stop();
      stopSelectedAyah();
    }
    setPageNumber(nextPage);
    setImageFailed(false);
    setImageLoading(true);
  }, [pageNumber, playPageTurnSound, recitation.currentAyah, recitation.stop, stopSelectedAyah]);

  const jumpToTypedPage = () => {
    const nextPage = parseMushafPageNumber(pageNumberInput);
    if (nextPage === null) {
      setPageNumberInputError(true);
      return;
    }
    goToPage(nextPage);
    setPageNumberSelectorVisible(false);
  };

  const pageRef = useRef(pageNumber);
  const zoomRef = useRef(zoom);
  const goToPageRef = useRef(goToPage);
  pageRef.current = pageNumber;
  zoomRef.current = zoom;
  goToPageRef.current = goToPage;

  useEffect(() => {
    const activeAyah = recitation.currentAyah;
    if (!activeAyah) return;
    const activePage = pageForAyah(activeAyah.suraId, activeAyah.ayahNumber);
    if (activePage !== pageNumber) goToPage(activePage, true);
  }, [goToPage, pageNumber, recitation.currentAyah]);

  const pageColors = tone === "night"
    ? { background: "#101713", paper: "#FDFBF4", text: "#F5F1E7", muted: "#D3DDCF" }
    : tone === "sepia"
      ? { background: "#E4D2AE", paper: "#FFF6E3", text: "#342719", muted: "#756046" }
      : { background: "#F3F1E4", paper: "#FFFDF6", text: "#26372C", muted: "#617565" };
  const verticalSafeInsets = Platform.OS === "web" ? 0 : safeAreaInsets.top + safeAreaInsets.bottom;
  const availableReaderHeight = readerAreaHeight || Math.max(200, height - verticalSafeInsets - 132);
  const pageWidthByHeight = Math.max(1, (availableReaderHeight - 74) * (1024 / 1656) + 24);
  const basePageWidth = Math.min(620, Math.max(1, width - 24), pageWidthByHeight);
  const pageWidth = basePageWidth * zoom;

  const changeZoom = (amount: number) => {
    const nextZoom = Math.min(1.8, Math.max(0.8, Number((zoom + amount).toFixed(1))));
    setZoom(nextZoom);
    AsyncStorage.setItem("quran.pageZoom", String(nextZoom)).catch(() => undefined);
  };

  const toggleTone = () => {
    const nextTone: PageTone = tone === "paper" ? "sepia" : tone === "sepia" ? "night" : "paper";
    setTone(nextTone);
    AsyncStorage.setItem("quran.pageTone", nextTone).catch(() => undefined);
  };

  const openVerseActions = (verse: { suraId: number; ayahNumber: number }) => {
    recitation.stop();
    stopSelectedAyah();
    verseTextRequestIdRef.current += 1;
    setSelectedVerse(verse);
    setVerseActionView("menu");
    setVerseText("");
    setVerseTextLoading(true);
    setTafsirText("");
    setTafsirError(false);
    setAyahAudioError(false);
    const requestId = verseTextRequestIdRef.current;
    fetch(getAyahTextUrl(verse.suraId, verse.ayahNumber))
      .then((response) => { if (!response.ok) throw new Error("ayah"); return response.json(); })
      .then((payload: unknown) => { if (requestId === verseTextRequestIdRef.current) setVerseText(readAyahText(payload) ?? ""); })
      .catch(() => { if (requestId === verseTextRequestIdRef.current) setVerseText(""); })
      .finally(() => { if (requestId === verseTextRequestIdRef.current) setVerseTextLoading(false); });
  };

  const closeVerseActions = () => {
    verseTextRequestIdRef.current += 1;
    stopSelectedAyah();
    setSelectedVerse(null);
  };

  const loadSelectedTafsir = async (editionId = selectedTafsirId) => {
    if (!selectedVerse) return;
    setSelectedTafsirId(editionId);
    setVerseActionView("tafsir");
    setTafsirText("");
    setTafsirError(false);
    setTafsirLoading(true);
    try {
      const response = await fetch(getAyahTafsirUrl(editionId, selectedVerse.suraId, selectedVerse.ayahNumber));
      if (!response.ok) throw new Error("tafsir");
      const text = readAyahTafsir(await response.json());
      if (!text) throw new Error("tafsir");
      setTafsirText(text);
    } catch {
      setTafsirError(true);
    } finally {
      setTafsirLoading(false);
    }
  };

  const playSelectedAyah = async () => {
    if (!selectedVerse) return;
    recitation.stop();
    stopSelectedAyah();
    const requestId = verseAudioRequestIdRef.current;
    const reciter = AYAH_RECITERS.find((item) => item.id === selectedAyahReciterId) ?? AYAH_RECITERS[0];
    setVerseActionView("audio");
    setAyahAudioError(false);
    setAyahAudioLoading(true);
    try {
      try { verseAudioPlayerRef.current?.remove(); } catch { /* replace a previous recitation */ }
      verseAudioPlayerRef.current = null;
      if (verseAudioWebRef.current) stopWebAudioSource(verseAudioWebRef.current);
      setAyahAudioPlaying(false);
      const response = await fetch(getAyahAudioUrl(selectedVerse.suraId, selectedVerse.ayahNumber, reciter.edition));
      if (!response.ok) throw new Error("audio");
      const audioUrl = readAyahAudioUrl(await response.json());
      if (verseAudioRequestIdRef.current !== requestId) return;
      if (!audioUrl) throw new Error("audio");
      if (Platform.OS === "web" && typeof Audio !== "undefined") {
        let player = verseAudioWebRef.current;
        if (!player) {
          const audioPlayer = new Audio();
          audioPlayer.preload = "auto";
          audioPlayer.onended = () => {
            if (verseAudioWebRef.current === audioPlayer) setAyahAudioPlaying(false);
          };
          audioPlayer.onerror = () => {
            if (verseAudioWebRef.current === audioPlayer && audioPlayer.error?.code !== 1) {
              setAyahAudioPlaying(false);
              setAyahAudioError(true);
            }
          };
          player = audioPlayer;
          verseAudioWebRef.current = audioPlayer;
        }
        const didStart = await playWebAudioSource(player, audioUrl);
        if (verseAudioRequestIdRef.current !== requestId) return;
        if (!didStart) throw new Error("Browser did not allow audio playback");
      } else {
        await setAudioModeAsync({ playsInSilentMode: true });
        if (verseAudioRequestIdRef.current !== requestId) return;
        const player = createAudioPlayer({ uri: audioUrl });
        verseAudioPlayerRef.current = player;
        player.addListener("playbackStatusUpdate", (status) => {
          if (status.didJustFinish && verseAudioPlayerRef.current === player) {
            player.remove();
            verseAudioPlayerRef.current = null;
            setAyahAudioPlaying(false);
          }
        });
        player.play();
      }
      setAyahAudioPlaying(true);
    } catch {
      if (verseAudioRequestIdRef.current === requestId) setAyahAudioError(true);
    } finally {
      if (verseAudioRequestIdRef.current === requestId) setAyahAudioLoading(false);
    }
  };

  const toggleContinuousRecitation = () => {
    if (recitation.currentAyah) {
      recitation.togglePlayback();
      return;
    }
    stopSelectedAyah();
    const firstTarget = verseTapTargets[0];
    const startAyah = resolveRecitationStart(pageNumber, lastTouchedAyahRef.current, firstTarget ?? null);
    if (startAyah) recitation.togglePlayback(startAyah);
  };

  const returnToHome = () => {
    recitation.stop();
    stopSelectedAyah();
    router.dismissTo("/(tabs)");
  };

  const selectSura = (suraId: number) => {
    recitation.stop();
    stopSelectedAyah();
    lastTouchedAyahRef.current = null;
    goToPage(pageForSura(suraId));
    setSuraSelectorVisible(false);
  };

  return (
    <ScreenContainer
      edges={isFullscreen ? ["top", "bottom", "left", "right"] : ["bottom", "left", "right"]}
      containerClassName={isFullscreen ? "bg-[#F3F1E4]" : "bg-[#075739]"}
      safeAreaClassName={isFullscreen ? "bg-[#F3F1E4]" : "bg-[#075739]"}
    >
      <StatusBar hidden={isFullscreen} />
      <View style={[styles.root, { backgroundColor: pageColors.background }]}>
        <View
          nativeID="quran-reader-area"
          style={styles.readerArea}
          onLayout={(event) => {
            const measuredHeight = event.nativeEvent.layout.height;
            setReaderAreaHeight((currentHeight) => Math.abs(currentHeight - measuredHeight) > 1 ? measuredHeight : currentHeight);
          }}
          onTouchStart={Platform.OS === "web" ? undefined : handleTouchStart}
          onTouchEnd={Platform.OS === "web" ? undefined : handleTouchEnd}
          onTouchCancel={Platform.OS === "web" ? undefined : handleTouchCancel}
        >
          <ScrollView
            ref={pageVerticalScrollRef}
            style={styles.verticalScroll}
            scrollEnabled={zoom > 1 || Boolean(searchAyahText)}
            contentContainerStyle={[styles.pageScrollContent, isFullscreen && styles.fullscreenPageScrollContent]}
            showsVerticalScrollIndicator={false}
          >
            <ScrollView
              horizontal
              scrollEnabled={zoom > 1}
              showsHorizontalScrollIndicator={zoom > 1}
              contentContainerStyle={styles.horizontalScrollContent}
            >
              <View style={[styles.pageFrame, { width: pageWidth, backgroundColor: pageColors.paper }]}>
                <View style={styles.pageInfoBar} accessibilityLabel={`سورة ${currentSura.name}، صفحة ${toArabicDigits(pageNumber)}، ${juzNameInArabic(juzForPage(pageNumber))}`}>
                  <View style={styles.pageInfoSuraGroup}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`معلومات سورة ${currentSura.name}`}
                      accessibilityHint="عرض مكان النزول وعدد الآيات ومعلومات أسباب النزول"
                      onPress={() => setSurahInfoVisible(true)}
                      style={styles.pageInfoSuraInfoButton}
                    >
                      <MaterialIcons name="info-outline" size={16} color="#FFFDF6" />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`فتح فهرس السور، السورة الحالية ${currentSura.name}`}
                      accessibilityHint="اختر سورة للانتقال مباشرة إلى صفحتها الأولى"
                      onPress={() => { setJuzSelectorVisible(false); setSuraSelectorVisible(true); }}
                      style={styles.pageInfoSuraButton}
                    >
                      <Text numberOfLines={1} style={styles.pageInfoSuraText}>سورة {currentSura.name}</Text>
                      <MaterialIcons name="menu" size={20} color="#FFFDF6" />
                    </Pressable>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`اختيار رقم الصفحة ${toArabicDigits(pageNumber)}`}
                    accessibilityHint="افتح قائمة الصفحات أو اكتب رقمًا للانتقال المباشر"
                    onPress={() => {
                      setPageNumberInput(toArabicDigits(pageNumber));
                      setPageNumberInputError(false);
                      setPageNumberSelectorVisible(true);
                    }}
                    style={styles.pageInfoNumberButton}
                  >
                    <Text style={styles.pageInfoNumber}>{toArabicDigits(pageNumber)}</Text>
                    <MaterialIcons name="menu" size={15} color="#FFFDF6" />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="عرض قائمة الأجزاء" onPress={() => { setSuraSelectorVisible(false); setJuzSelectorVisible(true); }} style={styles.pageInfoPartButton}>
                    <Text numberOfLines={1} style={styles.pageInfoPartLabel}>{juzNameInArabic(juzForPage(pageNumber))}</Text>
                    <MaterialIcons name="menu" size={20} color="#FFFDF6" />
                  </Pressable>
                </View>
                <View pointerEvents="none" style={styles.ornamentBand}>
                  {[0, 1, 2, 3, 4, 5, 6].map((item) => (
                    <Text key={`top-${item}`} style={[styles.ornament, item % 2 === 0 ? styles.flower : styles.vine]}>{item % 2 === 0 ? "✿" : "❧"}</Text>
                  ))}
                </View>
                <View style={styles.pageInner}>
                  {imageFailed || !pageData ? (
                    <View style={[styles.textPage, { width: Math.max(220, pageWidth - 24), aspectRatio: 0.707, backgroundColor: pageColors.paper }]}>
                      {lines.map((line, index) => {
                        const verseMatch = line.verseRange?.match(/^(\d+):(\d+)/u);
                        const isActiveBasmala = line.type === "basmala" && recitation.isPlayingBasmala &&
                          recitation.currentAyah?.ayahNumber === 1 &&
                          suraIdForBasmalaLine(lines, index) === recitation.currentAyah.suraId;
                        const lineContent = line.type === "surah-header"
                          ? <Text style={styles.suraHeader}>{line.text}</Text>
                          : line.type === "basmala"
                            ? <Text style={styles.basmala}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
                            : <Text style={styles.mushafLine}>{line.text}</Text>;
                        return (
                          <View key={`${pageNumber}-${index}`} style={[styles.lineRow, (isActiveBasmala || textHighlightTargets.some((target) => target.lineIndex === index)) && styles.textRecitationHighlight]}>
                            {verseMatch ? (
                              <Pressable accessibilityRole="button" accessibilityLabel={`خيارات الآية ${verseMatch[2]}`} style={styles.verseTextTap} onPress={() => {
                                const suraId = Number(verseMatch[1]);
                                const ayahNumber = Number(verseMatch[2]);
                                lastTouchedAyahRef.current = verseTapTargets.find((target) => target.lineIndex === index && target.suraId === suraId && target.ayahNumber === ayahNumber)
                                  ?? { suraId, ayahNumber, lineIndex: index, segmentIndex: 0, segmentCount: 1 };
                                openVerseActions({ suraId, ayahNumber });
                              }}>{lineContent}</Pressable>
                            ) : lineContent}
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={[styles.pageImageFrame, { width: Math.max(220, pageWidth - 24) }]}>
                      <ExpoImage
                        key={pageNumber}
                        source={pageImageSource}
                        onLoadEnd={() => setImageLoading(false)}
                        onError={() => { setImageFailed(true); setImageLoading(false); }}
                        cachePolicy="memory-disk"
                        priority="high"
                        transition={0}
                        contentFit="fill"
                        style={[styles.pageImage, { backgroundColor: pageColors.paper }]}
                        accessibilityLabel={`صفحة ${pageNumber} من المصحف`}
                      />
                      {(pageNumber === 1 || pageNumber === 2) && (
                        <View pointerEvents="none" accessible={false} importantForAccessibility="no" style={styles.pageOrnamentOverlay}>
                          <ExpoImage
                            source={MUSHAF_ORNAMENT_IMAGE}
                            transition={0}
                            contentFit="fill"
                            style={styles.pageOrnamentImage}
                          />
                          <View style={styles.openingSuraTitlePlate}>
                            <ExpoImage
                              source={OPENING_SURA_TITLE_IMAGES[pageNumber]}
                              tintColor="#176A3A"
                              transition={0}
                              contentFit="contain"
                              accessibilityLabel={`سورة ${currentSura.name}`}
                              style={[styles.openingSuraTitleImage, { width: Math.min(116, Math.max(76, pageWidth * 0.31)), height: Math.min(32, Math.max(20, pageWidth * 0.085)) }]}
                            />
                          </View>
                        </View>
                      )}
                      {verseHotspots.map((hotspot) => {
                        const { target } = hotspot;
                        return (
                          <Pressable
                            key={`${pageNumber}-${hotspot.key}`}
                            accessibilityRole="button"
                            accessibilityLabel={`سورة ${SURAS.find((item) => item.id === target.suraId)?.name ?? "القرآن"}، الآية ${toArabicDigits(target.ayahNumber)}، عرض الخيارات`}
                            disabled={imageLoading}
                            onPress={() => { lastTouchedAyahRef.current = target; openVerseActions({ suraId: target.suraId, ayahNumber: target.ayahNumber }); }}
                            style={[styles.verseHotspot, hotspot.area ? pixelRectStyle(hotspot.area) : hotspot.fallbackStyle]}
                          />
                        );
                      })}
                      {imageLoading && (
                        <View style={styles.loadingCover} pointerEvents="none">
                          <ActivityIndicator color="#075739" />
                        </View>
                      )}
                      {!imageLoading ? requestedHighlightItems.map((item) => (
                        <View
                          key={`requested-${pageNumber}-${item.key}`}
                          pointerEvents="none"
                          accessibilityElementsHidden
                          importantForAccessibility="no"
                          style={[styles.requestedAyahHighlight, item.style]}
                        />
                      )) : null}
                      {!imageLoading ? activeHighlightItems.map((item) => (
                        <View
                          key={`active-${pageNumber}-${item.key}`}
                          pointerEvents="none"
                          accessibilityElementsHidden
                          importantForAccessibility="no"
                          style={[styles.activeRecitationHighlight, item.style]}
                        />
                      )) : null}
                    </View>
                  )}
                </View>
                <View pointerEvents="none" style={styles.ornamentBand}>
                  {[0, 1, 2, 3, 4, 5, 6].map((item) => (
                    <Text key={`bottom-${item}`} style={[styles.ornament, item % 2 === 0 ? styles.flower : styles.vine]}>{item % 2 === 0 ? "✿" : "❧"}</Text>
                  ))}
                </View>
              </View>
            </ScrollView>

            {searchAyahText && ayahLineIndex >= 0 ? (
              <View style={[styles.searchPreview, { backgroundColor: pageColors.paper }]}>
                <View style={styles.searchPreviewHeader}>
                  <Text style={styles.searchPreviewTitle}>موضع البحث</Text>
                  <Text style={[styles.searchPreviewMeta, { color: pageColors.muted }]}>الآية {toArabicDigits(requestedAyah)}</Text>
                </View>
                <Text style={styles.searchPreviewText}>
                  {highlightMatches(searchAyahText, searchHighlight).map((segment, index) => (
                    <Text key={`${index}-${segment.text}`} style={segment.highlighted ? styles.searchHighlight : undefined}>{segment.text}</Text>
                  ))}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </View>

        <View style={styles.bottomToolbar}>
          <ContinuousRecitationPlayer
            compact
            currentAyah={recitation.currentAyah}
            selectedReciterId={recitation.selectedReciterId}
            isLoading={recitation.isLoading}
            isPlaying={recitation.isPlaying}
            hasError={recitation.hasError}
            disabled={!recitation.currentAyah && verseTapTargets.length === 0}
            onToggle={toggleContinuousRecitation}
            onSelectReciter={recitation.selectReciter}
          >
            <HomeToolbarButton onPress={returnToHome} />
            <ToolbarButton label="فتح الفهرس" icon="menu-book" onPress={() => router.push("/sura-index")} />
            <ToolbarButton label={`تكبير الصفحة ${Math.round(zoom * 100)} بالمئة`} icon={zoom > 1 ? "zoom-out" : "zoom-in"} onPress={() => changeZoom(zoom > 1 ? -0.2 : 0.2)} />
            <ToolbarButton label="الصفحة السابقة" icon="chevron-right" onPress={() => goToPage(pageNumber - 1)} disabled={pageNumber === 1} />
            <ToolbarButton label="الصفحة التالية" icon="chevron-left" onPress={() => goToPage(pageNumber + 1)} disabled={pageNumber === PAGE_COUNT} />
            <ToolbarButton label="تغيير لون الصفحة" icon={tone === "night" ? "light-mode" : "dark-mode"} onPress={toggleTone} />
            <ToolbarButton label={isFullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"} icon={isFullscreen ? "fullscreen-exit" : "fullscreen"} onPress={() => setIsFullscreen((current) => !current)} />
          </ContinuousRecitationPlayer>
        </View>
      </View>

      <Modal visible={juzSelectorVisible} transparent animationType="slide" onRequestClose={() => setJuzSelectorVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="إغلاق قائمة الأجزاء" style={styles.modalBackdrop} onPress={() => setJuzSelectorVisible(false)} />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeading}>
              <Text style={styles.sheetTitle}>اختر جزءًا</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="إغلاق" onPress={() => setJuzSelectorVisible(false)} style={styles.sheetClose}>
                <MaterialIcons name="close" size={22} color="#075739" />
              </Pressable>
            </View>
            <ScrollView style={styles.juzList} contentContainerStyle={styles.juzListContent}>
              {Array.from({ length: 30 }, (_, index) => {
                const juzNumber = index + 1;
                const startPage = pageForJuz(juzNumber);
                const startSura = SURAS.find((item) => item.id === suraIdForPage(startPage));
                const active = juzNumber === juzForPage(pageNumber);
                return (
                  <Pressable key={juzNumber} accessibilityRole="button" accessibilityLabel={juzNameInArabic(juzNumber)} accessibilityState={{ selected: active }} onPress={() => { goToPage(startPage); setJuzSelectorVisible(false); }} style={[styles.juzRow, active && styles.juzRowActive]}>
                    <View style={styles.juzRowNumber}><MaterialIcons name="menu-book" size={19} color="#FFFDF6" /></View>
                    <View style={styles.juzRowInfo}>
                      <Text style={styles.juzRowTitle}>{juzNameInArabic(juzNumber)}</Text>
                      <Text style={styles.juzRowSubtitle}>بداية الصفحة {toArabicDigits(startPage)} · سورة {startSura?.name ?? "الفاتحة"}</Text>
                    </View>
                    <MaterialIcons name="chevron-left" size={20} color="#54705C" />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={suraSelectorVisible} transparent animationType="slide" onRequestClose={() => setSuraSelectorVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="إغلاق فهرس السور" style={styles.modalBackdrop} onPress={() => setSuraSelectorVisible(false)} />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeading}>
              <Text style={styles.sheetTitle}>فهرس السور</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="إغلاق فهرس السور" onPress={() => setSuraSelectorVisible(false)} style={styles.sheetClose}>
                <MaterialIcons name="close" size={22} color="#075739" />
              </Pressable>
            </View>
            <ScrollView style={styles.juzList} contentContainerStyle={styles.juzListContent}>
              {SURAS.map((sura) => {
                const startPage = pageForSura(sura.id);
                const active = sura.id === currentSuraId;
                return (
                  <Pressable
                    key={sura.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`سورة ${sura.name}، أول صفحة ${toArabicDigits(startPage)}`}
                    onPress={() => selectSura(sura.id)}
                    style={[styles.juzRow, active && styles.juzRowActive]}
                  >
                    <View style={styles.juzRowNumber}><Text style={styles.juzRowNumberText}>{toArabicDigits(sura.id)}</Text></View>
                    <View style={styles.juzRowInfo}>
                      <Text numberOfLines={1} style={styles.juzRowTitle}>{sura.name}</Text>
                      <Text numberOfLines={1} style={styles.juzRowSubtitle}>{sura.type} · {toArabicDigits(sura.verses)} آية · صفحة {toArabicDigits(startPage)}</Text>
                    </View>
                    <MaterialIcons name="chevron-left" size={20} color="#54705C" />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={pageNumberSelectorVisible} transparent animationType="slide" onRequestClose={() => setPageNumberSelectorVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="إغلاق قائمة أرقام الصفحات" style={styles.modalBackdrop} onPress={() => setPageNumberSelectorVisible(false)} />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeading}>
              <Text style={styles.sheetTitle}>اختر رقم الصفحة</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="إغلاق قائمة الصفحات" onPress={() => setPageNumberSelectorVisible(false)} style={styles.sheetClose}>
                <MaterialIcons name="close" size={22} color="#075739" />
              </Pressable>
            </View>
            <View style={styles.pageNumberInputRow}>
              <TextInput
                accessibilityLabel="رقم الصفحة للانتقال المباشر"
                keyboardType="number-pad"
                returnKeyType="go"
                maxLength={4}
                value={pageNumberInput}
                onChangeText={(value) => { setPageNumberInput(value); setPageNumberInputError(false); }}
                onSubmitEditing={jumpToTypedPage}
                placeholder="أدخل رقمًا من ١ إلى ٦٠٤"
                placeholderTextColor="#899386"
                style={styles.pageNumberInput}
              />
              <Pressable accessibilityRole="button" onPress={jumpToTypedPage} style={styles.pageNumberJumpButton}>
                <Text style={styles.pageNumberJumpText}>انتقال</Text>
              </Pressable>
            </View>
            {pageNumberInputError ? <Text accessibilityRole="alert" style={styles.pageNumberError}>أدخل رقم صفحة من ١ إلى ٦٠٤.</Text> : null}
            <FlatList
              data={PAGE_NUMBERS}
              numColumns={6}
              keyExtractor={(item) => String(item)}
              columnWrapperStyle={styles.pageNumberRow}
              contentContainerStyle={styles.pageNumberGrid}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={36}
              maxToRenderPerBatch={36}
              windowSize={7}
              style={{ height: Math.min(height * 0.5, 460) }}
              renderItem={({ item }) => {
                const active = item === pageNumber;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`الانتقال إلى الصفحة ${toArabicDigits(item)}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => { goToPage(item); setPageNumberSelectorVisible(false); }}
                    style={[styles.pageNumberCell, active && styles.pageNumberCellActive]}
                  >
                    <Text style={[styles.pageNumberCellText, active && styles.pageNumberCellTextActive]}>{toArabicDigits(item)}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      <SurahInfoSheet visible={surahInfoVisible} surah={currentSura} onClose={() => setSurahInfoVisible(false)} />

      <Modal visible={selectedVerse !== null} transparent animationType="slide" onRequestClose={closeVerseActions}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="إغلاق خيارات الآية" style={styles.modalBackdrop} onPress={closeVerseActions} />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeading}>
              <Text style={styles.sheetTitle}>
                {selectedVerse ? `سورة ${SURAS.find((item) => item.id === selectedVerse.suraId)?.name ?? "القرآن"} · الآية ${toArabicDigits(selectedVerse.ayahNumber)}` : "خيارات الآية"}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="إغلاق" onPress={closeVerseActions} style={styles.sheetClose}>
                <MaterialIcons name="close" size={22} color="#075739" />
              </Pressable>
            </View>
            <ScrollView style={styles.verseSheetScroll} contentContainerStyle={styles.verseSheetContent}>
              <View style={styles.verseQuote}>
                {verseTextLoading ? <ActivityIndicator color="#075739" /> : <Text style={styles.verseQuoteText}>{verseText || "تعذر تحميل نص الآية الآن."}</Text>}
              </View>

              {verseActionView === "menu" ? (
                <View style={styles.verseActions}>
                  <Pressable accessibilityRole="button" onPress={() => { void loadSelectedTafsir(); }} style={styles.actionCard}>
                    <MaterialIcons name="menu-book" size={24} color="#075739" />
                    <View style={styles.actionCardText}><Text style={styles.actionTitle}>عرض التفسير</Text><Text style={styles.actionSubtitle}>التفسير الميسر، ابن كثير أو السعدي</Text></View>
                    <MaterialIcons name="chevron-left" size={20} color="#809080" />
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => setVerseActionView("audio")} style={styles.actionCard}>
                    <MaterialIcons name="headphones" size={24} color="#075739" />
                    <View style={styles.actionCardText}><Text style={styles.actionTitle}>الاستماع للآية</Text><Text style={styles.actionSubtitle}>اختر القارئ ثم شغّل الآية منفردة</Text></View>
                    <MaterialIcons name="chevron-left" size={20} color="#809080" />
                  </Pressable>
                </View>
              ) : null}

              {verseActionView === "tafsir" ? (
                <View style={styles.modePanel}>
                  <Pressable accessibilityRole="button" onPress={() => setVerseActionView("menu")} style={styles.backToActions}><MaterialIcons name="arrow-forward" size={18} color="#075739" /><Text style={styles.backToActionsText}>خيارات الآية</Text></Pressable>
                  <Text style={styles.panelLabel}>اختر التفسير</Text>
                  <View style={styles.choiceChips}>
                    {AYAH_TAFSIRS.map((edition) => <Pressable key={edition.id} accessibilityRole="button" accessibilityState={{ selected: selectedTafsirId === edition.id }} onPress={() => { void loadSelectedTafsir(edition.id); }} style={[styles.choiceChip, selectedTafsirId === edition.id && styles.choiceChipActive]}><Text style={[styles.choiceChipText, selectedTafsirId === edition.id && styles.choiceChipTextActive]}>{edition.name}</Text></Pressable>)}
                  </View>
                  <View style={styles.tafsirCard}>
                    {tafsirLoading ? <ActivityIndicator color="#075739" /> : tafsirError ? <Text style={styles.errorText}>تعذّر تحميل التفسير الآن. تحقق من الاتصال وحاول مجددًا.</Text> : <Text style={styles.tafsirBody}>{tafsirText || "اختر تفسيرًا لعرض شرح هذه الآية."}</Text>}
                  </View>
                </View>
              ) : null}

              {verseActionView === "audio" ? (
                <View style={styles.modePanel}>
                  <Pressable accessibilityRole="button" onPress={() => { stopSelectedAyah(); setVerseActionView("menu"); }} style={styles.backToActions}><MaterialIcons name="arrow-forward" size={18} color="#075739" /><Text style={styles.backToActionsText}>خيارات الآية</Text></Pressable>
                  <Text style={styles.panelLabel}>اختر القارئ</Text>
                  <View style={styles.choiceChips}>
                    {AYAH_RECITERS.map((reciter) => <Pressable key={reciter.id} accessibilityRole="button" accessibilityState={{ selected: selectedAyahReciterId === reciter.id }} onPress={() => setSelectedAyahReciterId(reciter.id)} style={[styles.choiceChip, selectedAyahReciterId === reciter.id && styles.choiceChipActive]}><Text style={[styles.choiceChipText, selectedAyahReciterId === reciter.id && styles.choiceChipTextActive]}>{reciter.name}</Text></Pressable>)}
                  </View>
                  {ayahAudioError ? <Text style={styles.errorText}>تعذّر تشغيل الآية لهذا القارئ. تحقق من الاتصال أو اختر قارئًا آخر.</Text> : null}
                  <View style={styles.audioActions}>
                    <Pressable accessibilityRole="button" disabled={ayahAudioLoading} onPress={() => { void playSelectedAyah(); }} style={[styles.primaryAction, ayahAudioLoading && styles.dimmed]}>
                      {ayahAudioLoading ? <ActivityIndicator color="#FFFDF6" /> : <><MaterialIcons name="play-arrow" size={21} color="#FFFDF6" /><Text style={styles.primaryActionText}>تشغيل الآية</Text></>}
                    </Pressable>
                    {ayahAudioPlaying ? <Pressable accessibilityRole="button" onPress={stopSelectedAyah} style={styles.stopAction}><MaterialIcons name="stop" size={20} color="#075739" /><Text style={styles.stopActionText}>إيقاف</Text></Pressable> : null}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function ToolbarButton({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.toolbarButton, pressed && styles.toolbarPressed, disabled && styles.toolbarDisabled]}
    >
      <MaterialIcons name={icon} size={23} color="#F7F4EC" />
    </Pressable>
  );
}

function HomeToolbarButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="العودة إلى القوائم الرئيسية" onPress={onPress} style={({ pressed }) => [styles.homeToolbarButton, pressed && styles.toolbarPressed]}>
      <MaterialIcons name="home" size={19} color="#F7F4EC" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fullscreenPageScrollContent: { paddingVertical: 0, paddingHorizontal: 0 },
  fullscreenExitButton: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,253,246,0.7)",
    backgroundColor: "rgba(7,87,57,0.92)",
  },
  fullscreenHomeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
    minWidth: 82,
    height: 44,
    paddingHorizontal: 10,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,253,246,0.7)",
    backgroundColor: "rgba(7,87,57,0.92)",
  },
  fullscreenHomeText: { color: "#FFFDF6", fontSize: 11, fontWeight: "800" },
  header: {
    minHeight: 58,
    paddingHorizontal: 10,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#075739",
    borderBottomWidth: 1,
    borderBottomColor: "#347C56",
  },
  headerSection: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 4 },
  headerSectionText: { color: "#F7F4EC", fontSize: 15, fontWeight: "800", textAlign: "center" },
  suraName: { flexShrink: 1, color: "#F7F4EC", fontSize: 15, fontWeight: "800", textAlign: "center" },
  headerPageBadge: { width: 42, height: 42, borderWidth: 2, borderColor: "#F7F4EC", borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#064A31" },
  headerPageText: { color: "#F4D58E", fontSize: 16, fontWeight: "900" },
  readerArea: { flex: 1, minHeight: 0 },
  verticalScroll: { flex: 1 },
  pageScrollContent: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingVertical: 5, paddingHorizontal: 4 },
  horizontalScrollContent: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  pageFrame: {
    alignSelf: "center",
    overflow: "hidden",
    borderColor: "#397650",
    borderWidth: 3,
    borderRadius: 5,
    padding: 3,
    shadowColor: "#173F2A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  pageInfoBar: { minHeight: 31, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 9, backgroundColor: "#075739", borderBottomWidth: 2, borderBottomColor: "#CDAE63" },
  pageInfoNumberButton: { minWidth: 62, minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 2 },
  pageInfoNumber: { minWidth: 20, color: "#F4D58E", fontSize: 15, fontWeight: "900", textAlign: "center" },
  pageInfoSuraGroup: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2 },
  pageInfoSuraInfoButton: { width: 24, minHeight: 28, alignItems: "center", justifyContent: "center" },
  pageInfoSuraButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3, minHeight: 28 },
  pageInfoSuraText: { flexShrink: 1, color: "#FFFDF6", fontSize: 11, fontWeight: "800", textAlign: "right" },
  pageInfoPartButton: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-end", gap: 2, minHeight: 28, paddingLeft: 0 },
  pageInfoPartLabel: { color: "#FFFDF6", fontSize: 11, fontWeight: "800", textAlign: "center" },
  ornamentBand: { height: 18, flexDirection: "row", justifyContent: "space-around", alignItems: "center", backgroundColor: "#F4F1DE" },
  ornament: { fontSize: 13, lineHeight: 16, fontWeight: "800" },
  flower: { color: "#D67DA3" },
  vine: { color: "#4A8255" },
  pageInner: { borderColor: "#B3C79A", borderWidth: 1, padding: 2, backgroundColor: "#FFFDF6" },
  pageImageFrame: { position: "relative", overflow: "hidden" },
  pageImage: { width: "100%", aspectRatio: 1024 / 1656 },
  pageOrnamentOverlay: { ...StyleSheet.absoluteFill, zIndex: 1 },
  pageOrnamentImage: { width: "100%", height: "100%" },
  openingSuraTitlePlate: { position: "absolute", top: "10%", left: "30%", right: "30%", height: "8%", alignItems: "center", justifyContent: "center", zIndex: 2 },
  openingSuraTitleImage: { alignSelf: "center" },
  verseHotspot: { position: "absolute", zIndex: 2, backgroundColor: "transparent" },
  requestedAyahHighlight: { position: "absolute", zIndex: 3, backgroundColor: "rgba(240,182,74,0.16)", borderRadius: 2 },
  activeRecitationHighlight: { position: "absolute", zIndex: 4, backgroundColor: "rgba(240,182,74,0.34)", borderRadius: 2 },
  verseTextTap: { width: "100%", alignItems: "center" },
  loadingCover: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,253,246,0.65)" },
  textPage: { justifyContent: "center", paddingHorizontal: 8, paddingVertical: 18, borderWidth: 1, borderColor: "#91A879" },
  lineRow: { marginVertical: 5 },
  textRecitationHighlight: { borderRadius: 5, backgroundColor: "rgba(240,182,74,0.20)" },
  mushafLine: { color: "#192C21", textAlign: "center", writingDirection: "rtl", fontSize: 19, lineHeight: 33, fontWeight: "500" },
  suraHeader: { color: "#075739", textAlign: "center", fontSize: 20, fontWeight: "800", marginVertical: 8 },
  basmala: { color: "#075739", textAlign: "center", fontSize: 21, lineHeight: 36, fontWeight: "600" },
  searchPreview: { width: "100%", borderWidth: 1, borderColor: "#B5C89B", borderRadius: 10, padding: 10, marginTop: 8 },
  searchPreviewHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  searchPreviewTitle: { color: "#26372C", fontSize: 13, fontWeight: "800" },
  searchPreviewMeta: { fontSize: 11, fontWeight: "700" },
  searchPreviewText: { color: "#26372C", textAlign: "right", writingDirection: "rtl", fontSize: 17, lineHeight: 30 },
  searchHighlight: { color: "#171A35", backgroundColor: "#F0B64A", fontWeight: "800" },
  bottomToolbar: { height: 50, flexShrink: 0, backgroundColor: "#075739", borderTopWidth: 1, borderTopColor: "#347C56" },
  toolbarButton: { width: 34, minWidth: 34, maxWidth: 38, flexShrink: 0, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  homeToolbarButton: { width: 34, flexShrink: 0, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  toolbarPressed: { backgroundColor: "rgba(255,255,255,0.14)" },
  toolbarDisabled: { opacity: 0.32 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(5,18,11,0.55)" },
  bottomSheet: { maxHeight: "86%", minHeight: 240, width: "100%", backgroundColor: "#FFFDF6", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 2, borderColor: "#D2BC83", paddingBottom: 18, overflow: "hidden" },
  sheetHeading: { minHeight: 58, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 17, borderBottomWidth: 1, borderBottomColor: "#E5DFC9", backgroundColor: "#F7F4E8" },
  sheetTitle: { flex: 1, color: "#075739", fontSize: 17, fontWeight: "900", textAlign: "right" },
  sheetClose: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#E8EFDF" },
  pageNumberInputRow: { flexDirection: "row-reverse", alignItems: "center", gap: 9, paddingHorizontal: 14, paddingVertical: 10 },
  pageNumberInput: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: "#C9D5C1", borderRadius: 10, paddingHorizontal: 12, color: "#163F2A", backgroundColor: "#FFFFFF", textAlign: "center", fontSize: 16, fontWeight: "700" },
  pageNumberJumpButton: { minHeight: 44, minWidth: 74, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#075739", paddingHorizontal: 12 },
  pageNumberJumpText: { color: "#FFFDF6", fontSize: 13, fontWeight: "800" },
  pageNumberError: { color: "#A54331", fontSize: 12, textAlign: "right", paddingHorizontal: 16, paddingBottom: 6 },
  pageNumberRow: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 6, marginBottom: 6 },
  pageNumberGrid: { paddingHorizontal: 12, paddingBottom: 12 },
  pageNumberCell: { flex: 1, maxWidth: 52, minHeight: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E0E6DA", borderRadius: 10, backgroundColor: "#FBFCF8" },
  pageNumberCellActive: { borderColor: "#075739", backgroundColor: "#E7F0E6" },
  pageNumberCellText: { color: "#435647", fontSize: 13, fontWeight: "700" },
  pageNumberCellTextActive: { color: "#075739", fontWeight: "900" },
  juzList: { flexGrow: 0, paddingHorizontal: 12 },
  juzListContent: { paddingBottom: 10 },
  juzRow: { minHeight: 62, flexDirection: "row-reverse", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#E8E4D7", paddingHorizontal: 6 },
  juzRowActive: { backgroundColor: "#EFF4E8" },
  juzRowNumber: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#075739" },
  juzRowNumberText: { color: "#FFFDF6", fontSize: 16, fontWeight: "900" },
  juzRowInfo: { flex: 1, alignItems: "flex-start", gap: 2 },
  juzRowTitle: { color: "#163F2A", fontSize: 14, fontWeight: "800" },
  juzRowSubtitle: { color: "#738072", fontSize: 11, textAlign: "right" },
  verseSheetScroll: { flexGrow: 0, maxHeight: 600 },
  verseSheetContent: { padding: 16, gap: 12 },
  verseQuote: { minHeight: 72, padding: 13, borderWidth: 1, borderColor: "#D4C69A", borderRadius: 12, backgroundColor: "#F8F3E4", alignItems: "center", justifyContent: "center" },
  verseQuoteText: { color: "#152E20", fontSize: 21, lineHeight: 39, textAlign: "center", writingDirection: "rtl" },
  verseActions: { gap: 10 },
  actionCard: { minHeight: 66, paddingHorizontal: 13, flexDirection: "row-reverse", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#D9E1CF", borderRadius: 12, backgroundColor: "#FAFBF5" },
  actionCardText: { flex: 1, alignItems: "flex-start", gap: 3 },
  actionTitle: { color: "#16452E", fontSize: 14, fontWeight: "800" },
  actionSubtitle: { color: "#7A8279", fontSize: 11, textAlign: "right" },
  modePanel: { gap: 11 },
  backToActions: { minHeight: 34, flexDirection: "row-reverse", alignItems: "center", alignSelf: "flex-start", gap: 5, paddingHorizontal: 7 },
  backToActionsText: { color: "#075739", fontSize: 12, fontWeight: "800" },
  panelLabel: { color: "#556557", fontSize: 12, fontWeight: "800", textAlign: "right" },
  choiceChips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  choiceChip: { minHeight: 36, justifyContent: "center", borderWidth: 1, borderColor: "#CAD7C5", borderRadius: 18, paddingHorizontal: 11, backgroundColor: "#FBFBF6" },
  choiceChipActive: { borderColor: "#075739", backgroundColor: "#E7F0E6" },
  choiceChipText: { color: "#4C6151", fontSize: 11, fontWeight: "700" },
  choiceChipTextActive: { color: "#075739", fontWeight: "900" },
  tafsirCard: { minHeight: 90, padding: 14, justifyContent: "center", borderWidth: 1, borderColor: "#DDD5BB", borderRadius: 12, backgroundColor: "#FAF7ED" },
  tafsirBody: { color: "#27382B", fontSize: 15, lineHeight: 28, textAlign: "right", writingDirection: "rtl" },
  errorText: { color: "#A54331", fontSize: 13, lineHeight: 22, textAlign: "right" },
  audioActions: { flexDirection: "row-reverse", gap: 10, alignItems: "center" },
  primaryAction: { minHeight: 44, flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 11, backgroundColor: "#075739" },
  primaryActionText: { color: "#FFFDF6", fontSize: 13, fontWeight: "800" },
  stopAction: { minHeight: 42, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderColor: "#A7B8A7", borderRadius: 10, paddingHorizontal: 12 },
  stopActionText: { color: "#075739", fontSize: 12, fontWeight: "800" },
  dimmed: { opacity: 0.65 },
});
type VerseHotspot = {
  key: string;
  target: VerseTapTarget;
  area: MushafPixelRect | null;
  fallbackStyle: ReturnType<typeof verseTargetLayout> | null;
};
