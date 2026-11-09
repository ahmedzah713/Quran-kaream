export type ReciterLibrary = {
  availableSuras?: readonly number[];
  urls?: Readonly<Record<number, string>>;
};

export type SurahLike = { id: number };

/** Returns surahs in Quran order that actually have a recording in the selected reciter's library. */
export function getAvailableSuras<T extends SurahLike>(
  suras: readonly T[],
  reciter: ReciterLibrary,
): T[] {
  const explicitIds = reciter.availableSuras
    ? new Set(reciter.availableSuras)
    : reciter.urls
      ? new Set(Object.keys(reciter.urls).map(Number).filter(Number.isFinite))
      : null;

  return explicitIds ? suras.filter((sura) => explicitIds.has(sura.id)) : [...suras];
}

/** Returns the neighboring item in a sorted/list order, optionally wrapping at either end. */
export function getAdjacentItem<T>(
  items: readonly T[],
  currentIndex: number,
  delta: number,
  wrap = false,
): T | null {
  if (items.length === 0 || currentIndex < 0 || currentIndex >= items.length || !Number.isFinite(delta) || delta === 0) {
    return null;
  }

  const step = delta > 0 ? 1 : -1;
  const nextIndex = currentIndex + step;
  if (wrap) return items[(nextIndex + items.length) % items.length];
  return items[nextIndex] ?? null;
}

/** Navigate among a reciter's available surahs, never through missing recordings. */
export function getAdjacentAvailableSura<T extends SurahLike>(
  suras: readonly T[],
  reciter: ReciterLibrary,
  currentSuraId: number,
  delta: number,
  wrap = false,
): T | null {
  const availableSuras = getAvailableSuras(suras, reciter);
  const currentIndex = availableSuras.findIndex((sura) => sura.id === currentSuraId);
  return getAdjacentItem(availableSuras, currentIndex, delta, wrap);
}

/** Clamp a time seek to the playable range, leaving a small buffer before the end event. */
export function getSeekTarget(position: number, duration: number, deltaSeconds: number): number | null {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(deltaSeconds)) {
    return null;
  }
  const latestSeek = Math.max(0, duration - 0.25);
  return Math.min(latestSeek, Math.max(0, position + deltaSeconds));
}
