import { describe, expect, it } from "vitest";
import { isContinueReadingSession, juzForPage, juzNameInArabic, lineIndexForAyah, pageAfterHorizontalSwipe, pageForAyah, pageForJuz, pageForSura, parseMushafPageNumber, PAGES, suraIdForPage, verseTapTargetsForPage } from "../lib/mushaf";

const containsSura = (page: (typeof PAGES)[number], suraId: number) => {
  const code = String(suraId).padStart(3, "0");
  const prefix = `${suraId}:`;
  return page.lines.some((line) => line.surah === code || line.verseRange?.startsWith(prefix));
};

describe("Madinah Mushaf surah page mapping", () => {
  it("contains exactly 604 pages", () => {
    expect(PAGES).toHaveLength(604);
  });

  it("maps every one of the 114 surahs to its own first matching page", () => {
    for (let suraId = 1; suraId <= 114; suraId += 1) {
      const pageNumber = pageForSura(suraId);
      expect(pageNumber).toBeGreaterThanOrEqual(1);
      expect(pageNumber).toBeLessThanOrEqual(604);
      expect(containsSura(PAGES[pageNumber - 1], suraId)).toBe(true);
      expect(PAGES.findIndex((page) => containsSura(page, suraId)) + 1).toBe(pageNumber);
    }
  });

  it("maps a searched ayah to the page whose verse range contains it", () => {
    const pageForSaff6 = PAGES.find((page) => page.lines.some((line) => line.verseRange === "61:6-61:6" || line.verseRange === "61:6-61:7"))?.page;
    expect(pageForSaff6).toBeDefined();
    expect(pageForAyah(61, 6)).toBe(pageForSaff6);
    expect(pageForAyah(61, 6)).not.toBe(pageForSura(61));
    expect(pageForAyah(1, 1)).toBe(pageForSura(1));
    expect(lineIndexForAyah(pageForSaff6 as number, 61, 6)).toBeGreaterThanOrEqual(0);
  });

  it("does not fall back to Al-Fatiha page for other surahs", () => {
    for (let suraId = 2; suraId <= 114; suraId += 1) {
      expect(pageForSura(suraId)).not.toBe(1);
    }
  });

  it("restores the surah shown on a page even when the page has no surah title marker", () => {
    expect(suraIdForPage(1)).toBe(1);
    expect(suraIdForPage(2)).toBe(2);
    expect(suraIdForPage(604)).toBe(112);
    expect(suraIdForPage(0)).toBe(1);
  });

  it("maps page boundaries to the correct Madinah Mushaf juz", () => {
    expect(juzForPage(1)).toBe(1);
    expect(juzForPage(22)).toBe(2);
    expect(juzForPage(21)).toBe(1);
    expect(juzForPage(604)).toBe(30);
  });

  it("maps all thirty juz to their opening pages in the Madinah Mushaf", () => {
    expect(Array.from({ length: 30 }, (_, index) => pageForJuz(index + 1))).toEqual([1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582]);
    expect(pageForJuz(0)).toBe(1);
    expect(pageForJuz(31)).toBe(1);
  });

  it("writes every juz ordinal in Arabic words instead of numerals", () => {
    expect(Array.from({ length: 30 }, (_, index) => juzNameInArabic(index + 1))).toEqual([
      "الجزء الأول", "الجزء الثاني", "الجزء الثالث", "الجزء الرابع", "الجزء الخامس", "الجزء السادس", "الجزء السابع", "الجزء الثامن", "الجزء التاسع", "الجزء العاشر",
      "الجزء الحادي عشر", "الجزء الثاني عشر", "الجزء الثالث عشر", "الجزء الرابع عشر", "الجزء الخامس عشر", "الجزء السادس عشر", "الجزء السابع عشر", "الجزء الثامن عشر", "الجزء التاسع عشر", "الجزء العشرون",
      "الجزء الحادي والعشرون", "الجزء الثاني والعشرون", "الجزء الثالث والعشرون", "الجزء الرابع والعشرون", "الجزء الخامس والعشرون", "الجزء السادس والعشرون", "الجزء السابع والعشرون", "الجزء الثامن والعشرون", "الجزء التاسع والعشرون", "الجزء الثلاثون",
    ]);
    expect(juzNameInArabic(0)).toBe("الجزء غير محدد");
  });

  it("parses valid page numbers in Western, Arabic-Indic, and Persian digits", () => {
    expect(parseMushafPageNumber("1")).toBe(1);
    expect(parseMushafPageNumber("٦٠٤")).toBe(604);
    expect(parseMushafPageNumber("۵۸۲")).toBe(582);
    expect(parseMushafPageNumber(" ٢٢ ")).toBe(22);
  });

  it("rejects blank, malformed, and out-of-range page numbers", () => {
    expect(parseMushafPageNumber("")).toBeNull();
    expect(parseMushafPageNumber("٠")).toBeNull();
    expect(parseMushafPageNumber("٦٠٥")).toBeNull();
    expect(parseMushafPageNumber("١٢٫٥")).toBeNull();
  });

  it("creates tappable targets only for numbered verses on a valid page", () => {
    const targets = verseTapTargetsForPage(1);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((target) => target.suraId === 1 && target.ayahNumber >= 1 && target.ayahNumber <= 7)).toBe(true);
    expect(verseTapTargetsForPage(0)).toEqual([]);
    expect(verseTapTargetsForPage(605)).toEqual([]);
  });

  it("advances on a right swipe and returns to the previous page on a left swipe", () => {
    expect(pageAfterHorizontalSwipe(1, 100, 0)).toBe(2);
    expect(pageAfterHorizontalSwipe(20, -100, 0)).toBe(19);
  });

  it("continues to turn pages through repeated right and left swipes", () => {
    let page = 1;
    for (let index = 0; index < 5; index += 1) page = pageAfterHorizontalSwipe(page, 100, 4);
    expect(page).toBe(6);
    for (let index = 0; index < 5; index += 1) page = pageAfterHorizontalSwipe(page, -100, -4);
    expect(page).toBe(1);
  });

  it("does not turn short or mostly vertical gestures into page changes", () => {
    expect(pageAfterHorizontalSwipe(20, 35, 0)).toBe(20);
    expect(pageAfterHorizontalSwipe(20, 50, 60)).toBe(20);
  });

  it("keeps horizontal swipes within the first and last Mushaf pages", () => {
    expect(pageAfterHorizontalSwipe(1, -100, 0)).toBe(1);
    expect(pageAfterHorizontalSwipe(604, 100, 0)).toBe(604);
  });

  it("saves reading progress only for the dedicated continue-reading route", () => {
    expect(isContinueReadingSession("continue")).toBe(true);
    expect(isContinueReadingSession(undefined)).toBe(false);
    expect(isContinueReadingSession("index")).toBe(false);
    expect(isContinueReadingSession(["continue", "other"])).toBe(false);
  });
});
