import { useState, type ReactNode } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { AYAH_RECITERS } from "@/lib/verse-services";
import { SURAS } from "@/lib/quran-data";
import type { RecitationAyah } from "@/lib/continuous-recitation";

const toArabicDigits = (value: number) => String(value).replace(/[0-9]/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);

type Props = {
  currentAyah: RecitationAyah | null;
  selectedReciterId: string;
  isLoading: boolean;
  isPlaying: boolean;
  hasError: boolean;
  disabled: boolean;
  compact?: boolean;
  children?: ReactNode;
  onToggle: () => void;
  onSelectReciter: (reciterId: string) => void;
};

export function ContinuousRecitationPlayer({
  currentAyah,
  selectedReciterId,
  isLoading,
  isPlaying,
  hasError,
  disabled,
  compact = false,
  children,
  onToggle,
  onSelectReciter,
}: Props) {
  const [reciterPickerVisible, setReciterPickerVisible] = useState(false);
  const currentSura = currentAyah ? SURAS.find((sura) => sura.id === currentAyah.suraId) : null;
  const selectedReciter = AYAH_RECITERS.find((reciter) => reciter.id === selectedReciterId) ?? AYAH_RECITERS[0];
  const buttonLabel = hasError
    ? "تعذرت التلاوة؛ اضغط لإعادة المحاولة"
    : isLoading
      ? "إلغاء تحميل التلاوة"
      : isPlaying
        ? "إيقاف التلاوة مؤقتًا"
        : "تشغيل التلاوة";

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <View style={[styles.mainRow, compact && styles.compactMainRow]}>
        {compact ? children : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
          accessibilityState={{ disabled: disabled && !isLoading && !isPlaying }}
          disabled={disabled && !isLoading && !isPlaying}
          onPress={onToggle}
          style={({ pressed }) => [styles.playButton, compact && styles.compactPlayButton, pressed && styles.pressed, disabled && !isLoading && !isPlaying && styles.disabled, hasError && styles.errorButton]}
        >
          {isLoading ? (
            <ActivityIndicator color="#10231A" size="small" />
          ) : (
            <MaterialIcons name={hasError ? "error-outline" : isPlaying ? "pause" : "play-arrow"} size={compact ? 22 : 24} color="#10231A" />
          )}
        </Pressable>

        {!compact ? (
          <View style={styles.trackInfo}>
            <Text numberOfLines={1} style={styles.title}>التلاوة المتتابعة</Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {currentAyah && currentSura
                ? `سورة ${currentSura.name} · الآية ${toArabicDigits(currentAyah.ayahNumber)}`
                : "ابدأ من الآية التي تلمسها أو أول آية في الصفحة"}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`اختيار القارئ، الحالي ${selectedReciter.name}`}
          accessibilityHint="عرض قائمة القراء المتاحين للتلاوة المتتابعة"
          onPress={() => setReciterPickerVisible(true)}
          style={({ pressed }) => [compact ? styles.compactReciterButton : styles.reciterButton, pressed && styles.pressed]}
        >
          {compact ? (
            <MaterialIcons name="headset-mic" size={18} color="#F4D58E" />
          ) : (
            <Text numberOfLines={1} style={styles.reciterButtonText}>{selectedReciter.name}</Text>
          )}
          <MaterialIcons name="expand-more" size={compact ? 14 : 17} color="#F4D58E" />
        </Pressable>
      </View>

      {!compact ? <Text numberOfLines={1} style={styles.externalNote}>ملفات التلاوة تُبث من مصدر خارجي وليست مضمّنة داخل التطبيق.</Text> : null}

      <Modal
        visible={reciterPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReciterPickerVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إغلاق قائمة القراء"
            style={styles.modalBackdrop}
            onPress={() => setReciterPickerVisible(false)}
          />
          <View style={styles.reciterSheet} accessibilityViewIsModal>
            <View style={styles.sheetHeading}>
              <Text style={styles.sheetTitle}>اختر القارئ</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
                onPress={() => setReciterPickerVisible(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={20} color="#075739" />
              </Pressable>
            </View>
            <Text style={styles.externalNote}>ملفات التلاوة تُبث من مصدر خارجي وليست مضمّنة في التطبيق.</Text>
            {AYAH_RECITERS.map((reciter) => {
              const active = reciter.id === selectedReciterId;
              return (
                <Pressable
                  key={reciter.id}
                  accessibilityRole="button"
                  accessibilityLabel={`اختيار القارئ ${reciter.name}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    onSelectReciter(reciter.id);
                    setReciterPickerVisible(false);
                  }}
                  style={[styles.reciterRow, active && styles.reciterRowActive]}
                >
                  <Text style={[styles.reciterRowText, active && styles.reciterRowTextActive]}>{reciter.name}</Text>
                  {active ? <MaterialIcons name="check" size={19} color="#075739" /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 9,
    paddingTop: 3,
    paddingBottom: 3,
    backgroundColor: "#064A31",
    borderTopWidth: 1,
    borderTopColor: "#347C56",
  },
  compactContainer: {
    height: 50,
    flexShrink: 0,
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 2,
    backgroundColor: "#075739",
  },
  mainRow: { minHeight: 39, flexDirection: "row-reverse", alignItems: "center", gap: 7 },
  compactMainRow: { flex: 1, width: "100%", minHeight: 0, justifyContent: "space-around", gap: 0 },
  playButton: { width: 40, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#F0B64A" },
  compactPlayButton: { width: 35, height: 38, flexShrink: 0, borderRadius: 10 },
  errorButton: { backgroundColor: "#FFD5C9" },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
  trackInfo: { flex: 1, minWidth: 0, alignItems: "flex-start", gap: 1 },
  title: { color: "#FFFDF6", fontSize: 11, fontWeight: "900", textAlign: "right" },
  subtitle: { color: "#E0E8D8", fontSize: 9, fontWeight: "600", textAlign: "right" },
  reciterButton: { maxWidth: 118, minWidth: 82, minHeight: 31, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 1, paddingHorizontal: 6, borderWidth: 1, borderColor: "#819381", borderRadius: 16, backgroundColor: "#0A5A3B" },
  compactReciterButton: { width: 35, height: 38, flexShrink: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: -3, borderRadius: 10, backgroundColor: "#0A5A3B" },
  reciterButtonText: { flexShrink: 1, color: "#F2F3E9", fontSize: 9, fontWeight: "800", textAlign: "center" },
  externalNote: { color: "#617565", fontSize: 10, lineHeight: 15, textAlign: "right", paddingHorizontal: 12, paddingBottom: 6 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(5,18,11,0.55)" },
  reciterSheet: { width: "100%", paddingHorizontal: 12, paddingBottom: 18, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTopWidth: 2, borderColor: "#D2BC83", backgroundColor: "#FFFDF6", overflow: "hidden" },
  sheetHeading: { minHeight: 52, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#E5DFC9" },
  sheetTitle: { color: "#075739", fontSize: 16, fontWeight: "900", textAlign: "right" },
  closeButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "#E8EFDF" },
  reciterRow: { minHeight: 47, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#E8E4D7" },
  reciterRowActive: { backgroundColor: "#EFF4E8" },
  reciterRowText: { color: "#334C3B", fontSize: 13, fontWeight: "700" },
  reciterRowTextActive: { color: "#075739", fontWeight: "900" },
});
