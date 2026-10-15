import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BrandId } from './src/brands';
import { QueueItem, Settings, loadQueue, loadSettings, saveQueue, saveSettings } from './src/storage';
import { QueueScreen } from './src/screens/QueueScreen';
import { NewPostScreen } from './src/screens/NewPostScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { color, fontFiles } from './src/ui/theme';

type Route =
  | { name: 'queue' }
  | { name: 'new'; preset?: { brand: BrandId; slot: string } }
  | { name: 'settings'; firstRun?: boolean };

export default function App() {
  const [fontsLoaded] = useFonts(fontFiles);
  const [route, setRoute] = useState<Route>({ name: 'queue' });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    (async () => {
      const [s, q] = await Promise.all([loadSettings(), loadQueue()]);
      setSettings(s);
      setQueue(q);
      const missing = !s.uploadPostKey || !s.anthropicKey || Object.values(s.profiles).some((p) => !p);
      if (missing) setRoute({ name: 'settings', firstRun: true });
    })();
  }, []);

  const updateQueue = useCallback(async (q: QueueItem[]) => {
    setQueue(q);
    await saveQueue(q);
  }, []);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: color.concrete }}>
        <StatusBar style="dark" />
        {!fontsLoaded || !settings ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={color.ink} />
          </View>
        ) : route.name === 'queue' ? (
          <QueueScreen
            queue={queue}
            settings={settings}
            onChange={updateQueue}
            onNew={(preset) => setRoute({ name: 'new', preset })}
            onSettings={() => setRoute({ name: 'settings' })}
          />
        ) : route.name === 'new' ? (
          <NewPostScreen
            queue={queue}
            settings={settings}
            preset={route.preset}
            onScheduled={(item) =>
              setQueue((q) => {
                const next = [...q, item];
                saveQueue(next);
                return next;
              })
            }
            onClose={() => setRoute({ name: 'queue' })}
          />
        ) : (
          <SettingsScreen
            settings={settings}
            firstRun={route.firstRun}
            onSave={async (ns) => {
              await saveSettings(ns);
              setSettings(ns);
              setRoute({ name: 'queue' });
            }}
            onClose={() => setRoute({ name: 'queue' })}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}
