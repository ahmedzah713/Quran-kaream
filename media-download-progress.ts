export type DownloadProgressSnapshot = {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
};

export function mediaDownloadPercent(progress: DownloadProgressSnapshot): number | null {
  const { totalBytesWritten, totalBytesExpectedToWrite } = progress;
  if (!Number.isFinite(totalBytesWritten) || totalBytesWritten < 0) return null;
  if (!Number.isFinite(totalBytesExpectedToWrite) || totalBytesExpectedToWrite <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100)));
}
