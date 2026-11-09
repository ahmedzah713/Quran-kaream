import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadShaarawiMedia, getShaarawiMediaUri } from "./shaarawi-media-cache";

const mockState = vi.hoisted(() => ({
  platform: "ios",
  responseStatus: 200,
  rejectDownload: false,
  storage: new Map<string, string>(),
  files: new Map<string, { size: number }>(),
  lastDestination: "",
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return mockState.platform;
    },
  },
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => mockState.storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { mockState.storage.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { mockState.storage.delete(key); }),
  },
}));

vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///app/Documents/",
  getInfoAsync: vi.fn(async (uri: string) => {
    const file = mockState.files.get(uri);
    return { exists: Boolean(file), size: file?.size ?? 0 };
  }),
  makeDirectoryAsync: vi.fn(async () => undefined),
  createDownloadResumable: vi.fn((
    _url: string,
    destination: string,
    _options: unknown,
    onProgress?: (progress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void,
  ) => ({
    downloadAsync: async () => {
      mockState.lastDestination = destination;
      onProgress?.({ totalBytesWritten: 50, totalBytesExpectedToWrite: 100 });
      mockState.files.set(destination, { size: 25 });
      if (mockState.rejectDownload) throw new Error("network-connection-failed");
      if (mockState.responseStatus >= 200 && mockState.responseStatus < 300) mockState.files.set(destination, { size: 100 });
      return { uri: destination, status: mockState.responseStatus };
    },
  })),
  deleteAsync: vi.fn(async (uri: string) => { mockState.files.delete(uri); }),
}));

describe("Shaarawi media cache", () => {
  beforeEach(() => {
    mockState.platform = "ios";
    mockState.responseStatus = 200;
    mockState.rejectDownload = false;
    mockState.storage.clear();
    mockState.files.clear();
    mockState.lastDestination = "";
  });

  it("downloads a chosen track, reports progress, and reuses its verified local copy", async () => {
    const progress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }[] = [];
    const uri = await downloadShaarawiMedia("audio", "surah 7", "https://media.example/audio.mp3", (value) => progress.push(value));

    expect(uri).toContain("/shaarawi-media/audio-surah-7-");
    expect(progress).toEqual([{ totalBytesWritten: 50, totalBytesExpectedToWrite: 100 }]);
    expect(await getShaarawiMediaUri("audio", "surah 7")).toBe(uri);
  });

  it("clears a stale cache mapping and falls back to the external source", async () => {
    mockState.storage.set("quran.shaarawi.media.v1.video.episode-1", "file:///missing.mp4");

    await expect(getShaarawiMediaUri("video", "episode-1")).resolves.toBeNull();
    expect(mockState.storage.has("quran.shaarawi.media.v1.video.episode-1")).toBe(false);
  });

  it("removes an incomplete file when the source returns an HTTP error", async () => {
    mockState.responseStatus = 503;

    await expect(downloadShaarawiMedia("video", "episode-2", "https://media.example/episode.mp4")).rejects.toThrow("media-download-failed");
    expect(mockState.lastDestination).not.toBe("");
    expect(mockState.files.has(mockState.lastDestination)).toBe(false);
  });

  it("removes an incomplete file when the network request rejects", async () => {
    mockState.rejectDownload = true;

    await expect(downloadShaarawiMedia("audio", "surah-3", "https://media.example/audio.mp3")).rejects.toThrow("network-connection-failed");
    expect(mockState.lastDestination).not.toBe("");
    expect(mockState.files.has(mockState.lastDestination)).toBe(false);
  });

  it("keeps web streaming external and rejects device-only downloads there", async () => {
    mockState.platform = "web";

    await expect(getShaarawiMediaUri("audio", "surah-1")).resolves.toBeNull();
    await expect(downloadShaarawiMedia("audio", "surah-1", "https://media.example/audio.mp3")).rejects.toThrow("offline-download-requires-mobile");
  });
});
