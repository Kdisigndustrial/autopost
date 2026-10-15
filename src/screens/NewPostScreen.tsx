import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRANDS, BrandId, brandById } from '../brands';
import { QueueItem, Settings } from '../storage';
import { formatSlot, freeSlots } from '../schedule';
import { generateCopy, schedulePost } from '../api';
import { Button, Field, TopBar } from '../ui/components';
import { BORDER, OFFSET, color, font, type } from '../ui/theme';

interface Draft {
  asset: ImagePicker.ImagePickerAsset;
  brand: BrandId;
  /** horario elegido a mano; si no, el próximo libre */
  slot?: string;
  notes: string;
  title: string;
  caption: string;
}

export function NewPostScreen(props: {
  queue: QueueItem[];
  settings: Settings;
  preset?: { brand: BrandId; slot: string };
  /** solo para vista previa de diseño */
  demoAssets?: ImagePicker.ImagePickerAsset[];
  onScheduled: (item: QueueItem) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [idx, setIdx] = useState(0);
  const [lastBrand, setLastBrand] = useState<BrandId>(props.preset?.brand ?? 'navaja');
  const [busy, setBusy] = useState<'' | 'copy' | 'upload'>('');
  const [progress, setProgress] = useState(0);
  // incluye lo programado en esta misma tanda
  const [localQueue, setLocalQueue] = useState<QueueItem[]>(props.queue);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: true,
      selectionLimit: 20,
      quality: 1,
    });
    if (res.canceled || !res.assets?.length) return;
    setDrafts(
      res.assets.map((asset, i) => ({
        asset,
        brand: lastBrand,
        slot: i === 0 ? props.preset?.slot : undefined,
        notes: '',
        title: '',
        caption: '',
      })),
    );
    setIdx(0);
  };

  // Abre la galería directo al entrar
  useEffect(() => {
    if (props.demoAssets) {
      setDrafts(props.demoAssets.map((asset) => ({ asset, brand: lastBrand, notes: 'kickflip de Juancito en el spot de Bernal, tabla nueva del drop', title: 'Kickflip en Bernal con la tabla nueva', caption: 'Bernal, cemento y una tabla recién salida del drop.\nJuancito la estrena con kickflip limpio, sin vueltas.\n#navajaskate #skateargentina #kickflip #skatebuenosaires #streetskate #shorts' })));
      return;
    }
    pick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = drafts[idx];
  const brand = d ? brandById(d.brand) : null;
  const set = (patch: Partial<Draft>) => setDrafts((all) => all.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  const options = d ? freeSlots(d.brand, localQueue, 6) : [];
  const slot = d ? (d.slot && options.includes(d.slot) ? d.slot : options[0]) : '';

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
      Alert.alert('No se pudo escribir el copy', e.message);
    } finally {
      setBusy('');
    }
  };

  const doSchedule = async () => {
    if (!d || !slot) return;
    if (!d.caption.trim()) return Alert.alert('Falta el copy', 'Escribilo vos o generalo con Claude antes de programar.');
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (idx + 1 < drafts.length) {
        setDrafts((all) => all.map((x, i) => (i === idx + 1 ? { ...x, brand: d.brand } : x)));
        setIdx(idx + 1);
      } else {
        props.onClose();
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('No se pudo programar', e.message);
    } finally {
      setBusy('');
      setProgress(0);
    }
  };

  if (!d || !brand) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <TopBar title="Nuevo" onBack={props.onClose} />
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 80 }}>
          <Text style={[type.h1, { marginBottom: 10 }]}>Elegí los videos</Text>
          <Text style={[type.body, { color: color.graphite, marginBottom: 26 }]}>
            Podés elegir varios. Cada uno va al próximo horario libre de su marca, a las 12 o a las 20.
          </Text>
          <Button label="Abrir galería" onPress={pick} />
        </View>
      </View>
    );
  }

  const uploadLabel =
    busy === 'upload'
      ? progress >= 0.999
        ? 'Programando…'
        : `Subiendo ${Math.round(progress * 100)}%`
      : `Programar para ${slot ? formatSlot(slot).toLowerCase() : '—'}`;

  return (
    <KeyboardAvoidingView style={{ flex: 1, paddingTop: insets.top }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TopBar
        title="Nuevo"
        onBack={busy ? undefined : props.onClose}
        right={
          drafts.length > 1 ? (
            <Text style={[type.label, { paddingBottom: 6 }]}>
              Video {idx + 1} de {drafts.length}
            </Text>
          ) : null
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row' }}>
          <Preview key={d.asset.uri} uri={d.asset.uri} ink={brand.accent} />
          <View style={{ flex: 1, marginLeft: 18 }}>
            <Text style={[type.label, { marginBottom: 8 }]}>Marca</Text>
            {BRANDS.map((b) => {
              const on = b.id === d.brand;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => set({ brand: b.id, slot: undefined })}
                  style={[s.brandBtn, on && { backgroundColor: b.accent }]}
                >
                  <Text style={{ fontFamily: font.display, fontSize: 22, color: on ? b.onAccent : color.ink }}>{b.name}</Text>
                </Pressable>
              );
            })}
            <Text style={[type.small, { marginTop: 6 }]} numberOfLines={1}>
              {d.asset.duration ? `${Math.round(d.asset.duration / 1000)} s` : ''}
              {d.asset.width && d.asset.height ? `${d.asset.duration ? ', ' : ''}${d.asset.width}×${d.asset.height}` : ''}
            </Text>
          </View>
        </View>

        <Text style={[type.label, { marginTop: 26, marginBottom: 10 }]}>Cuándo sale</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {options.map((o) => {
            const on = o === slot;
            return (
              <Pressable key={o} onPress={() => set({ slot: o })} style={[s.slotChip, on && { backgroundColor: color.ink }]}>
                <Text style={{ fontFamily: font.bodyMedium, fontSize: 14, color: on ? color.plate : color.ink }}>{formatSlot(o)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={[type.small, { marginTop: 8 }]}>Se publica en TikTok y YouTube Shorts al mismo tiempo.</Text>

        <Field
          label="¿De qué trata?"
          hint="Con tus palabras, aunque sea a medias. Claude lo pasa a la voz de la marca."
          multiline
          value={d.notes}
          onChangeText={(notes) => set({ notes })}
          placeholder={d.brand === 'navaja' ? 'kickflip de Juancito en el spot de Bernal' : 'adelanto del track nuevo, parte del bajo'}
        />
        <Button
          label={d.caption ? 'Reescribir copy con Claude' : 'Escribir copy con Claude'}
          variant="outline"
          onPress={doGenerate}
          busy={busy === 'copy'}
          disabled={!!busy}
          style={{ marginTop: 12 }}
        />

        <Field label="Copy y hashtags" max={2200} tall multiline value={d.caption} onChangeText={(caption) => set({ caption })} placeholder="Generalo o escribilo vos" />
        <Field label="Título para YouTube" max={100} value={d.title} onChangeText={(title) => set({ title })} placeholder="Corto, sin hashtags" />

        {drafts.length > 1 && idx + 1 < drafts.length && !busy && (
          <Pressable onPress={() => setIdx(idx + 1)} style={{ marginTop: 22, alignSelf: 'center' }} hitSlop={10}>
            <Text style={[type.label, { color: color.graphite, textDecorationLine: 'underline' }]}>Saltear este video</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Button
          label={uploadLabel}
          onPress={doSchedule}
          disabled={!!busy || !slot}
          busy={busy === 'upload' && progress >= 0.999}
          progress={busy === 'upload' ? progress : undefined}
          progressInk={brand.accent}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Preview({ uri, ink }: { uri: string; ink: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <View style={{ width: 128 + OFFSET, height: 228 + OFFSET }}>
      <View style={{ position: 'absolute', left: OFFSET, top: OFFSET, width: 128, height: 228, backgroundColor: ink }} />
      <View style={s.preview}>
        <VideoView player={player} style={{ flex: 1 }} contentFit="cover" nativeControls={false} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  preview: { width: 128, height: 228, borderWidth: BORDER, borderColor: color.ink, backgroundColor: color.ink, overflow: 'hidden' },
  brandBtn: {
    borderWidth: BORDER,
    borderColor: color.ink,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: color.plate,
  },
  slotChip: {
    borderWidth: BORDER,
    borderColor: color.ink,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: color.plate,
  },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: BORDER, borderTopColor: color.ink, backgroundColor: color.concrete },
});
