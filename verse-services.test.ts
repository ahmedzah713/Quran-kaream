import { describe, expect, it } from "vitest";
import { AYAH_RECITERS, AYAH_TAFSIRS, getAyahAudioUrl, getAyahTafsirUrl, getAyahTextUrl, readAyahAudioUrl, readAyahTafsir, readAyahText } from "../lib/verse-services";

describe("ayah services", () => {
  it("offers multiple reciters with an audio edition for a specific verse", () => {
    expect(AYAH_RECITERS.length).toBeGreaterThan(1);
    for (const reciter of AYAH_RECITERS) {
      expect(getAyahAudioUrl(2, 255, reciter.edition)).toContain(`/ayah/2:255/${reciter.edition}`);
    }
  });

  it("builds Arabic text, tafsir, and audio API URLs for the requested ayah", () => {
    expect(getAyahTextUrl(2, 255)).toContain("/ayah/2:255/quran-uthmani");
    expect(getAyahTafsirUrl(AYAH_TAFSIRS[0].id, 2, 255)).toContain("/ar-tafsir-muyassar/2/255.json");
  });

  it("extracts only valid Arabic text and HTTPS audio URLs", () => {
    expect(readAyahText({ data: { text: "آية كريمة" } })).toBe("آية كريمة");
    expect(readAyahText({ data: { text: " " } })).toBeNull();
    expect(readAyahAudioUrl({ data: { audio: "https://cdn.example/ayah.mp3" } })).toBe("https://cdn.example/ayah.mp3");
    expect(readAyahAudioUrl({ data: { audio: "javascript:alert(1)" } })).toBeNull();
  });

  it("extracts the selected tafsir and rejects invalid response payloads", () => {
    expect(readAyahTafsir({ text: "شرح الآية" })).toBe("شرح الآية");
    expect(readAyahTafsir({ text: " " })).toBeNull();
    expect(readAyahTafsir({ data: { text: "غير مدعوم" } })).toBeNull();
  });
});
