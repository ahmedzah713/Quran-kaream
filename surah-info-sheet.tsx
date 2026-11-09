import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { Sura } from "@/lib/quran-data";
import { SURAS } from "@/lib/quran-data";
import { getSurahInfoNotes } from "@/lib/surah-info";

type SurahInfoSheetProps = {
  visible: boolean;
  surah: Sura;
  onClose: () => void;
};

const toArabicDigits = (value: number) => String(value).replace(/[0-9]/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoValue}>{value}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

export function SurahInfoSheet({ visible, surah, onClose }: SurahInfoSheetProps) {
  const notes = getSurahInfoNotes(surah.id);
  const openSource = (url: string) => {
    void Linking.openURL(url).catch(() => undefined);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="إغلاق معلومات السورة" style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeading}>
            <View style={styles.headingText}>
              <Text style={styles.sheetTitle}>معلومات السورة</Text>
              <Text numberOfLines={1} style={styles.surahName}>سورة {surah.name}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="إغلاق معلومات السورة" onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={22} color="#075739" />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.metadataCard}>
              <InfoRow label="مكان النزول" value={surah.type} />
              <InfoRow label="ترتيبها في المصحف" value={`${toArabicDigits(surah.id)} من ${toArabicDigits(SURAS.length)}`} />
              <InfoRow label="عدد الآيات" value={`${toArabicDigits(surah.verses)} آية`} />
            </View>

            {notes.classificationNote ? (
              <View style={styles.noteCard}>
                <View style={styles.sectionHeading}>
                  <MaterialIcons name="info-outline" size={19} color="#075739" />
                  <Text style={styles.sectionTitle}>ملاحظة حول التصنيف</Text>
                </View>
                <Text style={styles.bodyText}>{notes.classificationNote}</Text>
              </View>
            ) : null}

            <View style={styles.reasonCard}>
              <View style={styles.sectionHeading}>
                <MaterialIcons name="menu-book" size={19} color="#075739" />
                <Text style={styles.sectionTitle}>سبب النزول</Text>
              </View>
              <Text style={styles.bodyText}>{notes.asbabNote}</Text>
            </View>

            <View style={styles.sourcesSection}>
              <Text style={styles.sourcesTitle}>المصادر</Text>
              {notes.references.map((source) => (
                <Pressable
                  key={source.url}
                  accessibilityRole="link"
                  accessibilityLabel={`فتح المصدر: ${source.title}`}
                  onPress={() => openSource(source.url)}
                  style={styles.sourceLink}
                >
                  <MaterialIcons name="open-in-new" size={17} color="#075739" />
                  <Text style={styles.sourceText}>{source.title}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(5,18,11,0.55)" },
  sheet: { width: "100%", maxHeight: "86%", minHeight: 280, backgroundColor: "#FFFDF6", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 2, borderColor: "#D2BC83", paddingBottom: 18, overflow: "hidden" },
  sheetHeading: { minHeight: 62, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 17, borderBottomWidth: 1, borderBottomColor: "#E5DFC9", backgroundColor: "#F7F4E8" },
  headingText: { flex: 1, minWidth: 0, alignItems: "flex-start", gap: 2 },
  sheetTitle: { color: "#738072", fontSize: 11, fontWeight: "700", textAlign: "right" },
  surahName: { maxWidth: "100%", color: "#075739", fontSize: 16, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#E8EFDF" },
  scroll: { flexGrow: 0, maxHeight: 620 },
  content: { padding: 16, gap: 12 },
  metadataCard: { paddingHorizontal: 13, borderWidth: 1, borderColor: "#D9E1CF", borderRadius: 13, backgroundColor: "#FAFBF5" },
  infoRow: { minHeight: 44, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: "#E8EDE2" },
  infoLabel: { color: "#667367", fontSize: 12, textAlign: "right" },
  infoValue: { color: "#16452E", fontSize: 13, fontWeight: "900", textAlign: "left" },
  noteCard: { padding: 13, gap: 8, borderWidth: 1, borderColor: "#D7C99F", borderRadius: 13, backgroundColor: "#F8F3E4" },
  reasonCard: { padding: 13, gap: 8, borderWidth: 1, borderColor: "#D9E1CF", borderRadius: 13, backgroundColor: "#FAFBF5" },
  sectionHeading: { flexDirection: "row-reverse", alignItems: "center", gap: 7 },
  sectionTitle: { color: "#16452E", fontSize: 13, fontWeight: "900", textAlign: "right" },
  bodyText: { color: "#354438", fontSize: 13, lineHeight: 23, textAlign: "right", writingDirection: "rtl" },
  sourcesSection: { gap: 7, paddingBottom: 2 },
  sourcesTitle: { color: "#667367", fontSize: 11, fontWeight: "800", textAlign: "right" },
  sourceLink: { minHeight: 38, flexDirection: "row-reverse", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "#D9E1CF", borderRadius: 10, paddingHorizontal: 11, backgroundColor: "#FFFFFF" },
  sourceText: { flex: 1, color: "#075739", fontSize: 12, fontWeight: "800", textAlign: "right", textDecorationLine: "underline" },
});
