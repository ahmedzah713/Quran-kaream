import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as MailComposer from "expo-mail-composer";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { ActivityIndicator, Animated, Easing, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SvgUri, SvgXml } from "react-native-svg";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { BookmarkButton } from "@/components/bookmark-button";
import { SURAS } from "@/lib/quran-data";
import { getApiBaseUrl } from "@/constants/oauth";
import { filterTafsirRows, normalizeTafsirRows } from "@/lib/tafsir-utils";
import { pageAfterSwipe } from "@/lib/tafsir-pagination";
import { highlightMatches, normalizeSearchText, uniqueAyahResults, type SearchAyahResult } from "@/lib/search-utils";
import { addBookmark, bookmarkId, loadBookmarks, removeBookmark } from "@/lib/bookmarks";
import { publishMiniPlayer } from "@/lib/mini-player";
import { useLanguage } from "@/lib/language-provider";
import { ShaarawiFlow } from "@/components/shaarawi-flow";

type Reciter = { name: string; code: string; server: string; urls?: Record<number, string>; availableSuras?: number[]; externalTitles?: Record<number, string> };

const RECITERS: Reciter[] = [
  { name: "مشاري راشد العفاسي", code: "afs", server: "https://server8.mp3quran.net/afs/" },
  { name: "ماهر المعيقلي", code: "maher", server: "https://cdn.mp3quran.net/audio/maher-muaiqly/r1/" },
  { name: "عبد الباسط عبد الصمد", code: "basit", server: "https://server7.mp3quran.net/basit/" },
  { name: "محمود خليل الحصري", code: "husr", server: "https://server13.mp3quran.net/husr/" },
  { name: "محمد صديق المنشاوي", code: "minsh1387", server: "https://server10.mp3quran.net/minsh1387/" },
  { name: "عبد الرحمن السديس", code: "sds", server: "https://server11.mp3quran.net/sds/" },
  { name: "سعود الشريم", code: "shur", server: "https://server7.mp3quran.net/shur/" },
  { name: "أحمد بن علي العجمي", code: "ajm", server: "https://server10.mp3quran.net/ajm/" },
  { name: "محمد أيوب", code: "ayyoub2", server: "https://server16.mp3quran.net/ayyoub2/Rewayat-Hafs-A-n-Assem/" },
  { name: "علي بن عبد الرحمن الحذيفي", code: "hthfi", server: "https://server9.mp3quran.net/hthfi/" },
  { name: "محمد جبريل", code: "jbrl", server: "https://server8.mp3quran.net/jbrl/" },
  { name: "محمود الشحات محمد أنور", code: "shahat-murattal", server: "https://media.way2quran.com/al-shahat-muhammad-anwar/hafs-an-asim/" },
];

// المصاحف التي يصنفها مصدر MP3Quran باسم «المصحف المجود».
const MUJAWWAD_RECITERS: Reciter[] = [
  { name: "محمد الطبلاوي", code: "tablawi-mujawwad", server: "https://cdn.mp3quran.net/audio/muhammad-tablawi/r2/" },
  { name: "محمد صديق المنشاوي", code: "minshawi-mujawwad", server: "https://cdn.mp3quran.net/audio/muhammad-minshawi/r2/" },
  { name: "محمود خليل الحصري", code: "husary-mujawwad", server: "https://cdn.mp3quran.net/audio/mahmoud-husary/r2/" },
  { name: "محمود علي البنا", code: "banna-mujawwad", server: "https://cdn.mp3quran.net/audio/mahmoud-banna/r2/" },
  { name: "مصطفى إسماعيل", code: "mustafa-ismail-mujawwad", server: "https://cdn.mp3quran.net/audio/mustafa-ismail/r2/" },
  { name: "عبدالباسط عبدالصمد", code: "abdulbasit-mujawwad", server: "https://cdn.mp3quran.net/audio/abdulbasit-abdulsamad/r1/" },
  { name: "السيد سعيد", code: "alsaid-saeed-mujawwad", server: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/", urls: {
    1: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/001.mp3", 2: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/002-001.mp3", 3: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/003-001.mp3", 4: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/004-001.mp3", 5: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/005-001.mp3", 6: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/006-002.mp3", 12: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/012.mp3", 13: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/013-001.mp3", 14: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/014-001.mp3", 16: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/016-001.mp3", 17: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/017-001.mp3", 18: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/018-001.mp3", 19: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/019-001.mp3", 20: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/020-001.mp3", 21: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/021-001.mp3", 23: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/023-001.mp3", 25: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/025-001.mp3", 28: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/028-001.mp3", 30: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/030-001.mp3", 31: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/031.mp3", 32: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/032.mp3", 33: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/033-001.mp3", 35: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/035.mp3", 36: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/036-001.mp3", 49: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/049.mp3", 50: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/050.mp3", 54: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/054.mp3", 55: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/055-001.mp3", 59: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/059.mp3", 66: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/066.mp3", 69: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/069.mp3", 73: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/073.mp3", 75: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/075.mp3", 78: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/078-001.mp3", 79: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/079.mp3", 82: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/082.mp3", 85: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/085.mp3", 86: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/086.mp3", 87: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/087.mp3", 88: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/088.mp3", 89: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/089.mp3", 90: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/090.mp3", 91: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/091.mp3", 93: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/093.mp3", 96: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/096.mp3", 97: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/097.mp3", 99: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/099.mp3", 106: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/106.mp3", 108: "https://media.way2quran.com/alsaid-saeed/hafs-an-asim/108.mp3"
  }, availableSuras: [1,2,3,4,5,6,12,13,14,16,17,18,19,20,21,23,25,28,30,31,32,33,35,36,49,50,54,55,59,66,69,73,75,78,79,82,85,86,87,88,89,90,91,93,96,97,99,106,108] },
  { name: "محمود الشحات محمد أنور · تسجيلات خارجية", code: "shahat-mujawwad", server: "https://podcasts.qurancentral.com/", urls: {
    1: "https://podcasts.qurancentral.com/mahmood-shahat/mahmood-shahat-qurancentral.com-001-al-fatihah-2020-03-13-02-08-17.mp3",
    17: "https://podcasts.qurancentral.com/mahmood-shahat/jame-masjid-batley.mp3",
    87: "https://podcasts.qurancentral.com/mahmood-shahat/mahmood-shahat-qurancentral.com-087-al-ala-2020-03-13-02-14-32.mp3",
    91: "https://podcasts.qurancentral.com/mahmood-shahat/mahmood-shahat-qurancentral.com-091-ash-shams-2020-03-13-02-15-09.mp3",
    93: "https://podcasts.qurancentral.com/mahmood-shahat/mahmood-shahat-qurancentral.com-093-ad-dhuha-2020-03-13-02-05-00.mp3",
    95: "https://podcasts.qurancentral.com/mahmood-shahat/mahmood-shahat-qurancentral.com-surah-at-tin-and-surah-quraish-2020-03-13-02-07-24.mp3",
    97: "https://podcasts.qurancentral.com/mahmood-shahat/mahmood-shahat-qurancentral.com-097-al-qadr-2020-03-13-02-12-51.mp3",
    99: "https://podcasts.qurancentral.com/mahmood-shahat/mahmood-shahat-qurancentral.com-099-az-zalzala-2020-03-13-02-16-04.mp3",
    112: "https://podcasts.qurancentral.com/mahmood-shahat/mahmood-shahat-qurancentral.com-112-al-ikhlas-2020-03-13-02-11-59.mp3",
    2: "https://archive.org/download/026-s-20zzzzzzzzzzz/002%20s%202%20%20%D8%A7%D9%84%D8%B4%D9%8A%D8%AE%20%D9%85%D8%AD%D9%85%D9%88%D8%AF%20%D8%A7%D9%84%D8%B4%D8%AD%D8%A7%D8%AA%20%D9%81%D9%8A%20%D8%A3%D8%AF%D8%A7%D8%A1%20%D8%A7%D8%B9%D8%AC%D8%A7%D8%B2%D9%8A%20%D9%8A%D8%B0%D9%87%D9%84%20%D8%A8%D9%87%20%D8%A7%D9%84%D8%B9%D9%82%D9%88%D9%84%20%D9%88%20%D9%8A%D8%A3%D8%B3%D8%B1%20%D8%A7%D9%84%D9%82%D9%84%D9%88%D8%A8%20%D9%85%D9%86%20%D8%B3%D9%88%D8%B1%D8%A9%20%D8%A7%D9%84%D8%A8%D9%82%D8%B1%D8%A9.mp3",
    3: "https://archive.org/download/026-s-20zzzzzzzzzzz/402%20s%203%20%20%D8%B3%D9%88%D8%B1%D8%A9%20%D8%A2%D9%84%20%D8%B9%D9%85%D8%B1%D8%A7%D9%86%20%20%D9%82%D9%84%20%D8%A7%D9%84%D9%84%D9%87%D9%85%20%D9%85%D8%A7%D9%84%D9%83%20%D8%A7%D9%84%D9%85%D9%84%D9%83%20%D8%A8%D9%87%D8%B0%D8%A7%20%D8%A7%D9%84%D8%AA%D9%86%D9%88%D8%B9%20%D8%A7%D9%84%D9%86%D8%A7%D8%AF%D8%B1%20%D9%88%D8%A7%D9%84%D8%BA%D9%8A%D8%B1%20%D9%85%D8%A3%D9%84%D9%88%D9%81%20%D9%8A%D8%AA%D8%B1%D9%86%D9%85%20%D8%A7%D9%84%D8%B4%D9%8A%D8%AE%20%D9%85%D8%AD%D9%85%D9%88%D8%AF%20%D8%A7%D9%84%D8%B4%D8%AD%D8%A7%D8%AA%20%D8%A3%D9%86%D9%88%D8%B1.mp3",
    5: "https://archive.org/download/026-s-20zzzzzzzzzzz/403%20s%205%20%20%D8%A7%D9%84%D9%85%D8%A7%D8%A6%D8%AF%D8%A9%20%D8%A3%D8%B1%D9%88%D8%B9%20%D9%84%D9%8A%D9%80%D8%A7%D9%84%D9%8A%202020%20%E2%9C%AA%20%D9%84%D9%84%D8%B4%D9%8A%D8%AE%20%D9%85%D8%AD%D9%85%D9%88%D8%AF%20%D8%A7%D9%84%D8%B4%D8%AD%D8%A7%D8%AA%20%D8%A3%D9%86%D9%88%D8%B1%20%D9%84%D9%8A%D9%84%D8%A9%20%D8%AA%D9%83%D8%B1%D9%8A%D9%85%20%D9%81%D8%B6%D9%8A%D9%84%D8%A9%20%D8%A7%D9%84%D8%B4%D9%8A%D8%AE%20%D9%85%D8%AD%D9%85%D8%AF%20%D8%A7%D9%84%D8%B9%D8%B2%D8%A8%20%20HD%20%20%D8%A3%D8%A8%D9%88%20%D8%AF%D8%A7%D9%88%D8%AF%20%D8%A7%D9%84%D8%B9%D9%86%D8%A8.mp3",
    6: "https://archive.org/download/026-s-20zzzzzzzzzzz/404%20s%206%20%20%D8%A7%D9%84%D8%B4%D9%8A%D8%AE%20%D9%85%D8%AD%D9%85%D9%88%D8%AF%20%D8%A7%D9%84%D8%B4%D8%AD%D8%A7%D8%AA%20%D8%A7%D9%86%D9%88%D8%B1%20%D8%B3%D9%88%D8%B1%D9%87%20%D8%A7%D9%84%D8%A7%D9%86%D8%B9%D8%A7%D9%85%20%D8%B9%D8%B2%D8%A7%D8%A1%20%D9%81%D9%82%D9%8A%D8%AF%D9%87%20%D8%B9%D8%A7%D8%A6%D9%84%D8%A7%D8%AA%20%D8%A7%D9%84%D9%87%D9%88%D8%A7%D8%B1%D9%89%20%D9%88%D8%A7%D9%84%D8%B4%D9%87%D8%A7%D8%A8%D9%89%2023%3D4%3D2021%20%D8%B3%D9%86%D8%AA%D9%85%D8%A7%D9%89%20%3D%20%D9%85%D9%8A%D8%AA%20%D8%BA%D9%85%D8%B1%20%D8%AF.mp3",
    12: "https://archive.org/download/026-s-20zzzzzzzzzzz/016%20s%2012%20%20%2091%20%20%20%D9%85%D9%86%20%D8%A3%D8%AC%D9%85%D9%84%20%D9%85%D8%A7%20%D9%82%D8%B1%D8%A3%20%D8%A7%D9%84%D8%B4%D9%8A%D8%AE%20%D9%85%D8%AD%D9%85%D9%88%D8%AF%20%D8%A7%D9%84%D8%B4%D8%AD%D8%A7%D8%AA%20%D8%B3%D9%88%D8%B1%D8%A9%20%D9%8A%D9%88%D8%B3%D9%81%20%D9%88%D8%A7%D9%84%D8%B4%D9%85%D8%B3%20%D9%85%D9%86%20%D9%81%D8%B1%D9%86%D8%B3%D8%A7%20%D8%AA%D9%84%D8%A7%D9%88%D8%A9%20%D8%AA%D9%81%D9%88%D9%82%20%D8%A7%D9%84%D9%88%D8%B5%D9%81%20%D8%A7%D8%B1%D8%AD_%D8%B3%D9%85%D8%B9%D9%83_%D8%A8%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D9%86.mp3",
    19: "https://archive.org/download/026-s-20zzzzzzzzzzz/025%20s%2019%20%20%D8%A3%D9%88%D9%84%20%D9%85%D8%B1%D9%87%20%D8%A3%D8%B3%D8%AA%D9%85%D8%B9%20%D8%B3%D9%88%D8%B1%D8%A9%20%D9%85%D8%B1%D9%8A%D9%85%20%D8%A8%D8%A7%D9%84%D8%AC%D9%85%D8%A7%D9%84%20%D9%88%D8%A7%D9%84%D8%A3%D8%AD%D8%B3%D8%A7%D8%B3%20%D8%A7%D9%84%D8%B9%D8%A7%D9%84%D9%89%20%20%D9%83%D8%AF%D8%A7%20%20%D9%85%D9%86%20%D8%A7%D9%84%D8%B4%D9%8A%D8%AE%20%D9%85%D8%AD%D9%85%D9%88%D8%AF%20%D8%A7%D9%84%D8%B4%D8%AD%D8%A7%D8%AA%20%D8%AC%D9%86%D8%A7%D9%86%20%D9%81%D9%82%D8%B7%20%D8%B9%D9%85%D8%B1%D9%88%20%D8%B5%D9%82%D8%B1%20010023.mp3",
    26: "https://archive.org/download/026-s-20zzzzzzzzzzz/156%20s%2026%20%D8%AA%D8%B1%D8%AD%D9%8A%D8%A8%20%D9%85%D8%A4%D8%AB%D8%B1%20%F0%9F%98%A2%20%D8%A8%D8%A7%D9%84%D8%B4%D9%8A%D8%AE%20%D9%85%D8%AD%D9%85%D9%88%D8%AF%20%D8%A7%D9%84%D8%B4%D8%AD%D8%A7%D8%AA%20%D9%85%D9%86%20%D8%AC%D9%86%D9%88%D8%A8%20%D8%A3%D9%81%D8%B1%D9%8A%D9%82%D9%8A%D8%A7%20%D9%88%D8%B3%D9%88%D8%B1%D8%A9%20%D8%A7%D9%84%D8%B4%D8%B9%D8%B1%D8%A7%D8%A1%20%D9%88%D9%82%D8%B5%D8%A7%D8%B1%20%D8%A7%D9%84%D8%B3%D9%88%D8%B1.mp3",
    28: "https://archive.org/download/026-s-20zzzzzzzzzzz/038%20s%2028%20%20%D8%AA%D9%84%D8%A7%D9%88%D8%A9%20%D8%AA%D8%A7%D8%B1%D9%8A%D8%AE%D9%8A%D8%A9%20%E2%9D%A4%EF%B8%8F%F0%9F%8E%A4%F0%9F%8C%B9%D8%B3%D9%88%D8%B1%D8%A9%20%D8%A7%D9%84%D9%82%D8%B5%D8%B5%F0%9F%8C%B7%D8%A7%D9%84%D8%B4%D9%8A%D8%AE%20%D9%85%D8%AD%D9%85%D9%88%D8%AF%20%D8%A7%D9%84%D8%B4%D8%AD%D8%A7%D8%AA%20%D8%A3%D9%86%D9%88%D8%B1.mp3",
    40: "https://archive.org/download/026-s-20zzzzzzzzzzz/253%20s%2040%20%D8%B1%D8%AC%D9%84%20%D9%85%D8%B3%D9%83%D9%8A%D9%86%20%D9%8A%D8%B0%D9%83%D8%B1%D9%87%20%D8%A8%D9%88%D8%A7%D9%84%D8%AF%D9%87%20%D9%81%D9%8A%D8%B9%D9%88%D8%AF%20%D8%A5%D9%84%D9%89%20%D8%A3%D8%B3%D9%84%D9%88%D8%A8%20%D8%A3%D8%A8%D9%8A%D9%87%20%D8%A7%D9%84%D9%85%D8%A4%D8%AB%D8%B1%20I%20%20%D8%A5%D8%B3%D9%85%D8%B9%20%D8%A8%D9%82%D9%84%D8%A8%D9%83%D9%80%20%D8%A7%D9%84%D8%B4%D9%8A%D8%AE%20%D9%85%D8%AD%D9%85%D9%88%D8%AF%20%D8%A7%D9%84%D8%B4%D8%AD%D8%A7%D8%AA.mp3",
    48: "https://archive.org/download/026-s-20zzzzzzzzzzz/412%20s%2048%20%2049%20%20%D9%85%D8%B9%D8%A7%D9%86%D9%89%20%D9%82%D8%B1%D8%A2%D9%86%D9%8A%D8%A9%20%D8%A3%D8%A8%D8%AF%D8%B9%20%D9%81%D9%8A%D9%87%D8%A7%20%D9%85%D8%AD%D9%85%D9%88%D8%AF%20%D8%A7%D9%84%D8%B4%D8%AD%D8%A7%D8%AA%20%D8%A3%D9%86%D9%88%D8%B1%20%D9%88%D8%B3%D9%88%D8%B1%20%D8%A7%D9%84%D9%81%D8%AA%D8%AD%20%D9%88%D8%A7%D9%84%D8%AD%D8%AC%D8%B1%D8%A7%D8%AA%20%D9%88%D8%A7%D9%84%D8%A3%D8%B9%D9%84%D9%89%20%D9%88%D8%A7%D9%84%D8%A8%D9%8A%D9%86%D9%87%20%D9%88%D8%A7%D9%84%D9%81%D8%A7%D8%AA%D8%AD%D9%87%20%D9%88%D8%A3%D9%88%D9%84%20%D8%A7%D9%84%D8%A8%D9%82%D8%B1%D8%A9%20%F0%9F%98%8D.mp3",
    66: "https://archive.org/download/026-s-20zzzzzzzzzzz/092%20s%2066%20%20%D8%AA%D9%84%D8%A7%D9%88%D8%A9%20%D9%83%D8%A7%D9%85%D9%84%D8%A9%20%D9%88%20%D8%B1%D8%A7%D8%A7%D8%A7%D8%A7%D8%A6%D8%B9%D8%A9%20-%20%D8%A7%D9%84%D8%B4%D9%8A%D8%AE%20%D9%85%D8%AD%D9%85%D9%88%D8%AF%20%D8%A7%D9%84%D8%B4%D8%AD%D8%A7%D8%AA%20%D8%B3%D9%88%D8%B1%D8%A9%20%D8%A7%D9%84%D8%AA%D8%AD%D8%B1%D9%8A%D9%85%20Best%20of%20Mahmood%20Shahat.mp3",
    76: "https://archive.org/download/026-s-20zzzzzzzzzzz/102%20s%2076%20%20%D9%82%D8%A7%D8%B1%D8%A6%20%D8%A7%D9%84%D8%B9%D8%A7%D9%84%D9%85%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%20%D8%A7%D9%84%D8%B4%D9%8A%D8%AE%20%D9%85%D8%AD%D9%85%D9%88%D8%AF%20%D8%A7%D9%84%D8%B4%D8%AD%D8%A7%D8%AA%20%D8%B3%D9%88%D8%B1%D8%A9%20%D8%A7%D9%84%D8%A3%D9%86%D8%B3%D8%A7%D9%86%20%D9%88%D9%82%D8%B5%D8%A7%D8%B1%20%D8%A7%D9%84%D8%B3%D9%88%D8%B1%20%D8%B7%D9%86%D8%B7%D8%A7%20%F0%9F%92%9A.mp3",
    83: "https://archive.org/download/026-s-20zzzzzzzzzzz/115%20s%2083%20%2091%20%20%D8%A7%D9%84%D8%B4%D9%8A%D8%AE%20%D9%85%D8%AD%D9%85%D9%88%D8%AF%20%D8%A7%D9%84%D8%B4%D8%AD%D8%A7%D8%AA%20-%20%D8%B3%D9%88%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D8%B7%D9%81%D9%81%D9%8A%D9%86%20%D9%88%D8%A7%D9%84%D8%B4%D9%85%D8%B3%2025_06.2012.mp3",
    89: "https://archive.org/download/026-s-20zzzzzzzzzzz/121%20s%2089%20%20%D9%88%D8%A7%D9%84%D9%81%D8%AC%D8%B1%20%D8%8C%20%D9%88%D9%84%D9%8A%D8%A7%D9%84%20%D8%B9%D8%B4%D8%B1%20%28%20%D8%B3%D9%80%D9%80%D9%88%D8%B1%D8%A9%20%D8%A7%D9%84%D9%81%D8%AC%D8%B1%20%29%20%20%D8%A8%D8%B5%D9%88%D8%AA%20%D8%A7%D9%84%D8%B4%D9%8A%D8%AE%20%D9%85%D8%AD%D9%85%D9%88%D8%AF%20%D8%A7%D9%84%D8%B4%D8%AD%D8%A7%D8%AA%20%D8%A3%D9%86%D9%88%D8%B1.mp3"
  }, availableSuras: [1,2,3,5,6,12,17,19,26,28,40,48,66,76,83,87,89,91,93,95,97,99,112], externalTitles: {
    1: "سورة الفاتحة · تسجيل خارجي مجود",
    17: "ما تيسر من سورة الإسراء · تسجيل خارجي مجود",
    87: "سورة الأعلى · تسجيل خارجي مجود",
    91: "سورة الشمس · تسجيل خارجي مجود",
    93: "سورة الضحى · تسجيل خارجي مجود",
    95: "سورتا التين وقريش · تسجيل خارجي مجود",
    97: "سورة القدر · تسجيل خارجي مجود",
    99: "سورة الزلزلة · تسجيل خارجي مجود",
    112: "سورة الإخلاص · تسجيل خارجي مجود",
    2: "سورة البقرة · تسجيل خارجي مجود",
    3: "سورة آل عمران · تسجيل خارجي مجود",
    5: "سورة المائدة · تسجيل خارجي مجود",
    6: "سورة الأنعام · تسجيل خارجي مجود",
    12: "سورة يوسف والشمس · تسجيل خارجي مجود",
    19: "سورة مريم · تسجيل خارجي مجود",
    26: "سورة الشعراء وقصار السور · تسجيل خارجي مجود",
    28: "سورة القصص · تسجيل خارجي مجود",
    40: "سورة غافر ومقاطع إضافية · تسجيل خارجي مجود",
    48: "سورة الفتح والحجرات ومقاطع إضافية · تسجيل خارجي مجود",
    66: "سورة التحريم · تسجيل خارجي مجود",
    76: "سورة الإنسان وقصار السور · تسجيل خارجي مجود",
    83: "سورة المطففين والشمس · تسجيل خارجي مجود",
    89: "سورة الفجر · تسجيل خارجي مجود"
  } },
];

const ALL_RECITERS = [...RECITERS, ...MUJAWWAD_RECITERS];

function getRecitationUrl(reciter: Reciter, suraId: number) {
  return reciter.urls?.[suraId] ?? `${reciter.server}${String(suraId).padStart(3, "0")}.mp3`;
}
function getRecitationTitle(reciter: Reciter, suraId: number, fallback: string) {
  return reciter.externalTitles?.[suraId] ?? fallback;
}
const TAFSIR_SLUGS: Record<string, string> = { "تفسير ابن كثير": "ar-tafsir-ibn-kathir", "التفسير الميسر": "ar-tafsir-muyassar", "تفسير الجلالين": "ar-tafsir-al-jalalayn", "تفسير الطبري": "ar-tafsir-al-tabari", "تفسير القرطبي": "ar-tafseer-al-qurtubi", "المختصر في التفسير": "ar-tafsir-al-mukhtasar", "تفسير السعدي": "ar-tafsir-as-saadi", "فتح القدير للشوكاني": "fath-al-qadir-al-shawkani", "إعراب القرآن الميسر": "al-i-rab-al-muyassar" };
const TAFSIR_SOURCE = "Tafsir API · spa5k/tafsir_api · نص مفصول حسب السورة والآية";
const VERIFIED_TAFSIRS = [{ label: "تفسير ابن كثير", id: "ar-tafsir-ibn-kathir" }, { label: "التفسير الميسر", id: "ar-tafsir-muyassar" }, { label: "تفسير الجلالين", id: "ar-tafsir-al-jalalayn" }, { label: "تفسير الطبري", id: "ar-tafsir-al-tabari" }, { label: "تفسير القرطبي", id: "ar-tafseer-al-qurtubi" }, { label: "المختصر في التفسير", id: "ar-tafsir-al-mukhtasar" }, { label: "تفسير السعدي", id: "ar-tafsir-as-saadi" }, { label: "فتح القدير للشوكاني", id: "fath-al-qadir-al-shawkani" }, { label: "إعراب القرآن الميسر", id: "al-i-rab-al-muyassar" }];
const QURANPEDIA_MUSHAF_SLUGS: Record<number, string> = { 1: "hafs", 4: "warsh", 6: "douri", 7: "qalon", 9: "shubah" };
const VERIFIED_RIWAYAT = [
  { label: "رواية حفص عن عاصم", id: "quran-uthmani", imam: "الإمام عاصم الكوفي", mushafId: 1 },
  { label: "رواية شعبة عن عاصم", id: "riwaya-shubah-asim", imam: "الإمام عاصم الكوفي", mushafId: 9 },
  { label: "رواية ورش عن نافع", id: "riwaya-warsh-nafi", imam: "الإمام نافع المدني", mushafId: 4 },
  { label: "رواية قالون عن نافع", id: "riwaya-qalun-nafi", imam: "الإمام نافع المدني", mushafId: 7 },
  { label: "رواية السوسي عن أبي عمرو", id: "riwaya-al-susi-abu-amr", imam: "الإمام أبو عمرو البصري", mushafId: 10 },
  { label: "رواية الدوري عن أبي عمرو", id: "riwaya-al-duri-abu-amr", imam: "الإمام أبو عمرو البصري", mushafId: 6 },
  { label: "رواية البزي عن ابن كثير", id: "riwaya-al-bazzi-ibn-kathir", imam: "الإمام ابن كثير المكي", mushafId: 5 },
  { label: "رواية قنبل عن ابن كثير", id: "riwaya-qunbul-ibn-kathir", imam: "الإمام ابن كثير المكي", mushafId: 8 },
];
const VERIFIED_TRANSLATIONS = [{ label: "English · Saheeh International", id: "en.sahih" }, { label: "Français · Hamidullah", id: "fr.hamidullah" }, { label: "Bahasa Indonesia", id: "id.indonesian" }, { label: "Deutsch · Bubenheim & Elyas", id: "de.bubenheim" }, { label: "Русский · Кулиев", id: "ru.kuliev" }, { label: "Türkçe · Diyanet", id: "tr.diyanet" }, { label: "Español · Asad", id: "es.asad" }, { label: "中文 · Ma Jian", id: "zh.majian" }];
const CONTENT: Record<string, { title: string; subtitle: string; icon: keyof typeof MaterialIcons.glyphMap; options: string[] }> = {
  shaarawi: { title: "الشيخ محمد متولي الشعراوي", subtitle: "التفسير المرئي والمكتوب من مصادر موثوقة", icon: "auto-stories", options: [] },
  riwayat: { title: "الروايات", subtitle: "اختر الرواية ثم السورة", icon: "library-books", options: VERIFIED_RIWAYAT.map((item) => item.label) },
  reciters: { title: "القراء", subtitle: "اختر القارئ المفضل للاستماع", icon: "people", options: RECITERS.map((item) => item.name) },
  mp3: { title: "القرآن MP3", subtitle: "اختر القارئ واستمع إلى آخر سورة قرأتها", icon: "headphones", options: RECITERS.map((item) => item.name) },
  tafsir: { title: "التفاسير", subtitle: "تدبر المعاني من مصادر التفسير", icon: "notes", options: ["التفسير الميسر", "تفسير ابن كثير", "تفسير السعدي"] },
  translations: { title: "الترجمات", subtitle: "اقرأ معاني القرآن بلغات مختلفة", icon: "translate", options: ["العربية", "English", "Français", "Türkçe"] },
  search: { title: "الباحث القرآني", subtitle: "ابحث عن كلمة أو آية في القرآن", icon: "search", options: ["ابدأ البحث في نص القرآن"] },
};

export default function SectionScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const content = CONTENT[kind ?? ""] ?? CONTENT.search;
  const [selected, setSelected] = useState(content.options[0]);
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [tafsirText, setTafsirText] = useState<Array<{ ayah: number; text: string }>>([]);
  const [tafsirStatus, setTafsirStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [lastSuraId, setLastSuraId] = useState(36);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const isPdf = kind === "pdf";
  const isContact = kind === "contact";
  const isSourceFlow = kind === "tafsir" || kind === "riwayat" || kind === "translations";
  const isShaarawi = kind === "shaarawi";
  const isMp3 = kind === "mp3";
  const title = isPdf ? t("القرآن PDF", "Quran PDF") : isContact ? t("الاتصال بنا", "Contact us") : t(content.title, ({ "الروايات": "Riwayat", "القراء": "Reciters", "القرآن MP3": "Quran MP3", "التفاسير": "Tafsir", "الترجمات": "Translations", "الباحث القرآني": "Quran search" } as Record<string, string>)[content.title] ?? content.title);
  const subtitle = isPdf ? t("افتح نسخة القرآن بصيغة PDF", "Open the Quran PDF") : isContact ? t("نسعد بملاحظاتك واقتراحاتك", "We welcome your feedback and suggestions") : t(content.subtitle, ({ "اختر الرواية ثم السورة": "Choose a riwayah, then a surah", "اختر القارئ المفضل للاستماع": "Choose your preferred reciter", "اختر القارئ واستمع إلى آخر سورة قرأتها": "Choose a reciter and listen to your last surah", "تدبر المعاني من مصادر التفسير": "Reflect on meanings from tafsir sources", "اقرأ معاني القرآن بلغات مختلفة": "Read Quran meanings in different languages", "ابحث عن كلمة أو آية في القرآن": "Search for a word or ayah in the Quran" } as Record<string, string>)[content.subtitle] ?? content.subtitle);
  const icon = isPdf ? "picture-as-pdf" : isContact ? "mail-outline" : content.icon;
  const lastSura = SURAS.find((sura) => sura.id === lastSuraId) ?? SURAS[35];

  useEffect(() => {
    AsyncStorage.multiGet(["quran.lastSura", "quran.reciter", "quran.tafsir"]).then(([sura, reciter, tafsir]) => {
      if (sura[1]) setLastSuraId(Number(sura[1]));
      if (reciter[1] && content.options.includes(reciter[1])) setSelected(reciter[1]);
      if (tafsir[1] && kind === "tafsir" && content.options.includes(tafsir[1])) setSelected(tafsir[1]);
    });
    if (isMp3) setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    return () => { playerRef.current?.remove(); playerRef.current = null; };
  }, [isMp3, kind]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const current = playerRef.current as unknown as { currentTime?: number; duration?: number } | null;
      if (current) { const nextPosition = current.currentTime ?? 0; setPosition(nextPosition); setDuration(current.duration ?? 0); const reciterCode = ALL_RECITERS.find((item) => item.name === selected)?.code ?? RECITERS[0].code; AsyncStorage.setItem(`quran.position.${lastSura.id}.${reciterCode}`, String(nextPosition)).catch(() => undefined); }
    }, 500);
    return () => clearInterval(timer);
  }, [playing, selected, lastSura.id]);

  useEffect(() => {
    if (kind !== "tafsir") return;
    let active = true;
    setTafsirStatus("loading");
    const slug = TAFSIR_SLUGS[selected] ?? TAFSIR_SLUGS["التفسير الميسر"];
    fetch(`https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/${slug}/${lastSura.id}.json`)
      .then((response) => { if (!response.ok) throw new Error("tafsir"); return response.json(); })
      .then((payload) => { if (!active) return; const rows = Array.isArray(payload) ? payload.filter((item) => item?.text).map((item) => ({ ayah: Number(item.ayah), text: String(item.text) })) : []; setTafsirText(rows); setTafsirStatus(rows.length ? "ready" : "error"); })
      .catch(() => { if (active) setTafsirStatus("error"); });
    return () => { active = false; };
  }, [kind, selected, lastSura.id]);

  const actionLabel = isPdf ? "فتح القرآن PDF" : isContact ? "إرسال رسالة" : kind === "search" ? "فتح البحث" : isMp3 ? (loadingAudio ? "جارٍ التحميل…" : playing ? "إيقاف التلاوة" : `تشغيل سورة ${lastSura.name}`) : "حفظ الاختيار";

  if (isSourceFlow) return <SourceFlow kind={kind as "tafsir" | "riwayat" | "translations"} />;
  if (isShaarawi) return <ShaarawiFlow />;
  if (isMp3) return <Mp3Flow />;
  const choose = (option: string) => { setSelected(option); if (isMp3 || kind === "reciters") AsyncStorage.setItem("quran.reciter", option).catch(() => undefined); if (kind === "tafsir") AsyncStorage.setItem("quran.tafsir", option).catch(() => undefined); };
  const audioUrl = () => { const reciter = ALL_RECITERS.find((item) => item.name === selected) ?? RECITERS[0]; return getRecitationUrl(reciter, lastSura.id); };
  const changeSura = (delta: number) => { const index = SURAS.findIndex((sura) => sura.id === lastSura.id); const next = SURAS[(index + delta + SURAS.length) % SURAS.length]; playerRef.current?.remove(); playerRef.current = null; setPlaying(false); setPosition(0); setDuration(0); setLastSuraId(next.id); AsyncStorage.setItem("quran.lastSura", String(next.id)).catch(() => undefined); };
  const downloadCurrent = async () => { if (kind !== "mp3") return; try { setDownloading(true); setAudioError(""); const reciter = ALL_RECITERS.find((item) => item.name === selected) ?? RECITERS[0]; const localUri = `${FileSystem.documentDirectory}quran-${reciter.code.replace(/[^a-z0-9]/gi, "-")}-${lastSura.id}.mp3`; const info = await FileSystem.getInfoAsync(localUri); if (!info.exists) await FileSystem.downloadAsync(audioUrl(), localUri); await AsyncStorage.setItem(`quran.audio.${lastSura.id}.${reciter.code}`, localUri); setDownloaded(true); } catch { setAudioError("تعذر تنزيل التلاوة. تحقق من الاتصال وحاول مرة أخرى."); } finally { setDownloading(false); } };
  const submitFeedback = async () => {
    const trimmedMessage = feedbackMessage.trim();
    const trimmedEmail = feedbackEmail.trim();
    if (!trimmedMessage) { setFeedbackError("اكتب الملاحظة أو الاقتراح أولًا."); setFeedbackSent(false); return; }
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { setFeedbackError("أدخل بريدًا إلكترونيًا صحيحًا أو اترك الحقل فارغًا."); setFeedbackSent(false); return; }
    setFeedbackError("");
    const body = ["السلام عليكم،", "", `الاسم: ${feedbackName.trim() || "غير مذكور"}`, `البريد: ${trimmedEmail || "غير مذكور"}`, "", "الملاحظة أو الاقتراح:", trimmedMessage].join("\\n");
    const subject = "ملاحظة أو اقتراح حول تطبيق القرآن";
    try {
      if (Platform.OS === "web") {
        setFeedbackError("افتح التطبيق على هاتفك لاستخدام تطبيق البريد الأصلي.");
        setFeedbackSent(false);
        return;
      }
      if (!(await MailComposer.isAvailableAsync())) {
        setFeedbackError("لا يوجد تطبيق بريد مُعدّ على هذا الجهاز. أضف حساب بريد ثم حاول مرة أخرى.");
        setFeedbackSent(false);
        return;
      }
      const result = await MailComposer.composeAsync({ recipients: ["Qurankareem7137@gmail.com"], subject, body });
      if (result.status === "cancelled") { setFeedbackSent(false); return; }
      setFeedbackSent(true);
    } catch {
      setFeedbackError("تعذر فتح تطبيق البريد الأصلي. تحقق من إعداد حساب البريد على الهاتف ثم حاول مرة أخرى.");
      setFeedbackSent(false);
    }
  };

  const primaryAction = async () => {
    if (isPdf) return Linking.openURL("https://quran.com");
    if (isContact) return Linking.openURL("mailto:Qurankareem7137@gmail.com?subject=ملاحظات%20واقتراحات%20حول%20تطبيق%20القرآن&body=السلام%20عليكم،%0A%0Aأرغب%20في%20إرسال%20ملاحظة%20أو%20اقتراح:%0A");
    if (kind === "search") return router.push("/search");
    if (!isMp3) return;
    if (playing) { playerRef.current?.pause(); setPlaying(false); return; }
    try {
      setLoadingAudio(true);
      playerRef.current?.remove();
      const reciter = ALL_RECITERS.find((item) => item.name === selected) ?? RECITERS[0];
      const saved = await AsyncStorage.getItem(`quran.audio.${lastSura.id}.${reciter.code}`);
      const source = saved ?? audioUrl();
      playerRef.current = createAudioPlayer({ uri: source });
      const resume = Number(await AsyncStorage.getItem(`quran.position.${lastSura.id}.${reciter.code}`) ?? 0);
      if (resume > 0) playerRef.current.seekTo(resume);
      playerRef.current.play();
      setAudioError("");
      setPlaying(true);
    } catch { setPlaying(false); setAudioError("تعذر تشغيل التلاوة. تحقق من الاتصال أو نزّل السورة أولًا."); } finally { setLoadingAudio(false); }
  };

  return <ScreenContainer edges={["bottom", "left", "right"]}><View style={styles.root}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-forward" size={22} color="#F0B64A" /></Pressable><Text style={styles.headerTitle}>{title}</Text><View style={styles.back} /></View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}><View style={styles.heroIcon}><MaterialIcons name={icon} size={34} color="#F0B64A" /></View><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text>{isMp3 && <Text style={styles.suraHint}>السورة المختارة: {lastSura.name} · {lastSura.verses} آيات</Text>}</View>
      {isPdf || isContact ? <View style={styles.singleCard}>{isContact ? <><Text style={styles.singleText}>للملاحظات والاقتراحات يمكنكم التواصل معنا مباشرة عبر البريد الإلكتروني.</Text><Text style={styles.contactEmail}>Qurankareem7137@gmail.com</Text><TextInput value={feedbackName} onChangeText={(value) => { setFeedbackName(value); setFeedbackError(""); }} placeholder="الاسم (اختياري)" placeholderTextColor="#737891" style={styles.feedbackInput} textAlign="right" /><TextInput value={feedbackEmail} onChangeText={(value) => { setFeedbackEmail(value); setFeedbackError(""); }} placeholder="البريد الإلكتروني (اختياري)" placeholderTextColor="#737891" style={styles.feedbackInput} textAlign="right" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} /><TextInput value={feedbackMessage} onChangeText={(value) => { setFeedbackMessage(value); setFeedbackError(""); setFeedbackSent(false); }} placeholder="اكتب ملاحظتك أو اقتراحك" placeholderTextColor="#737891" style={[styles.feedbackInput, styles.feedbackMessage]} textAlign="right" multiline numberOfLines={5} textAlignVertical="top" /><Text style={styles.contactNote}>سيتم إضافة واتساب كقناة تواصل لاحقًا.</Text>{feedbackError ? <Text style={styles.feedbackError}>{feedbackError}</Text> : null}{feedbackSent ? <Text style={styles.feedbackSuccess}>تم تجهيز رسالة البريد. راجعها ثم اضغط إرسال.</Text> : null}<Pressable onPress={submitFeedback} style={styles.primary}><MaterialIcons name="mail-outline" size={21} color="#171A35" /><Text style={styles.primaryText}>فتح البريد لإرسال الملاحظة</Text></Pressable></> : <><Text style={styles.singleText}>يمكنك فتح نسخة القراءة من المصدر مباشرة في المتصفح.</Text><Pressable onPress={primaryAction} style={styles.primary}><MaterialIcons name="open-in-new" size={21} color="#171A35" /><Text style={styles.primaryText}>فتح القرآن PDF</Text></Pressable></>}</View> : <View style={styles.options}>{content.options.map((option) => <Pressable key={option} onPress={() => choose(option)} style={[styles.option, selected === option && styles.optionActive]}><View style={[styles.radio, selected === option && styles.radioActive]}>{selected === option && <View style={styles.dot} />}</View><Text style={styles.optionText}>{option}</Text></Pressable>)}<Pressable disabled={loadingAudio} onPress={primaryAction} style={styles.primary}>{loadingAudio ? <ActivityIndicator color="#171A35" /> : <MaterialIcons name={isMp3 ? (playing ? "pause" : "play-arrow") : kind === "search" ? "search" : "check"} size={21} color="#171A35" />}<Text style={styles.primaryText}>{actionLabel}</Text></Pressable></View>}
      {kind === "tafsir" && <View style={styles.tafsirCard}><Text style={styles.tafsirSource}>المصدر: {selected} · السورة: {lastSura.name}</Text>{tafsirStatus === "loading" && <View style={styles.tafsirState}><ActivityIndicator color="#F0B64A" /><Text style={styles.tafsirStateText}>جارٍ تحميل التفسير…</Text></View>}{tafsirStatus === "error" && <Text style={styles.tafsirStateText}>تعذر تحميل التفسير. تحقق من الاتصال ثم اختر التفسير مرة أخرى.</Text>}{tafsirStatus === "ready" && tafsirText.map((item) => <View key={item.ayah} style={styles.tafsirRow}><Text style={styles.tafsirAyah}>الآية {item.ayah}</Text><Text style={styles.tafsirText}>{item.text}</Text></View>)}</View>}
      {isMp3 && <View style={styles.playerCard}><View style={styles.playerTop}><Text style={styles.playerLabel}>{playing ? "التلاوة تعمل الآن" : "جاهز للاستماع"}</Text><Text style={styles.playerTime}>{Math.floor(position / 60)}:{String(Math.floor(position % 60)).padStart(2, "0")} / {duration ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}` : "--:--"}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${duration ? Math.min(100, (position / duration) * 100) : 0}%` }]} /></View><View style={styles.playerNav}><Pressable onPress={() => changeSura(-1)} style={styles.navButton}><MaterialIcons name="skip-next" size={22} color="#F0B64A" /><Text style={styles.navText}></Text></Pressable><Pressable onPress={downloadCurrent} disabled={downloading} style={styles.downloadButton}><MaterialIcons name={downloaded ? "download-done" : "download"} size={20} color="#171A35" /><Text style={styles.downloadText}>{downloading ? "جارٍ التنزيل" : downloaded ? "تم التنزيل" : "دون اتصال"}</Text></Pressable><Pressable onPress={() => changeSura(1)} style={styles.navButton}><Text style={styles.navText}></Text><MaterialIcons name="skip-previous" size={22} color="#F0B64A" /></Pressable></View>{audioError ? <Text style={styles.audioError}>{audioError}</Text> : null}</View>}
      {!isPdf && !isContact && kind !== "search" && kind !== "tafsir" && <Text style={styles.note}>{isMp3 ? "تُحفظ السورة وموضع التلاوة محليًا ويمكن تنزيلها للاستماع دون اتصال." : "سيتم تطبيق اختيارك على تجربة القراءة والاستماع في التطبيق."}</Text>}
    </ScrollView>
  </View></ScreenContainer>;
}

type WebAudioPlayer = { play: () => Promise<void>; pause: () => void; currentTime: number; duration: number; preload: string; onloadedmetadata: (() => void) | null; ontimeupdate: (() => void) | null; onended: (() => void) | null };
type PlaybackMode = "direct" | "playlist" | "favorites";
type PlaylistItem = { suraId: number; suraName: string; reciterCode: string; reciterName: string };

// مراجع مشتركة لا ترتبط بتركيب Mp3Flow؛ لذلك لا يختفي الصوت عند الرجوع للشاشة الرئيسية.
const sharedMp3PlayerRef: { current: ReturnType<typeof createAudioPlayer> | null } = { current: null };
const sharedMp3NativeEndSubscriptionRef: { current: { remove: () => void } | null } = { current: null };
const sharedMp3WebAudioRef: { current: WebAudioPlayer | null } = { current: null };
const sharedMp3PlaybackGenerationRef = { current: 0 };
const SLEEP_TIMER_OPTIONS = [15, 30, 60];

function Mp3Flow() {
  const router = useRouter();
  const { reciter: reciterParam, suraId: suraParam, from: fromParam } = useLocalSearchParams<{ reciter?: string; suraId?: string; from?: string }>();
  const [stage, setStage] = useState<"home" | "queue" | "mujawwad" | "sura" | "player">("home");
  const [reciter, setReciter] = useState<Reciter>(RECITERS[0]);
  const [reciterCatalog, setReciterCatalog] = useState<"murattal" | "mujawwad">("murattal");
  const [sura, setSura] = useState(SURAS[0]);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackWidth, setTrackWidth] = useState(1);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [repeatCurrent, setRepeatCurrent] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("direct");
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);
  const [navigationBusy, setNavigationBusy] = useState(false);
  const playerRef = sharedMp3PlayerRef;
  const nativeEndSubscriptionRef = sharedMp3NativeEndSubscriptionRef;
  const autoPlayRef = useRef(true);
  const playlistRef = useRef<PlaylistItem[]>([]);
  const favoriteTracksRef = useRef<PlaylistItem[]>([]);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackModeRef = useRef<PlaybackMode>("direct");
  const currentTrackRef = useRef({ suraId: SURAS[0].id, reciterCode: RECITERS[0].code, mode: "direct" as PlaybackMode });
  const currentPlaylistIndexRef = useRef<number | null>(null);
  const navigationLockRef = useRef(false);
  const navigationQueueRef = useRef<number[]>([]);
  const navigationProcessingRef = useRef(false);
  const playbackGenerationRef = sharedMp3PlaybackGenerationRef;
  const repeatCurrentRef = useRef(false);
  const sleepStoppingRef = useRef(false);
  const webAudioRef = sharedMp3WebAudioRef;
  const activePulse = useRef(new Animated.Value(1)).current;
  const seekStartFractionRef = useRef(0);
  const trackLayoutRef = useRef({ x: 0, width: 1 });
  const seekingRef = useRef(false);
  const bookmarkPlaybackRef = useRef<string | null>(null);

  // يوجد مشغل صوت واحد فقط على مستوى بطاقة MP3 والمشغل العائم.
  // نوقف ونزيل أي مسار سابق قبل بدء طلب تشغيل جديد حتى لا تتداخل مشغلات native أو web.
  const stopCurrentPlayback = () => {
    nativeEndSubscriptionRef.current?.remove();
    nativeEndSubscriptionRef.current = null;
    try { playerRef.current?.pause(); } catch { /* المشغل قد يكون أُزيل بالفعل */ }
    try { playerRef.current?.remove(); } catch { /* المشغل قد يكون أُزيل بالفعل */ }
    playerRef.current = null;
    try { webAudioRef.current?.pause(); } catch { /* عنصر الصوت قد يكون غير متاح */ }
    webAudioRef.current = null;
  };

  useEffect(() => {
    let active = true;
    AsyncStorage.multiGet(["quran.reciter", "quran.autoplay", "quran.playlist"]).then(([savedReciter, savedAutoplay, savedPlaylist]) => {
      if (!active) return;
      if (!reciterParam && savedReciter[1]) {
        const match = RECITERS.find((item) => item.name === savedReciter[1]);
        if (match) setReciter(match);
      }
      if (savedAutoplay[1] !== null) {
        const enabled = savedAutoplay[1] !== "false";
        autoPlayRef.current = enabled;
        setAutoPlayEnabled(enabled);
      }
      if (savedPlaylist[1]) {
        try {
          const savedItems = JSON.parse(savedPlaylist[1]) as Array<number | PlaylistItem>;
          const restored = savedItems.map((entry) => {
            if (typeof entry === "number") {
              const legacySura = SURAS.find((item) => item.id === entry);
              return legacySura ? { suraId: legacySura.id, suraName: legacySura.name, reciterCode: RECITERS[0].code, reciterName: RECITERS[0].name } : null;
            }
            const restoredSura = SURAS.find((item) => item.id === entry.suraId);
            const restoredReciter = ALL_RECITERS.find((item) => item.code === entry.reciterCode);
            return restoredSura && restoredReciter ? { suraId: restoredSura.id, suraName: restoredSura.name, reciterCode: restoredReciter.code, reciterName: restoredReciter.name } : null;
          }).filter((item): item is PlaylistItem => Boolean(item));
          playlistRef.current = restored;
          setPlaylist(restored);
        } catch { setPlaylist([]); }
      }
    }).catch(() => undefined);
    loadBookmarks().then((stored) => {
      favoriteTracksRef.current = stored.filter((item) => item.kind === "mp3" && item.reciterCode && item.suraId).sort((a, b) => a.createdAt - b.createdAt).map((item) => ({ suraId: item.suraId, suraName: item.suraName, reciterCode: item.reciterCode!, reciterName: item.reciterName ?? "" }));
    }).catch(() => undefined);
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    return () => { active = false; navigationLockRef.current = false; if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current); countdownTimerRef.current = null; if (sleepTimerRef.current) clearInterval(sleepTimerRef.current); sleepTimerRef.current = null; };
  }, []);

  useEffect(() => {
    const requestedReciter = typeof reciterParam === "string" ? ALL_RECITERS.find((item) => item.code === reciterParam) : undefined;
    const requestedSura = typeof suraParam === "string" ? SURAS.find((item) => item.id === Number(suraParam)) : undefined;
    if (!requestedReciter && !requestedSura) return;
    if (requestedReciter) setReciter(requestedReciter);
    if (requestedSura) setSura(requestedSura);
    setStage("player");
  }, [reciterParam, suraParam]);

  useEffect(() => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    if (sleepTimerRemaining === null) { sleepTimerRef.current = null; return; }
    sleepTimerRef.current = setInterval(() => {
      setSleepTimerRemaining((remaining) => {
        if (remaining === null || remaining <= 1) {
          if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
          sleepTimerRef.current = null;
          sleepStoppingRef.current = true;
          if (Platform.OS === "web") webAudioRef.current?.pause(); else playerRef.current?.pause();
          setPlaying(false);
          setSleepTimerMinutes(null);
          return null;
        }
        return remaining - 1;
      });
    }, 1000);
    return () => { if (sleepTimerRef.current) clearInterval(sleepTimerRef.current); sleepTimerRef.current = null; };
  }, [sleepTimerRemaining]);

  useEffect(() => {
    if (!playing) {
      activePulse.stopAnimation();
      activePulse.setValue(1);
      return;
    }
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(activePulse, { toValue: 0.62, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(activePulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [playing, activePulse]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const player = Platform.OS === "web" ? webAudioRef.current : playerRef.current as unknown as { currentTime?: number; duration?: number } | null;
      if (!player) return;
      if (seekingRef.current) return;
      const nextPosition = player.currentTime ?? 0;
      setPosition(nextPosition);
      setDuration(player.duration ?? 0);
      AsyncStorage.setItem(`quran.position.${sura.id}.${reciter.code}`, String(nextPosition)).catch(() => undefined);
    }, 500);
    return () => clearInterval(timer);
  }, [playing, reciter.code, sura.id]);

  const chooseReciter = (item: Reciter) => {
    // فتح فهرس قارئ آخر لا يوقف التلاوة الحالية؛ إيقاف المسار يحدث فقط
    // عندما يطلب المستخدم تشغيل سورة جديدة من الفهرس الجديد.
    setReciter(item);
    setError("");
    AsyncStorage.setItem("quran.reciter", item.name).catch(() => undefined);
    setStage("sura");
  };

  const toggleRepeatMode = () => {
    const next = !repeatCurrentRef.current;
    repeatCurrentRef.current = next;
    setRepeatCurrent(next);
  };

  const toggleAutoPlay = () => {
    const next = !autoPlayRef.current;
    autoPlayRef.current = next;
    setAutoPlayEnabled(next);
    AsyncStorage.setItem("quran.autoplay", String(next)).catch(() => undefined);
    if (!next && countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
      setCountdown(null);
    }
  };

  const togglePlaylist = (item: typeof SURAS[number]) => {
    const playlistItem: PlaylistItem = { suraId: item.id, suraName: item.name, reciterCode: reciter.code, reciterName: reciter.name };
    const exists = playlistRef.current.some((entry) => entry.suraId === item.id && entry.reciterCode === reciter.code);
    const next = exists ? playlistRef.current.filter((entry) => !(entry.suraId === item.id && entry.reciterCode === reciter.code)) : [...playlistRef.current, playlistItem];
    playlistRef.current = next;
    setPlaylist(next);
    AsyncStorage.setItem("quran.playlist", JSON.stringify(next)).catch(() => undefined);
  };

  const removePlaylistItem = (item: PlaylistItem) => {
    const removedIndex = playlistRef.current.findIndex((entry) => entry.suraId === item.suraId && entry.reciterCode === item.reciterCode);
    const next = playlistRef.current.filter((entry) => !(entry.suraId === item.suraId && entry.reciterCode === item.reciterCode));
    if (currentPlaylistIndexRef.current !== null) {
      if (removedIndex === currentPlaylistIndexRef.current) currentPlaylistIndexRef.current = null;
      else if (removedIndex >= 0 && removedIndex < currentPlaylistIndexRef.current) currentPlaylistIndexRef.current -= 1;
    }
    playlistRef.current = next;
    setPlaylist(next);
    AsyncStorage.setItem("quran.playlist", JSON.stringify(next)).catch(() => undefined);
  };

  const queueNextSura = (currentSuraId: number, mode: PlaybackMode = playbackModeRef.current, currentReciterCode = reciter.code) => {
    if (sleepStoppingRef.current) {
      sleepStoppingRef.current = false;
      setPlaying(false);
      return;
    }
    if (!autoPlayRef.current) {
      setPlaying(false);
      return;
    }
    const queue = playlistRef.current;
    const queueIndex = queue.findIndex((entry) => entry.suraId === currentSuraId && entry.reciterCode === currentReciterCode);
    const sequentialIndex = SURAS.findIndex((entry) => entry.id === currentSuraId);
    const favorites = favoriteTracksRef.current;
    const favoriteIndex = favorites.findIndex((entry) => entry.suraId === currentSuraId && entry.reciterCode === currentReciterCode);
    const next = mode === "playlist"
      ? queueIndex >= 0 && queueIndex < queue.length - 1 ? queue[queueIndex + 1] : undefined
      : mode === "favorites"
        ? favoriteIndex >= 0 && favoriteIndex < favorites.length - 1 ? favorites[favoriteIndex + 1] : undefined
        : sequentialIndex >= 0 && sequentialIndex < SURAS.length - 1 ? SURAS[sequentialIndex + 1] : undefined;
    if (!next) {
      setPlaying(false);
      setCountdown(null);
      return;
    }
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    setPlaying(false);
    setCountdown(1);
    countdownTimerRef.current = setTimeout(() => {
      countdownTimerRef.current = null;
      setCountdown(null);
      if (mode === "playlist") void playPlaylistItem(next as PlaylistItem); else if (mode === "favorites") { const favorite = next as PlaylistItem; setReciter(RECITERS.find((item) => item.code === favorite.reciterCode) ?? reciter); void playSura(SURAS.find((item) => item.id === favorite.suraId)!, "favorites", RECITERS.find((item) => item.code === favorite.reciterCode) ?? reciter); } else void playSura(next as typeof SURAS[number], mode);
    }, 500);
  };

  const playPlaylistItem = (item: PlaylistItem) => {
    const playlistIndex = playlistRef.current.findIndex((entry) => entry.suraId === item.suraId && entry.reciterCode === item.reciterCode);
    currentPlaylistIndexRef.current = playlistIndex >= 0 ? playlistIndex : null;
    const itemSura = SURAS.find((entry) => entry.id === item.suraId);
    const itemReciter = ALL_RECITERS.find((entry) => entry.code === item.reciterCode);
    if (!itemSura || !itemReciter) return;
    setReciter(itemReciter);
    void playSura(itemSura, "playlist", itemReciter);
  };

  const playPlaylistNow = () => {
    if (!playlistRef.current.length) {
      setError("أضف سورًا إلى قائمة التشغيل أولًا من زر الإضافة بجانب كل سورة.");
      return;
    }
    playPlaylistItem(playlistRef.current[0]);
  };

  const setSleepTimer = (minutes: number | null) => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    sleepTimerRef.current = null;
    setSleepTimerMinutes(minutes);
    setSleepTimerRemaining(minutes === null ? null : minutes * 60);
  };

  const playSura = async (item: typeof SURAS[number], mode: PlaybackMode = "direct", selectedReciter = reciter) => {
    item = selectedReciter.externalTitles?.[item.id] ? { ...item, name: getRecitationTitle(selectedReciter, item.id, item.name) } : item;
    const playbackGeneration = ++playbackGenerationRef.current;
    try {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
      setCountdown(null);
      playbackModeRef.current = mode;
      if (mode === "playlist") currentPlaylistIndexRef.current = playlistRef.current.findIndex((entry) => entry.suraId === item.id && entry.reciterCode === selectedReciter.code);
      else if (mode === "favorites") currentPlaylistIndexRef.current = favoriteTracksRef.current.findIndex((entry) => entry.suraId === item.id && entry.reciterCode === selectedReciter.code);
      else currentPlaylistIndexRef.current = null;
      currentTrackRef.current = { suraId: item.id, reciterCode: selectedReciter.code, mode };
      setReciter(selectedReciter);
      setPlaybackMode(mode);
      sleepStoppingRef.current = false;
      setSura(item);
      // كل طرق التشغيل تستخدم مشغل قائمة التشغيل العلوي نفسه؛ لا توجد واجهة player ثانية.
      setStage("player");
      setLoading(true);
      setError("");
      // الإيقاف يتم قبل أي انتظار للشبكة أو التخزين؛ لذلك لا يبقى المسار السابق يعمل أثناء تجهيز الجديد.
      stopCurrentPlayback();
      const localUri = await AsyncStorage.getItem(`quran.audio.${item.id}.${selectedReciter.code}`);
      const directSource = getRecitationUrl(selectedReciter, item.id);
      const source = selectedReciter.code === "afs" && item.id === 1 ? directSource : (localUri ?? directSource);
      const savedPosition = Number(await AsyncStorage.getItem(`quran.position.${item.id}.${selectedReciter.code}`) ?? 0);
      if (playbackGeneration !== playbackGenerationRef.current) return;
      if (Platform.OS === "web") {
        const audio = new window.Audio(source) as unknown as WebAudioPlayer;
        audio.preload = "metadata";
        audio.onloadedmetadata = () => { setDuration(audio.duration || 0); if (savedPosition > 0) audio.currentTime = Math.min(savedPosition, audio.duration || savedPosition); };
        audio.ontimeupdate = () => { setPosition(audio.currentTime || 0); setDuration(audio.duration || 0); };
        audio.onended = () => {
          if (playbackGeneration !== playbackGenerationRef.current) return;
          if (repeatCurrentRef.current) {
            audio.currentTime = 0;
            void audio.play();
            setPosition(0);
            setPlaying(true);
          } else queueNextSura(item.id, mode, selectedReciter.code);
        };
        webAudioRef.current = audio;
        if (savedPosition > 0) audio.currentTime = savedPosition;
        await audio.play();
      } else {
        const player = createAudioPlayer({ uri: source });
        playerRef.current = player;
        nativeEndSubscriptionRef.current = player.addListener("playbackStatusUpdate", (status) => {
          if (status.didJustFinish && playbackGeneration === playbackGenerationRef.current) {
            setPosition(status.currentTime);
            setDuration(status.duration);
            if (repeatCurrentRef.current) {
              player.seekTo(0);
              player.play();
              setPosition(0);
              setPlaying(true);
            } else queueNextSura(item.id, mode, selectedReciter.code);
          }
        });
        if (savedPosition > 0) player.seekTo(savedPosition);
        player.play();
      }
      if (playbackGeneration !== playbackGenerationRef.current) return;
      setPosition(savedPosition);
      setPlaying(true);
      publishMiniPlayer({ title: item.name, subtitle: selectedReciter.name, playing: true, toggle: togglePlayback, previous: () => changeSura(-1), next: () => changeSura(1), open: () => setStage("player") });
      await AsyncStorage.setItem("quran.lastSura", String(item.id));
      if (playbackGeneration !== playbackGenerationRef.current) return;
      if (selectedReciter.code !== reciter.code) await AsyncStorage.setItem("quran.reciter", selectedReciter.name);
    } catch {
      if (playbackGeneration === playbackGenerationRef.current) {
        setPlaying(false);
        setError("تعذر تشغيل التلاوة. تحقق من الاتصال أو جرّب قارئًا آخر.");
      }
    } finally {
      if (playbackGeneration === playbackGenerationRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    const requestedReciter = typeof reciterParam === "string" ? ALL_RECITERS.find((item) => item.code === reciterParam) : undefined;
    const requestedSura = typeof suraParam === "string" ? SURAS.find((item) => item.id === Number(suraParam)) : undefined;
    if (!requestedReciter || !requestedSura) return;
    const key = `${fromParam === "favorites" ? "favorites" : "direct"}:${requestedReciter.code}:${requestedSura.id}`;
    if (bookmarkPlaybackRef.current === key) return;
    bookmarkPlaybackRef.current = key;
    if (fromParam === "favorites") {
      void loadBookmarks().then((stored) => {
        favoriteTracksRef.current = stored.filter((item) => item.kind === "mp3" && item.reciterCode && item.suraId).sort((a, b) => a.createdAt - b.createdAt).map((item) => ({ suraId: item.suraId, suraName: item.suraName, reciterCode: item.reciterCode!, reciterName: item.reciterName ?? "" }));
        return playSura(requestedSura, "favorites", requestedReciter);
      });
    } else void playSura(requestedSura, "direct", requestedReciter);
  }, [fromParam, reciterParam, suraParam]);

  const seekToFraction = (fraction: number) => {
    if (!Number.isFinite(fraction)) return;
    const bounded = Math.max(0, Math.min(1, fraction));
    const currentDuration = Platform.OS === "web" ? (webAudioRef.current?.duration || duration) : duration;
    if (!Number.isFinite(currentDuration) || currentDuration <= 0) return;
    const next = bounded >= 1 ? Math.max(0, currentDuration - 0.25) : bounded * currentDuration;
    try {
      if (Platform.OS === "web") {
        const audio = webAudioRef.current;
        if (!audio) return;
        audio.currentTime = next;
      } else {
        const player = playerRef.current as unknown as { seekTo?: (value: number) => void } | null;
        if (!player?.seekTo) return;
        player.seekTo(next);
      }
      setPosition(next);
    } catch {
      setError("تعذر تغيير موضع التلاوة. حاول مرة أخرى.");
    }
  };

  const handleTrackLayout = (event: { nativeEvent: { layout: { x: number; width: number } } }) => {
    const width = Math.max(1, event.nativeEvent.layout.width);
    trackLayoutRef.current = { x: event.nativeEvent.layout.x, width };
    setTrackWidth(width);
  };

  const seekResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => trackLayoutRef.current.width > 0 && duration > 0,
    onMoveShouldSetPanResponder: () => trackLayoutRef.current.width > 0 && duration > 0,
    onPanResponderGrant: (event) => {
      seekingRef.current = true;
      const nativeEvent = event.nativeEvent as { locationX?: number; offsetX?: number; pageX?: number };
      const localX = nativeEvent.locationX ?? nativeEvent.offsetX ?? ((nativeEvent.pageX ?? 0) - trackLayoutRef.current.x);
      seekStartFractionRef.current = Math.max(0, Math.min(1, localX / trackLayoutRef.current.width));
      seekToFraction(seekStartFractionRef.current);
    },
    onPanResponderMove: (event, gestureState) => {
      const nativeEvent = event.nativeEvent as { locationX?: number; offsetX?: number; pageX?: number };
      const localX = nativeEvent.locationX ?? nativeEvent.offsetX ?? ((nativeEvent.pageX ?? 0) - trackLayoutRef.current.x);
      const fraction = Number.isFinite(localX) && localX > 0 ? localX / trackLayoutRef.current.width : seekStartFractionRef.current + gestureState.dx / trackLayoutRef.current.width;
      seekToFraction(fraction);
    },
    onPanResponderRelease: () => { seekingRef.current = false; seekStartFractionRef.current = 0; },
    onPanResponderTerminate: () => { seekingRef.current = false; seekStartFractionRef.current = 0; },
    onPanResponderTerminationRequest: () => false,
  });

  const togglePlayback = () => {
    if (loading) return;
        if (Platform.OS === "web") {
          const audio = webAudioRef.current;
          if (!audio) return;
          if (playing) {
            audio.pause();
            if (webAudioRef.current === audio) { setPlaying(false); publishMiniPlayer({ title: sura.name, subtitle: reciter.name, playing: false, toggle: togglePlayback, previous: () => changeSura(-1), next: () => changeSura(1), open: () => setStage("player") }); }
      } else {
        Promise.resolve(audio.play()).then(() => {
          if (webAudioRef.current === audio) { setPlaying(true); publishMiniPlayer({ title: sura.name, subtitle: reciter.name, playing: true, toggle: togglePlayback, previous: () => changeSura(-1), next: () => changeSura(1), open: () => setStage("player") }); }
        }).catch(() => {
          if (webAudioRef.current === audio) {
            setPlaying(false);
            setError("تعذر تشغيل الصوت في المتصفح. اضغط تشغيل مرة أخرى أو تحقق من الاتصال.");
          }
        });
      }
      return;
    }
    const player = playerRef.current;
    if (!player) return;
    try {
      if (playing) {
        player.pause();
        if (playerRef.current === player) { setPlaying(false); publishMiniPlayer({ title: sura.name, subtitle: reciter.name, playing: false, toggle: togglePlayback, previous: () => changeSura(-1), next: () => changeSura(1), open: () => setStage("player") }); }
      } else {
        Promise.resolve(player.play()).then(() => {
          if (playerRef.current === player) { setPlaying(true); publishMiniPlayer({ title: sura.name, subtitle: reciter.name, playing: true, toggle: togglePlayback, previous: () => changeSura(-1), next: () => changeSura(1), open: () => setStage("player") }); }
        }).catch(() => {
          if (playerRef.current === player) {
            setPlaying(false);
            setError("تعذر تشغيل التلاوة. اضغط تشغيل مرة أخرى أو تحقق من الاتصال.");
          }
        });
      }
    } catch {
      setPlaying(false);
      setError("تعذر تشغيل التلاوة. اضغط تشغيل مرة أخرى أو تحقق من الاتصال.");
    }
  };

  const processNavigationQueue = async () => {
    if (navigationProcessingRef.current) return;
    navigationProcessingRef.current = true;
    navigationLockRef.current = true;
    setNavigationBusy(true);
    try {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
      setCountdown(null);
      playbackGenerationRef.current += 1;
      while (navigationQueueRef.current.length > 0) {
        const delta = navigationQueueRef.current.shift() ?? 1;
        const currentTrack = currentTrackRef.current;
        if (currentTrack.mode === "playlist" || currentTrack.mode === "favorites") {
          const queue = currentTrack.mode === "favorites" ? favoriteTracksRef.current : playlistRef.current;
          const currentIndex = queue.findIndex((item) => item.suraId === currentTrack.suraId && item.reciterCode === currentTrack.reciterCode);
          const nextIndex = currentIndex + delta;
          const nextItem = currentIndex >= 0 && nextIndex >= 0 && nextIndex < queue.length ? queue[nextIndex] : null;
          if (!nextItem) { setError(delta > 0 ? "وصلت إلى نهاية قائمة التشغيل." : "أنت في بداية قائمة التشغيل."); continue; }
          const nextSura = SURAS.find((item) => item.id === nextItem.suraId);
          const nextReciter = RECITERS.find((item) => item.code === nextItem.reciterCode);
          if (nextSura && nextReciter) await playSura(nextSura, currentTrack.mode, nextReciter);
          continue;
        }
        const index = SURAS.findIndex((item) => item.id === currentTrack.suraId);
        if (index < 0) continue;
        const next = SURAS[(index + delta + SURAS.length) % SURAS.length];
        const currentReciter = RECITERS.find((item) => item.code === currentTrack.reciterCode) ?? reciter;
        await playSura(next, "direct", currentReciter);
      }
    } finally {
      navigationProcessingRef.current = false;
      navigationLockRef.current = false;
      setNavigationBusy(false);
    }
  };

  const changeSura = (delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    navigationQueueRef.current.push(delta > 0 ? 1 : -1);
    void processNavigationQueue();
  };

  useEffect(() => {
    if (stage !== "player") return;
    publishMiniPlayer({
      title: sura.name,
      subtitle: reciter.name,
      playing,
      toggle: togglePlayback,
      previous: () => changeSura(-1),
      next: () => changeSura(1),
      open: () => setStage("player"),
    });
  }, [stage, sura.id, sura.name, reciter.code, reciter.name, playing, loading, playbackMode]);

  return <ScreenContainer edges={["bottom", "left", "right"]}><View style={mp3Styles.root}>
    <View style={mp3Styles.header}><Pressable onPress={() => fromParam === "favorites" ? router.back() : stage === "home" ? router.back() : setStage(stage === "player" ? "sura" : stage === "sura" ? (reciterCatalog === "mujawwad" ? "mujawwad" : "home") : stage === "mujawwad" ? "home" : "home")} style={mp3Styles.back}><MaterialIcons name="arrow-forward" size={20} color="#F0B64A" /></Pressable><Text style={mp3Styles.headerTitle}>{stage === "mujawwad" ? "القرآن المجود" : "القرآن MP3"}</Text></View>
    <ScrollView contentContainerStyle={mp3Styles.content}>
      {stage === "home" && <><Pressable onPress={() => setStage("queue")} style={mp3Styles.queueEntry}><MaterialIcons name="playlist-play" size={28} color="#F0B64A" /><View style={mp3Styles.queueEntryCopy}><Text style={mp3Styles.queueEntryTitle}>قائمة التشغيل</Text><Text style={mp3Styles.queueEntrySubtitle}>اضغط لعرض السور المضافة فقط</Text></View></Pressable><Pressable onPress={() => { setReciterCatalog("mujawwad"); setStage("mujawwad"); }} style={mp3Styles.mujawwadCard}><View style={mp3Styles.mujawwadIcon}><MaterialIcons name="auto-stories" size={27} color="#F0B64A" /></View><View style={mp3Styles.queueEntryCopy}><Text style={mp3Styles.mujawwadTitle}>القرآن المجود</Text><Text style={mp3Styles.mujawwadSubtitle}>استمع إلى تلاوات كبار القراء بالتجويد</Text><Text style={mp3Styles.mujawwadCount}>{MUJAWWAD_RECITERS.length} قراء متاحون</Text></View><MaterialIcons name="chevron-left" size={23} color="#F0B64A" /></Pressable><View style={mp3Styles.sectionLabel}><MaterialIcons name="headphones" size={20} color="#F0B64A" /><Text style={mp3Styles.sectionLabelText}>القراء</Text></View><View style={mp3Styles.list}>{RECITERS.map((item) => <Pressable key={item.code} onPress={() => { setReciterCatalog("murattal"); chooseReciter(item); }} style={mp3Styles.option}><MaterialIcons name="chevron-left" size={21} color="#A6ABC7" /><Text style={mp3Styles.optionText}>{item.name}</Text></Pressable>)}</View></>}
      {stage === "mujawwad" && <><View style={mp3Styles.hero}><MaterialIcons name="auto-stories" size={38} color="#F0B64A" /><Text style={mp3Styles.title}>القرآن المجود</Text><Text style={mp3Styles.subtitle}>اختر قارئًا للاستماع إلى المصحف المجود كاملًا</Text></View><View style={mp3Styles.list}>{MUJAWWAD_RECITERS.map((item) => <Pressable key={item.code} onPress={() => { setReciterCatalog("mujawwad"); chooseReciter(item); }} style={mp3Styles.option}><MaterialIcons name="chevron-left" size={21} color="#F0B64A" /><Text style={mp3Styles.optionText}>{item.name}</Text></Pressable>)}</View></>}
      {stage === "queue" && <>{(loading || playing || duration > 0) && <View style={mp3Styles.queuePlayer}><Text style={mp3Styles.queuePlayerLabel}>المشغل الآن</Text><Text style={mp3Styles.queuePlayerTitle}>{sura.name}</Text><Text style={mp3Styles.queuePlayerReciter}>{reciter.name}</Text><Text style={mp3Styles.time}>{Math.floor(position / 60)}:{String(Math.floor(position % 60)).padStart(2, "0")} / {duration ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}` : "--:--"}</Text><Pressable onLayout={handleTrackLayout} {...seekResponder.panHandlers} style={mp3Styles.track}><View style={[mp3Styles.fill, { width: `${duration ? Math.min(100, (position / duration) * 100) : 0}%` }]} /></Pressable><View style={mp3Styles.queuePlayerControls}><Pressable onPress={() => changeSura(-1)} disabled={loading} style={mp3Styles.miniNavButton}><MaterialIcons name="arrow-forward-ios" size={16} color="#F0B64A" /></Pressable><Pressable onPress={togglePlayback} disabled={loading} style={mp3Styles.queuePlayButton}><MaterialIcons name={playing ? "pause" : "play-arrow"} size={20} color="#171A35" /></Pressable><Pressable onPress={() => changeSura(1)} disabled={loading} style={mp3Styles.miniNavButton}><MaterialIcons name="arrow-back-ios" size={16} color="#F0B64A" /></Pressable><Text style={mp3Styles.queuePlayerState}>{loading ? "جارٍ التحميل…" : playing ? "تعمل الآن" : "متوقفة"}</Text></View></View>}<View style={mp3Styles.libraryCard}><View style={mp3Styles.libraryHeader}><View><Text style={mp3Styles.libraryTitle}>قائمة التشغيل</Text><Text style={mp3Styles.libraryHint}>{playlist.length ? `${playlist.length} ملفات صوتية` : "لا توجد سور مضافة بعد"}</Text></View>{playlist.length > 0 && <Pressable onPress={playPlaylistNow} style={mp3Styles.queuePlayButton}><MaterialIcons name="play-arrow" size={18} color="#171A35" /></Pressable>}</View>{playlist.length > 0 ? playlist.map((item, index) => { const isCurrent = playbackMode === "playlist" && playing && item.suraId === sura.id && item.reciterCode === reciter.code; return <Pressable key={`${item.suraId}-${item.reciterCode}`} onPress={() => playPlaylistItem(item)} style={({ pressed }) => [mp3Styles.libraryRow, isCurrent && mp3Styles.queueRowActive, pressed && mp3Styles.rowPressed]}><Text style={[mp3Styles.queueIndex, isCurrent && mp3Styles.queueIndexActive]}>{index + 1}</Text><View style={mp3Styles.queueCopy}><Text style={[mp3Styles.queueName, isCurrent && mp3Styles.queueNameActive]}>{item.suraName}</Text><Text style={mp3Styles.queueReciter}>{item.reciterName}</Text></View><MaterialIcons name={isCurrent ? "graphic-eq" : "play-circle-outline"} size={20} color={isCurrent ? "#171A35" : "#F0B64A"} /><Pressable onPress={(event) => { event.stopPropagation(); removePlaylistItem(item); }} style={mp3Styles.removeButton}><MaterialIcons name="close" size={18} color="#A6ABC7" /></Pressable></Pressable>; }) : <Text style={mp3Styles.emptyLibrary}>أضف سورًا من فهرس أي قارئ لتظهر هنا فقط.</Text>}</View></>}
      {stage === "sura" && <><View style={mp3Styles.hero}><Text style={mp3Styles.title}>{reciter.name}</Text><Text style={mp3Styles.subtitle}>اضغط اسم السورة للتشغيل المباشر، أو استخدم زر الإضافة لبناء قائمة مستقلة</Text></View><View style={mp3Styles.list}>{SURAS.filter((item) => !reciter.availableSuras || reciter.availableSuras.includes(item.id)).map((item) => { const inPlaylist = playlist.some((entry) => entry.suraId === item.id && entry.reciterCode === reciter.code); return <Pressable key={item.id} onPress={() => playSura(item)} style={mp3Styles.option}><View style={mp3Styles.number}><Text style={mp3Styles.numberText}>{item.id}</Text></View><View style={mp3Styles.copy}><Text style={mp3Styles.optionText}>{getRecitationTitle(reciter, item.id, item.name)}</Text><Text style={mp3Styles.meta}>{reciter.externalTitles?.[item.id] ? "حفلة مجودة وتسجيل خارجي · MP3" : `${item.latin} · ${item.verses} آيات`}</Text></View><Pressable onPress={(event) => { event.stopPropagation(); togglePlaylist(item); }} style={mp3Styles.queueButton}><MaterialIcons name={inPlaylist ? "playlist-add-check" : "playlist-add"} size={23} color="#F0B64A" /></Pressable><BookmarkButton bookmark={{ id: bookmarkId("mp3", item.id, undefined, undefined, reciter.code), kind: "mp3", suraId: item.id, suraName: item.name, reciterCode: reciter.code, reciterName: reciter.name, scope: reciter.code, title: `${getRecitationTitle(reciter, item.id, `سورة ${item.name}`)} · ${reciter.name}`, subtitle: "تسجيل صوتي محفوظ ضمن بطاقة القرآن المجود", createdAt: Date.now() }} /><MaterialIcons name="play-circle-outline" size={22} color="#F0B64A" /></Pressable>; })}</View></>}
      {stage === "player" && <><View style={mp3Styles.hero}><MaterialIcons name="graphic-eq" size={38} color="#F0B64A" /><Text style={mp3Styles.title}>{sura.name}</Text><Text style={mp3Styles.subtitle}>{reciter.name} · {playbackMode === "playlist" ? "تشغيل من القائمة" : "تشغيل مباشر"}</Text>{countdown !== null && <Text style={mp3Styles.countdown}>السورة التالية خلال {countdown} ثوانٍ</Text>}</View><View style={mp3Styles.player}><Text style={mp3Styles.playerState}>{loading ? "جارٍ تحميل التلاوة…" : playing ? "التلاوة تعمل الآن" : countdown !== null ? "يستعد للسورة التالية" : "التلاوة متوقفة"}</Text><Text style={mp3Styles.time}>{Math.floor(position / 60)}:{String(Math.floor(position % 60)).padStart(2, "0")} / {duration ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}` : "--:--"}</Text><Pressable onLayout={handleTrackLayout} {...seekResponder.panHandlers} style={mp3Styles.track}><View style={[mp3Styles.fill, { width: `${duration ? Math.min(100, (position / duration) * 100) : 0}%` }]} /></Pressable><View style={mp3Styles.controls}><Pressable onPress={() => changeSura(-1)} disabled={navigationBusy} style={[mp3Styles.iconControl, navigationBusy && mp3Styles.controlDisabled]} accessibilityLabel="السورة السابقة"><MaterialIcons name="skip-next" size={26} color="#F0B64A" /></Pressable><Pressable disabled={loading} onPress={togglePlayback} style={mp3Styles.play}><MaterialIcons name={playing ? "pause" : "play-arrow"} size={32} color="#171A35" /></Pressable><Pressable onPress={() => changeSura(1)} disabled={navigationBusy} style={[mp3Styles.iconControl, navigationBusy && mp3Styles.controlDisabled]} accessibilityLabel="السورة التالية"><MaterialIcons name="skip-previous" size={26} color="#F0B64A" /></Pressable></View><View style={mp3Styles.compactTools}><Pressable onPress={toggleRepeatMode} style={[mp3Styles.modeButton, repeatCurrent && mp3Styles.modeButtonActive]} accessibilityLabel={repeatCurrent ? "إلغاء تكرار السورة" : "تكرار السورة"}><MaterialIcons name="repeat-one" size={18} color={repeatCurrent ? "#171A35" : "#F0B64A"} /></Pressable><View style={mp3Styles.sleepWrap}><Pressable onPress={() => setSleepMenuOpen((open) => !open)} style={mp3Styles.sleepPicker} accessibilityLabel="اختيار مدة مؤقت النوم"><MaterialIcons name="bedtime" size={17} color="#F0B64A" /><Text style={mp3Styles.sleepPickerText}>{sleepTimerMinutes === null ? "مؤقت النوم" : `${sleepTimerMinutes} د`}</Text><MaterialIcons name={sleepMenuOpen ? "expand-less" : "expand-more"} size={18} color="#F0B64A" /></Pressable>{sleepMenuOpen && <View style={mp3Styles.sleepMenu}><Pressable onPress={() => { setSleepTimer(null); setSleepMenuOpen(false); }} style={[mp3Styles.sleepOption, sleepTimerMinutes === null && mp3Styles.sleepOptionActive]}><Text style={mp3Styles.sleepOptionText}>إيقاف</Text></Pressable>{SLEEP_TIMER_OPTIONS.map((minutes) => <Pressable key={minutes} onPress={() => { setSleepTimer(minutes); setSleepMenuOpen(false); }} style={[mp3Styles.sleepOption, sleepTimerMinutes === minutes && mp3Styles.sleepOptionActive]}><Text style={mp3Styles.sleepOptionText}>{minutes} د</Text></Pressable>)}</View>}</View>{sleepTimerRemaining !== null && <Text style={mp3Styles.sleepStatus}>{Math.ceil(sleepTimerRemaining / 60)} د</Text>}</View>{error ? <Text style={mp3Styles.error}>{error}</Text> : null}</View></>}
    </ScrollView>
  </View></ScreenContainer>;
}

const mp3Styles = StyleSheet.create({
  mujawwadCard: { minHeight: 82, borderRadius: 18, backgroundColor: "#171C3B", borderWidth: 1, borderColor: "#80663B", paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row-reverse", alignItems: "center", gap: 11, marginBottom: 14 },
  mujawwadIcon: { width: 47, height: 47, borderRadius: 16, backgroundColor: "#292D4D", alignItems: "center", justifyContent: "center" },
  mujawwadTitle: { color: "#F0B64A", fontSize: 17, fontWeight: "800", textAlign: "right" },
  mujawwadSubtitle: { color: "#A6ABC7", fontSize: 11, marginTop: 3, textAlign: "right" },
  mujawwadCount: { color: "#D7B56B", fontSize: 10, marginTop: 3, textAlign: "right" }, root: { flex: 1, backgroundColor: "#080A1F" }, header: { height: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#292D4D" }, back: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#151B3D", alignItems: "center", justifyContent: "center" }, headerTitle: { color: "#F7F4EC", fontSize: 18, fontWeight: "800" }, content: { paddingHorizontal: 7, paddingTop: 5, paddingBottom: 12 }, hero: { alignItems: "center", backgroundColor: "#11152F", borderRadius: 11, padding: 7, marginBottom: 5, gap: 2 }, title: { color: "#F7F4EC", fontSize: 18, fontWeight: "800", textAlign: "center" }, subtitle: { color: "#A6ABC7", fontSize: 12, textAlign: "center", lineHeight: 18 }, list: { backgroundColor: "#121630", borderRadius: 17, overflow: "hidden" }, option: { minHeight: 54, paddingHorizontal: 11, borderBottomWidth: 1, borderBottomColor: "#292D4D", flexDirection: "row-reverse", alignItems: "center", gap: 12 }, optionText: { flex: 1, color: "#F7F4EC", textAlign: "right", fontSize: 16, fontWeight: "700" }, number: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#F1D39A", alignItems: "center", justifyContent: "center" }, numberText: { color: "#7C5420", fontWeight: "800" }, copy: { flex: 1 }, meta: { color: "#A6ABC7", fontSize: 11, textAlign: "right", marginTop: 3 }, libraryCard: { backgroundColor: "#11152F", borderRadius: 16, padding: 14, marginBottom: 14 }, queuePlayer: { backgroundColor: "#11152F", borderRadius: 16, padding: 14, marginBottom: 12 }, queuePlayerLabel: { color: "#F0B64A", fontSize: 12, fontWeight: "800", textAlign: "right" }, queuePlayerTitle: { color: "#F7F4EC", fontSize: 17, fontWeight: "800", textAlign: "right", marginTop: 4 }, queuePlayerReciter: { color: "#A6ABC7", fontSize: 12, textAlign: "right", marginTop: 2 }, queuePlayerControls: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginTop: 8 }, miniNavButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#292D4D", alignItems: "center", justifyContent: "center" }, queuePlayerState: { color: "#A6ABC7", fontSize: 12 }, queueEntry: { backgroundColor: "#11152F", borderRadius: 14, padding: 11, flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 14 }, queueEntryCopy: { flex: 1 }, queueEntryTitle: { color: "#F7F4EC", fontSize: 17, fontWeight: "800", textAlign: "right" }, queueEntrySubtitle: { color: "#A6ABC7", fontSize: 12, textAlign: "right", marginTop: 3 }, sectionLabel: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 5, paddingVertical: 6 }, sectionLabelText: { color: "#F7F4EC", fontSize: 15, fontWeight: "800", textAlign: "right" }, addFromReciter: { marginTop: 12, minHeight: 40, borderRadius: 10, backgroundColor: "#F0B64A", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6 }, addFromReciterText: { color: "#171A35", fontSize: 13, fontWeight: "800" }, libraryHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }, libraryToggle: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }, libraryTitle: { color: "#F7F4EC", fontSize: 15, fontWeight: "800", textAlign: "right" }, libraryHint: { color: "#A6ABC7", fontSize: 11, textAlign: "right", marginTop: 3 }, libraryRow: { flexDirection: "row-reverse", alignItems: "center", borderTopWidth: 1, borderTopColor: "#292D4D", paddingVertical: 6, gap: 7 }, rowPressed: { opacity: 0.68 }, removeButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center" }, emptyLibrary: { color: "#A6ABC7", fontSize: 12, textAlign: "right", lineHeight: 20 }, playlistSummary: { backgroundColor: "#11152F", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 }, playlistSummaryText: { color: "#A6ABC7", textAlign: "right", fontSize: 13 }, playlistButton: { marginTop: 9, borderRadius: 10, backgroundColor: "#F0B64A", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9 }, playlistButtonText: { color: "#171A35", fontSize: 13, fontWeight: "800" }, queueButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" }, player: { backgroundColor: "#121630", borderRadius: 13, padding: 9 }, compactTools: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8, minHeight: 42 }, sleepWrap: { flex: 1, position: "relative" }, modeButton: { flexDirection: "row-reverse", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#292D4D" }, modeButtonActive: { backgroundColor: "#F0B64A" }, modeText: { color: "#A6ABC7", fontSize: 11, fontWeight: "700" }, modeTextActive: { color: "#F0B64A" }, modeDivider: { color: "#737891", fontSize: 11 }, settingRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }, settingLabel: { color: "#F7F4EC", fontSize: 13, fontWeight: "700", flex: 1, textAlign: "right" }, switch: { width: 48, height: 28, borderRadius: 14, backgroundColor: "#292D4D", padding: 3, justifyContent: "center" }, switchOn: { backgroundColor: "#F0B64A" }, switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#A6ABC7", alignSelf: "flex-start" }, switchThumbOn: { backgroundColor: "#171A35", alignSelf: "flex-end" }, queueCard: { backgroundColor: "#0D1028", borderRadius: 12, padding: 12, marginTop: 18 }, queueHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }, queueTitle: { color: "#F0B64A", textAlign: "right", fontWeight: "800" }, queuePlayButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#F0B64A", alignItems: "center", justifyContent: "center" }, queueRow: { flexDirection: "row-reverse", alignItems: "center", borderTopWidth: 1, borderTopColor: "#292D4D", paddingVertical: 8, gap: 8 }, queueRowActive: { backgroundColor: "#F0B64A", borderRadius: 9, borderTopColor: "#F0B64A", paddingHorizontal: 6 }, queueCopy: { flex: 1 }, queueReciter: { color: "#A6ABC7", fontSize: 11, textAlign: "right", marginTop: 2 }, queueIndex: { color: "#F0B64A", width: 22, textAlign: "center", fontWeight: "800" }, queueName: { color: "#F7F4EC", flex: 1, textAlign: "right", fontSize: 13 }, queueNameActive: { color: "#171A35", fontWeight: "800" }, queueIndexActive: { color: "#171A35" }, countdown: { color: "#F0B64A", fontSize: 14, fontWeight: "700", marginTop: 4 }, sleepCard: { marginTop: 8, paddingTop: 7, borderTopWidth: 1, borderTopColor: "#292D4D" }, sleepHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }, sleepTitle: { color: "#F7F4EC", fontSize: 14, fontWeight: "800" }, sleepStatus: { color: "#F0B64A", fontSize: 12, fontWeight: "700" }, sleepOptions: { flexDirection: "row-reverse", gap: 7 }, sleepPicker: { minHeight: 42, borderRadius: 10, backgroundColor: "#292D4D", paddingHorizontal: 13, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }, sleepPickerText: { color: "#F7F4EC", fontSize: 12, fontWeight: "700" }, sleepMenu: { marginTop: 7, gap: 6 }, sleepOption: { minHeight: 34, borderRadius: 9, backgroundColor: "#292D4D", alignItems: "center", justifyContent: "center" }, sleepOptionActive: { backgroundColor: "#F0B64A" }, sleepOptionText: { color: "#F7F4EC", fontSize: 11, fontWeight: "700" }, playerState: { color: "#F7F4EC", textAlign: "center", fontSize: 15, fontWeight: "800" }, time: { color: "#A6ABC7", textAlign: "center", marginTop: 8 }, track: { height: 6, backgroundColor: "#292D4D", borderRadius: 5, marginTop: 12, overflow: "hidden" }, fill: { height: 7, backgroundColor: "#F0B64A", borderRadius: 5 }, controls: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 9 }, control: { alignItems: "center", gap: 4, minWidth: 42 }, iconControl: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#292D4D" }, seek: { alignItems: "center", gap: 3, minWidth: 48 }, controlText: { color: "#A6ABC7", fontSize: 12 }, play: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#F0B64A", alignItems: "center", justifyContent: "center" }, error: { color: "#F08B8B", textAlign: "center", lineHeight: 22, marginTop: 14 }, controlDisabled: { opacity: 0.55 }, secondary: { width: 42, height: 34, borderWidth: 1, borderColor: "#F0B64A", borderRadius: 10, alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: 10 }, secondaryText: { color: "#F0B64A", fontWeight: "700" } });

const WEB_PAGE_DB = "quran-riwaya-pages";
const WEB_PAGE_STORE = "svg";

function saveWebSvg(key: string, xml: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("indexeddb"));
    const request = indexedDB.open(WEB_PAGE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(WEB_PAGE_STORE, { keyPath: "key" });
    request.onerror = () => reject(request.error ?? new Error("indexeddb"));
    request.onsuccess = () => {
      const transaction = request.result.transaction(WEB_PAGE_STORE, "readwrite");
      transaction.objectStore(WEB_PAGE_STORE).put({ key, xml });
      transaction.oncomplete = () => { request.result.close(); resolve(); };
      transaction.onerror = () => { request.result.close(); reject(transaction.error ?? new Error("indexeddb")); };
    };
  });
}

function readWebSvg(key: string): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return resolve(undefined);
    const request = indexedDB.open(WEB_PAGE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(WEB_PAGE_STORE, { keyPath: "key" });
    request.onerror = () => reject(request.error ?? new Error("indexeddb"));
    request.onsuccess = () => {
      const transaction = request.result.transaction(WEB_PAGE_STORE, "readonly");
      const getRequest = transaction.objectStore(WEB_PAGE_STORE).get(key);
      getRequest.onsuccess = () => { request.result.close(); resolve(getRequest.result?.xml as string | undefined); };
      getRequest.onerror = () => { request.result.close(); reject(getRequest.error ?? new Error("indexeddb")); };
    };
  });
}

type SourceItem = (typeof VERIFIED_TAFSIRS)[number] | (typeof VERIFIED_RIWAYAT)[number] | (typeof VERIFIED_TRANSLATIONS)[number];
type TranslationRow = { numberInSurah: number; arabicText: string; translationText: string };

function SourceFlow({ kind }: { kind: "tafsir" | "riwayat" | "translations" }) {
  const router = useRouter();
  const { tafsirQuery: initialTafsirQuery, suraId: initialSuraId, ayah: initialAyah, tafsir: initialTafsir, from: sourceFrom } = useLocalSearchParams<{ tafsirQuery?: string; suraId?: string; ayah?: string; tafsir?: string; from?: string }>();
  const options = kind === "tafsir" ? VERIFIED_TAFSIRS : kind === "riwayat" ? VERIFIED_RIWAYAT : VERIFIED_TRANSLATIONS;
  const [stage, setStage] = useState<"source" | "sura" | "content">("source");
  const [source, setSource] = useState(options[0]);
  const [sura, setSura] = useState(SURAS[0]);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Array<{ numberInSurah: number; text: string; arabicText?: string; translationText?: string }>>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [offlinePages, setOfflinePages] = useState<Array<{ page: number; uri: string; xml?: string }>>([]);
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [tafsirPage, setTafsirPage] = useState(0);
  const [tafsirQuery, setTafsirQuery] = useState(String(initialTafsirQuery ?? ""));
  const [tafsirContentQuery, setTafsirContentQuery] = useState("");
  const [tafsirSearchResults, setTafsirSearchResults] = useState<SearchAyahResult[]>([]);
  const [tafsirSearchStatus, setTafsirSearchStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [tafsirSearchError, setTafsirSearchError] = useState<"network" | "source" | "empty" | null>(null);
  const [tafsirMenuOpen, setTafsirMenuOpen] = useState(false);
  const [tafsirContentMenuOpen, setTafsirContentMenuOpen] = useState(false);
  const [tafsirBookmarkedIds, setTafsirBookmarkedIds] = useState<string[]>([]);
  const tafsirSearchControllerRef = useRef<AbortController | null>(null);
  const tafsirSearchCacheRef = useRef(new Map<string, SearchAyahResult[]>());
  const openedTafsirBookmarkRef = useRef<string | null>(null);
  const filtered = SURAS.filter((item) => `${item.name} ${item.latin} ${item.id}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedMushafId = kind === "riwayat" ? VERIFIED_RIWAYAT.find((item) => item.id === source.id)?.mushafId : undefined;
  useEffect(() => {
    if (kind !== "riwayat" || !selectedMushafId) return;
    setOfflinePages([]);
    setDownloadStatus("idle");
    setDownloadProgress(0);
    AsyncStorage.getItem(`quran.riwaya.pages.${source.id}.${sura.id}`).then(async (raw) => {
      if (!raw) return;
      try {
        const stored = JSON.parse(raw) as Array<{ page: number; uri: string; xml?: string }>;
        const hydrated = Platform.OS === "web" ? await Promise.all(stored.map(async (page) => ({ ...page, xml: page.xml ?? await readWebSvg(page.uri) }))) : stored;
        setOfflinePages(hydrated.filter((page) => Platform.OS !== "web" || Boolean(page.xml)));
        setDownloadStatus("ready");
      } catch { setOfflinePages([]); }
    }).catch(() => undefined);
  }, [kind, selectedMushafId, source.id, sura.id]);
  const chooseSource = (item: typeof options[number]) => { setSource(item); setOfflinePages([]); setDownloadStatus("idle"); AsyncStorage.setItem(kind === "tafsir" ? "quran.tafsir" : kind === "riwayat" ? "quran.riwaya" : "quran.translation", item.id).catch(() => undefined); setStage("sura"); };
  const chooseSura = (item: typeof SURAS[number], targetAyah?: number, sourceOverride?: SourceItem) => {
    const activeSource = sourceOverride ?? source;
    if (kind === "tafsir") {
      setSource(activeSource as typeof VERIFIED_TAFSIRS[number]);
      AsyncStorage.setItem("quran.tafsir", activeSource.id).catch(() => undefined);
    }
    setSura(item); setTafsirPage(0); if (targetAyah) setTafsirContentQuery(""); setOfflinePages([]); setDownloadStatus("idle"); setDownloadProgress(0); setStage("content");
    if (kind === "riwayat") { setItems([]); setStatus("error"); return; }
    setStatus("loading");
    if (kind === "tafsir") {
      fetch(`https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/${activeSource.id}/${item.id}.json`)
        .then((response) => { if (!response.ok) throw new Error("content"); return response.json(); })
        .then((payload) => { const rows = normalizeTafsirRows(payload, item.verses); const visibleRows = targetAyah ? rows.filter((row) => row.numberInSurah === targetAyah) : rows; setItems(visibleRows.map((row) => ({ numberInSurah: row.numberInSurah, text: row.text }))); setStatus(visibleRows.length ? "ready" : "error"); })
        .catch(() => setStatus("error"));
      return;
    }
    const arabicEndpoint = `https://api.alquran.cloud/v1/surah/${item.id}/quran-uthmani`;
    const translationEndpoint = `https://api.alquran.cloud/v1/surah/${item.id}/${activeSource.id}`;
    Promise.all([fetch(arabicEndpoint), fetch(translationEndpoint)])
      .then(async ([arabicResponse, translationResponse]) => {
        if (!arabicResponse.ok || !translationResponse.ok) throw new Error("content");
        return Promise.all([arabicResponse.json(), translationResponse.json()]);
      })
      .then(([arabicPayload, translationPayload]) => {
        const arabicRows = arabicPayload?.data?.ayahs ?? [];
        const translationRows = translationPayload?.data?.ayahs ?? [];
        const translationByAyah = new Map(translationRows.map((ayah: { numberInSurah: number; text: string }) => [ayah.numberInSurah, String(ayah.text)]));
        const rows: TranslationRow[] = arabicRows.map((ayah: { numberInSurah: number; text: string }) => ({ numberInSurah: ayah.numberInSurah, arabicText: String(ayah.text), translationText: translationByAyah.get(ayah.numberInSurah) ?? "" })).filter((row: TranslationRow) => row.translationText);
        const visibleRows = targetAyah ? rows.filter((row) => row.numberInSurah === targetAyah) : rows;
        setItems(visibleRows.map((row) => ({ ...row, text: row.translationText }))); setStatus(visibleRows.length ? "ready" : "error");
      })
      .catch(() => setStatus("error"));
  };
  useEffect(() => {
    if (sourceFrom !== "favorites" || kind !== "tafsir" || !initialSuraId || !initialTafsir) return;
    const requestedSura = SURAS.find((item) => item.id === Number(initialSuraId));
    const requestedSource = options.find((item) => item.label === initialTafsir);
    if (!requestedSura || !requestedSource) return;
    const key = `${requestedSource.id}:${requestedSura.id}:${initialAyah ?? "all"}`;
    if (openedTafsirBookmarkRef.current === key) return;
    openedTafsirBookmarkRef.current = key;
    chooseSura(requestedSura, initialAyah ? Number(initialAyah) : undefined, requestedSource);
  }, [sourceFrom, kind, initialSuraId, initialAyah, initialTafsir]);

  const runTafsirSearch = async () => {
    const term = tafsirQuery.trim();
    tafsirSearchControllerRef.current?.abort();
    if (term.length < 2) { setTafsirSearchResults([]); setTafsirSearchStatus("idle"); setTafsirSearchError(null); return; }
    const cacheKey = `quran:${normalizeSearchText(term)}`;
    const cached = tafsirSearchCacheRef.current.get(cacheKey);
    if (cached) { setTafsirSearchResults(cached); setTafsirSearchStatus(cached.length ? "ready" : "idle"); setTafsirSearchError(cached.length ? null : "empty"); return; }
    const controller = new AbortController();
    tafsirSearchControllerRef.current = controller;
    setTafsirSearchStatus("loading");
    setTafsirSearchError(null);
    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/api/quran/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
      if (!response.ok) throw new Error(response.status >= 500 ? "quran-source" : "quran-search");
      const payload = await response.json();
      const matches = uniqueAyahResults((payload?.data?.matches ?? []).filter((item: SearchAyahResult) => item?.surah?.number && item?.numberInSurah && item?.text)).slice(0, 40);
      tafsirSearchCacheRef.current.set(cacheKey, matches);
      setTafsirSearchResults(matches);
      setTafsirSearchStatus(matches.length ? "ready" : "idle");
      setTafsirSearchError(matches.length ? null : "empty");
    } catch (error) { if ((error as { name?: string })?.name !== "AbortError") { setTafsirSearchResults([]); setTafsirSearchStatus("error"); setTafsirSearchError((error as { message?: string })?.message === "quran-source" ? "source" : "network"); } }
  };

  const tafsirPageSize = 5;
  const normalizedTafsirQuery = normalizeSearchText(tafsirContentQuery);
  const visibleTafsirItems = kind === "tafsir" ? filterTafsirRows(items, tafsirContentQuery) : items;
  useEffect(() => {
    if (kind !== "tafsir" || stage !== "content") return;
    loadBookmarks().then((stored) => setTafsirBookmarkedIds(stored.filter((item) => item.kind === "tafsir" && item.suraId === sura.id && item.tafsirName === source.label).map((item) => item.id)));
  }, [kind, stage, sura.id, source.label, items.length]);
  const toggleTafsirBookmark = async (item: { numberInSurah: number; text: string }) => {
    const id = bookmarkId("tafsir", sura.id, item.numberInSurah, source.label, `tafsir:${source.id}`);
    if (tafsirBookmarkedIds.includes(id)) {
      await removeBookmark(id);
      setTafsirBookmarkedIds((current) => current.filter((value) => value !== id));
      return;
    }
    await addBookmark({ id, kind: "tafsir", suraId: sura.id, suraName: sura.name, ayah: item.numberInSurah, tafsirName: source.label, scope: `tafsir:${source.id}`, title: `تفسير ${sura.name} · الآية ${item.numberInSurah}`, subtitle: source.label, snippet: item.text, createdAt: Date.now() });
    setTafsirBookmarkedIds((current) => [...current, id]);
  };
  const tafsirPageCount = Math.max(1, Math.ceil(visibleTafsirItems.length / tafsirPageSize));
  const originalTafsirUrl = `https://www.altafsir.com/Tafasir.asp?tMadhNo=0&tTafsirNo=0&tSoraNo=${sura.id}&tAyahNo=${items[0]?.numberInSurah ?? 1}&tDisplay=no&LanguageID=1`;
  const tafsirSwipeResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      setTafsirPage((page) => pageAfterSwipe(page, tafsirPageCount, gesture.dx));
    },
  });
  const quranpediaUrl = (target: string) => {
    if (Platform.OS !== "web") return target;
    const runtimeBase = typeof window !== "undefined" && window.location?.hostname ? `${window.location.protocol}//${window.location.hostname.replace(/^8081-/, "3000-")}` : getApiBaseUrl();
    return `${runtimeBase}/api/quranpedia/proxy?url=${encodeURIComponent(target)}`;
  };
  const downloadSuraPages = async () => {
    if (kind !== "riwayat" || !selectedMushafId) return;
    try {
      setDownloadStatus("loading");
      setDownloadProgress(0);
      const slug = QURANPEDIA_MUSHAF_SLUGS[selectedMushafId];
      const pageResponse = await fetch(quranpediaUrl(`https://quranpedia.net/surah/${selectedMushafId}/${sura.id}`));
      if (!pageResponse.ok) throw new Error("source");
      const html = await pageResponse.text();
      const matches = Array.from(html.matchAll(/data-page="(\d+)"[^>]*data-svg-url="([^"]+)"/g)).map((match) => ({ page: Number(match[1]), url: match[2].replace(/&amp;/g, "&") }));
      if (!matches.length || !slug) throw new Error("pages");
      const saved: Array<{ page: number; uri: string; xml?: string }> = [];
      for (let index = 0; index < matches.length; index += 1) {
        const match = matches[index];
        if (Platform.OS === "web") {
          const response = await fetch(quranpediaUrl(`https://quranpedia.net${match.url}`));
          if (!response.ok) throw new Error("svg");
          const xml = await response.text();
          const cacheKey = `web-svg-${selectedMushafId}-${sura.id}-${match.page}`;
          await saveWebSvg(cacheKey, xml);
          saved.push({ page: match.page, uri: cacheKey });
        } else {
          const localUri = `${FileSystem.documentDirectory}riwaya-${selectedMushafId}-sura-${sura.id}-page-${match.page}.svg`;
          const info = await FileSystem.getInfoAsync(localUri);
          const uri = info.exists ? localUri : (await FileSystem.downloadAsync(`https://quranpedia.net${match.url}`, localUri)).uri;
          saved.push({ page: match.page, uri });
        }
        setDownloadProgress(Math.round(((index + 1) / matches.length) * 100));
      }
      await AsyncStorage.setItem(`quran.riwaya.pages.${source.id}.${sura.id}`, JSON.stringify(saved));
      setOfflinePages(saved);
      setDownloadStatus("ready");
    } catch { setDownloadStatus("error"); }
  };
  return <ScreenContainer edges={["bottom", "left", "right"]}><View style={flowStyles.root}><View style={flowStyles.header}><Pressable onPress={() => sourceFrom === "favorites" ? router.back() : stage === "source" ? router.back() : setStage(stage === "content" ? "sura" : "source")} style={flowStyles.back}><MaterialIcons name="arrow-forward" size={22} color="#F0B64A" /></Pressable><Text style={flowStyles.headerTitle}>{kind === "tafsir" ? "التفاسير" : kind === "riwayat" ? "الروايات" : "الترجمات"}</Text><View style={flowStyles.back} /></View><ScrollView contentContainerStyle={flowStyles.content}>{stage === "source" && <>{kind === "tafsir" && <><View style={flowStyles.tafsirPicker}><Text style={flowStyles.tafsirPickerLabel}>المفسر المفضل</Text><Pressable onPress={() => setTafsirMenuOpen((open) => !open)} style={flowStyles.tafsirPickerButton}><Text style={flowStyles.tafsirPickerValue}>{source.label}</Text><MaterialIcons name={tafsirMenuOpen ? "expand-less" : "expand-more"} size={19} color="#80663B" /></Pressable>{tafsirMenuOpen && <View style={flowStyles.tafsirPickerMenu}>{options.map((item) => <Pressable key={item.id} onPress={() => { setSource(item); setTafsirMenuOpen(false); setTafsirSearchResults([]); setTafsirSearchStatus("idle"); AsyncStorage.setItem("quran.tafsir", item.id).catch(() => undefined); }} style={flowStyles.tafsirPickerOption}><Text style={flowStyles.tafsirPickerOptionText}>{item.label}</Text>{item.id === source.id && <MaterialIcons name="check" size={17} color="#B58B45" />}</Pressable>)}</View>}</View><View style={flowStyles.sourceTafsirSearch}><MaterialIcons name="search" size={19} color="#80663B" /><TextInput value={tafsirQuery} onChangeText={setTafsirQuery} onSubmitEditing={runTafsirSearch} placeholder="ابحث عن آية في القرآن…" placeholderTextColor="#80663B" style={flowStyles.sourceTafsirSearchInput} textAlign="right" returnKeyType="search" /><Pressable onPress={runTafsirSearch} style={flowStyles.tafsirSearchButton}><Text style={flowStyles.tafsirSearchButtonText}>بحث</Text></Pressable></View></>}{tafsirSearchStatus === "loading" && <Text style={flowStyles.tafsirSearchState}>جارٍ البحث في آيات القرآن…</Text>}{tafsirSearchStatus === "error" && <Text style={flowStyles.tafsirSearchState}>{tafsirSearchError === "source" ? "مصدر البحث غير متاح مؤقتًا، حاول بعد قليل." : "تعذر الاتصال بخدمة البحث، تحقق من الاتصال ثم أعد المحاولة."}</Text>}{tafsirSearchStatus === "idle" && tafsirQuery.trim().length >= 2 && tafsirSearchError === "empty" && <Text style={flowStyles.tafsirSearchState}>لا توجد آية تحتوي عبارة البحث.</Text>}{tafsirSearchStatus === "ready" && <View style={flowStyles.tafsirSearchResults}>{tafsirSearchResults.map((result) => <Pressable key={`${result.surah.number}-${result.numberInSurah}`} onPress={() => { chooseSura(SURAS.find((item) => item.id === result.surah.number) ?? SURAS[0], result.numberInSurah, source); }} style={flowStyles.tafsirSearchResult}><View style={flowStyles.copy}><Text style={flowStyles.tafsirSearchResultTitle}>{result.surah.name} · الآية {result.numberInSurah}</Text><Text style={flowStyles.tafsirSearchResultSource}>التفسير المختار: {source.label}</Text><Text numberOfLines={2} style={flowStyles.tafsirSearchResultText}>{result.text}</Text></View><MaterialIcons name="menu-book" size={18} color="#F0B64A" /></Pressable>)}</View>}<View style={flowStyles.hero}><MaterialIcons name={kind === "tafsir" ? "notes" : kind === "riwayat" ? "menu-book" : "translate"} size={34} color="#F0B64A" /><Text style={flowStyles.title}>{kind === "tafsir" ? "اختر المفسر" : kind === "riwayat" ? "اختر الرواية" : "اختر المترجم"}</Text><Text style={flowStyles.subtitle}>اختر المصدر أولًا ثم حدّد السورة</Text></View><View style={kind === "riwayat" ? flowStyles.mushafPage : flowStyles.list}>{options.map((item, index) => <Pressable key={item.id} onPress={() => chooseSource(item)} style={kind === "riwayat" ? flowStyles.mushafOption : flowStyles.option}>{kind === "riwayat" && <View style={flowStyles.mushafNumber}><Text style={flowStyles.mushafNumberText}>{index + 1}</Text></View>}<View style={flowStyles.copy}><Text style={kind === "riwayat" ? flowStyles.mushafOptionText : flowStyles.optionText}>{item.label}</Text>{kind === "riwayat" && <Text style={flowStyles.mushafMeta}>{VERIFIED_RIWAYAT.find((entry) => entry.id === item.id)?.imam}</Text>}</View><MaterialIcons name="chevron-left" size={20} color={kind === "riwayat" ? "#98733A" : "#A6ABC7"} /></Pressable>)}</View></>}{stage === "sura" && <><View style={flowStyles.hero}><Text style={flowStyles.title}>{source.label}</Text><Text style={flowStyles.subtitle}>اختر السورة لعرض {kind === "tafsir" ? "التفسير" : kind === "riwayat" ? "النص" : "الترجمة"}</Text></View><View style={flowStyles.search}><MaterialIcons name="search" size={20} color="#A6ABC7" /><TextInput value={query} onChangeText={setQuery} placeholder="ابحث باسم السورة أو رقمها" placeholderTextColor="#737891" style={flowStyles.input} textAlign="right" /></View><View style={flowStyles.list}>{filtered.map((item) => <Pressable key={item.id} onPress={() => chooseSura(item)} style={flowStyles.option}><View style={flowStyles.number}><Text style={flowStyles.numberText}>{item.id}</Text></View><View style={flowStyles.copy}><Text style={flowStyles.optionText}>{item.name}</Text><Text style={flowStyles.meta}>{item.latin} · {item.verses} آيات</Text></View><BookmarkButton bookmark={kind === "tafsir" ? { id: bookmarkId("tafsir", item.id, undefined, source.label, `tafsir:${source.id}`), kind: "tafsir", suraId: item.id, suraName: item.name, tafsirName: source.label, scope: `tafsir:${source.id}`, title: `تفسير سورة ${item.name}`, subtitle: `العودة إلى ${source.label}`, createdAt: Date.now() } : { id: bookmarkId("sura", item.id, undefined, source.id, kind), kind: "sura", suraId: item.id, suraName: item.name, scope: `${kind}:${source.id}`, title: `سورة ${item.name} · ${source.label}`, subtitle: `العودة إلى ${source.label}`, createdAt: Date.now() }} light /></Pressable>)}</View></>}{stage === "content" && <><View style={flowStyles.hero}><Text style={flowStyles.title}>{sura.name}</Text><Text style={flowStyles.subtitle}>{kind === "riwayat" ? `${source.label} · قراءة موثقة` : `${source.label} · ${kind === "tafsir" ? TAFSIR_SOURCE : "النص العربي: مصحف عثماني · الترجمة: Al Quran Cloud"}`}</Text>{kind === "translations" && <Pressable onPress={() => router.push({ pathname: "/reader", params: { suraId: String(sura.id) } })} style={flowStyles.mushafLink}><MaterialIcons name="menu-book" size={18} color="#171A35" /><Text style={flowStyles.mushafLinkText}>فتح السورة في مصحف المدينة</Text></Pressable>}</View>{status === "loading" && <View style={flowStyles.state}><ActivityIndicator color="#F0B64A" /><Text style={flowStyles.subtitle}>جارٍ تحميل المحتوى…</Text></View>}{status === "error" && <View style={kind === "riwayat" ? flowStyles.mushafContent : flowStyles.state}>{kind === "riwayat" ? <><MaterialIcons name="menu-book" size={34} color="#B58B45" /><Text style={flowStyles.mushafContentTitle}>{sura.name}</Text><Text style={flowStyles.mushafContentMeta}>{source.label}</Text><Text style={flowStyles.mushafContentText}>تم اختيار الرواية والسورة بنجاح. حفاظًا على دقة النص، لا نعرض نص حفص بدل هذه الرواية. افتح صفحات مصحف المدينة للمسار النصي الموثق المتاح.</Text><Text style={flowStyles.mushafSource}>المصدر الأصلي للصفحات: quranpedia.net · مصحف {source.label} · إصدار/نسخة المصدر الموثقة</Text>{selectedMushafId && QURANPEDIA_MUSHAF_SLUGS[selectedMushafId] ? <Pressable onPress={downloadSuraPages} disabled={downloadStatus === "loading"} style={flowStyles.secondary}><Text style={flowStyles.secondaryText}>{downloadStatus === "loading" ? `جارٍ تنزيل الصفحات ${downloadProgress}%` : downloadStatus === "ready" ? "تحديث الصفحات المحفوظة دون اتصال" : "تنزيل صفحات السورة دون اتصال"}</Text></Pressable> : <Text style={flowStyles.mushafSource}>التنزيل المحلي بصيغة صفحات SVG غير متاح حاليًا لهذه الرواية من المصدر؛ يمكنك فتح صفحاتها الأصلية مباشرة.</Text>}<Pressable onPress={() => selectedMushafId ? WebBrowser.openBrowserAsync(`https://quranpedia.net/surah/${selectedMushafId}/${sura.id}`) : undefined} style={flowStyles.secondary}><Text style={flowStyles.secondaryText}>فتح الصفحة الأصلية للرواية المختارة</Text></Pressable>{downloadStatus === "error" && <Text style={flowStyles.mushafSource}>تعذر تنزيل الصفحات. تحقق من الاتصال وحاول مرة أخرى.</Text>}{offlinePages.map((page) => <View key={page.page} style={flowStyles.offlinePage}><Text style={flowStyles.offlinePageLabel}>صفحة {page.page} · محفوظة محليًا</Text>{Platform.OS === "web" && page.xml ? <SvgXml xml={page.xml} width="100%" height={520} /> : <SvgUri uri={page.uri} width="100%" height={520} />}</View>)}</> : <Text style={flowStyles.subtitle}>تعذر تحميل هذا الإصدار. اختر مصدرًا آخر أو تحقق من الاتصال.</Text>}</View>}{status === "ready" && kind === "tafsir" ? <View style={flowStyles.bookReader}><View style={flowStyles.tafsirContentPicker}><Pressable onPress={() => setTafsirContentMenuOpen((open) => !open)} style={flowStyles.tafsirContentPickerButton}><Text style={flowStyles.tafsirContentPickerValue}>{source.label}</Text><MaterialIcons name={tafsirContentMenuOpen ? "expand-less" : "expand-more"} size={18} color="#80663B" /></Pressable>{tafsirContentMenuOpen && <View style={flowStyles.tafsirContentMenu}>{options.map((item) => <Pressable key={item.id} onPress={() => { setTafsirContentMenuOpen(false); chooseSura(sura, items[0]?.numberInSurah, item); }} style={flowStyles.tafsirContentOption}><Text style={flowStyles.tafsirContentOptionText}>{item.label}</Text>{item.id === source.id && <MaterialIcons name="check" size={16} color="#B58B45" />}</Pressable>)}</View>}</View><View style={flowStyles.tafsirSearch}><MaterialIcons name="search" size={18} color="#80663B" /><TextInput value={tafsirContentQuery} onChangeText={(value) => { setTafsirContentQuery(value); setTafsirPage(0); }} placeholder="ابحث داخل هذا التفسير…" placeholderTextColor="#80663B" style={flowStyles.tafsirSearchInput} textAlign="right" /></View>{normalizedTafsirQuery && <Text style={flowStyles.tafsirResultCount}>عدد النتائج: {visibleTafsirItems.length}</Text>}<View {...tafsirSwipeResponder.panHandlers} style={flowStyles.bookPage}><View style={flowStyles.bookPageHeader}><Text style={flowStyles.bookPageTitle}>{source.label}</Text><Text style={flowStyles.bookPageNumber}>صفحة {tafsirPage + 1} من {tafsirPageCount}</Text></View>{visibleTafsirItems.slice(tafsirPage * tafsirPageSize, (tafsirPage + 1) * tafsirPageSize).map((item) => { const id = bookmarkId("tafsir", sura.id, item.numberInSurah, source.label, `tafsir:${source.id}`); const saved = tafsirBookmarkedIds.includes(id); return <View key={item.numberInSurah} style={flowStyles.bookEntry}><View style={flowStyles.bookEntryHeader}><Text style={flowStyles.bookAyah}>الآية {item.numberInSurah}</Text><Pressable onPress={() => toggleTafsirBookmark(item)} style={flowStyles.bookmarkButton} accessibilityLabel={saved ? "إزالة علامة التفسير" : "حفظ التفسير"}><MaterialIcons name={saved ? "bookmark" : "bookmark-border"} size={19} color="#B58B45" /></Pressable></View><Text style={flowStyles.bookText}>{highlightMatches(item.text, tafsirContentQuery).map((segment, index) => <Text key={`${item.numberInSurah}-${index}`} style={segment.highlighted ? flowStyles.tafsirHighlight : undefined}>{segment.text}</Text>)}</Text></View>; })}</View><View style={flowStyles.bookNavigation}><Pressable disabled={tafsirPage === 0} onPress={() => setTafsirPage((page) => Math.max(0, page - 1))} style={[flowStyles.pageButton, tafsirPage === 0 && flowStyles.pageButtonDisabled]}><Text style={flowStyles.pageButtonText}></Text></Pressable><Pressable onPress={() => WebBrowser.openBrowserAsync(originalTafsirUrl)} style={flowStyles.sourceButton}><Text style={flowStyles.sourceButtonText}>فتح المصدر الأصلي</Text></Pressable><Pressable disabled={tafsirPage >= tafsirPageCount - 1} onPress={() => setTafsirPage((page) => Math.min(tafsirPageCount - 1, page + 1))} style={[flowStyles.pageButton, tafsirPage >= tafsirPageCount - 1 && flowStyles.pageButtonDisabled]}><Text style={flowStyles.pageButtonText}></Text></Pressable></View></View> : status === "ready" ? kind === "translations" ? <View style={flowStyles.translationReader}>{items.map((item) => <View key={item.numberInSurah} style={flowStyles.translationCard}><View style={flowStyles.translationHeader}><Text style={flowStyles.translationLabel}>الآية {item.numberInSurah}</Text><View style={flowStyles.circle}><Text style={flowStyles.circleText}>{item.numberInSurah}</Text></View></View><Text style={flowStyles.translationArabic}>{item.arabicText ?? ""}</Text><View style={flowStyles.translationDivider} /><Text style={flowStyles.translationText}>{item.translationText ?? item.text}</Text><BookmarkButton bookmark={{ id: bookmarkId("ayah", sura.id, item.numberInSurah, source.label, kind), kind: "ayah", suraId: sura.id, suraName: sura.name, ayah: item.numberInSurah, scope: kind, title: `سورة ${sura.name} · الآية ${item.numberInSurah}`, subtitle: `ترجمة ${source.label}`, snippet: item.translationText ?? item.text, createdAt: Date.now() }} light /></View>)}</View> : items.map((item) => <View key={item.numberInSurah} style={flowStyles.ayah}><Text style={flowStyles.ayahText}>{item.text}</Text><View style={flowStyles.circle}><Text style={flowStyles.circleText}>{item.numberInSurah}</Text></View><BookmarkButton bookmark={{ id: bookmarkId("ayah", sura.id, item.numberInSurah, undefined, kind), kind: "ayah", suraId: sura.id, suraName: sura.name, ayah: item.numberInSurah, scope: kind, title: `سورة ${sura.name} · الآية ${item.numberInSurah}`, subtitle: source.label, snippet: item.text, createdAt: Date.now() }} light /></View>) : null}</>}</ScrollView></View></ScreenContainer>;
}

const flowStyles = StyleSheet.create({ root: { flex: 1, backgroundColor: "#080A1F" }, header: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#292D4D" }, back: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#151B3D", alignItems: "center", justifyContent: "center" }, headerTitle: { color: "#F7F4EC", fontSize: 18, fontWeight: "800" }, content: { paddingHorizontal: 8, paddingTop: 0, paddingBottom: 18 }, tafsirPicker: { width: "100%", marginBottom: 6, position: "relative", zIndex: 5 }, tafsirPickerLabel: { color: "#F0E4C7", fontSize: 11, textAlign: "right", marginBottom: 3 }, tafsirPickerButton: { width: "100%", height: 38, backgroundColor: "#F7F0DF", borderRadius: 9, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10 }, tafsirPickerValue: { color: "#33281B", fontSize: 13, fontWeight: "700" }, tafsirPickerMenu: { width: "100%", backgroundColor: "#FFF9EC", borderWidth: 1, borderColor: "#C9A96A", borderRadius: 9, marginTop: 3, overflow: "hidden" }, tafsirPickerOption: { minHeight: 36, paddingHorizontal: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#E8D8B7" }, tafsirPickerOptionText: { color: "#33281B", fontSize: 12, textAlign: "right" }, sourceTafsirSearch: { width: "100%", height: 40, backgroundColor: "#F0E4C7", borderRadius: 9, flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 10, marginBottom: 6 }, sourceTafsirSearchInput: { flex: 1, color: "#33281B", fontSize: 13, paddingVertical: 0 }, tafsirSearchButton: { backgroundColor: "#F0B64A", borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6 }, tafsirSearchButtonText: { color: "#171A35", fontSize: 11, fontWeight: "800" }, tafsirSearchState: { color: "#80663B", fontSize: 11, textAlign: "right", alignSelf: "stretch", marginBottom: 5 }, tafsirSearchResults: { width: "100%", backgroundColor: "#F7F0DF", borderRadius: 9, borderWidth: 1, borderColor: "#C9A96A", marginBottom: 6, overflow: "hidden" }, tafsirSearchResult: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 9, borderBottomWidth: 1, borderBottomColor: "#D8C49B" }, tafsirSearchResultTitle: { color: "#5B4325", fontSize: 12, fontWeight: "800", textAlign: "right" }, tafsirSearchResultSource: { color: "#A06E22", fontSize: 10, fontWeight: "700", textAlign: "right", marginTop: 2 }, tafsirSearchResultText: { color: "#80663B", fontSize: 11, lineHeight: 17, textAlign: "right", marginTop: 3 }, hero: { alignItems: "center", backgroundColor: "#11152F", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 9, marginBottom: 5, gap: 1 }, title: { color: "#F7F4EC", fontSize: 17, fontWeight: "800", textAlign: "center" }, subtitle: { color: "#A6ABC7", fontSize: 11, textAlign: "center", lineHeight: 15 }, list: { backgroundColor: "#121630", borderRadius: 10, overflow: "hidden" }, option: { minHeight: 42, paddingHorizontal: 9, borderBottomWidth: 1, borderBottomColor: "#292D4D", flexDirection: "row-reverse", alignItems: "center", gap: 8 }, optionText: { flex: 1, color: "#F7F4EC", textAlign: "right", fontSize: 15, fontWeight: "700" }, number: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F1D39A", alignItems: "center", justifyContent: "center" }, numberText: { color: "#7C5420", fontWeight: "800" }, copy: { flex: 1 }, meta: { color: "#A6ABC7", fontSize: 10, textAlign: "right", marginTop: 2 }, mushafPage: { backgroundColor: "#F7F0DF", borderRadius: 10, borderWidth: 1, borderColor: "#C9A96A", overflow: "hidden", paddingVertical: 5 }, mushafOption: { minHeight: 50, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#D8C49B", flexDirection: "row-reverse", alignItems: "center", gap: 10 }, mushafOptionText: { flex: 1, color: "#33281B", textAlign: "right", fontSize: 15, fontWeight: "800" }, mushafMeta: { color: "#80663B", fontSize: 10, textAlign: "right", marginTop: 2 }, mushafNumber: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: "#B58B45", alignItems: "center", justifyContent: "center" }, mushafNumberText: { color: "#805F2C", fontSize: 12, fontWeight: "800" }, mushafContent: { alignItems: "center", backgroundColor: "#F7F0DF", borderRadius: 10, borderWidth: 1, borderColor: "#C9A96A", padding: 18, minHeight: 300 }, mushafContentTitle: { color: "#33281B", fontSize: 24, fontWeight: "800", textAlign: "center", marginTop: 10 }, mushafContentMeta: { color: "#80663B", fontSize: 14, fontWeight: "700", textAlign: "center", marginTop: 6 }, mushafContentText: { color: "#4B3A24", fontSize: 15, lineHeight: 27, textAlign: "right", writingDirection: "rtl", marginTop: 22 }, mushafSource: { color: "#80663B", fontSize: 11, lineHeight: 18, textAlign: "center", marginTop: 16 }, search: { height: 38, backgroundColor: "#121630", borderRadius: 10, flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 10, marginBottom: 6 }, input: { flex: 1, color: "#F7F4EC", fontSize: 14 }, tafsirSearch: { width: "100%", height: 38, backgroundColor: "#F0E4C7", borderRadius: 9, flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 10, marginBottom: 4 }, tafsirSearchInput: { flex: 1, color: "#33281B", fontSize: 13 }, tafsirResultCount: { color: "#80663B", fontSize: 11, textAlign: "right", alignSelf: "stretch", marginBottom: 4 }, tafsirHighlight: { backgroundColor: "#F0B64A", color: "#33281B" }, state: { alignItems: "center", paddingVertical: 40, gap: 10 }, ayah: { flexDirection: "row-reverse", alignItems: "flex-end", gap: 8, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#292D4D" }, ayahText: { flex: 1, color: "#F7F4EC", textAlign: "right", fontSize: 18, lineHeight: 32, writingDirection: "rtl" }, translationReader: { width: "100%" }, translationCard: { backgroundColor: "#F8F0DE", borderWidth: 1, borderColor: "#C9A96A", borderRadius: 8, padding: 12, marginBottom: 8 }, translationHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }, translationLabel: { color: "#A06E22", fontSize: 11, fontWeight: "800", textAlign: "right" }, translationArabic: { color: "#33281B", textAlign: "right", fontSize: 19, lineHeight: 34, fontWeight: "700", writingDirection: "rtl" }, translationDivider: { height: 1, backgroundColor: "#D8C49B", width: "100%", marginVertical: 8 }, translationText: { color: "#80663B", textAlign: "left", fontSize: 15, lineHeight: 25 }, mushafLink: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#F0B64A", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 }, mushafLinkText: { color: "#171A35", fontSize: 12, fontWeight: "800" }, translationCopy: { flex: 1, gap: 7 }, circle: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "#D99432", alignItems: "center", justifyContent: "center" }, circleText: { color: "#D99432", fontSize: 11, fontWeight: "800" }, secondary: { borderWidth: 1, borderColor: "#F0B64A", borderRadius: 12, alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, marginTop: 20 }, secondaryText: { color: "#F0B64A", fontWeight: "700", textAlign: "center" }, offlinePage: { width: "100%", marginTop: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#D8C49B" }, offlinePageLabel: { color: "#80663B", fontSize: 11, textAlign: "center", marginBottom: 8 }, bookReader: { width: "100%", alignItems: "center" }, tafsirContentPicker: { width: "100%", marginBottom: 5, position: "relative", zIndex: 6 }, tafsirContentPickerButton: { height: 36, borderRadius: 9, backgroundColor: "#F0E4C7", flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10 }, tafsirContentPickerValue: { color: "#33281B", fontSize: 12, fontWeight: "800" }, tafsirContentMenu: { backgroundColor: "#FFF9EC", borderWidth: 1, borderColor: "#C9A96A", borderRadius: 9, marginTop: 3, overflow: "hidden" }, tafsirContentOption: { minHeight: 34, paddingHorizontal: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#E8D8B7" }, tafsirContentOptionText: { color: "#33281B", fontSize: 11, textAlign: "right" }, bookPage: { width: "100%", minHeight: 540, overflow: "hidden", backgroundColor: "#F8F0DE", borderWidth: 1, borderColor: "#C9A96A", borderRadius: 4, padding: 18, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } }, bookPageHeader: { borderBottomWidth: 1, borderBottomColor: "#D8C49B", paddingBottom: 10, marginBottom: 8, alignItems: "center", gap: 3 }, bookPageTitle: { color: "#5B4325", fontSize: 15, fontWeight: "800" }, bookPageNumber: { color: "#80663B", fontSize: 10 },   bookEntry: { borderBottomWidth: 1, borderBottomColor: "#E4D6B9", paddingVertical: 12 },
  bookEntryHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 5 },
  bookmarkButton: { width: 30, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#F0E4C7" },
  bookAyah: { color: "#A06E22", fontSize: 11, fontWeight: "800", textAlign: "right" },
  bookAyahUnused: { color: "#A06E22", fontSize: 11, fontWeight: "800", textAlign: "right", marginBottom: 5 }, bookText: { color: "#33281B", fontSize: 16, lineHeight: 29, textAlign: "right", writingDirection: "rtl" }, bookNavigation: { width: "100%", flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 8 }, pageButton: { backgroundColor: "#E7D19E", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }, pageButtonDisabled: { opacity: 0.4 }, pageButtonText: { color: "#5B4325", fontSize: 11, fontWeight: "800" }, sourceButton: { borderWidth: 1, borderColor: "#B58B45", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }, sourceButtonText: { color: "#80663B", fontSize: 10, fontWeight: "800" } });

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: "#080A1F" }, header: { height: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#292D4D" }, back: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#151B3D", alignItems: "center", justifyContent: "center" }, headerTitle: { color: "#F7F4EC", fontSize: 18, fontWeight: "800" }, content: { padding: 18, paddingBottom: 40 }, hero: { backgroundColor: "#11152F", borderRadius: 22, alignItems: "center", padding: 27, marginBottom: 18 }, heroIcon: { width: 66, height: 66, borderRadius: 22, backgroundColor: "#20274E", alignItems: "center", justifyContent: "center", marginBottom: 13 }, title: { color: "#F7F4EC", fontSize: 25, fontWeight: "800" }, subtitle: { color: "#A6ABC7", fontSize: 14, marginTop: 8, textAlign: "center" }, suraHint: { color: "#F0B64A", fontSize: 13, marginTop: 12 }, options: { backgroundColor: "#121630", borderRadius: 18, padding: 15 }, option: { minHeight: 55, flexDirection: "row-reverse", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#292D4D", gap: 12, paddingHorizontal: 4 }, optionActive: { backgroundColor: "#181D3A" }, optionText: { color: "#F7F4EC", flex: 1, textAlign: "right", fontSize: 16 }, radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: "#7E85A6", alignItems: "center", justifyContent: "center" }, radioActive: { borderColor: "#F0B64A" }, dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: "#F0B64A" }, primary: { backgroundColor: "#F0B64A", borderRadius: 14, minHeight: 48, marginTop: 17, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 }, primaryText: { color: "#171A35", fontSize: 15, fontWeight: "800" }, singleCard: { backgroundColor: "#121630", borderRadius: 18, padding: 20 }, singleText: { color: "#A6ABC7", textAlign: "right", lineHeight: 25, fontSize: 15 }, contactEmail: { color: "#F0B64A", fontSize: 15, fontWeight: "800", textAlign: "center", marginTop: 12, writingDirection: "ltr" }, contactNote: { color: "#969BBC", fontSize: 12, lineHeight: 20, textAlign: "center", marginTop: 5 }, feedbackInput: { backgroundColor: "#0B0F28", borderWidth: 1, borderColor: "#292D4D", borderRadius: 10, color: "#F7F4EC", minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10, fontSize: 14 }, feedbackMessage: { minHeight: 112 }, feedbackError: { color: "#F08B8B", textAlign: "right", fontSize: 12, lineHeight: 20, marginTop: 8 }, feedbackSuccess: { color: "#7BE0A5", textAlign: "right", fontSize: 12, lineHeight: 20, marginTop: 8 }, playerCard: { backgroundColor: "#121630", borderRadius: 18, padding: 16, marginTop: 18 }, playerTop: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, playerLabel: { color: "#F7F4EC", fontWeight: "800" }, playerTime: { color: "#A6ABC7", fontSize: 12 }, progressTrack: { height: 6, backgroundColor: "#292D4D", borderRadius: 4, marginTop: 14, overflow: "hidden" }, progressFill: { height: 6, backgroundColor: "#F0B64A", borderRadius: 4 }, playerNav: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 14 }, navButton: { alignItems: "center", gap: 3 }, navText: { color: "#A6ABC7", fontSize: 11 }, downloadButton: { backgroundColor: "#F0B64A", borderRadius: 12, flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 9 }, downloadText: { color: "#171A35", fontSize: 12, fontWeight: "800" }, audioError: { color: "#F08B8B", textAlign: "center", fontSize: 12, marginTop: 12 }, tafsirCard: { backgroundColor: "#121630", borderRadius: 12, padding: 10, marginTop: 8 }, tafsirSource: { color: "#F0B64A", textAlign: "right", fontSize: 11, fontWeight: "800", marginBottom: 6 }, tafsirState: { alignItems: "center", paddingVertical: 22, gap: 10 }, tafsirStateText: { color: "#A6ABC7", textAlign: "center", lineHeight: 25 }, tafsirRow: { borderTopWidth: 1, borderTopColor: "#292D4D", paddingVertical: 9 }, tafsirAyah: { color: "#F0B64A", textAlign: "right", fontSize: 13, fontWeight: "800", marginBottom: 7 }, tafsirText: { color: "#F7F4EC", textAlign: "right", fontSize: 16, lineHeight: 28, writingDirection: "rtl" }, note: { color: "#737891", textAlign: "center", marginTop: 18, fontSize: 12 } });
