import { describe, expect, it } from "vitest";
import { getAdjacentAvailableSura, getAdjacentItem, getAvailableSuras, getSeekTarget } from "./mp3-playback";

const suras = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, name: `سورة ${index + 1}` }));

describe("MP3 playback navigation", () => {
  it("limits direct navigation to the reciter's published surahs", () => {
    const available = getAvailableSuras(suras, { availableSuras: [1, 4, 6] });
    expect(available.map((sura) => sura.id)).toEqual([1, 4, 6]);
    expect(getAdjacentItem(available, 0, 1)?.id).toBe(4);
    expect(getAdjacentItem(available, 1, -1)?.id).toBe(1);
    expect(getAdjacentItem(available, 1, 1)?.id).toBe(6);
    expect(getAdjacentItem(available, 2, 1)).toBeNull();
  });

  it("moves previous and next through only the selected reciter's available surahs in Quran order", () => {
    const reciter = { availableSuras: [1, 4, 6] };
    expect(getAdjacentAvailableSura(suras, reciter, 1, 1)?.id).toBe(4);
    expect(getAdjacentAvailableSura(suras, reciter, 6, -1)?.id).toBe(4);
    expect(getAdjacentAvailableSura(suras, reciter, 4, 1)?.id).toBe(6);
    expect(getAdjacentAvailableSura(suras, reciter, 6, 1, true)?.id).toBe(1);
    expect(getAdjacentAvailableSura(suras, reciter, 3, 1)).toBeNull();
  });

  it("uses explicit recording URL keys when no availability list is supplied", () => {
    const available = getAvailableSuras(suras, { urls: { 2: "two.mp3", 5: "five.mp3" } });
    expect(available.map((sura) => sura.id)).toEqual([2, 5]);
  });

  it("keeps the full Quran for reciters with a complete catalog and wraps manual navigation", () => {
    const available = getAvailableSuras(suras, {});
    expect(available).toHaveLength(6);
    expect(getAdjacentItem(available, 5, 1, true)?.id).toBe(1);
    expect(getAdjacentItem(available, 0, -1, true)?.id).toBe(6);
  });

  it("moves through a playlist in insertion order across murattal and mujawwad reciters", () => {
    const queue = [
      { suraId: 1, reciterCode: "afs" },
      { suraId: 4, reciterCode: "husary-mujawwad" },
      { suraId: 6, reciterCode: "alsaid-saeed-mujawwad" },
    ];
    expect(getAdjacentItem(queue, 0, 1)).toEqual(queue[1]);
    expect(getAdjacentItem(queue, 1, 1)).toEqual(queue[2]);
    expect(getAdjacentItem(queue, 2, -1)).toEqual(queue[1]);
    expect(getAdjacentItem(queue, 0, -1)).toBeNull();
  });

  it("seeks forward and backward by a bounded interval", () => {
    expect(getSeekTarget(30, 120, 10)).toBe(40);
    expect(getSeekTarget(30, 120, -10)).toBe(20);
    expect(getSeekTarget(5, 120, -10)).toBe(0);
    expect(getSeekTarget(115, 120, 10)).toBe(119.75);
    expect(getSeekTarget(0, 0, 10)).toBeNull();
  });
});
