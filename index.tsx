import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { BookmarkButton } from "@/components/bookmark-button";
import { bookmarkId } from "@/lib/bookmarks";
import { filterSuras, SURAS } from "@/lib/quran-data";
import { useLanguage } from "@/lib/language-provider";

const MENU_ROUTES: Record<string, string> = { "الروايات": "riwayat", "القرآن MP3": "mp3", "الباحث القرآني": "search", "التفاسير": "tafsir", "الترجمات": "translations", "الشيخ محمد متولي الشعراوي": "shaarawi", "الاتصال بنا": "contact" };
const MENU_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = { "القرآن الكريم": "menu-book", "الروايات": "library-books", "القرآن MP3": "headphones", "الباحث القرآني": "search", "التفاسير": "notes", "الترجمات": "translate", "الشيخ محمد متولي الشعراوي": "auto-stories", "الاتصال بنا": "mail-outline", "الإعدادات": "settings" };

const AYAH_PREVIEW = [
  "يس ۝ وَالْقُرْآنِ الْحَكِيمِ ۝ إِنَّكَ لَمِنَ الْمُرْسَلِينَ",
  "عَلَىٰ صِرَاطٍ مُّسْتَقِيمٍ ۝ تَنزِيلَ الْعَزِيزِ الرَّحِيمِ",
  "لِتُنذِرَ قَوْمًا مَّا أُنذِرَ آبَاؤُهُمْ فَهُمْ غَافِلُونَ",
];

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [dark, setDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [hasLastRead, setHasLastRead] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSura, setSelectedSura] = useState(SURAS[4]);
  const [playing, setPlaying] = useState(false);
  const [fontSize, setFontSize] = useState(28);
  const [ayahs, setAyahs] = useState<string[]>([]);
  const [loadingAyahs, setLoadingAyahs] = useState(false);
  const colors = dark ? palette.dark : palette.light;

  useEffect(() => {
    AsyncStorage.multiGet(["quran.dark", "quran.fontSize", "quran.lastSura"]).then(([darkValue, fontValue, suraValue]) => {
      if (darkValue[1]) setDark(darkValue[1] === "true");
      if (fontValue[1]) setFontSize(Number(fontValue[1]));
      if (suraValue[1]) {
        const saved = SURAS.find((sura) => sura.id === Number(suraValue[1]));
        if (saved) { setSelectedSura(saved); setHasLastRead(true); }
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.multiSet([["quran.dark", String(dark)], ["quran.fontSize", String(fontSize)], ["quran.lastSura", String(selectedSura.id)]]).catch(() => undefined);
  }, [dark, fontSize, selectedSura.id, hydrated]);

  useEffect(() => {
    let active = true;
    setLoadingAyahs(true);
    fetch(`https://api.alquran.cloud/v1/surah/${selectedSura.id}/quran-uthmani`)
      .then((response) => response.json())
      .then((payload) => {
        if (active && Array.isArray(payload?.data?.ayahs)) setAyahs(payload.data.ayahs.map((ayah: { text: string; numberInSurah: number }) => `${ayah.text} ۝${ayah.numberInSurah}`));
      })
      .catch(() => { if (active) setAyahs([]); })
      .finally(() => { if (active) setLoadingAyahs(false); });
    return () => { active = false; };
  }, [selectedSura.id]);
  const filtered = useMemo(() => filterSuras(search), [search]);

  return <QuickMenuHome dark={dark} onToggleDark={() => setDark((value) => !value)} />;

  return (
    <ScreenContainer edges={["bottom", "left", "right"]} containerClassName={dark ? "bg-[#080A1F]" : "bg-[#F7F7FB]"} safeAreaClassName="bg-transparent">
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.header, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => setDrawer(true)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} accessibilityLabel="فتح القائمة">
            <MaterialIcons name="menu" size={29} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => setDark((value) => !value)} style={({ pressed }) => [styles.moonButton, pressed && styles.pressed]} accessibilityLabel="تبديل الوضع الليلي">
            <MaterialIcons name={dark ? "wb-sunny" : "dark-mode"} size={22} color="#F0B64A" />
          </Pressable>
          <View style={styles.brand}>
            <View style={styles.brandMark}><MaterialIcons name="menu-book" size={25} color="#F0A23A" /></View>
            <Text style={[styles.brandText, { color: colors.text }]}>{t("القرآن الكريم", "Quran")}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroGlow} />
            <Text style={styles.heroEyebrow}>وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا</Text>
            <Text style={styles.heroTitle}>كتاب الله بين يديك</Text>
            <Text style={styles.heroSub}>قراءة هادئة، تدبر أعمق</Text>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("متابعة القراءة", "Continue reading")}</Text>
            <Pressable onPress={() => router.push({ pathname: "/reader", params: { suraId: String(selectedSura.id) } })} style={({ pressed }) => [pressed && styles.pressed]}><Text style={styles.link}>{t("فتح المصحف", "Open Mushaf")}</Text></Pressable>
          </View>
          <Pressable onPress={() => router.push({ pathname: "/reader", params: { suraId: String(selectedSura.id) } })} style={({ pressed }) => [styles.continueCard, { backgroundColor: colors.card }, pressed && styles.cardPressed]}>
            <View style={styles.continueIcon}><MaterialIcons name="auto-stories" size={23} color="#F0B64A" /></View>
            <View style={styles.continueCopy}>
              <Text style={[styles.continueLabel, { color: colors.muted }]}>{t("آخر قراءة", "Last read")}</Text>
              <Text style={[styles.continueName, { color: colors.text }]}>{hasLastRead ? `سورة ${selectedSura.name}` : "ابدأ القراءة"}</Text>
              <Text style={[styles.continueMeta, { color: colors.muted }]}>{hasLastRead ? `${selectedSura.type} · ${selectedSura.verses} آيات · محفوظة محليًا` : "اختر سورة من القائمة"}</Text>
            </View>
            <MaterialIcons name="arrow-back-ios" size={18} color="#F0B64A" />
          </Pressable>

          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialIcons name="search" size={22} color={colors.muted} />
            <TextInput value={search} onChangeText={setSearch} placeholder={t("ابحث عن سورة", "Search for a surah")} placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text }]} textAlign="right" returnKeyType="done" />
            {search.length > 0 && <Pressable onPress={() => setSearch("")}><MaterialIcons name="close" size={19} color={colors.muted} /></Pressable>}
          </View>

          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("السور", "Surahs")}</Text>
            <Text style={[styles.count, { color: colors.muted }]}>{filtered.length} {t("سور معروضة", "surahs shown")}</Text>
          </View>
          <FlatList
            data={filtered}
            scrollEnabled={false}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Pressable onPress={() => { setSelectedSura(item); setHasLastRead(true); AsyncStorage.setItem("quran.lastSura", String(item.id)).catch(() => undefined); router.push({ pathname: "/reader", params: { suraId: String(item.id) } }); }} style={({ pressed }) => [styles.suraRow, { backgroundColor: colors.card }, pressed && styles.cardPressed]}>
                <View style={styles.suraNumber}><Text style={styles.numberText}>{item.id}</Text></View>
                <View style={styles.suraCopy}><Text style={[styles.suraName, { color: colors.text }]}>{item.name}</Text><Text style={[styles.suraMeta, { color: colors.muted }]}>{item.type} · {item.verses} آيات</Text></View>
                <Text style={[styles.latin, { color: colors.muted }]}>{item.latin}</Text>
                <MaterialIcons name="chevron-left" size={20} color={colors.muted} />
                <BookmarkButton bookmark={{ id: bookmarkId("sura", item.id, undefined, undefined, "index"), kind: "sura", suraId: item.id, suraName: item.name, scope: "index", title: `سورة ${item.name}`, subtitle: "العودة إلى بداية السورة في المصحف", createdAt: Date.now() }} />
              </Pressable>
            )}
            ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>{t("لا توجد سورة بهذا الاسم", "No surah with this name")}</Text>}
          />

          <View style={[styles.readingCard, { backgroundColor: dark ? "#121630" : "#11152F" }]}>
            <View style={styles.readingTop}><Text style={styles.readingKicker}>القراءة الآن</Text><Text style={styles.readingName}>سورة {selectedSura.name}</Text></View>
            <Text style={styles.basmala}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
            <Text style={[styles.ayah, { fontSize }]}>{loadingAyahs ? "جارٍ تحميل الآيات…" : ayahs.length > 0 ? ayahs.slice(0, 8).join("\n\n") : AYAH_PREVIEW.join("\n")}</Text>
            <View style={styles.readingActions}>
              <Pressable onPress={() => setPlaying((value) => !value)} style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}><MaterialIcons name={playing ? "pause" : "play-arrow"} size={20} color="#11152F" /><Text style={styles.playText}>{playing ? "إيقاف" : "استماع"}</Text></Pressable>
              <Pressable onPress={() => setFontSize((value) => (value >= 34 ? 24 : value + 2))} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}><Text style={styles.textButtonLabel}>حجم النص</Text><Text style={styles.textButtonValue}>أكبر</Text></Pressable>
            </View>
          </View>
        </ScrollView>

        {drawer && <View style={styles.overlay}><Pressable style={styles.scrim} onPress={() => setDrawer(false)} /><View style={[styles.drawer, { backgroundColor: colors.drawer }]}><View style={styles.drawerTop}><View style={styles.drawerBrand}><View style={styles.brandMark}><MaterialIcons name="menu-book" size={22} color="#F0A23A" /></View><Text style={[styles.drawerTitle, { color: colors.text }]}>القرآن الكريم</Text></View><Pressable onPress={() => setDrawer(false)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><MaterialIcons name="close" size={27} color={colors.text} /></Pressable></View><Text style={[styles.drawerCaption, { color: colors.muted }]}>اختر ما تريد أن تقرأه اليوم</Text>{["القرآن الكريم", "الروايات", "القرآن MP3", "الباحث القرآني", "التفاسير", "الترجمات", "الشيخ محمد متولي الشعراوي", "الاتصال بنا", "الإعدادات"].map((label, index) => <Pressable key={label} onPress={() => { setDrawer(false); if (label === "الإعدادات") router.push("/settings"); else if (index === 0) router.push({ pathname: "/reader", params: { suraId: "36" } }); else if (MENU_ROUTES[label]) router.push({ pathname: "/section", params: { kind: MENU_ROUTES[label] } }); }} style={({ pressed }) => [styles.drawerItem, pressed && styles.pressed]}><MaterialIcons name={MENU_ICONS[label] ?? "chevron-left"} size={21} color={index === 0 ? "#F0B64A" : colors.muted} /><Text style={[styles.drawerLabel, { color: index === 0 ? "#F0B64A" : colors.text }]}>{label}</Text>{[0, 1, 3, 4, 6].includes(index) && <MaterialIcons name="chevron-left" size={18} color={colors.muted} />}</Pressable>)}</View></View>}
      </View>
    </ScreenContainer>
  );
}

function QuickMenuHome({ dark, onToggleDark }: { dark: boolean; onToggleDark: () => void }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [qrVisible, setQrVisible] = useState(false);
  const [ayahResults, setAyahResults] = useState<Array<{ surah: { number: number; name: string }; numberInSurah: number; text: string }>>([]);
  const [searchStatus, setSearchStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const suraResults = useMemo(() => query.trim() ? filterSuras(query).slice(0, 6) : [], [query]);

  useEffect(() => {
    const term = query.trim();
    if (!term || term.length < 2 || /^\\d+$/.test(term) || /^\\d+:\\d+$/.test(term)) { setAyahResults([]); setSearchStatus(term ? "idle" : "idle"); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearchStatus("loading");
      fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(term)}/all/quran-uthmani`, { signal: controller.signal })
        .then((response) => { if (!response.ok) throw new Error("search"); return response.json(); })
        .then((payload) => { const matches = Array.isArray(payload?.data?.matches) ? payload.data.matches.slice(0, 8) : []; setAyahResults(matches); setSearchStatus(matches.length ? "ready" : "idle"); })
        .catch((error) => { if (error?.name !== "AbortError") { setAyahResults([]); setSearchStatus("error"); } });
    }, 280);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  const openSearchResult = (surahId: number, ayah?: number) => router.push({ pathname: "/reader", params: { suraId: String(surahId), ...(ayah ? { ayah: String(ayah) } : {}) } });
  const buttons = [
    { label: t("المفضلة", "Bookmarks"), subtitle: t("السور والآيات المحفوظة", "Saved surahs and ayahs"), icon: "bookmark" as const, action: () => router.push("/bookmarks") },
    { label: t("القرآن الكريم", "Quran"), subtitle: t("فهرس السور ثم القراءة", "Surah index and reading"), icon: "menu-book" as const, action: () => router.push("/sura-index") },
    { label: t("الروايات", "Riwayat"), subtitle: t("اختيار الرواية ثم السورة", "Choose a riwayah, then a surah"), icon: "library-books" as const, action: () => router.push({ pathname: "/section", params: { kind: "riwayat" } }) },
    { label: t("القرآن MP3", "Quran MP3"), subtitle: t("اختيار القارئ ثم تشغيل السورة", "Choose a reciter and play a surah"), icon: "headphones" as const, action: () => router.push({ pathname: "/section", params: { kind: "mp3" } }) },
    { label: t("الباحث القرآني", "Quran search"), subtitle: t("البحث في السور والآيات", "Search surahs and ayahs"), icon: "search" as const, action: () => router.push({ pathname: "/section", params: { kind: "search" } }) },
    { label: t("التفاسير", "Tafsir"), subtitle: t("اختيار المفسر ثم السورة", "Choose a tafsir, then a surah"), icon: "notes" as const, action: () => router.push({ pathname: "/section", params: { kind: "tafsir" } }) },
    { label: t("الترجمات", "Translations"), subtitle: t("اختيار المترجم ثم السورة", "Choose a translator, then a surah"), icon: "translate" as const, action: () => router.push({ pathname: "/section", params: { kind: "translations" } }) },
    { label: t("الشيخ محمد متولي الشعراوي", "Sheikh Al-Shaarawi"), subtitle: t("التفسير المرئي والمكتوب من مصادر موثوقة", "Video and written tafsir from trusted sources"), icon: "auto-stories" as const, action: () => router.push({ pathname: "/section", params: { kind: "shaarawi" } }) },
    { label: t("الاتصال بنا", "Contact us"), subtitle: t("إرسال الملاحظات والاقتراحات", "Send feedback and suggestions"), icon: "mail-outline" as const, action: () => router.push({ pathname: "/section", params: { kind: "contact" } }) },
    { label: t("الإعدادات", "Settings"), subtitle: t("تخصيص القراءة والاستماع", "Customize reading and listening"), icon: "settings" as const, action: () => router.push("/settings") },
  ];
  return <ScreenContainer edges={["bottom", "left", "right"]} containerClassName={dark ? "bg-[#080A1F]" : "bg-[#F7F7FB]"} safeAreaClassName="bg-transparent"><View style={[styles.root, { backgroundColor: dark ? palette.dark.background : palette.light.background }]}><View style={[styles.header, { backgroundColor: dark ? palette.dark.header : palette.light.header, borderBottomColor: dark ? palette.dark.border : palette.light.border }]}><View style={styles.brand}><View style={styles.brandMark}><MaterialIcons name="menu-book" size={25} color="#F0A23A" /></View><Text style={[styles.brandText, { color: "#F7F4EC" }]}>القرآن الكريم</Text></View><View style={styles.headerActions} accessibilityLabel="أدوات الشريط الأزرق"><Pressable onPress={() => setQrVisible(true)} style={({ pressed }) => [styles.qrButton, pressed && styles.pressed]} accessibilityLabel="فتح رمز QR"><MaterialIcons name="qr-code-2" size={21} color="#F0B64A" /></Pressable><Pressable onPress={onToggleDark} style={({ pressed }) => [styles.moonButton, pressed && styles.pressed]} accessibilityLabel="تبديل الوضع الليلي"><MaterialIcons name={dark ? "wb-sunny" : "dark-mode"} size={22} color="#F0B64A" /></Pressable></View></View><ScrollView contentContainerStyle={styles.quickContent} showsVerticalScrollIndicator={false}><View style={styles.quickSearch}><MaterialIcons name="search" size={22} color="#A6ABC7" /><TextInput value={query} onChangeText={setQuery} placeholder={t("ابحث عن سورة أو آية...", "Search for a surah or ayah...")} placeholderTextColor="#737891" style={styles.quickInput} textAlign="right" returnKeyType="search" />{query.length > 0 && <Pressable onPress={() => setQuery("")}><MaterialIcons name="close" size={19} color="#A6ABC7" /></Pressable>}</View>{(suraResults.length > 0 || ayahResults.length > 0 || searchStatus === "loading" || searchStatus === "error") && <View style={[styles.quickResults, { backgroundColor: dark ? palette.dark.card : palette.light.card, borderColor: dark ? palette.dark.border : palette.light.border }]}>{searchStatus === "loading" && <Text style={styles.quickState}>جارٍ البحث في الآيات…</Text>}{searchStatus === "error" && <Text style={styles.quickState}>تعذر البحث الآن، تحقق من الاتصال.</Text>}{suraResults.map((item) => <Pressable key={`sura-${item.id}`} onPress={() => openSearchResult(item.id)} style={styles.quickResult}><View style={styles.quickResultNumber}><Text style={styles.quickResultNumberText}>{item.id}</Text></View><View style={styles.quickResultCopy}><Text style={[styles.quickResultTitle, { color: dark ? palette.dark.text : palette.light.text }]}>سورة {item.name}</Text><Text style={[styles.quickResultMeta, { color: dark ? palette.dark.muted : palette.light.muted }]}>{item.latin} · {item.verses} آيات</Text></View><BookmarkButton bookmark={{ id: bookmarkId("sura", item.id, undefined, undefined, "quick"), kind: "sura", suraId: item.id, suraName: item.name, scope: "quick", title: `سورة ${item.name}`, subtitle: "العودة إلى بداية السورة في المصحف", createdAt: Date.now() }} /><MaterialIcons name="menu-book" size={19} color="#F0B64A" /></Pressable>)}{ayahResults.map((item, index) => <Pressable key={`ayah-${item.surah.number}-${item.numberInSurah}-${index}`} onPress={() => openSearchResult(item.surah.number, item.numberInSurah)} style={styles.quickResult}><View style={styles.quickResultNumber}><Text style={styles.quickResultNumberText}>{item.numberInSurah}</Text></View><View style={styles.quickResultCopy}><Text style={[styles.quickResultTitle, { color: dark ? palette.dark.text : palette.light.text }]}>سورة {item.surah.name} · الآية {item.numberInSurah}</Text><Text numberOfLines={2} style={[styles.quickResultMeta, { color: dark ? palette.dark.muted : palette.light.muted }]}>{item.text}</Text></View><BookmarkButton bookmark={{ id: bookmarkId("ayah", item.surah.number, item.numberInSurah, undefined, "quick"), kind: "ayah", suraId: item.surah.number, suraName: item.surah.name, ayah: item.numberInSurah, scope: "quick", title: `سورة ${item.surah.name} · الآية ${item.numberInSurah}`, subtitle: "العودة إلى موضع الآية في المصحف", snippet: item.text, createdAt: Date.now() }} /><MaterialIcons name="open-in-new" size={19} color="#F0B64A" /></Pressable>)}</View>}<View style={styles.quickGrid}>{buttons.map((button) => <Pressable key={button.label} onPress={button.action} style={({ pressed }) => [styles.quickButton, { backgroundColor: dark ? palette.dark.card : palette.light.card, borderColor: dark ? palette.dark.border : palette.light.border }, pressed && styles.cardPressed]}><View style={styles.quickIcon}><MaterialIcons name={button.icon} size={25} color="#F0B64A" /></View><View style={styles.quickCopy}><Text style={[styles.quickLabel, { color: dark ? palette.dark.text : palette.light.text }]}>{button.label}</Text><Text style={[styles.quickMeta, { color: dark ? palette.dark.muted : palette.light.muted }]}>{button.subtitle}</Text></View><MaterialIcons name="chevron-left" size={21} color="#F0B64A" /></Pressable>)}</View></ScrollView><Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}><View style={styles.qrOverlay}><Pressable style={styles.qrScrim} onPress={() => setQrVisible(false)} /><View style={styles.qrModal}><Text style={styles.qrModalTitle}>رمز QR</Text><Text style={styles.qrModalHint}>امسح الرمز لفتح موقع القرآن الكريم</Text><Image source={{ uri: "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=https%3A%2F%2Fquran.com" }} style={styles.qrImage} accessibilityLabel="رمز QR لموقع القرآن الكريم" /><Pressable onPress={() => setQrVisible(false)} style={({ pressed }) => [styles.qrClose, pressed && styles.pressed]}><Text style={styles.qrCloseText}>إغلاق</Text></Pressable></View></View></Modal></View></ScreenContainer>;
}

function TafsirQuickCard({ dark, onOpen }: { dark: boolean; onOpen: (query?: string) => void }) {
  const [query, setQuery] = useState("");
  const card = dark ? palette.dark : palette.light;
  return <View style={[styles.tafsirQuickCard, { backgroundColor: card.card, borderColor: card.border }]}><Pressable onPress={() => onOpen()} style={({ pressed }) => [styles.tafsirQuickHeader, pressed && styles.pressed]}><View style={styles.quickIcon}><MaterialIcons name="notes" size={24} color="#F0B64A" /></View><View style={styles.quickCopy}><Text style={[styles.quickLabel, { color: card.text }]}>التفاسير</Text><Text style={[styles.quickMeta, { color: card.muted }]}>ابحث عن تفسير أي آية</Text></View><MaterialIcons name="chevron-left" size={21} color="#F0B64A" /></Pressable><View style={[styles.tafsirQuickSearch, { borderColor: card.border }]}><MaterialIcons name="search" size={18} color={card.muted} /><TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => onOpen(query.trim() || undefined)} placeholder="اكتب كلمة من التفسير…" placeholderTextColor={card.muted} style={[styles.tafsirQuickInput, { color: card.text }]} textAlign="right" returnKeyType="search" /><Pressable onPress={() => onOpen(query.trim() || undefined)} style={({ pressed }) => [styles.tafsirQuickButton, pressed && styles.pressed]}><Text style={styles.tafsirQuickButtonText}>بحث</Text></Pressable></View></View>;
}

const palette = {
  light: { background: "#F7F7FB", header: "#080A1F", card: "#FFFFFF", text: "#171A35", muted: "#737891", border: "#E4E6EF", drawer: "#080A1F" },
  dark: { background: "#080A1F", header: "#050611", card: "#121630", text: "#F7F4EC", muted: "#A6ABC7", border: "#292D4D", drawer: "#10132A" },
};

const styles = StyleSheet.create({
  root: { flex: 1 }, header: { height: 48, flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 18, borderBottomWidth: 1, gap: 13 }, brand: { flexDirection: "row-reverse", alignItems: "center", gap: 9, marginLeft: "auto" }, brandMark: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#151B3D", alignItems: "center", justifyContent: "center" }, brandText: { fontSize: 18, fontWeight: "700" }, headerActions: { flexDirection: "row", alignItems: "center", gap: 6 }, qrButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#151B3D", alignItems: "center", justifyContent: "center" }, moonButton: { width: 34, height: 34, borderRadius: 20, backgroundColor: "#151B3D", alignItems: "center", justifyContent: "center" }, iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.62 }, content: { paddingHorizontal: 10, paddingTop: 0, paddingBottom: 18 }, quickContent: { paddingHorizontal: 10, paddingTop: 0, paddingBottom: 18 }, quickSearch: { height: 38, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4E6EF", flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 15, gap: 8, marginBottom: 9 }, quickInput: { flex: 1, color: "#171A35", fontSize: 15, paddingVertical: 0 }, quickResults: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 16 }, quickResult: { minHeight: 56, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#E4E6EF", flexDirection: "row-reverse", alignItems: "center", gap: 10 }, quickResultNumber: { width: 32, height: 32, borderRadius: 12, backgroundColor: "#F1D39A", alignItems: "center", justifyContent: "center" }, quickResultNumberText: { color: "#7C5420", fontSize: 12, fontWeight: "800" }, quickResultCopy: { flex: 1, alignItems: "flex-end" }, quickResultTitle: { fontSize: 14, fontWeight: "800", textAlign: "right" }, quickResultMeta: { fontSize: 11, marginTop: 3, textAlign: "right" }, quickState: { color: "#737891", textAlign: "right", padding: 16, fontSize: 13 }, quickHero: { alignItems: "center", backgroundColor: "#11152F", borderRadius: 18, paddingVertical: 14, paddingHorizontal: 12, marginBottom: 12, gap: 4 }, quickTitle: { color: "#F7F4EC", fontSize: 21, fontWeight: "800" }, quickSubtitle: { color: "#A6ABC7", fontSize: 12 }, quickGrid: { gap: 5 }, quickButton: { minHeight: 48, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", gap: 12 }, tafsirQuickCard: { borderRadius: 18, borderWidth: 1, padding: 10, gap: 8 }, tafsirQuickHeader: { minHeight: 46, flexDirection: "row-reverse", alignItems: "center", gap: 12 }, tafsirQuickSearch: { height: 38, borderRadius: 10, borderWidth: 1, flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 8, gap: 6 }, tafsirQuickInput: { flex: 1, fontSize: 12, paddingVertical: 0 }, tafsirQuickButton: { backgroundColor: "#F0B64A", borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7 }, tafsirQuickButtonText: { color: "#171A35", fontSize: 11, fontWeight: "800" }, quickIcon: { width: 34, height: 34, borderRadius: 15, backgroundColor: "#20274E", alignItems: "center", justifyContent: "center" }, quickCopy: { flex: 1, alignItems: "flex-end" }, quickLabel: { fontSize: 15, fontWeight: "800" }, quickMeta: { fontSize: 10, marginTop: 3 }, hero: { minHeight: 164, borderRadius: 24, padding: 22, justifyContent: "center", backgroundColor: "#11152F", overflow: "hidden", marginBottom: 22 }, heroGlow: { position: "absolute", width: 180, height: 180, borderRadius: 100, backgroundColor: "#1C2755", right: -34, top: -64, opacity: 0.8 }, heroEyebrow: { color: "#F0B64A", fontSize: 13, fontWeight: "700", textAlign: "right", marginBottom: 10 }, heroTitle: { color: "#F8F5EE", fontSize: 27, fontWeight: "800", textAlign: "right" }, heroSub: { color: "#B6BCD7", fontSize: 14, textAlign: "right", marginTop: 7 }, sectionHeading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 10, marginTop: 3 }, sectionTitle: { fontSize: 19, fontWeight: "800" }, link: { color: "#D99432", fontSize: 13, fontWeight: "700" }, count: { fontSize: 12 }, continueCard: { borderRadius: 16, padding: 12, flexDirection: "row-reverse", alignItems: "center", marginBottom: 20, shadowColor: "#0B0D2B", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, cardPressed: { opacity: 0.72 }, continueIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#20274E", alignItems: "center", justifyContent: "center", marginLeft: 12 }, continueCopy: { flex: 1, alignItems: "flex-end" }, continueLabel: { fontSize: 12 }, continueName: { fontSize: 17, fontWeight: "800", marginTop: 2 }, continueMeta: { fontSize: 12, marginTop: 2 }, searchBox: { height: 52, borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 15, gap: 8, marginBottom: 23 }, input: { flex: 1, fontSize: 15, paddingVertical: 0 }, suraRow: { minHeight: 60, borderRadius: 17, marginBottom: 9, paddingHorizontal: 13, flexDirection: "row-reverse", alignItems: "center" }, suraNumber: { width: 34, height: 34, borderRadius: 13, backgroundColor: "#F1D39A", alignItems: "center", justifyContent: "center", marginLeft: 11 }, numberText: { color: "#7C5420", fontSize: 14, fontWeight: "800" }, suraCopy: { flex: 1, alignItems: "flex-end" }, suraName: { fontSize: 17, fontWeight: "800" }, suraMeta: { fontSize: 12, marginTop: 3 }, latin: { fontSize: 11, marginLeft: 9 }, empty: { textAlign: "center", padding: 25 }, readingCard: { borderRadius: 22, marginTop: 18, padding: 19, overflow: "hidden" }, readingTop: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, readingKicker: { color: "#A6ABC7", fontSize: 12 }, readingName: { color: "#F0B64A", fontSize: 17, fontWeight: "800" },   basmala: { color: "#F0B64A", textAlign: "center", fontSize: 20, marginTop: 17, writingDirection: "rtl" }, ayah: { color: "#F7F4EC", textAlign: "right", lineHeight: 48, marginTop: 17, writingDirection: "rtl" }, readingActions: { flexDirection: "row-reverse", gap: 9, marginTop: 16 }, playButton: { backgroundColor: "#F0B64A", borderRadius: 13, height: 42, paddingHorizontal: 15, flexDirection: "row-reverse", alignItems: "center", gap: 5 }, playText: { color: "#11152F", fontWeight: "800", fontSize: 13 }, textButton: { borderColor: "#3A416D", borderWidth: 1, borderRadius: 13, height: 42, paddingHorizontal: 13, justifyContent: "center", alignItems: "center" }, textButtonLabel: { color: "#E1E3ED", fontSize: 11 }, textButtonValue: { color: "#A6ABC7", fontSize: 10, marginTop: 2 }, overlay: { ...StyleSheet.absoluteFill, zIndex: 10, flexDirection: "row-reverse" }, scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)" }, drawer: { width: "82%", maxWidth: 360, paddingTop: 20, paddingHorizontal: 18, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: -8, height: 0 }, elevation: 10 }, drawerTop: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#2B3154", paddingBottom: 19 }, drawerBrand: { flexDirection: "row-reverse", alignItems: "center", gap: 8 }, drawerTitle: { fontSize: 19, fontWeight: "800" }, drawerCaption: { fontSize: 12, textAlign: "right", marginTop: 18, marginBottom: 8 }, drawerItem: { minHeight: 52, flexDirection: "row-reverse", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#1D2240", gap: 12 }, drawerLabel: { flex: 1, textAlign: "right", fontSize: 16, fontWeight: "600" }, qrOverlay: { flex: 1, alignItems: "center", justifyContent: "center" }, qrScrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.62)" }, qrModal: { width: "82%", maxWidth: 320, borderRadius: 24, backgroundColor: "#FFFFFF", alignItems: "center", padding: 22, zIndex: 2 }, qrModalTitle: { color: "#171A35", fontSize: 21, fontWeight: "800" }, qrModalHint: { color: "#737891", fontSize: 13, textAlign: "center", marginTop: 6, marginBottom: 16 }, qrImage: { width: 220, height: 220, backgroundColor: "#FFFFFF" }, qrClose: { marginTop: 17, minWidth: 120, height: 42, borderRadius: 13, backgroundColor: "#11152F", alignItems: "center", justifyContent: "center" }, qrCloseText: { color: "#F0B64A", fontSize: 14, fontWeight: "800" },
});
