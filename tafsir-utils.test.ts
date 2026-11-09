import { describe, expect, it } from "vitest";
import { filterTafsirRows, normalizeTafsirRows } from "../lib/tafsir-utils";

describe("tafsir rows", () => {
  it("keeps one valid row per ayah, sorted and within the selected surah", () => {
    const rows = normalizeTafsirRows([
      { ayah: 3, text: "ثالثًا" },
      { ayah: 1, text: "أولًا" },
      { ayah: 3, text: "نسخة مكررة" },
      { ayah: 0, text: "غير صالح" },
      { ayah: 4, text: "خارج السورة" },
      { ayah: 2, text: "ثانيًا" },
      { ayah: 2, text: "" },
    ], 3);
    expect(rows).toEqual([
      { numberInSurah: 1, text: "أولًا" },
      { numberInSurah: 2, text: "ثانيًا" },
      { numberInSurah: 3, text: "ثالثًا" },
    ]);
  });

  it("finds tafsir text without requiring Arabic diacritics", () => {
    const rows = [
      { numberInSurah: 1, text: "هَٰذَا تَفْسِيرٌ مُخْتَصَرٌ" },
      { numberInSurah: 2, text: "نَصٌّ آخَر" },
    ];
    expect(filterTafsirRows(rows, "تفسير")).toEqual([rows[0]]);
    expect(filterTafsirRows(rows, "")).toEqual(rows);
  });

  it("returns no rows for an invalid payload", () => {
    expect(normalizeTafsirRows(null, 7)).toEqual([]);
    expect(normalizeTafsirRows({ ayah: 1 }, 7)).toEqual([]);
  });
});
