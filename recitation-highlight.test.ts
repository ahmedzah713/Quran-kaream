import { describe, expect, it } from "vitest";
import { verseTapTargetsForAyahOnPage } from "./mushaf";

describe("printed ayah highlight segments", () => {
  it("returns every line fragment for Al-Baqarah ayah 6 on page 3", () => {
    expect(verseTapTargetsForAyahOnPage(3, 2, 6)).toEqual([
      { suraId: 2, ayahNumber: 6, lineIndex: 0, segmentIndex: 0, segmentCount: 1 },
      { suraId: 2, ayahNumber: 6, lineIndex: 1, segmentIndex: 0, segmentCount: 2 },
    ]);
  });

  it("keeps Al-Baqarah ayah 7's printed fragments distinct from ayah 6", () => {
    expect(verseTapTargetsForAyahOnPage(3, 2, 7)).toEqual([
      { suraId: 2, ayahNumber: 7, lineIndex: 1, segmentIndex: 1, segmentCount: 2 },
      { suraId: 2, ayahNumber: 7, lineIndex: 2, segmentIndex: 0, segmentCount: 2 },
    ]);
  });

  it("returns no fragments for an ayah outside the page mapping", () => {
    expect(verseTapTargetsForAyahOnPage(3, 2, 286)).toEqual([]);
  });
});
