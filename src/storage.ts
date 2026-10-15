import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { BRANDS, BrandId } from './brands';

export interface Settings {
  uploadPostKey: string;
  anthropicKey: string;
  /** Nombre del perfil en Upload-Post para cada marca */
  profiles: Record<BrandId, string>;
  voices: Record<BrandId, string>;
}

export type PostStatus = 'scheduled' | 'published' | 'partial' | 'failed';

export interface PlatformResult {
  platform: string;
  success: boolean;
  message?: string;
}

export interface QueueItem {
  id: string;
  brand: BrandId;
  fileName: string;
  title: string;
  caption: string;
  /** "YYYY-MM-DDTHH:mm" hora Argentina */
  slot: string;
  jobId?: string;
  status: PostStatus;
  results?: PlatformResult[];
  createdAt: number;
}

const QUEUE_KEY = 'autopost.queue.v1';
const PREFS_KEY = 'autopost.prefs.v1';
const UP_KEY = 'uploadPostKey';
const AN_KEY = 'anthropicKey';

export async function loadSettings(): Promise<Settings> {
  const [up, an, prefsRaw] = await Promise.all([
    SecureStore.getItemAsync(UP_KEY),
    SecureStore.getItemAsync(AN_KEY),
    AsyncStorage.getItem(PREFS_KEY),
  ]);
  const prefs = prefsRaw ? JSON.parse(prefsRaw) : {};
  const profiles = {} as Record<BrandId, string>;
  const voices = {} as Record<BrandId, string>;
  for (const b of BRANDS) {
    profiles[b.id] = prefs.profiles?.[b.id] ?? '';
    voices[b.id] = prefs.voices?.[b.id] || b.defaultVoice;
  }
  return { uploadPostKey: up ?? '', anthropicKey: an ?? '', profiles, voices };
}

export async function saveSettings(s: Settings) {
  await Promise.all([
    SecureStore.setItemAsync(UP_KEY, s.uploadPostKey.trim()),
    SecureStore.setItemAsync(AN_KEY, s.anthropicKey.trim()),
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ profiles: s.profiles, voices: s.voices })),
  ]);
}

export async function loadQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveQueue(q: QueueItem[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}
