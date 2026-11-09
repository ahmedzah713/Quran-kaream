import { describe, expect, it } from "vitest";
import { mediaDownloadPercent } from "./media-download-progress";

describe("mediaDownloadPercent", () => {
  it("calculates a rounded percentage from byte counts", () => {
    expect(mediaDownloadPercent({ totalBytesWritten: 65536, totalBytesExpectedToWrite: 262144 })).toBe(25);
    expect(mediaDownloadPercent({ totalBytesWritten: 1, totalBytesExpectedToWrite: 3 })).toBe(33);
  });

  it("returns null when the server does not report a usable total", () => {
    expect(mediaDownloadPercent({ totalBytesWritten: 100, totalBytesExpectedToWrite: 0 })).toBeNull();
    expect(mediaDownloadPercent({ totalBytesWritten: 100, totalBytesExpectedToWrite: -1 })).toBeNull();
  });

  it("keeps the percentage inside the visible progress range", () => {
    expect(mediaDownloadPercent({ totalBytesWritten: 0, totalBytesExpectedToWrite: 100 })).toBe(0);
    expect(mediaDownloadPercent({ totalBytesWritten: 120, totalBytesExpectedToWrite: 100 })).toBe(100);
    expect(mediaDownloadPercent({ totalBytesWritten: -1, totalBytesExpectedToWrite: 100 })).toBeNull();
  });
});
