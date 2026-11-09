import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";

type MiniPlayerState = {
  title: string;
  subtitle: string;
  playing: boolean;
  toggle: () => void;
  previous: () => void;
  next: () => void;
  open: () => void;
};

type MiniPlayerContextValue = {
  state: MiniPlayerState | null;
  setState: (state: MiniPlayerState | null) => void;
};

const MiniPlayerContext = createContext<MiniPlayerContextValue | null>(null);
let sharedState: MiniPlayerState | null = null;
const sharedListeners = new Set<(state: MiniPlayerState | null) => void>();

export function publishMiniPlayer(next: MiniPlayerState | null) {
  sharedState = next;
  sharedListeners.forEach((listener) => listener(sharedState));
}

export function MiniPlayerProvider({ children }: { children: ReactNode }) {
  const [state, setLocalState] = useState<MiniPlayerState | null>(sharedState);
  useEffect(() => {
    const listener = (next: MiniPlayerState | null) => setLocalState(next);
    sharedListeners.add(listener);
    setLocalState(sharedState);
    return () => { sharedListeners.delete(listener); };
  }, []);
  const setState = (next: MiniPlayerState | null) => publishMiniPlayer(next);
  const value = useMemo(() => ({ state, setState }), [state]);
  return <MiniPlayerContext.Provider value={value}>{children}<MiniPlayer /></MiniPlayerContext.Provider>;
}

export function useMiniPlayer() {
  const context = useContext(MiniPlayerContext);
  if (!context) throw new Error("useMiniPlayer must be used inside MiniPlayerProvider");
  return context;
}

function MiniPlayer() {
  const { state } = useMiniPlayer();
  const [hidden, setHidden] = useState(false);
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8 || Math.abs(gesture.dx) > 8,
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 24 || gesture.dx > 24) setHidden(true);
    },
  });
  if (!state) return null;
  if (hidden) return <Pressable onPress={() => setHidden(false)} style={styles.restore} accessibilityLabel="إظهار شريط التحكم"><MaterialIcons name="keyboard-arrow-up" size={20} color="#F0B64A" /></Pressable>;
  return <View {...panResponder.panHandlers} style={styles.bar} accessibilityLabel="شريط التحكم العائم"><Pressable onPress={state.open} style={styles.track} accessibilityLabel="فتح المشغل"><View style={styles.equalizer}><MaterialIcons name="graphic-eq" size={20} color="#F0B64A" /></View><View style={styles.copy}><Text numberOfLines={1} style={styles.title}>{state.title}</Text><Text numberOfLines={1} style={styles.subtitle}>{state.subtitle}</Text></View></Pressable><View style={styles.controls}><Pressable onPress={state.previous} style={styles.icon} accessibilityLabel="السورة السابقة"><MaterialIcons name="skip-next" size={20} color="#F0B64A" /></Pressable><Pressable onPress={state.toggle} style={styles.play} accessibilityLabel={state.playing ? "إيقاف التلاوة" : "تشغيل التلاوة"}><MaterialIcons name={state.playing ? "pause" : "play-arrow"} size={20} color="#171A35" /></Pressable><Pressable onPress={state.next} style={styles.icon} accessibilityLabel="السورة التالية"><MaterialIcons name="skip-previous" size={20} color="#F0B64A" /></Pressable></View></View>;
}

const styles = StyleSheet.create({
  restore: { position: "absolute", right: 10, bottom: 66, width: 32, height: 24, borderRadius: 12, backgroundColor: "#11152F", borderWidth: 1, borderColor: "#F0B64A", alignItems: "center", justifyContent: "center", zIndex: 20 },
  bar: { position: "absolute", left: 8, right: 8, bottom: 66, minHeight: 44, borderRadius: 14, backgroundColor: "#11152F", borderWidth: 1, borderColor: "#F0B64A", flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 7, gap: 5, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 8 },
  track: { flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 8, minWidth: 0 },
  equalizer: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#292D4D", alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0 },
  title: { color: "#F7F4EC", fontSize: 13, fontWeight: "800", textAlign: "right" },
  subtitle: { color: "#A6ABC7", fontSize: 10, marginTop: 2, textAlign: "right" },
  controls: { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
  icon: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#292D4D", alignItems: "center", justifyContent: "center" },
  play: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#F0B64A", alignItems: "center", justifyContent: "center" },
});
