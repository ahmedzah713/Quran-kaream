import { describe, expect, it } from "vitest";
import { cleanSurahName, highlightMatches, parseAyahReference, uniqueAyahResults } from "../lib/search-utils";

const result = (text: string) => ({
  number: 551,
  numberInSurah: 6,
  text,
  surah: { number: 61, name: "سُورَةُ الصَّفِّ", englishName: "As-Saff" },
});

describe("Quran search result normalization", () => {
  it("removes the duplicated surah prefix", () => {
    expect(cleanSurahName("سُورَةُ الصَّفِّ", 61)).toBe("الصف");
  });

  it("highlights an Arabic query inside a vocalized verse without changing its text", () => {
    const segments = highlightMatches("وَإِذْ قَالَ عِيسَى ابْنُ مَرْيَمَ", "قال عيسى");
    expect(segments.filter((segment) => segment.highlighted).map((segment) => segment.text).join(" ")).toContain("قَالَ");
    expect(segments.some((segment) => segment.highlighted && segment.text.includes("عِيسَى"))).toBe(true);
  });

  it("parses Latin and Arabic surah-ayah references and rejects invalid ranges", () => {
    expect(parseAyahReference("61:6")).toEqual({ suraId: 61, ayahNumber: 6 });
    expect(parseAyahReference("٦١:٦")).toEqual({ suraId: 61, ayahNumber: 6 });
    expect(parseAyahReference("61/7")).toEqual({ suraId: 61, ayahNumber: 7 });
    expect(parseAyahReference("61:15")).toBeNull();
    expect(parseAyahReference("115:1")).toBeNull();
  });

  it("keeps one result for repeated editions of the same ayah", () => {
    const results = uniqueAyahResults([
      result("النص الأول"),
      result("النص الثاني"),
      { ...result("آية مختلفة"), numberInSurah: 7, number: 552 },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].surah.name).toBe("الصف");
    expect(results[0].numberInSurah).toBe(6);
  });
});
