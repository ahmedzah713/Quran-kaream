import { describe, expect, it, vi } from "vitest";
import { playWebAudioSource, type WebAudioElement } from "./web-audio";

function makeAudio() {
  const attributes = new Map<string, string>();
  const audio = {
    currentTime: 0,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: vi.fn((name: string, value: string) => attributes.set(name, value)),
    removeAttribute: vi.fn((name: string) => attributes.delete(name)),
    load: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(async () => undefined),
  } as unknown as WebAudioElement;
  return { audio, attributes };
}

describe("web audio source switching", () => {
  it("reuses the same element when the next ayah changes the source", async () => {
    const { audio } = makeAudio();

    expect(await playWebAudioSource(audio, "https://audio.example/ayah-1.mp3")).toBe(true);
    expect(await playWebAudioSource(audio, "https://audio.example/ayah-2.mp3")).toBe(true);

    expect(audio.setAttribute).toHaveBeenNthCalledWith(1, "src", "https://audio.example/ayah-1.mp3");
    expect(audio.setAttribute).toHaveBeenNthCalledWith(2, "src", "https://audio.example/ayah-2.mp3");
    expect(audio.load).toHaveBeenCalledTimes(2);
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it("catches a browser autoplay rejection instead of leaking an unhandled promise", async () => {
    const { audio } = makeAudio();
    vi.mocked(audio.play).mockRejectedValueOnce(new Error("NotAllowedError"));

    await expect(playWebAudioSource(audio, "https://audio.example/ayah.mp3")).resolves.toBe(false);
  });

  it("preserves the paused position when resuming the same source", async () => {
    const { audio } = makeAudio();
    const uri = "https://audio.example/ayah.mp3";
    await playWebAudioSource(audio, uri);
    audio.currentTime = 12.5;

    expect(await playWebAudioSource(audio, uri, false)).toBe(true);
    expect(audio.currentTime).toBe(12.5);
    expect(audio.load).toHaveBeenCalledTimes(1);
  });
});
