// Paper things that live on the board: index cards, tape, handwriting, prints, sticky notes, rubber stamps.
import type { ReactNode } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { fonts, handType, palettes, radii, spacing, SurfaceProvider, world } from '@/theme';

import { fillImage, materials } from './materials';
import { Pin, useBoardAnchor, type AnchorOptions, type PinKind } from './string-board';
import { pressedStyle } from '@/components/ui/button';

/** Deterministic small tilt from a key, so cards look pinned by hand but never jitter between renders. */
export function tiltFor(key: string | number | undefined, max = 0.8): number {
  if (key === undefined) return 0;
  const s = String(key);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (((h % 1000) + 1000) % 1000) / 1000 * 2 * max - max;
}

/** Paper lifted off the cork: a soft, offset shadow like the lamp overhead. */
export const paperShadow: ViewStyle = Platform.select<ViewStyle>({
  web: { boxShadow: '0 3px 8px rgba(0,0,0,0.42), 0 1px 1px rgba(0,0,0,0.3)' } as ViewStyle,
  android: { elevation: 5 },
  default: { shadowColor: world.shadow, shadowOpacity: 0.45, shadowRadius: 7, shadowOffset: { width: 0, height: 3 } },
})!;

export interface PaperProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Flat paper (no texture): nested slips and sheets. */
  plain?: boolean;
}

/** Aged ivory paper. Everything inside reads ink-on-paper (Courier Prime) through the surface context. */
export function Paper({ children, style, plain = false }: PaperProps) {
  return (
    <View style={[styles.paper, style]}>
      {!plain && <Image source={materials.paper} style={fillImage} resizeMode="cover" accessible={false} />}
      <SurfaceProvider surface="paper">{children}</SurfaceProvider>
    </View>
  );
}

export interface PinnedProps extends AnchorOptions {
  children: ReactNode;
  /** How it hangs: a push pin (default), a strip of tape, or nothing. */
  fasten?: 'pin' | 'tape' | 'none';
  /** Tilt seed (degrees are derived); false keeps it square. */
  tilt?: string | number | false;
  style?: StyleProp<ViewStyle>;
}

/**
 * Something hung on the cork. Inside a StringBoard its pin joins the board (and its thread); elsewhere it draws
 * its own pin.
 */
export function Pinned({ children, fasten = 'pin', tilt, style, thread, order, pin = 'red', at }: PinnedProps) {
  const { ref, onLayout, pinned } = useBoardAnchor({ thread, order, pin: fasten === 'pin' ? pin : null, at });
  const angle = tilt === false ? 0 : tiltFor(tilt);
  return (
    <View
      ref={ref}
      onLayout={onLayout}
      collapsable={false}
      style={[angle ? { transform: [{ rotate: `${angle.toFixed(2)}deg` }] } : null, style]}>
      {children}
      {fasten === 'pin' && !pinned && <Pin kind={pin as PinKind} style={at === 'top' ? styles.ownPinTop : styles.ownPinLeft} />}
      {fasten === 'tape' && <Tape style={styles.tapeTop} />}
    </View>
  );
}

export function Tape({ width = 84, style }: { width?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ width, height: width * 0.2 }, style]}>
      <Image source={materials.tape} style={fillImage} resizeMode="stretch" accessible={false} />
    </View>
  );
}

/** Handwriting in marker (Caveat). Decorative voice for labels and margin notes, never for data. */
export function Hand({
  children,
  size = 'note',
  color,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  size?: 'note' | 'label';
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} maxFontSizeMultiplier={1.4} style={[handType[size], { color: color ?? palettes.desk.text }, style]}>
      {children}
    </Text>
  );
}

/** A strip of masking tape with a handwritten label: act headers, section titles. */
export function TapeLabel({ children, note, style }: { children: string; note?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.tapeRow, style]} accessibilityRole="header" accessible accessibilityLabel={note ? `${children}, ${note}` : children}>
      <View style={[styles.tapeLabel, { transform: [{ rotate: `${tiltFor(children, 2).toFixed(2)}deg` }] }]}>
        <Image source={materials.tape} style={fillImage} resizeMode="stretch" accessible={false} />
        <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[handType.label, styles.tapeText]}>
          {children}
        </Text>
      </View>
      {note ? (
        <Hand color={palettes.desk.text} style={styles.tapeNote}>
          {note}
        </Hand>
      ) : null}
    </View>
  );
}

/** A photographic print with a white border and a handwritten caption: characters, scenes. */
export function Polaroid({
  source,
  caption,
  width = 132,
  aspect = 4 / 5,
  style,
}: {
  source?: ImageSourcePropType;
  caption?: string;
  width?: number;
  aspect?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.print, paperShadow, { width }, style]}>
      <View style={[styles.printPhoto, { height: (width - 14) / aspect }]}>
        {source ? (
          <Image source={source} style={fillImage} resizeMode="cover" accessible={false} />
        ) : (
          <Text style={styles.printEmpty}>No photo</Text>
        )}
      </View>
      {caption ? (
        <Hand color={palettes.paper.text} size="note" numberOfLines={1} style={styles.printCaption}>
          {caption}
        </Hand>
      ) : null}
    </View>
  );
}

export type NoteColor = keyof typeof world.note;

/** A square sticky note (planning-board voice): discoveries, interpretations, reactions. */
export function StickyNote({ color = 'yellow', children, style }: { color?: NoteColor; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.note, paperShadow, { backgroundColor: world.note[color] }, style]}>
      {/* Real paper fibre under the dye: the same stock as the cards, tinted to the note's colour. */}
      <Image source={materials.paper} resizeMode="cover" style={[fillImage, styles.noteFibre]} accessible={false} />
      <View style={[fillImage, { backgroundColor: world.note[color], opacity: 0.7 }]} />
      <SurfaceProvider surface="paper">{children}</SurfaceProvider>
    </View>
  );
}

const TYPEWRITER_INK = [0x24, 0x1e, 0x17];

/** Stamp ink presses darker than its source colour, so a stamp holds 4.5:1 on tinted notes as well as plain paper. */
export function stampInk(color: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return color;
  const n = parseInt(hex, 16);
  return `#${[n >> 16, (n >> 8) & 255, n & 255]
    .map((v, i) => Math.round(v * 0.62 + TYPEWRITER_INK[i]! * 0.38).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** A rubber stamp on paper: outcome tiers, canon status, provenance. Always carries its word, never color alone. */
export function Stamp({ label, color: source, strike = false, style }: { label: string; color: string; strike?: boolean; style?: StyleProp<ViewStyle> }) {
  const color = stampInk(source);
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.stamp, { borderColor: color, transform: [{ rotate: `${tiltFor(label, 2.5).toFixed(2)}deg` }] }, style]}>
      <Text maxFontSizeMultiplier={1.4} numberOfLines={1} style={[styles.stampText, { color }, strike && styles.strike]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

/** A blank index card lying loose on the cork, waiting to be written on: where the next item goes. */
export function BlankSlip({ label, onPress, style }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.blankTilt, { transform: [{ rotate: `${tiltFor(label, 2).toFixed(2)}deg` }] }, style]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.blank, paperShadow, pressedStyle(pressed)]}>
        <Image source={materials.paper} resizeMode="cover" style={fillImage} accessible={false} />
        <Hand color={palettes.paper.text} style={styles.blankLabel}>
          {`+ ${label}`}
        </Hand>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: palettes.paper.bg,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  ownPinLeft: { position: 'absolute', left: 3, top: 1 },
  ownPinTop: { position: 'absolute', alignSelf: 'center', top: 1 },
  tapeTop: { position: 'absolute', alignSelf: 'center', top: -8 },
  // The note drops under the tape when the row is too narrow, rather than losing words.
  tapeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: spacing.xxs, minHeight: 36, flexShrink: 1 },
  tapeLabel: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xxs, justifyContent: 'center', minHeight: 34 },
  tapeText: { color: palettes.paper.text },
  tapeNote: { flexShrink: 1, paddingRight: 4 }, // room for Caveat's overhanging last glyph
  print: { backgroundColor: '#F3EEE3', padding: 7, paddingBottom: 4, borderRadius: 1 },
  printPhoto: { backgroundColor: '#1A1714', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  printEmpty: { fontFamily: fonts.typewriter, fontSize: 12, color: '#8B8173' },
  printCaption: { textAlign: 'center', marginTop: 2 },
  note: { padding: spacing.lg, paddingTop: spacing.xl, borderRadius: 1, overflow: 'hidden' },
  noteFibre: { opacity: 0.9 },
  stamp: { borderWidth: 1.5, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 2, alignSelf: 'flex-start' },
  blankTilt: { minHeight: 96 },
  blank: {
    flex: 1,
    minHeight: 96,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: palettes.paper.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  blankLabel: { textAlign: 'center' },
  stampText: { fontFamily: fonts.typewriterBold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
  strike: { textDecorationLine: 'line-through' },
});
