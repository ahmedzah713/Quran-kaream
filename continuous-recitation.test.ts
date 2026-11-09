import { describe, expect, it } from "vitest";
import { audioStatusHasEnded, needsSeparateBasmalaTrack, nextAyahInQuran, nextAyahWithinSura, resolveRecitationStart, upcomingAyahsInQuran } from "./continuous-recitation";
import { SURAS } from "./quran-data";

const firstAyahOnPageTwo = { suraId: 2, ayahNumber: 1 };

describe("continuous recitation flow", () => {
  it("advances by one ayah without changing surah", () => {
    expect(nextAyahWithinSura({ suraId: 2, ayahNumber: 17 }, 286)).toEqual({ suraId: 2, ayahNumber: 18 });
  });

  it("stops at the end of the current surah", () => {
    expect(nextAyahWithinSura({ suraId: 2, ayahNumber: 286 }, 286)).toBeNull();
    expect(nextAyahWithinSura({ suraId: 2, ayahNumber: 1 }, 0)).toBeNull();
  });

  it("continues from the final verse of a surah to verse one of the next surah", () => {
    expect(nextAyahInQuran({ suraId: 2, ayahNumber: 286 }, SURAS)).toEqual({ suraId: 3, ayahNumber: 1 });
    expect(nextAyahInQuran({ suraId: 8, ayahNumber: 75 }, SURAS)).toEqual({ suraId: 9, ayahNumber: 1 });
  });

  it("stops after the last verse of the final surah in the Mushaf", () => {
    expect(nextAyahInQuran({ suraId: 114, ayahNumber: 6 }, SURAS)).toBeNull();
  });

  it("plays a separately recorded basmala before other surahs but not Al-Fatihah or At-Tawbah", () => {
    expect(needsSeparateBasmalaTrack({ suraId: 2, ayahNumber: 1 })).toBe(true);
    expect(needsSeparateBasmalaTrack({ suraId: 1, ayahNumber: 1 })).toBe(false);
    expect(needsSeparateBasmalaTrack({ suraId: 9, ayahNumber: 1 })).toBe(false);
    expect(needsSeparateBasmalaTrack({ suraId: 2, ayahNumber: 2 })).toBe(false);
  });

  it("prepares the next two ayahs, including a surah boundary, without running past the Mushaf", () => {
    expect(upcomingAyahsInQuran({ suraId: 2, ayahNumber: 285 }, SURAS)).toEqual([
      { suraId: 2, ayahNumber: 286 },
      { suraId: 3, ayahNumber: 1 },
    ]);
    expect(upcomingAyahsInQuran({ suraId: 114, ayahNumber: 5 }, SURAS)).toEqual([
      { suraId: 114, ayahNumber: 6 },
    ]);
    expect(upcomingAyahsInQuran({ suraId: 2, ayahNumber: 1 }, SURAS, 0)).toEqual([]);
  });

  it("recognizes natural audio completion even when Expo Web omits didJustFinish", () => {
    expect(audioStatusHasEnded({ duration: 8, currentTime: 7.9, playing: false })).toBe(true);
    expect(audioStatusHasEnded({ didJustFinish: true, duration: 8, currentTime: 6, playing: false })).toBe(true);
    expect(audioStatusHasEnded({ duration: 8, currentTime: 7.7, playing: true })).toBe(false);
    expect(audioStatusHasEnded({ duration: 0, currentTime: 0, playing: false })).toBe(false);
  });

  it("starts at the touched ayah when that ayah belongs to the current page", () => {
    expect(resolveRecitationStart(2, { suraId: 2, ayahNumber: 3 }, firstAyahOnPageTwo)).toEqual({
      suraId: 2,
      ayahNumber: 3,
    });
  });

  it("falls back to the first ayah on the visible page when the previous touch is elsewhere", () => {
    expect(resolveRecitationStart(2, { suraId: 1, ayahNumber: 1 }, firstAyahOnPageTwo)).toEqual(firstAyahOnPageTwo);
  });

  it("returns no start when the page has no ayah target", () => {
    expect(resolveRecitationStart(2, null, null)).toBeNull();
  });
});
