import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRANDS } from '../brands';
import { Settings } from '../storage';
import { BrandTag, Button, Field, TopBar } from '../ui/components';
import { BORDER, color, type } from '../ui/theme';

export function SettingsScreen(props: { settings: Settings; firstRun?: boolean; onSave: (s: Settings) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [st, setSt] = useState<Settings>(props.settings);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await props.onSave(st);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, paddingTop: insets.top }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TopBar title="Ajustes" onBack={props.firstRun ? undefined : props.onClose} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {props.firstRun && (
          <Text style={[type.body, { color: color.graphite, marginBottom: 6 }]}>
            Antes de arrancar, cargá las dos claves y el perfil de Upload-Post de cada marca.
          </Text>
        )}

        <Section title="Conexiones">
          <Field
            label="Clave de Upload-Post"
            hint="En upload-post.com, sección API Keys."
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={st.uploadPostKey}
            onChangeText={(uploadPostKey) => setSt({ ...st, uploadPostKey })}
          />
          <Field
            label="Clave de Anthropic"
            hint="En console.anthropic.com. Se usa para escribir los copies."
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={st.anthropicKey}
            onChangeText={(anthropicKey) => setSt({ ...st, anthropicKey })}
          />
          <Text style={[type.small, { marginTop: 10 }]}>Las claves se guardan cifradas en este celular y no salen de acá.</Text>
        </Section>

        {BRANDS.map((b) => (
          <Section key={b.id} title={<BrandTag brand={b} />}>
            <Field
              label="Perfil en Upload-Post"
              hint="Tal cual figura en Upload-Post, con mayúsculas y todo."
              autoCapitalize="none"
              autoCorrect={false}
              value={st.profiles[b.id]}
              onChangeText={(v) => setSt({ ...st, profiles: { ...st.profiles, [b.id]: v } })}
            />
            <Field
              label="Voz de la marca"
              hint="Instrucciones que sigue Claude al escribir los copies de esta marca."
              multiline
              tall
              value={st.voices[b.id]}
              onChangeText={(v) => setSt({ ...st, voices: { ...st.voices, [b.id]: v } })}
            />
            <Pressable onPress={() => setSt({ ...st, voices: { ...st.voices, [b.id]: b.defaultVoice } })} hitSlop={10} style={{ marginTop: 10 }}>
              <Text style={[type.label, { color: color.graphite, textDecorationLine: 'underline' }]}>Volver a la voz original</Text>
            </Pressable>
          </Section>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 + insets.bottom, borderTopWidth: BORDER, borderTopColor: color.ink }}>
        <Button label="Guardar" onPress={save} busy={saving} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Section(props: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 28, paddingTop: 18, borderTopWidth: BORDER, borderTopColor: color.ink }}>
      {typeof props.title === 'string' ? <Text style={type.h2}>{props.title}</Text> : props.title}
      {props.children}
    </View>
  );
}
