export type SurahInfoReference = {
  title: string;
  url: string;
};

export type SurahInfoNotes = {
  classificationNote?: string;
  asbabNote: string;
  references: SurahInfoReference[];
};

const specificNotes: Record<number, SurahInfoNotes> = {
  1: {
    classificationNote:
      "المشهور أنها مكية، ونُقل قول بأنها مدنية، كما رُويت أنها نزلت مرتين. يذكر ابن كثير هذه الأقوال؛ لذلك تعرض البطاقة التصنيف الأشهر مع التنبيه إلى الخلاف.",
    asbabNote:
      "لا يعرض المصدر سببًا خاصًا متفقًا عليه لنزول السورة كاملة. لذا لا تنسب البطاقة سببًا قطعيًا لها، ويمكن مراجعة تفسير آية بعينها إذا ورد لها سبب خاص.",
    references: [
      {
        title: "تفسير ابن كثير، سورة الفاتحة",
        url: "https://quran.ksu.edu.sa/tafseer/katheer/sura1-aya1.html",
      },
    ],
  },
  2: {
    asbabNote:
      "ليس للسورة سبب نزول واحد جامع. من أسباب نزول بعض آياتها ما ورد حول الآية ١٥٨ من سورة البقرة عن الصفا والمروة. تذكر روايات أن بعض المسلمين، ومنهم أناس من الأنصار، تحرّجوا من السعي بسبب ما ارتبط بالمكان في الجاهلية؛ وتلك روايات تخص الآية ١٥٨ لا السورة كلها.",
    references: [
      {
        title: "تفسير البغوي، البقرة ١٥٨",
        url: "https://quran.ksu.edu.sa/tafseer/baghawy/sura2-aya158.html",
      },
      {
        title: "أسباب النزول للواحدي، البقرة ١٥٨",
        url: "https://www.islamweb.net/ar/library/content/63/40/",
      },
    ],
  },
};

export function getSurahInfoNotes(surahId: number): SurahInfoNotes {
  const specific = specificNotes[surahId];
  if (specific) return specific;

  return {
    asbabNote:
      "لا تعرض هذه البطاقة سببًا عامًا موثقًا لنزول السورة كاملة. قد يرد سبب النزول لآية بعينها؛ افتح الآية ثم اختر «عرض التفسير» لمعرفة ما ورد عنها.",
    references: [
      {
        title: "تفسير ابن كثير، بداية السورة",
        url: `https://quran.ksu.edu.sa/tafseer/katheer/sura${surahId}-aya1.html`,
      },
    ],
  };
}
