import mushafPages from "../data/mushaf-pages.json";

export type MushafLine = { type: string; text: string; verseRange: string | null; surah: string | null };
export type MushafPage = { page: number; lines: MushafLine[] };

export const PAGES = mushafPages as MushafPage[];

/** Parse a typed page number in Arabic-Indic, Persian, or Western digits. */
export const parseMushafPageNumber = (value: string): number | null => {
  const normalized = value.trim().replace(/[٠-٩۰-۹]/gu, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
  if (!/^\d+$/u.test(normalized)) return null;
  const pageNumber = Number(normalized);
  return Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= PAGES.length ? pageNumber : null;
};

/**
 * Finds the first Madinah Mushaf page containing the requested surah.
 * Some page records identify only the first verse range rather than repeating
 * the surah marker, so both fields must be considered.
 */
export const pageForSura = (suraId: number) => {
  const code = String(suraId).padStart(3, "0");
  const prefix = `${suraId}:`;
  return PAGES.find((page) => page.lines.some((line) => line.surah === code || line.verseRange?.startsWith(prefix)))?.page ?? 1;
};

/** Finds the first surah represented on a page, including pages without a surah title marker. */
export const suraIdForPage = (pageNumber: number) => {
  const page = PAGES[pageNumber - 1];
  if (!page) return 1;

  for (const line of page.lines) {
    if (line.type === "surah-header" && line.surah) return Number(line.surah);
    const match = line.verseRange?.match(/^(\d+):/u);
    if (match) return Number(match[1]);
  }

  return 1;
};

const JUZ_START_PAGES = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582] as const;

const JUZ_ORDINALS = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر", "التاسع عشر", "العشرون", "الحادي والعشرون", "الثاني والعشرون", "الثالث والعشرون", "الرابع والعشرون", "الخامس والعشرون", "السادس والعشرون", "السابع والعشرون", "الثامن والعشرون", "التاسع والعشرون", "الثلاثون"] as const;

export const juzNameInArabic = (juzNumber: number) => {
  const ordinal = JUZ_ORDINALS[juzNumber - 1];
  return ordinal ? `الجزء ${ordinal}` : "الجزء غير محدد";
};

export const pageForJuz = (juzNumber: number) => Number.isInteger(juzNumber) && juzNumber >= 1 && juzNumber <= JUZ_START_PAGES.length
  ? JUZ_START_PAGES[juzNumber - 1]
  : 1;

export type VerseTapTarget = { suraId: number; ayahNumber: number; lineIndex: number; segmentIndex: number; segmentCount: number };

export const verseTapTargetsForPage = (pageNumber: number): VerseTapTarget[] => {
  const page = PAGES[pageNumber - 1];
  if (!page) return [];

  return page.lines.flatMap((line, lineIndex) => {
    const range = line.verseRange?.match(/^(\d+):(\d+)-(\d+):(\d+)$/u);
    if (!range) return [];
    const startSura = Number(range[1]);
    const startAyah = Number(range[2]);
    const endSura = Number(range[3]);
    const endAyah = Number(range[4]);
    if (startSura !== endSura || endAyah < startAyah || endAyah - startAyah > 6) {
      return [{ suraId: startSura, ayahNumber: startAyah, lineIndex, segmentIndex: 0, segmentCount: 1 }];
    }
    const segmentCount = endAyah - startAyah + 1;
    return Array.from({ length: segmentCount }, (_, segmentIndex) => ({
      suraId: startSura,
      ayahNumber: startAyah + segmentIndex,
      lineIndex,
      segmentIndex,
      segmentCount,
    }));
  });
};

/** Return every printed segment for an ayah, including continuations on another line. */
export const verseTapTargetsForAyahOnPage = (
  pageNumber: number,
  suraId: number,
  ayahNumber: number,
): VerseTapTarget[] => verseTapTargetsForPage(pageNumber).filter(
  (target) => target.suraId === suraId && target.ayahNumber === ayahNumber,
);

export const juzForPage = (pageNumber: number) => {
  const index = JUZ_START_PAGES.findIndex((startPage, offset) => pageNumber < startPage && offset > 0);
  return index === -1 ? JUZ_START_PAGES.length : Math.max(1, index);
};

/** Resolve an intentional horizontal swipe: right advances, left goes back. */
export const pageAfterHorizontalSwipe = (pageNumber: number, deltaX: number, deltaY: number, pageCount = PAGES.length) => {
  if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return pageNumber;
  const requestedPage = pageNumber + (deltaX > 0 ? 1 : -1);
  return Math.max(1, Math.min(pageCount, requestedPage));
};

/** Only the explicit Continue Reading flow owns the saved reading position. */
export const isContinueReadingSession = (mode: string | string[] | undefined) => mode === "continue";

const rangeContainsAyah = (range: string | null, suraId: number, ayahNumber: number) => {
  if (!range) return false;
  const match = range.match(/^(\d+):(\d+)-(\d+):(\d+)$/u);
  if (!match) return false;
  const startSura = Number(match[1]);
  const startAyah = Number(match[2]);
  const endSura = Number(match[3]);
  const endAyah = Number(match[4]);
  if (startSura !== suraId || endSura !== suraId) return false;
  return ayahNumber >= startAyah && ayahNumber <= endAyah;
};

export const pageForAyah = (suraId: number, ayahNumber: number) => {
  const exactPage = PAGES.find((page) => page.lines.some((line) => rangeContainsAyah(line.verseRange, suraId, ayahNumber)))?.page;
  return exactPage ?? pageForSura(suraId);
};

export const lineIndexForAyah = (pageNumber: number, suraId: number, ayahNumber: number) => {
  const page = PAGES[pageNumber - 1];
  return page?.lines.findIndex((line) => rangeContainsAyah(line.verseRange, suraId, ayahNumber)) ?? -1;
};
