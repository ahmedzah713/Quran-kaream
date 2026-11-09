import { describe, expect, it } from "vitest";
import { calibratedAreasForAyah, calibratedBasmalaAreaForAyah, pixelRectToPercent, type MushafVerseLayout } from "./mushaf-layout";
import { pageForSura } from "./mushaf";
import calibratedLayoutJson from "../data/mushaf-verse-layout.json";

const fixture: MushafVerseLayout = {
  schemaVersion: 1,
  imageWidth: 1024,
  imageHeight: 1656,
  pages: {
    "2": { areas: {}, basmalaAreas: { "2": { x: 370, y: 540, width: 320, height: 42 } } },
    "3": { areas: { "2:8": [{ x: 80, y: 160, width: 300, height: 52 }, { x: 120, y: 270, width: 180, height: 48 }] } },
    "4": { areas: { "2:8": [{ x: 12, y: 20, width: 40, height: 30 }] } },
  },
};

describe("calibrated Mushaf verse layout", () => {
  it("returns all printed fragments scoped to the requested page and ayah", () => {
    expect(calibratedAreasForAyah(fixture, 3, 2, 8)).toHaveLength(2);
    expect(calibratedAreasForAyah(fixture, 4, 2, 8)).toEqual([{ x: 12, y: 20, width: 40, height: 30 }]);
    expect(calibratedAreasForAyah(fixture, 3, 2, 9)).toEqual([]);
    expect(calibratedAreasForAyah(fixture, 0, 2, 8)).toEqual([]);
  });

  it("maps scan pixels proportionally to the visible image at any size", () => {
    expect(pixelRectToPercent({ x: 256, y: 414, width: 512, height: 828 }, 1024, 1656)).toEqual({
      left: 25,
      top: 25,
      width: 50,
      height: 50,
    });
  });

  it("returns the printed basmala only for verse one of its surah", () => {
    expect(calibratedBasmalaAreaForAyah(fixture, 2, 2, 1)).toEqual([{ x: 370, y: 540, width: 320, height: 42 }]);
    expect(calibratedBasmalaAreaForAyah(fixture, 2, 3, 1)).toEqual([]);
    expect(calibratedBasmalaAreaForAyah(fixture, 2, 2, 2)).toEqual([]);
  });

  it("uses real page calibration for a printed surah-opening basmala, not Al-Fatihah or At-Tawbah", () => {
    const layout = calibratedLayoutJson as MushafVerseLayout;
    expect(calibratedBasmalaAreaForAyah(layout, pageForSura(2), 2, 1)).toHaveLength(1);
    expect(calibratedBasmalaAreaForAyah(layout, pageForSura(1), 1, 1)).toEqual([]);
    expect(calibratedBasmalaAreaForAyah(layout, pageForSura(9), 9, 1)).toEqual([]);
  });

  it("rejects invalid or out-of-frame calibration boxes", () => {
    expect(pixelRectToPercent({ x: 1000, y: 0, width: 30, height: 20 }, 1024, 1656)).toBeNull();
    expect(pixelRectToPercent({ x: -1, y: 0, width: 30, height: 20 }, 1024, 1656)).toBeNull();
  });
});
