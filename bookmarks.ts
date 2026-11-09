import AsyncStorage from "@react-native-async-storage/async-storage";

export const BOOKMARKS_STORAGE_KEY = "quran.bookmarks";

export type BookmarkKind = "sura" | "ayah" | "tafsir" | "mp3";

export type Bookmark = {
  id: string;
  kind: BookmarkKind;
  suraId: number;
  suraName: string;
  ayah?: number;
  page?: number;
  tafsirName?: string;
  scope?: string;
  reciterCode?: string;
  reciterName?: string;
  title: string;
  subtitle: string;
  snippet?: string;
  createdAt: number;
};

function isBookmark(value: unknown): value is Bookmark {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Bookmark>;
  return typeof item.id === "string" && (item.kind === "sura" || item.kind === "ayah" || item.kind === "tafsir" || item.kind === "mp3") && typeof item.suraId === "number" && typeof item.suraName === "string" && typeof item.title === "string" && typeof item.subtitle === "string";
}

export async function loadBookmarks(): Promise<Bookmark[]> {
  try {
    const raw = await AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // العلامات القديمة العامة للسور/الآيات لا تحمل سياق البطاقة، لذلك تُستبعد
    // حتى لا تظهر محفوظة في أكثر من بطاقة. يمكن للمستخدم حفظها من جديد من السياق المطلوب.
    return parsed.filter(isBookmark).map((item) => {
      if (item.kind === "sura" && item.scope?.startsWith("tafsir:")) {
        const tafsirName = item.tafsirName ?? item.subtitle;
        return { ...item, id: bookmarkId("tafsir", item.suraId, item.ayah, tafsirName, item.scope), kind: "tafsir" as const, tafsirName, title: item.title.startsWith("تفسير") ? item.title : `تفسير ${item.suraName}` };
      }
      return item;
    }).filter((item) => !((item.kind === "sura" || item.kind === "ayah") && !item.scope)).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function saveBookmarks(items: Bookmark[]): Promise<void> {
  await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(items));
}

export async function addBookmark(bookmark: Bookmark): Promise<Bookmark[]> {
  const current = await loadBookmarks();
  const next = [bookmark, ...current.filter((item) => item.id !== bookmark.id)];
  await saveBookmarks(next);
  return next;
}

export async function removeBookmark(id: string): Promise<Bookmark[]> {
  const next = (await loadBookmarks()).filter((item) => item.id !== id);
  await saveBookmarks(next);
  return next;
}

export function bookmarkId(kind: BookmarkKind, suraId: number, ayah?: number, tafsirName?: string, scope?: string): string {
  const base = [kind, suraId, ayah ?? "", tafsirName ?? ""];
  return scope ? [...base, scope].join(":") : base.join(":");
}
