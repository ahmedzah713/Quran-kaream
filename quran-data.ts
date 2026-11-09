export type Sura = { id: number; name: string; latin: string; verses: number; type: "مكية" | "مدنية" };

export const SURAS: Sura[] = [
  {
    "id": 1,
    "name": "ٱلْفاتحة",
    "latin": "Al-Faatiha",
    "verses": 7,
    "type": "مكية"
  },
  {
    "id": 2,
    "name": "البقرة",
    "latin": "Al-Baqara",
    "verses": 286,
    "type": "مدنية"
  },
  {
    "id": 3,
    "name": "ال عمران",
    "latin": "Aal-i-Imraan",
    "verses": 200,
    "type": "مدنية"
  },
  {
    "id": 4,
    "name": "النساء",
    "latin": "An-Nisaa",
    "verses": 176,
    "type": "مدنية"
  },
  {
    "id": 5,
    "name": "المائـدة",
    "latin": "Al-Maaida",
    "verses": 120,
    "type": "مدنية"
  },
  {
    "id": 6,
    "name": "الأنعام",
    "latin": "Al-An'aam",
    "verses": 165,
    "type": "مكية"
  },
  {
    "id": 7,
    "name": "الأعراف",
    "latin": "Al-A'raaf",
    "verses": 206,
    "type": "مكية"
  },
  {
    "id": 8,
    "name": "الأنفال",
    "latin": "Al-Anfaal",
    "verses": 75,
    "type": "مدنية"
  },
  {
    "id": 9,
    "name": "التوبة",
    "latin": "At-Tawba",
    "verses": 129,
    "type": "مدنية"
  },
  {
    "id": 10,
    "name": "يونس",
    "latin": "Yunus",
    "verses": 109,
    "type": "مكية"
  },
  {
    "id": 11,
    "name": "هودٍ",
    "latin": "Hud",
    "verses": 123,
    "type": "مكية"
  },
  {
    "id": 12,
    "name": "يوسف",
    "latin": "Yusuf",
    "verses": 111,
    "type": "مكية"
  },
  {
    "id": 13,
    "name": "الرعد",
    "latin": "Ar-Ra'd",
    "verses": 43,
    "type": "مدنية"
  },
  {
    "id": 14,
    "name": "إبراهيم",
    "latin": "Ibrahim",
    "verses": 52,
    "type": "مكية"
  },
  {
    "id": 15,
    "name": "الحجر",
    "latin": "Al-Hijr",
    "verses": 99,
    "type": "مكية"
  },
  {
    "id": 16,
    "name": "النحل",
    "latin": "An-Nahl",
    "verses": 128,
    "type": "مكية"
  },
  {
    "id": 17,
    "name": "الإسراء",
    "latin": "Al-Israa",
    "verses": 111,
    "type": "مكية"
  },
  {
    "id": 18,
    "name": "الكهف",
    "latin": "Al-Kahf",
    "verses": 110,
    "type": "مكية"
  },
  {
    "id": 19,
    "name": "مريم",
    "latin": "Maryam",
    "verses": 98,
    "type": "مكية"
  },
  {
    "id": 20,
    "name": "طه",
    "latin": "Taa-Haa",
    "verses": 135,
    "type": "مكية"
  },
  {
    "id": 21,
    "name": "الأنبياء",
    "latin": "Al-Anbiyaa",
    "verses": 112,
    "type": "مكية"
  },
  {
    "id": 22,
    "name": "الحج",
    "latin": "Al-Hajj",
    "verses": 78,
    "type": "مدنية"
  },
  {
    "id": 23,
    "name": "المؤمنون",
    "latin": "Al-Muminoon",
    "verses": 118,
    "type": "مكية"
  },
  {
    "id": 24,
    "name": "النور",
    "latin": "An-Noor",
    "verses": 64,
    "type": "مدنية"
  },
  {
    "id": 25,
    "name": "الفرقان",
    "latin": "Al-Furqaan",
    "verses": 77,
    "type": "مكية"
  },
  {
    "id": 26,
    "name": "الشعراء",
    "latin": "Ash-Shu'araa",
    "verses": 227,
    "type": "مكية"
  },
  {
    "id": 27,
    "name": "النمل",
    "latin": "An-Naml",
    "verses": 93,
    "type": "مكية"
  },
  {
    "id": 28,
    "name": "القصص",
    "latin": "Al-Qasas",
    "verses": 88,
    "type": "مكية"
  },
  {
    "id": 29,
    "name": "العنكبوت",
    "latin": "Al-Ankaboot",
    "verses": 69,
    "type": "مكية"
  },
  {
    "id": 30,
    "name": "الروم",
    "latin": "Ar-Room",
    "verses": 60,
    "type": "مكية"
  },
  {
    "id": 31,
    "name": "لقمان",
    "latin": "Luqman",
    "verses": 34,
    "type": "مكية"
  },
  {
    "id": 32,
    "name": "السجدة",
    "latin": "As-Sajda",
    "verses": 30,
    "type": "مكية"
  },
  {
    "id": 33,
    "name": "الأحزاب",
    "latin": "Al-Ahzaab",
    "verses": 73,
    "type": "مدنية"
  },
  {
    "id": 34,
    "name": "سبإٍ",
    "latin": "Saba",
    "verses": 54,
    "type": "مكية"
  },
  {
    "id": 35,
    "name": "فاطرٍ",
    "latin": "Faatir",
    "verses": 45,
    "type": "مكية"
  },
  {
    "id": 36,
    "name": "يس",
    "latin": "Yaseen",
    "verses": 83,
    "type": "مكية"
  },
  {
    "id": 37,
    "name": "الصافات",
    "latin": "As-Saaffaat",
    "verses": 182,
    "type": "مكية"
  },
  {
    "id": 38,
    "name": "ص",
    "latin": "Saad",
    "verses": 88,
    "type": "مكية"
  },
  {
    "id": 39,
    "name": "الزمر",
    "latin": "Az-Zumar",
    "verses": 75,
    "type": "مكية"
  },
  {
    "id": 40,
    "name": "غافرٍ",
    "latin": "Ghafir",
    "verses": 85,
    "type": "مكية"
  },
  {
    "id": 41,
    "name": "فصلت",
    "latin": "Fussilat",
    "verses": 54,
    "type": "مكية"
  },
  {
    "id": 42,
    "name": "الشورى",
    "latin": "Ash-Shura",
    "verses": 53,
    "type": "مكية"
  },
  {
    "id": 43,
    "name": "الزخرف",
    "latin": "Az-Zukhruf",
    "verses": 89,
    "type": "مكية"
  },
  {
    "id": 44,
    "name": "الدخان",
    "latin": "Ad-Dukhaan",
    "verses": 59,
    "type": "مكية"
  },
  {
    "id": 45,
    "name": "الجاثية",
    "latin": "Al-Jaathiya",
    "verses": 37,
    "type": "مكية"
  },
  {
    "id": 46,
    "name": "الأحقاف",
    "latin": "Al-Ahqaf",
    "verses": 35,
    "type": "مكية"
  },
  {
    "id": 47,
    "name": "محمدٍ",
    "latin": "Muhammad",
    "verses": 38,
    "type": "مدنية"
  },
  {
    "id": 48,
    "name": "الفتح",
    "latin": "Al-Fath",
    "verses": 29,
    "type": "مدنية"
  },
  {
    "id": 49,
    "name": "الحجرات",
    "latin": "Al-Hujuraat",
    "verses": 18,
    "type": "مدنية"
  },
  {
    "id": 50,
    "name": "ق",
    "latin": "Qaaf",
    "verses": 45,
    "type": "مكية"
  },
  {
    "id": 51,
    "name": "الذاريات",
    "latin": "Adh-Dhaariyat",
    "verses": 60,
    "type": "مكية"
  },
  {
    "id": 52,
    "name": "الطور",
    "latin": "At-Tur",
    "verses": 49,
    "type": "مكية"
  },
  {
    "id": 53,
    "name": "النجم",
    "latin": "An-Najm",
    "verses": 62,
    "type": "مكية"
  },
  {
    "id": 54,
    "name": "القمر",
    "latin": "Al-Qamar",
    "verses": 55,
    "type": "مكية"
  },
  {
    "id": 55,
    "name": "الرحمن",
    "latin": "Ar-Rahmaan",
    "verses": 78,
    "type": "مدنية"
  },
  {
    "id": 56,
    "name": "الواقعة",
    "latin": "Al-Waaqia",
    "verses": 96,
    "type": "مكية"
  },
  {
    "id": 57,
    "name": "الحديد",
    "latin": "Al-Hadid",
    "verses": 29,
    "type": "مدنية"
  },
  {
    "id": 58,
    "name": "المجادلة",
    "latin": "Al-Mujaadila",
    "verses": 22,
    "type": "مدنية"
  },
  {
    "id": 59,
    "name": "الحشر",
    "latin": "Al-Hashr",
    "verses": 24,
    "type": "مدنية"
  },
  {
    "id": 60,
    "name": "الممتحنة",
    "latin": "Al-Mumtahana",
    "verses": 13,
    "type": "مدنية"
  },
  {
    "id": 61,
    "name": "الصف",
    "latin": "As-Saff",
    "verses": 14,
    "type": "مدنية"
  },
  {
    "id": 62,
    "name": "الجمعة",
    "latin": "Al-Jumu'a",
    "verses": 11,
    "type": "مدنية"
  },
  {
    "id": 63,
    "name": "المنافقون",
    "latin": "Al-Munaafiqoon",
    "verses": 11,
    "type": "مدنية"
  },
  {
    "id": 64,
    "name": "التغابن",
    "latin": "At-Taghaabun",
    "verses": 18,
    "type": "مدنية"
  },
  {
    "id": 65,
    "name": "الطلاق",
    "latin": "At-Talaaq",
    "verses": 12,
    "type": "مدنية"
  },
  {
    "id": 66,
    "name": "التحريم",
    "latin": "At-Tahrim",
    "verses": 12,
    "type": "مدنية"
  },
  {
    "id": 67,
    "name": "الملك",
    "latin": "Al-Mulk",
    "verses": 30,
    "type": "مكية"
  },
  {
    "id": 68,
    "name": "القلم",
    "latin": "Al-Qalam",
    "verses": 52,
    "type": "مكية"
  },
  {
    "id": 69,
    "name": "الحاقة",
    "latin": "Al-Haaqqa",
    "verses": 52,
    "type": "مكية"
  },
  {
    "id": 70,
    "name": "المعارج",
    "latin": "Al-Ma'aarij",
    "verses": 44,
    "type": "مكية"
  },
  {
    "id": 71,
    "name": "نوحٍ",
    "latin": "Nooh",
    "verses": 28,
    "type": "مكية"
  },
  {
    "id": 72,
    "name": "الجن",
    "latin": "Al-Jinn",
    "verses": 28,
    "type": "مكية"
  },
  {
    "id": 73,
    "name": "المزمل",
    "latin": "Al-Muzzammil",
    "verses": 20,
    "type": "مكية"
  },
  {
    "id": 74,
    "name": "المدثر",
    "latin": "Al-Muddaththir",
    "verses": 56,
    "type": "مكية"
  },
  {
    "id": 75,
    "name": "القيامة",
    "latin": "Al-Qiyaama",
    "verses": 40,
    "type": "مكية"
  },
  {
    "id": 76,
    "name": "الإنسان",
    "latin": "Al-Insaan",
    "verses": 31,
    "type": "مدنية"
  },
  {
    "id": 77,
    "name": "المرسلات",
    "latin": "Al-Mursalaat",
    "verses": 50,
    "type": "مكية"
  },
  {
    "id": 78,
    "name": "النبإ",
    "latin": "An-Naba",
    "verses": 40,
    "type": "مكية"
  },
  {
    "id": 79,
    "name": "النازعات",
    "latin": "An-Naazi'aat",
    "verses": 46,
    "type": "مكية"
  },
  {
    "id": 80,
    "name": "عبس",
    "latin": "Abasa",
    "verses": 42,
    "type": "مكية"
  },
  {
    "id": 81,
    "name": "التكوير",
    "latin": "At-Takwir",
    "verses": 29,
    "type": "مكية"
  },
  {
    "id": 82,
    "name": "الانفطار",
    "latin": "Al-Infitaar",
    "verses": 19,
    "type": "مكية"
  },
  {
    "id": 83,
    "name": "المطففين",
    "latin": "Al-Mutaffifin",
    "verses": 36,
    "type": "مكية"
  },
  {
    "id": 84,
    "name": "الانشقاق",
    "latin": "Al-Inshiqaaq",
    "verses": 25,
    "type": "مكية"
  },
  {
    "id": 85,
    "name": "البروج",
    "latin": "Al-Burooj",
    "verses": 22,
    "type": "مكية"
  },
  {
    "id": 86,
    "name": "الطارق",
    "latin": "At-Taariq",
    "verses": 17,
    "type": "مكية"
  },
  {
    "id": 87,
    "name": "الأعلى",
    "latin": "Al-A'laa",
    "verses": 19,
    "type": "مكية"
  },
  {
    "id": 88,
    "name": "الغاشية",
    "latin": "Al-Ghaashiya",
    "verses": 26,
    "type": "مكية"
  },
  {
    "id": 89,
    "name": "الفجر",
    "latin": "Al-Fajr",
    "verses": 30,
    "type": "مكية"
  },
  {
    "id": 90,
    "name": "البلد",
    "latin": "Al-Balad",
    "verses": 20,
    "type": "مكية"
  },
  {
    "id": 91,
    "name": "الشمس",
    "latin": "Ash-Shams",
    "verses": 15,
    "type": "مكية"
  },
  {
    "id": 92,
    "name": "الليل",
    "latin": "Al-Lail",
    "verses": 21,
    "type": "مكية"
  },
  {
    "id": 93,
    "name": "الضحى",
    "latin": "Ad-Dhuhaa",
    "verses": 11,
    "type": "مكية"
  },
  {
    "id": 94,
    "name": "الشرح",
    "latin": "Ash-Sharh",
    "verses": 8,
    "type": "مكية"
  },
  {
    "id": 95,
    "name": "التين",
    "latin": "At-Tin",
    "verses": 8,
    "type": "مكية"
  },
  {
    "id": 96,
    "name": "العلق",
    "latin": "Al-Alaq",
    "verses": 19,
    "type": "مكية"
  },
  {
    "id": 97,
    "name": "القدر",
    "latin": "Al-Qadr",
    "verses": 5,
    "type": "مكية"
  },
  {
    "id": 98,
    "name": "البينة",
    "latin": "Al-Bayyina",
    "verses": 8,
    "type": "مدنية"
  },
  {
    "id": 99,
    "name": "الزلزلة",
    "latin": "Az-Zalzala",
    "verses": 8,
    "type": "مدنية"
  },
  {
    "id": 100,
    "name": "العاديات",
    "latin": "Al-Aadiyaat",
    "verses": 11,
    "type": "مكية"
  },
  {
    "id": 101,
    "name": "القارعة",
    "latin": "Al-Qaari'a",
    "verses": 11,
    "type": "مكية"
  },
  {
    "id": 102,
    "name": "التكاثر",
    "latin": "At-Takaathur",
    "verses": 8,
    "type": "مكية"
  },
  {
    "id": 103,
    "name": "العصر",
    "latin": "Al-Asr",
    "verses": 3,
    "type": "مكية"
  },
  {
    "id": 104,
    "name": "الهمزة",
    "latin": "Al-Humaza",
    "verses": 9,
    "type": "مكية"
  },
  {
    "id": 105,
    "name": "الفيل",
    "latin": "Al-Fil",
    "verses": 5,
    "type": "مكية"
  },
  {
    "id": 106,
    "name": "قريشٍ",
    "latin": "Quraish",
    "verses": 4,
    "type": "مكية"
  },
  {
    "id": 107,
    "name": "الماعون",
    "latin": "Al-Maa'un",
    "verses": 7,
    "type": "مكية"
  },
  {
    "id": 108,
    "name": "الكوثر",
    "latin": "Al-Kawthar",
    "verses": 3,
    "type": "مكية"
  },
  {
    "id": 109,
    "name": "الكافرون",
    "latin": "Al-Kaafiroon",
    "verses": 6,
    "type": "مكية"
  },
  {
    "id": 110,
    "name": "النصر",
    "latin": "An-Nasr",
    "verses": 3,
    "type": "مدنية"
  },
  {
    "id": 111,
    "name": "المسد",
    "latin": "Al-Masad",
    "verses": 5,
    "type": "مكية"
  },
  {
    "id": 112,
    "name": "الإخلاص",
    "latin": "Al-Ikhlaas",
    "verses": 4,
    "type": "مكية"
  },
  {
    "id": 113,
    "name": "الفلق",
    "latin": "Al-Falaq",
    "verses": 5,
    "type": "مكية"
  },
  {
    "id": 114,
    "name": "الناس",
    "latin": "An-Naas",
    "verses": 6,
    "type": "مكية"
  }
];

function normalizeSearchDigits(value: string): string {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";

  return Array.from(value, (digit) => {
    const arabicIndex = arabicDigits.indexOf(digit);
    if (arabicIndex >= 0) return String(arabicIndex);

    const persianIndex = persianDigits.indexOf(digit);
    if (persianIndex >= 0) return String(persianIndex);

    return digit;
  }).join("");
}

export function filterSuras(query: string): Sura[] {
  const normalized = normalizeSearchDigits(query.trim().toLocaleLowerCase());
  if (!normalized) return SURAS;

  const isNumberQuery = /^\d+$/.test(normalized);
  return SURAS.filter((sura) => {
    if (isNumberQuery) return String(sura.id) === normalized;
    return (sura.name + " " + sura.latin).toLocaleLowerCase().includes(normalized);
  });
}
