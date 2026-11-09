import { describe, expect, it } from "vitest";
import { getSurahInfoNotes } from "./surah-info";

describe("getSurahInfoNotes", () => {
  it("reports the Fatiha classification disagreement without claiming one definitive cause", () => {
    const notes = getSurahInfoNotes(1);

    expect(notes.classificationNote).toContain("مكية");
    expect(notes.classificationNote).toContain("مدنية");
    expect(notes.asbabNote).toContain("لا يعرض المصدر سببًا خاصًا متفقًا عليه");
    expect(notes.references[0]?.url).toBe("https://quran.ksu.edu.sa/tafseer/katheer/sura1-aya1.html");
  });

  it("clearly limits the Baqarah example to verse 158 and links Arabic tafsir sources", () => {
    const notes = getSurahInfoNotes(2);

    expect(notes.asbabNote).toContain("الآية ١٥٨");
    expect(notes.asbabNote).toContain("تخص الآية ١٥٨ لا السورة كلها");
    expect(notes.references).toHaveLength(2);
    expect(notes.references.every((source) => source.url.startsWith("https://"))).toBe(true);
  });

  it("uses a careful fallback for surahs without a curated surah-level note", () => {
    const notes = getSurahInfoNotes(3);

    expect(notes.asbabNote).toContain("لا تعرض هذه البطاقة سببًا عامًا موثقًا");
    expect(notes.asbabNote).toContain("عرض التفسير");
    expect(notes.references[0]?.url).toBe("https://quran.ksu.edu.sa/tafseer/katheer/sura3-aya1.html");
  });
});
