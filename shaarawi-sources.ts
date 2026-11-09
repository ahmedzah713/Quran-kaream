export const SHAAWARI_AUDIO_BASE = "https://archive.org/download/Khwater.El-Sharawy.Fi.Tafsir.EL-Quran-Karim-Up-By-mUSLEm/";
export const SHAAWARI_BOOK_SERVER = "https://ia600704.us.archive.org";
export const SHAAWARI_BOOK_PATH = "/23/items/KawatirSharawi";
export const SHAAWARI_OCR_BASE = "https://archive.org/download/KawatirSharawi/";
export const SHAAWARI_BOOK_PAGE_COUNTS = [0, 647, 640, 1] as const;

export function shaarawiOcrUrl(volume: number, xml = false) {
  return `${SHAAWARI_OCR_BASE}sharawy_${String(volume).padStart(2, "0")}_djvu.${xml ? "xml" : "txt"}`;
}

export const SHAAWARI_AUDIO_FILES = [
  ["000_Intro.mp3", "مقدمة التفسير"],
  ["001_Al-Fatihah.mp3", "سورة الفاتحة"], ["002_Al-Baqarah.mp3", "سورة البقرة"], ["003_Al-Imran.mp3", "سورة آل عمران"], ["004_An-Nisa.mp3", "سورة النساء"], ["005_Al-Maidah.mp3", "سورة المائدة"], ["006_Al-Anam.mp3", "سورة الأنعام"], ["007_Al-Araf.mp3", "سورة الأعراف"], ["008_Al-Anfal.mp3", "سورة الأنفال"], ["009_At-Taubah.mp3", "سورة التوبة"],
  ["010_Yunus.mp3", "سورة يونس"], ["011_Hud.mp3", "سورة هود"], ["012_Yusuf.mp3", "سورة يوسف"], ["013_Ar-Rad.mp3", "سورة الرعد"], ["014_Ibrahim.mp3", "سورة إبراهيم"], ["015_Al-Hijr.mp3", "سورة الحجر"], ["016_An-Nahl.mp3", "سورة النحل"], ["017_Al-Isra.mp3", "سورة الإسراء"], ["018_Al-Kahf.mp3", "سورة الكهف"], ["019_Maryam.mp3", "سورة مريم"],
  ["020_Ta-Ha.mp3", "سورة طه"], ["021_Al-Anbiya.mp3", "سورة الأنبياء"], ["022_Al-Haj.mp3", "سورة الحج"], ["023_Al-Muminen.mp3", "سورة المؤمنون"], ["024_An-Nur.mp3", "سورة النور"], ["025_Al-Furqan.mp3", "سورة الفرقان"], ["026_Ash-Shuara.mp3", "سورة الشعراء"], ["027_An-Naml.mp3", "سورة النمل"], ["028_Al-Qasas.mp3", "سورة القصص"], ["029_Al-Ankabot.mp3", "سورة العنكبوت"],
  ["030_Ar-Rum.mp3", "سورة الروم"], ["031_Luqman.mp3", "سورة لقمان"], ["032_As-Sajdah.mp3", "سورة السجدة"], ["033_Al-Ahzab.mp3", "سورة الأحزاب"], ["034_Saba.mp3", "سورة سبأ"], ["035_Fatir.mp3", "سورة فاطر"], ["036_Ya-Sen.mp3", "سورة يس"], ["037_As-Saffat.mp3", "سورة الصافات"], ["038_Sad.mp3", "سورة ص"], ["039_Az-Zumar.mp3", "سورة الزمر"],
  ["040_Ghafir.mp3", "سورة غافر"], ["041_Fussilat.mp3", "سورة فصلت"], ["042_Ash-Shura.mp3", "سورة الشورى"], ["043_Az-Zukhruf.mp3", "سورة الزخرف"], ["044_Ad-Dukhan.mp3", "سورة الدخان"], ["045_Al-Jathiya.mp3", "سورة الجاثية"], ["046_Al-Ahqaf.mp3", "سورة الأحقاف"], ["047_Muhammad.mp3", "سورة محمد"], ["048_Al-Fath.mp3", "سورة الفتح"], ["049_Al-Hujurat.mp3", "سورة الحجرات"], ["050_Qaf.mp3", "سورة ق"],
  ["051_a_060.mp3", "من سورة الذاريات إلى سورة الصف"], ["061_a_114.mp3", "من سورة الجمعة إلى سورة الناس"],
] as const;

export const SHAAWARI_AUDIO_TRACKS = SHAAWARI_AUDIO_FILES.map(([file, title]) => ({ file, title, url: `${SHAAWARI_AUDIO_BASE}${file}` }));

export function shaarawiBookPageUrl(volume: number, page: number, scale = 3) {
  const volumeCode = String(volume).padStart(2, "0");
  const file = `sharawy_${volumeCode}_${String(page).padStart(4, "0")}.jp2`;
  return `${SHAAWARI_BOOK_SERVER}/BookReader/BookReaderImages.php?zip=${SHAAWARI_BOOK_PATH}/sharawy_${volumeCode}_jp2.zip&file=sharawy_${volumeCode}_jp2%2F${file}&id=KawatirSharawi&scale=${scale}&rotate=0`;
}
