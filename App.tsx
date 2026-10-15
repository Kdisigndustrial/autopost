import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BRANDS, BrandId, brandById } from './src/brands';
import { QueueItem, Settings, loadQueue, loadSettings, saveQueue, saveSettings } from './src/storage';
import { formatSlot, nextFreeSlot, slotToTime } from './src/schedule';
import { fetchJobStatus, generateCopy, schedulePost } from './src/api';

type Screen = 'queue' | 'new' | 'settings';

const C = {
  bg: '#0B0B0C',
  card: '#17171A',
  line: '#2A2A2F',
  text: '#F2F2F2',
  dim: '#8C8C95',
  danger: '#FF5A4F',
  ok: '#3BE38C',
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('queue');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    (async () => {
      const [s, q] = await Promise.all([loadSettings(), loadQueue()]);
      setSettings(s);
      setQueue(q);
      if (!s.uploadPostKey || !s.anthropicKey) setScreen('settings');
    })();
  }, []);

  const updateQueue = useCallback(async (q: QueueItem[]) => {
    setQueue(q);
    await saveQueue(q);
  }, []);

  if (!settings) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color={C.text} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      {screen === 'queue' && (
        <QueueScreen
          queue={queue}
          settings={settings}
          onChange={updateQueue}
          onNew={() => setScreen('new')}
          onSettings={() => setScreen('settings')}
        />
      )}
      {screen === 'new' && (
        <NewPostScreen
          queue={queue}
          settings={settings}
          onScheduled={(item) => updateQueue([...queue, item])}
          onClose={() => setScreen('queue')}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          settings={settings}
          onSave={async (ns) => {
            await saveSettings(ns);
            setSettings(ns);
            setScreen('queue');
          }}
          onClose={() => setScreen('queue')}
        />
      )}
    </View>
  );
}

/* ---------------- Cola ---------------- */

function QueueScreen(props: {
  queue: QueueItem[];
  settings: Settings;
  onChange: (q: QueueItem[]) => void;
  onNew: () => void;
  onSettings: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const sorted = [...props.queue].sort((a, b) => b.slot.localeCompare(a.slot));

  const refresh = async () => {
    setRefreshing(true);
    try {
      const now = Date.now();
      const next = await Promise.all(
        props.queue.map(async (item) => {
          if (item.status !== 'scheduled' || !item.jobId || slotToTime(item.slot) > now) return item;
          try {
            const st = await fetchJobStatus(props.settings.uploadPostKey, item.jobId);
            if (st.status !== 'completed') return { ...item, results: st.results };
            const okAll = st.results.length > 0 && st.results.every((r) => r.success);
            const okAny = st.results.some((r) => r.success);
            return {
              ...item,
              results: st.results,
              status: okAll ? 'published' : okAny ? 'partial' : 'failed',
            } as QueueItem;
          } catch {
            return item;
          }
        }),
      );
      props.onChange(next);
    } finally {
      setRefreshing(false);
    }
  };

  const remove = (id: string) =>
    Alert.alert(
      'Quitar de la lista',
      'Esto solo lo saca de la app. Si ya está programado, cancelalo también desde el panel de Upload-Post.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Quitar', style: 'destructive', onPress: () => props.onChange(props.queue.filter((q) => q.id !== id)) },
      ],
    );

  return (
    <View style={s.flex}>
      <Header title="AUTOPOST" right={<HeaderBtn label="Ajustes" onPress={props.onSettings} />} />
      <FlatList
        data={sorted}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.text} />}
        ListEmptyComponent={
          <Text style={[s.dim, { textAlign: 'center', marginTop: 60 }]}>
            Todavía no programaste nada.{'\n'}Tocá “+ Nuevo” para cargar videos.
          </Text>
        }
        renderItem={({ item }) => {
          const b = brandById(item.brand);
          return (
            <Pressable onLongPress={() => remove(item.id)} style={s.card}>
              <View style={s.rowBetween}>
                <Text style={[s.chip, { backgroundColor: b.accent }]}>{b.name}</Text>
                <StatusPill status={item.status} />
              </View>
              <Text style={s.slot}>{formatSlot(item.slot)}</Text>
              <Text style={s.text} numberOfLines={2}>
                {item.caption}
              </Text>
              {item.results?.some((r) => !r.success) && (
                <Text style={[s.small, { color: C.danger }]}>
                  {item.results
                    .filter((r) => !r.success)
                    .map((r) => `${r.platform}: ${r.message ?? 'error'}`)
                    .join('\n')}
                </Text>
              )}
            </Pressable>
          );
        }}
      />
      <Pressable style={s.fab} onPress={props.onNew}>
        <Text style={s.fabText}>+ Nuevo</Text>
      </Pressable>
    </View>
  );
}

function StatusPill({ status }: { status: QueueItem['status'] }) {
  const map = {
    scheduled: ['Programado', C.dim],
    published: ['Publicado', C.ok],
    partial: ['Parcial', '#FFC24B'],
    failed: ['Falló', C.danger],
  } as const;
  const [label, color] = map[status];
  return <Text style={[s.small, { color, fontWeight: '700' }]}>{label}</Text>;
}

/* ---------------- Nuevo post ---------------- */

interface Draft {
  asset: ImagePicker.ImagePickerAsset;
  brand: BrandId;
  notes: string;
  title: string;
  caption: string;
}

function NewPostScreen(props: {
  queue: QueueItem[];
  settings: Settings;
  onScheduled: (item: QueueItem) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [idx, setIdx] = useState(0);
  const [lastBrand, setLastBrand] = useState<BrandId>('navaja');
  const [busy, setBusy] = useState<'' | 'copy' | 'upload'>('');
  const [progress, setProgress] = useState(0);
  // horarios ocupados mientras se cargan varios videos en la misma tanda
  const [localQueue, setLocalQueue] = useState<QueueItem[]>(props.queue);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: true,
      selectionLimit: 20,
      quality: 1,
    });
    if (res.canceled || !res.assets?.length) return;
    setDrafts(res.assets.map((asset) => ({ asset, brand: lastBrand, notes: '', title: '', caption: '' })));
    setIdx(0);
  };

  const d = drafts[idx];
  const set = (patch: Partial<Draft>) =>
    setDrafts((all) => all.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  const slot = d ? nextFreeSlot(d.brand, localQueue) : '';

  const doGenerate = async () => {
    if (!d) return;
    setBusy('copy');
    try {
      const copy = await generateCopy({
        apiKey: props.settings.anthropicKey,
        voice: props.settings.voices[d.brand],
        notes: d.notes,
        fileName: d.asset.fileName ?? undefined,
      });
      set({ title: copy.title, caption: copy.caption });
    } catch (e: any) {
      Alert.alert('No se pudo generar el copy', e.message);
    } finally {
      setBusy('');
    }
  };

  const doSchedule = async () => {
    if (!d) return;
    if (!d.caption.trim()) return Alert.alert('Falta el copy', 'Generalo o escribilo antes de programar.');
    setBusy('upload');
    setProgress(0);
    try {
      const name = d.asset.fileName ?? `video-${Date.now()}.mp4`;
      const { jobId } = await schedulePost({
        apiKey: props.settings.uploadPostKey,
        profile: props.settings.profiles[d.brand],
        video: { uri: d.asset.uri, name, type: d.asset.mimeType ?? 'video/mp4' },
        title: d.title,
        caption: d.caption,
        slot,
        onProgress: setProgress,
      });
      const item: QueueItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        brand: d.brand,
        fileName: name,
        title: d.title,
        caption: d.caption,
        slot,
        jobId,
        status: 'scheduled',
        createdAt: Date.now(),
      };
      props.onScheduled(item);
      setLocalQueue((q) => [...q, item]);
      setLastBrand(d.brand);
      if (idx + 1 < drafts.length) setIdx(idx + 1);
      else {
        Alert.alert('Listo', 'Todos los videos quedaron programados.');
        props.onClose();
      }
    } catch (e: any) {
      Alert.alert('No se pudo programar', e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header
        title={drafts.length > 1 ? `VIDEO ${idx + 1}/${drafts.length}` : 'NUEVO'}
        left={<HeaderBtn label="‹ Volver" onPress={props.onClose} />}
      />
      {!d ? (
        <View style={[s.flex, s.center, { padding: 24 }]}>
          <Pressable style={s.bigBtn} onPress={pick}>
            <Text style={s.bigBtnText}>Elegir videos de la galería</Text>
          </Pressable>
          <Text style={[s.dim, { marginTop: 16, textAlign: 'center' }]}>
            Podés elegir varios. Cada uno se programa en el próximo horario libre (12 o 20 hs) de su marca.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Text style={s.small} numberOfLines={1}>
            {d.asset.fileName ?? 'video'}
            {d.asset.duration ? ` · ${Math.round(d.asset.duration / 1000)} s` : ''}
          </Text>

          <Label>Marca</Label>
          <View style={s.row}>
            {BRANDS.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => set({ brand: b.id })}
                style={[s.brandBtn, d.brand === b.id && { backgroundColor: b.accent, borderColor: b.accent }]}
              >
                <Text style={[s.brandBtnText, d.brand === b.id && { color: '#000' }]}>{b.name}</Text>
              </Pressable>
            ))}
          </View>

          <Label>¿De qué trata? (tus palabras)</Label>
          <TextInput
            style={[s.input, { minHeight: 70 }]}
            multiline
            placeholder="ej: kickflip de Juancito en el spot de Bernal, tabla nueva del drop"
            placeholderTextColor={C.dim}
            value={d.notes}
            onChangeText={(notes) => set({ notes })}
          />
          <Pressable style={s.btn} onPress={doGenerate} disabled={!!busy}>
            {busy === 'copy' ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Generar copy</Text>}
          </Pressable>

          <Label>Título (YouTube)</Label>
          <TextInput
            style={s.input}
            value={d.title}
            maxLength={100}
            onChangeText={(title) => set({ title })}
            placeholderTextColor={C.dim}
            placeholder="Título corto"
          />

          <Label>Copy + hashtags (TikTok y YouTube)</Label>
          <TextInput
            style={[s.input, { minHeight: 140 }]}
            multiline
            value={d.caption}
            onChangeText={(caption) => set({ caption })}
            placeholderTextColor={C.dim}
            placeholder="Generalo o escribilo vos"
          />

          <View style={[s.card, { marginTop: 18 }]}>
            <Text style={s.dim}>Se publica en TikTok y YouTube Shorts</Text>
            <Text style={s.slot}>{formatSlot(slot)}</Text>
          </View>

          <Pressable style={[s.bigBtn, { marginTop: 8 }]} onPress={doSchedule} disabled={!!busy}>
            {busy === 'upload' ? (
              <View style={s.row}>
                <ActivityIndicator color="#000" />
                <Text style={[s.bigBtnText, { marginLeft: 10 }]}>{progress > 0 && progress < 1 ? `Subiendo… ${Math.round(progress * 100)}%` : progress >= 1 ? 'Procesando…' : 'Subiendo video…'}
                </Text>
              </View>
            ) : (
              <Text style={s.bigBtnText}>Programar</Text>
            )}
          </Pressable>
          {drafts.length > 1 && idx + 1 < drafts.length && (
            <Pressable onPress={() => setIdx(idx + 1)} disabled={!!busy}>
              <Text style={[s.dim, { textAlign: 'center', marginTop: 14 }]}>Saltear este video</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

/* ---------------- Ajustes ---------------- */

function SettingsScreen(props: { settings: Settings; onSave: (s: Settings) => void; onClose: () => void }) {
  const [st, setSt] = useState<Settings>(props.settings);
  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="AJUSTES" left={<HeaderBtn label="‹ Volver" onPress={props.onClose} />} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Label>Clave API de Upload-Post</Label>
        <TextInput
          style={s.input}
          secureTextEntry
          autoCapitalize="none"
          value={st.uploadPostKey}
          onChangeText={(uploadPostKey) => setSt({ ...st, uploadPostKey })}
        />
        <Label>Clave API de Anthropic (Claude)</Label>
        <TextInput
          style={s.input}
          secureTextEntry
          autoCapitalize="none"
          value={st.anthropicKey}
          onChangeText={(anthropicKey) => setSt({ ...st, anthropicKey })}
        />
        <Text style={[s.small, { marginTop: 6 }]}>Las claves quedan guardadas cifradas en este celular.</Text>

        {BRANDS.map((b) => (
          <View key={b.id} style={{ marginTop: 26 }}>
            <Text style={[s.chip, { backgroundColor: b.accent, alignSelf: 'flex-start' }]}>{b.name}</Text>
            <Label>Nombre del perfil en Upload-Post</Label>
            <TextInput
              style={s.input}
              autoCapitalize="none"
              placeholder="tal cual figura en Upload-Post"
              placeholderTextColor={C.dim}
              value={st.profiles[b.id]}
              onChangeText={(v) => setSt({ ...st, profiles: { ...st.profiles, [b.id]: v } })}
            />
            <Label>Voz de la marca (instrucciones para los copies)</Label>
            <TextInput
              style={[s.input, { minHeight: 160 }]}
              multiline
              value={st.voices[b.id]}
              onChangeText={(v) => setSt({ ...st, voices: { ...st.voices, [b.id]: v } })}
            />
            <Pressable onPress={() => setSt({ ...st, voices: { ...st.voices, [b.id]: b.defaultVoice } })}>
              <Text style={[s.small, { marginTop: 6, textDecorationLine: 'underline' }]}>Restaurar voz por defecto</Text>
            </Pressable>
          </View>
        ))}

        <Pressable style={[s.bigBtn, { marginTop: 30 }]} onPress={() => props.onSave(st)}>
          <Text style={s.bigBtnText}>Guardar</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---------------- UI chica ---------------- */

function Header(props: { title: string; left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={s.header}>
      <View style={{ width: 90 }}>{props.left}</View>
      <Text style={s.headerTitle}>{props.title}</Text>
      <View style={{ width: 90, alignItems: 'flex-end' }}>{props.right}</View>
    </View>
  );
}

const HeaderBtn = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable onPress={onPress} hitSlop={12}>
    <Text style={s.headerBtn}>{label}</Text>
  </Pressable>
);

const Label = ({ children }: { children: React.ReactNode }) => <Text style={s.label}>{children}</Text>;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 48 },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '900', letterSpacing: 2 },
  headerBtn: { color: C.text, fontSize: 15 },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  chip: {
    color: '#000',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  slot: { color: C.text, fontSize: 18, fontWeight: '800', marginVertical: 6 },
  text: { color: C.text, fontSize: 14, lineHeight: 20 },
  dim: { color: C.dim, fontSize: 14 },
  small: { color: C.dim, fontSize: 12 },
  label: { color: C.dim, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 18, marginBottom: 6 },
  input: {
    backgroundColor: C.card,
    color: C.text,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  brandBtn: { borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, marginRight: 10 },
  brandBtnText: { color: C.text, fontWeight: '900', letterSpacing: 1 },
  btn: { backgroundColor: C.text, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#000', fontWeight: '800', fontSize: 15 },
  bigBtn: { backgroundColor: C.text, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center', alignSelf: 'stretch' },
  bigBtnText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: C.text,
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 26,
    elevation: 6,
  },
  fabText: { color: '#000', fontWeight: '900', fontSize: 16 },
});
