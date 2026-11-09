import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { BookmarkButton } from "@/components/bookmark-button";
import { bookmarkId } from "@/lib/bookmarks";
import { filterSuras, SURAS } from "@/lib/quran-data";
import { suraIdForPage } from "@/lib/mushaf";
import { useLanguage } from "@/lib/language-provider";

type ReadingPosition = { page: number; suraId: number; hasProgress: boolean };

export default function SuraIndexScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [readingPosition, setReadingPosition] = useState<ReadingPosition>({ page: 1, suraId: 1, hasProgress: false });
  const filtered = useMemo(() => filterSuras(query), [query]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem("quran.lastPage")
      .then((storedPage) => {
        if (!active) return;
        const pageNumber = Number(storedPage);
        const validPage = Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= 604;
        const page = validPage ? pageNumber : 1;
        setReadingPosition({ page, suraId: suraIdForPage(page), hasProgress: validPage });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const openSura = (id: number) => {
    router.push({ pathname: "/reader", params: { suraId: String(id) } });
  };

  const continueReading = () => {
    router.push({ pathname: "/reader", params: { suraId: String(readingPosition.suraId), page: String(readingPosition.page), trackProgress: "continue" } });
  };

  return (
    <ScreenContainer edges={["bottom", "left", "right"]}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={() => router.dismissTo("/(tabs)")} style={styles.back} accessibilityLabel={t("رجوع إلى القوائم الرئيسية", "Back to the main menus")}>
            <MaterialIcons name="arrow-forward" size={22} color="#F0B64A" />
          </Pressable>
          <View style={styles.headerCenter}>
            <MaterialIcons name="menu-book" size={22} color="#F0B64A" />
            <Text style={styles.headerTitle}>{t("فهرس السور", "Surah index")}</Text>
          </View>
          <View style={styles.backPlaceholder} />
        </View>

        <View style={styles.content}>
          <Pressable onPress={continueReading} style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={readingPosition.hasProgress ? `متابعة القراءة، صفحة ${readingPosition.page}، سورة ${SURAS[readingPosition.suraId - 1]?.name ?? ""}` : "ابدأ القراءة من الصفحة الأولى"}>
            <View style={styles.continueIcon}><MaterialIcons name="auto-stories" size={24} color="#F4D58E" /></View>
            <View style={styles.continueCopy}>
              <Text style={styles.continueTitle}>{t("متابعة القراءة", "Continue reading")}</Text>
              <Text style={styles.continueMeta}>{readingPosition.hasProgress ? `صفحة ${readingPosition.page} · سورة ${SURAS[readingPosition.suraId - 1]?.name ?? ""}` : "ابدأ من أول صفحة في المصحف"}</Text>
            </View>
            <MaterialIcons name="arrow-back-ios" size={17} color="#F4D58E" />
          </Pressable>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={21} color="#8E94B2" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("ابحث باسم السورة أو رقمها", "Search by surah name or number")}
              placeholderTextColor="#8E94B2"
              style={styles.input}
              textAlign="right"
              keyboardType="default"
              returnKeyType="search"
              accessibilityLabel={t("البحث باسم السورة أو رقمها", "Search by surah name or number")}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} style={styles.clearButton} accessibilityLabel={t("مسح البحث", "Clear search")}>
                <MaterialIcons name="close" size={19} color="#8E94B2" />
              </Pressable>
            )}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => openSura(item.id)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`السورة ${item.name} رقم ${item.id}`}
              >
                <View style={styles.number}>
                  <Text style={styles.numberText}>{item.id}</Text>
                </View>
                <View style={styles.copy}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{item.type} · {item.verses} آيات · {item.latin}</Text>
                </View>
                <MaterialIcons name="chevron-left" size={21} color="#8E94B2" />
                <BookmarkButton bookmark={{ id: bookmarkId("sura", item.id, undefined, undefined, "quran"), kind: "sura", suraId: item.id, suraName: item.name, scope: "quran", title: `سورة ${item.name}`, subtitle: "العودة إلى بداية السورة في المصحف", createdAt: Date.now() }} />
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.empty}>{t("لا توجد سورة مطابقة للبحث", "No matching surah")}</Text>}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080A1F" },
  header: {
    height: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#292D4D",
  },
  headerCenter: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  headerTitle: { color: "#F7F4EC", fontSize: 20, fontWeight: "800" },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#151B3D", alignItems: "center", justifyContent: "center" },
  backPlaceholder: { width: 42, height: 42 },
  content: { flex: 1, paddingHorizontal: 14, paddingTop: 0 },
  continueCard: { minHeight: 72, backgroundColor: "#075739", borderWidth: 1, borderColor: "#297A56", borderRadius: 16, marginBottom: 12, paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  continueIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#0C7047", alignItems: "center", justifyContent: "center" },
  continueCopy: { flex: 1, alignItems: "flex-end" },
  continueTitle: { color: "#F7F4EC", fontSize: 16, fontWeight: "800" },
  continueMeta: { color: "#D1E1D1", fontSize: 12, marginTop: 4, textAlign: "right" },
  searchBox: {
    height: 52,
    borderRadius: 15,
    backgroundColor: "#121630",
    borderWidth: 1,
    borderColor: "#292D4D",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  input: { flex: 1, color: "#F7F4EC", fontSize: 15, paddingVertical: 0 },
  clearButton: { padding: 4 },
  list: { paddingBottom: 24 },
  row: {
    minHeight: 68,
    backgroundColor: "#121630",
    borderRadius: 16,
    marginBottom: 8,
    paddingHorizontal: 13,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 11,
  },
  pressed: { opacity: 0.68 },
  number: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#F1D39A", alignItems: "center", justifyContent: "center" },
  numberText: { color: "#7C5420", fontWeight: "800" },
  copy: { flex: 1, alignItems: "flex-end" },
  name: { color: "#F7F4EC", fontSize: 17, fontWeight: "800" },
  meta: { color: "#A6ABC7", fontSize: 11, marginTop: 4, textAlign: "right" },
  empty: { color: "#A6ABC7", textAlign: "center", paddingVertical: 35 },
});
