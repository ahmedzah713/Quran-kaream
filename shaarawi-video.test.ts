import { describe, expect, it } from "vitest";
import { SHAAWARI_INTERVIEWS, SHAAWARI_OFFICIAL_CHANNEL, SHAAWARI_TV_TAFSIR } from "../lib/shaarawi-video";

describe("Al-Shaarawi video library", () => {
  it("contains direct archive video episodes for the TV tafsir", () => {
    expect(SHAAWARI_TV_TAFSIR.length).toBeGreaterThanOrEqual(1000);
    expect(SHAAWARI_TV_TAFSIR.filter((item) => item.source === "archive").length).toBeGreaterThanOrEqual(1000);
    expect(SHAAWARI_TV_TAFSIR.every((item) => item.source === "archive")).toBe(true);
    expect(SHAAWARI_TV_TAFSIR.filter((item) => item.source === "archive").every((item) => item.url.endsWith(".mp4"))).toBe(true);
    expect(new Set(SHAAWARI_TV_TAFSIR.map((item) => item.url)).size).toBe(SHAAWARI_TV_TAFSIR.length);
    expect(SHAAWARI_TV_TAFSIR.some((item) => item.surah === "الفاتحة")).toBe(true);
    expect(SHAAWARI_TV_TAFSIR.some((item) => item.surah === "يس")).toBe(true);
    expect(SHAAWARI_TV_TAFSIR.some((item) => item.surah === "الجزء الثلاثون")).toBe(true);
    expect(SHAAWARI_TV_TAFSIR.every((item) => item.category === "tafsir")).toBe(true);
  });

  it("keeps official-channel interviews in a separate category", () => {
    expect(SHAAWARI_INTERVIEWS.length).toBeGreaterThanOrEqual(2);
    expect(SHAAWARI_INTERVIEWS.every((item) => item.category === "interview" && item.source === "youtube")).toBe(true);
    expect(SHAAWARI_OFFICIAL_CHANNEL).toContain("youtube.com/@alsharawiofficial");
  });
});
