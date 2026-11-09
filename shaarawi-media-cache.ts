import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

type ShaarawiMediaKind = "audio" | "video";
export type ShaarawiDownloadProgress = {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
};

const CACHE_KEY_PREFIX = "quran.shaarawi.media.v1";

function cacheKey(kind: ShaarawiMediaKind, id: string | number) {
  return `${CACHE_KEY_PREFIX}.${kind}.${String(id)}`;
}

function fileToken(value: string | number) {
  const text = String(value);
  const safe = text.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "media";
  const hash = Array.from(text).reduce((current, char) => Math.imul(current ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return `${safe}-${hash.toString(36)}`;
}

export async function getShaarawiMediaUri(kind: ShaarawiMediaKind, id: string | number): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const storedUri = await AsyncStorage.getItem(cacheKey(kind, id)).catch(() => null);
  if (!storedUri) return null;
  try {
    const info = await FileSystem.getInfoAsync(storedUri);
    if (info.exists && (typeof info.size !== "number" || info.size > 0)) return storedUri;
  } catch {
    // Remove the stale mapping below and fall back to the external stream.
  }
  await AsyncStorage.removeItem(cacheKey(kind, id)).catch(() => undefined);
  return null;
}

export async function downloadShaarawiMedia(
  kind: ShaarawiMediaKind,
  id: string | number,
  url: string,
  onProgress?: (progress: ShaarawiDownloadProgress) => void,
): Promise<string> {
  if (Platform.OS === "web") throw new Error("offline-download-requires-mobile");
  const existingUri = await getShaarawiMediaUri(kind, id);
  if (existingUri) return existingUri;

  const root = FileSystem.documentDirectory;
  if (!root) throw new Error("device-document-directory-unavailable");
  const directory = `${root}shaarawi-media/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const extension = kind === "audio" ? "mp3" : "mp4";
  const destination = `${directory}${kind}-${fileToken(id)}.${extension}`;
  const task = FileSystem.createDownloadResumable(url, destination, {}, (progress) => onProgress?.(progress));

  try {
    const result = await task.downloadAsync();
    if (!result?.uri || result.status < 200 || result.status >= 300) throw new Error("media-download-failed");
    const info = await FileSystem.getInfoAsync(result.uri);
    if (!info.exists || (typeof info.size === "number" && info.size <= 0)) throw new Error("downloaded-media-is-empty");
    await AsyncStorage.setItem(cacheKey(kind, id), result.uri);
    return result.uri;
  } catch (error) {
    await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
    throw error;
  }
}
