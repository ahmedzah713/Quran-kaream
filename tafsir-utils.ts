import { normalizeSearchText } from "./search-utils";

export type TafsirRow = { numberInSurah: number; text: string };

export const filterTafsirRows = (rows: TafsirRow[], query: string): TafsirRow[] => {
  const normalizedQuery = normalizeSearchText(query);
  return normalizedQuery ? rows.filter((row) => normalizeSearchText(row.text).includes(normalizedQuery)) : rows;
};

export const normalizeTafsirRows = (payload: unknown, verseCount: number): TafsirRow[] => {
  if (!Array.isArray(payload)) return [];
  const seen = new Set<number>();
  return payload
    .map((item) => ({ numberInSurah: Number((item as { ayah?: unknown })?.ayah), text: String((item as { text?: unknown })?.text ?? "").trim() }))
    .filter((item) => Number.isInteger(item.numberInSurah) && item.numberInSurah >= 1 && item.numberInSurah <= verseCount && item.text.length > 0)
    .filter((item) => {
      if (seen.has(item.numberInSurah)) return false;
      seen.add(item.numberInSurah);
      return true;
    })
    .sort((first, second) => first.numberInSurah - second.numberInSurah);
};
