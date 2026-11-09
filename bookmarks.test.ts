import { describe, expect, it } from "vitest";
import { bookmarkId } from "../lib/bookmarks";

describe("bookmark identity", () => {
  it("creates stable distinct ids for surah, ayah, tafsir, and mp3 bookmarks", () => {
    expect(bookmarkId("sura", 2)).toBe("sura:2::");
    expect(bookmarkId("ayah", 2, 255)).toBe("ayah:2:255:");
    expect(bookmarkId("tafsir", 2, 255, "تفسير ابن كثير")).toBe("tafsir:2:255:تفسير ابن كثير");
    expect(bookmarkId("mp3", 2, undefined, undefined, "afs")).toBe("mp3:2:::afs");
    expect(bookmarkId("sura", 1, undefined, undefined, "quran")).not.toBe(bookmarkId("sura", 1, undefined, undefined, "tafsir:1"));
    expect(bookmarkId("mp3", 1, undefined, undefined, "afs")).not.toBe(bookmarkId("mp3", 1, undefined, undefined, "basit"));
    expect(new Set([
      bookmarkId("sura", 2),
      bookmarkId("ayah", 2, 255),
      bookmarkId("tafsir", 2, 255, "تفسير ابن كثير"),
      bookmarkId("mp3", 2, undefined, undefined, "afs"),
    ]).size).toBe(4);
  });
});
