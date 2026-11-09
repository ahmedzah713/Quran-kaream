const stripArabicMarks = (value: string) => value
  .replace(/\uFEFF/g, "")
  .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
  .replace(/[ٱأإآ]/g, "ا")
  .replace(/ـ/g, "")
  .replace(/\s+/g, " ")
  .trim();

export function removeBasmalaPrefix(text: string): string {
  const words = text.replace(/\uFEFF/g, "").trim().split(/\s+/);
  const prefix = stripArabicMarks(words.slice(0, 4).join(" "));
  return prefix === "بسم الله الرحمن الرحيم" ? words.slice(4).join(" ").trim() : text.replace(/\uFEFF/g, "").trim();
}

export function formatArabicAyahNumber(number: number): string {
  return String(number).replace(/[0-9]/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}
