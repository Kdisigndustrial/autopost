import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRANDS, BrandId, brandById } from '../brands';
import { QueueItem, Settings } from '../storage';
import { SLOT_HOURS, formatDay, formatSlot, isSlotUpcoming, slotFor, slotToTime, upcomingDays } from '../schedule';
import { fetchJobStatus } from '../api';
import { BrandTag, Button, EmptySlot, InkCard, Segmented, TopBar } from '../ui/components';
import { BORDER, color, type } from '../ui/theme';

type Filter = 'all' | BrandId;

const STATUS: Record<QueueItem['status'], { label: string; color: string }> = {
  scheduled: { label: 'Programado', color: color.graphite },
  published: { label: 'Publicado', color: color.done },
  partial: { label: 'Salió en una sola red', color: '#B26B00' },
  failed: { label: 'No se publicó', color: color.alert },
};

export function QueueScreen(props: {
  queue: QueueItem[];
  settings: Settings;
  onChange: (q: QueueItem[]) => void;
  onNew: (preset?: { brand: BrandId; slot: string }) => void;
  onSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const brands = filter === 'all' ? BRANDS : [brandById(filter)];
  const visible = props.queue.filter((q) => filter === 'all' || q.brand === filter);
  const upcoming = visible.filter((q) => slotToTime(q.slot) > Date.now());
  const history = visible
    .filter((q) => slotToTime(q.slot) <= Date.now())
    .sort((a, b) => b.slot.localeCompare(a.slot));

  // 7 días + cualquier día más lejano que ya tenga algo programado
  const days = useMemo(() => {
    const base = upcomingDays(7);
    const extra = upcoming.map((q) => q.slot.slice(0, 10)).filter((d) => !base.includes(d));
    return [...base, ...Array.from(new Set(extra)).sort()];
  }, [upcoming]);

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
            return { ...item, results: st.results, status: okAll ? 'published' : okAny ? 'partial' : 'failed' } as QueueItem;
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

  // Al abrir, chequea lo que ya debería haber salido
  useEffect(() => {
    if (props.queue.some((q) => q.status === 'scheduled' && q.jobId && slotToTime(q.slot) <= Date.now())) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = (item: QueueItem) =>
    Alert.alert(
      'Quitar de la cola',
      'Lo saca de esta lista. Si ya está programado, cancelalo también desde el panel de Upload-Post para que no se publique.',
      [
        { text: 'Volver', style: 'cancel' },
        { text: 'Quitar', style: 'destructive', onPress: () => props.onChange(props.queue.filter((q) => q.id !== item.id)) },
      ],
    );

  const count = upcoming.length;

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <TopBar
        title="Cola"
        right={
          <Pressable onPress={props.onSettings} hitSlop={14} style={{ paddingBottom: 6 }}>
            <Text style={type.label}>Ajustes</Text>
          </Pressable>
        }
      />
      <View style={{ paddingHorizontal: 20, marginBottom: 6 }}>
        <Text style={[type.small, { marginBottom: 12 }]}>
          {count === 0 ? 'No hay nada programado.' : `${count} ${count === 1 ? 'video programado' : 'videos programados'}`}
        </Text>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Todas' },
            ...BRANDS.map((b) => ({ value: b.id as Filter, label: b.name, ink: b.accent, onInk: b.onAccent })),
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={color.ink} colors={[color.ink]} />}
      >
        {days.map((day) => {
          const rows = SLOT_HOURS.map((h) => slotFor(day, h)).filter(
            (slot) => isSlotUpcoming(slot) || upcoming.some((q) => q.slot === slot),
          );
          if (!rows.length) return null;
          return (
            <View key={day} style={{ marginTop: 18 }}>
              <Text style={[type.h2, { marginBottom: 10 }]}>{formatDay(day)}</Text>
              {rows.map((slot) => (
                <View key={slot} style={{ flexDirection: 'row' }}>
                  <Text style={[type.time, { width: 70, paddingTop: 10 }]}>{slot.slice(11)}</Text>
                  <View style={{ flex: 1 }}>
                    {brands.map((b) => {
                      const item = upcoming.find((q) => q.slot === slot && q.brand === b.id);
                      return item ? (
                        <PostCard key={b.id} item={item} onLongPress={() => remove(item)} />
                      ) : (
                        <EmptySlot key={b.id} label={`+ Libre para ${b.name}`} onPress={() => props.onNew({ brand: b.id, slot })} />
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          );
        })}

        {history.length > 0 && (
          <View style={{ marginTop: 34 }}>
            <Pressable onPress={() => setShowHistory(!showHistory)} hitSlop={10}>
              <Text style={type.h2}>
                {showHistory ? '▾' : '▸'} Ya publicados ({history.length})
              </Text>
            </Pressable>
            {showHistory && (
              <View style={{ marginTop: 12 }}>
                {history.slice(0, 40).map((item) => (
                  <PostCard key={item.id} item={item} showWhen onLongPress={() => remove(item)} />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 + insets.bottom, borderTopWidth: BORDER, borderTopColor: color.ink, backgroundColor: color.concrete }}>
        <Button label="Cargar videos" onPress={() => props.onNew()} />
      </View>
    </View>
  );
}

function PostCard({ item, showWhen, onLongPress }: { item: QueueItem; showWhen?: boolean; onLongPress: () => void }) {
  const b = brandById(item.brand);
  const st = STATUS[item.status];
  const failed = item.results?.filter((r) => !r.success) ?? [];
  return (
    <InkCard ink={b.accent} onLongPress={onLongPress} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <BrandTag brand={b} size="sm" />
        {showWhen && <Text style={[type.small, { color: st.color, fontFamily: type.label.fontFamily }]}>{st.label}</Text>}
      </View>
      {showWhen && <Text style={[type.label, { marginBottom: 4 }]}>{formatSlot(item.slot)}</Text>}
      <Text style={type.body} numberOfLines={2}>
        {item.caption}
      </Text>
      {failed.length > 0 && (
        <Text style={[type.small, { color: color.alert, marginTop: 8 }]}>
          {failed.map((r) => `${r.platform === 'youtube' ? 'YouTube' : 'TikTok'}: ${r.message ?? 'error'}`).join('\n')}
        </Text>
      )}
    </InkCard>
  );
}
