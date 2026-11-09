export type MushafPixelRect = { x: number; y: number; width: number; height: number };
export type MushafVerseLayout = {
  schemaVersion: number;
  imageWidth: number;
  imageHeight: number;
  pages: Record<string, { areas: Record<string, MushafPixelRect[]>; basmalaAreas?: Record<string, MushafPixelRect> }>;
};
export type MushafPercentRect = { left: number; top: number; width: number; height: number };

/** Returns every printed fragment of one ayah on one photographed Mushaf page. */
export const calibratedAreasForAyah = (
  layout: MushafVerseLayout,
  pageNumber: number,
  suraId: number,
  ayahNumber: number,
): MushafPixelRect[] => {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) return [];
  return layout.pages[String(pageNumber)]?.areas[`${suraId}:${ayahNumber}`] ?? [];
};

/** Return the separately printed basmala only while its first verse is active. */
export const calibratedBasmalaAreaForAyah = (
  layout: MushafVerseLayout,
  pageNumber: number,
  suraId: number,
  ayahNumber: number,
): MushafPixelRect[] => {
  if (ayahNumber !== 1 || !Number.isInteger(pageNumber) || pageNumber < 1) return [];
  const area = layout.pages[String(pageNumber)]?.basmalaAreas?.[String(suraId)];
  return area ? [area] : [];
};

/** Converts scan-pixel coordinates into percentages of the rendered image frame. */
export const pixelRectToPercent = (
  rect: MushafPixelRect,
  imageWidth: number,
  imageHeight: number,
): MushafPercentRect | null => {
  if (
    imageWidth <= 0 || imageHeight <= 0 || rect.width <= 0 || rect.height <= 0 ||
    rect.x < 0 || rect.y < 0 || rect.x + rect.width > imageWidth || rect.y + rect.height > imageHeight
  ) return null;

  return {
    left: (rect.x / imageWidth) * 100,
    top: (rect.y / imageHeight) * 100,
    width: (rect.width / imageWidth) * 100,
    height: (rect.height / imageHeight) * 100,
  };
};
