import { pageForAyah } from "./mushaf";

export type RecitationAyah = { suraId: number; ayahNumber: number };
export type AudioCompletionStatus = {
  didJustFinish?: boolean;
  duration?: number;
  currentTime?: number;
  playing?: boolean;
};

/** Expo Web can omit its one-shot finish event, so also recognize a stopped playhead at the end. */
export const audioStatusHasEnded = (status: AudioCompletionStatus, toleranceSeconds = 0.18): boolean =>
  Boolean(status.didJustFinish) || (
    (status.duration ?? 0) > 0 &&
    (status.currentTime ?? 0) >= (status.duration ?? 0) - toleranceSeconds &&
    !status.playing
  );

/** Al-Fatihah's basmala is verse 1 itself; At-Tawbah has no opening basmala. */
export const needsSeparateBasmalaTrack = (ayah: RecitationAyah): boolean =>
  ayah.ayahNumber === 1 && ayah.suraId !== 1 && ayah.suraId !== 9;

export type RecitationAyahTarget = RecitationAyah & {
  lineIndex: number;
  segmentIndex: number;
  segmentCount: number;
};

/** Return the following ayah, or null at the end of this surah. */
export const nextAyahWithinSura = (
  current: RecitationAyah,
  ayahCount: number,
): RecitationAyah | null => {
  if (
    !Number.isInteger(current.suraId) || current.suraId < 1 ||
    !Number.isInteger(current.ayahNumber) || current.ayahNumber < 1 ||
    !Number.isInteger(ayahCount) || ayahCount < 1 ||
    current.ayahNumber >= ayahCount
  ) {
    return null;
  }

  return { suraId: current.suraId, ayahNumber: current.ayahNumber + 1 };
};

/** Advance in Mushaf order across surah boundaries, stopping only after the final surah. */
export const nextAyahInQuran = (
  current: RecitationAyah,
  suras: ReadonlyArray<{ id: number; verses: number }>,
): RecitationAyah | null => {
  const currentIndex = suras.findIndex((sura) => sura.id === current.suraId);
  const sura = suras[currentIndex];
  if (!sura || !Number.isInteger(current.ayahNumber) || current.ayahNumber < 1 || current.ayahNumber > sura.verses) return null;
  if (current.ayahNumber < sura.verses) return { suraId: sura.id, ayahNumber: current.ayahNumber + 1 };
  const nextSura = suras[currentIndex + 1];
  return nextSura ? { suraId: nextSura.id, ayahNumber: 1 } : null;
};

/** Return a bounded run-ahead window for audio URL resolution and source warm-up. */
export const upcomingAyahsInQuran = (
  current: RecitationAyah,
  suras: ReadonlyArray<{ id: number; verses: number }>,
  count = 2,
): RecitationAyah[] => {
  if (!Number.isInteger(count) || count <= 0) return [];
  const upcoming: RecitationAyah[] = [];
  let cursor = current;
  while (upcoming.length < count) {
    const next = nextAyahInQuran(cursor, suras);
    if (!next) break;
    upcoming.push(next);
    cursor = next;
  }
  return upcoming;
};

/** Use the last verse the reader touched only when it belongs to the visible page. */
export const resolveRecitationStart = (
  pageNumber: number,
  touchedAyah: RecitationAyah | null,
  firstAyahOnPage: RecitationAyah | null,
): RecitationAyah | null => {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) return null;

  if (
    touchedAyah &&
    Number.isInteger(touchedAyah.suraId) &&
    Number.isInteger(touchedAyah.ayahNumber) &&
    touchedAyah.ayahNumber > 0 &&
    pageForAyah(touchedAyah.suraId, touchedAyah.ayahNumber) === pageNumber
  ) {
    return { suraId: touchedAyah.suraId, ayahNumber: touchedAyah.ayahNumber };
  }

  if (
    !firstAyahOnPage ||
    !Number.isInteger(firstAyahOnPage.suraId) ||
    !Number.isInteger(firstAyahOnPage.ayahNumber) ||
    firstAyahOnPage.suraId < 1 ||
    firstAyahOnPage.ayahNumber < 1
  ) {
    return null;
  }

  return { suraId: firstAyahOnPage.suraId, ayahNumber: firstAyahOnPage.ayahNumber };
};
