export type AyahReciter = { id: string; name: string; edition: string };
export type AyahTafsirEdition = { id: string; name: string };

export const AYAH_RECITERS: AyahReciter[] = [
  { id: "ar.alafasy", name: "مشاري العفاسي", edition: "ar.alafasy" },
  { id: "ar.abdurrahmaansudais", name: "عبدالرحمن السديس", edition: "ar.abdurrahmaansudais" },
  { id: "ar.mahermuaiqly", name: "ماهر المعيقلي", edition: "ar.mahermuaiqly" },
  { id: "ar.husary", name: "محمود خليل الحصري", edition: "ar.husary" },
];

export const AYAH_TAFSIRS: AyahTafsirEdition[] = [
  { id: "ar-tafsir-muyassar", name: "التفسير الميسر" },
  { id: "ar-tafsir-ibn-kathir", name: "تفسير ابن كثير" },
  { id: "ar-tafsir-as-saadi", name: "تفسير السعدي" },
];

export const getAyahTextUrl = (suraId: number, ayahNumber: number) =>
  `https://api.alquran.cloud/v1/ayah/${suraId}:${ayahNumber}/quran-uthmani`;

export const getAyahAudioUrl = (suraId: number, ayahNumber: number, edition: string) =>
  `https://api.alquran.cloud/v1/ayah/${suraId}:${ayahNumber}/${encodeURIComponent(edition)}`;

export const getAyahTafsirUrl = (editionId: string, suraId: number, ayahNumber: number) =>
  `https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir/${encodeURIComponent(editionId)}/${suraId}/${ayahNumber}.json`;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export const readAyahText = (payload: unknown): string | null => {
  if (!isRecord(payload) || !isRecord(payload.data) || typeof payload.data.text !== "string") return null;
  return payload.data.text.trim() || null;
};

export const readAyahAudioUrl = (payload: unknown): string | null => {
  if (!isRecord(payload) || !isRecord(payload.data) || typeof payload.data.audio !== "string") return null;
  const url = payload.data.audio.trim();
  return /^https:\/\//u.test(url) ? url : null;
};

export const readAyahTafsir = (payload: unknown): string | null => {
  if (!isRecord(payload) || typeof payload.text !== "string") return null;
  return payload.text.trim() || null;
};
