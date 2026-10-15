import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Brand } from '../brands';
import { BORDER, OFFSET, color, font, type } from './theme';

/** Tarjeta con la tinta de la marca desfasada detrás (registro corrido) */
export function InkCard(props: { ink?: string; children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; onLongPress?: () => void }) {
  return (
    <Pressable onPress={props.onPress} onLongPress={props.onLongPress} style={({ pressed }) => [{ marginRight: OFFSET, marginBottom: OFFSET }, props.style, pressed && props.onPress && { transform: [{ translateX: 2 }, { translateY: 2 }] }]}>
      {props.ink && <View style={[StyleSheet.absoluteFill, { backgroundColor: props.ink, top: OFFSET, left: OFFSET, right: -OFFSET, bottom: -OFFSET }]} />}
      <View style={ui.card}>{props.children}</View>
    </Pressable>
  );
}

/** Hueco libre en la grilla: contorno punteado */
export function EmptySlot(props: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} style={({ pressed }) => [ui.empty, pressed && { backgroundColor: color.plate }]}>
      <Text style={[type.small, { color: color.graphite }]}>{props.label}</Text>
    </Pressable>
  );
}

export function BrandTag({ brand, size = 'md' }: { brand: Brand; size?: 'sm' | 'md' }) {
  return (
    <View style={[ui.tag, { backgroundColor: brand.accent }, size === 'sm' && { paddingHorizontal: 6, paddingVertical: 1 }]}>
      <Text style={{ fontFamily: font.display, fontSize: size === 'sm' ? 14 : 17, letterSpacing: 0.5, color: brand.onAccent }}>
        {brand.name}
      </Text>
    </View>
  );
}

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'outline';
  busy?: boolean;
  disabled?: boolean;
  /** 0–1: rellena el botón con la tinta indicada mientras avanza */
  progress?: number;
  progressInk?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const solid = props.variant !== 'outline';
  const fg = solid ? color.plate : color.ink;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled || props.busy}
      style={({ pressed }) => [
        ui.button,
        { backgroundColor: solid ? color.ink : 'transparent' },
        (props.disabled && !props.busy) && { opacity: 0.35 },
        pressed && { opacity: 0.8 },
        props.style,
      ]}
    >
      {props.progress !== undefined && props.progress > 0 && (
        <View style={[StyleSheet.absoluteFill, { width: `${Math.min(100, props.progress * 100)}%`, backgroundColor: props.progressInk ?? color.graphite }]} />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {props.busy && <ActivityIndicator color={fg} style={{ marginRight: 10 }} />}
        <Text style={{ fontFamily: font.bodyBold, fontSize: 16, color: fg }}>{props.label}</Text>
      </View>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string; hint?: string; max?: number; tall?: boolean }) {
  const { label, hint, max, tall, style, ...input } = props;
  const [focus, setFocus] = useState(false);
  const len = (input.value ?? '').length;
  return (
    <View style={{ marginTop: 22 }}>
      <View style={ui.fieldHead}>
        <Text style={type.label}>{label}</Text>
        {max ? <Text style={[type.small, len > max && { color: color.alert }]}>{len}/{max}</Text> : null}
      </View>
      <TextInput
        {...input}
        onFocus={(e) => { setFocus(true); input.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); input.onBlur?.(e); }}
        placeholderTextColor={color.rule}
        selectionColor={color.ink}
        style={[ui.input, tall && { minHeight: 150 }, input.multiline && { textAlignVertical: 'top' }, focus && { borderColor: color.ink }, style]}
      />
      {hint ? <Text style={[type.small, { marginTop: 6 }]}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>(props: { options: { value: T; label: string; ink?: string; onInk?: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={ui.segment}>
      {props.options.map((o, i) => {
        const on = o.value === props.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => props.onChange(o.value)}
            style={[ui.segItem, i > 0 && { borderLeftWidth: BORDER }, on && { backgroundColor: o.ink ?? color.ink }]}
          >
            <Text style={{ fontFamily: font.display, fontSize: 17, color: on ? o.onInk ?? color.plate : color.ink }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TopBar(props: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={ui.topBar}>
      {props.onBack ? (
        <Pressable onPress={props.onBack} hitSlop={14} style={{ marginBottom: 10 }}>
          <Text style={type.label}>‹ Volver</Text>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Text style={type.hero}>{props.title}</Text>
        {props.right}
      </View>
    </View>
  );
}

export const ui = StyleSheet.create({
  card: { backgroundColor: color.plate, borderWidth: BORDER, borderColor: color.ink, padding: 14 },
  empty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: color.rule,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: OFFSET + 4,
    marginRight: OFFSET,
  },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2 },
  button: {
    minHeight: 56,
    borderWidth: BORDER,
    borderColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  fieldHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  input: {
    backgroundColor: color.plate,
    borderWidth: BORDER,
    borderColor: color.rule,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: font.body,
    fontSize: 16,
    lineHeight: 23,
    color: color.ink,
  },
  segment: { flexDirection: 'row', borderWidth: BORDER, borderColor: color.ink, backgroundColor: color.plate },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderColor: color.ink },
  topBar: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
});
