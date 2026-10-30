// The desk under the lamp: the Welcome hero. A full-bleed photograph of the screenwriter's desk fading into the
// dark, the engraved wordmark, the line, and the rehearsal server's state typed on a small paper tag.
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { fillImage, materials } from '@/components/board/materials';
import { Paper, paperShadow, tiltFor } from '@/components/board/paper';
import { Badge, Button, Caption, Icon, IconButton, pressedStyle } from '@/components/ui';
import { useSession } from '@/lib/session';
import { fonts, handType, palettes, spacing, TOUCH_TARGET, useTheme } from '@/theme';

/** Sidebar layout from this width (tablets, desktop web), matching the string nav. */
export const WIDE = 900;
const desk = palettes.desk;

/** THE / STORY DESK in Cinzel. `size` is the STORY DESK cap height in points; tracking scales with it. */
export function Wordmark({ size }: { size: number }) {
  const track = size * 0.18;
  const small = Math.max(10, size * 0.36);
  return (
    <View style={styles.wordmark} accessible accessibilityRole="header" accessibilityLabel="The Story Desk">
      <Text maxFontSizeMultiplier={1.2} style={[handType.wordmark, styles.the, { fontSize: small, lineHeight: small * 1.3, letterSpacing: small * 0.5, paddingLeft: small * 0.5 }]}>
        THE
      </Text>
      <Text
        maxFontSizeMultiplier={1.2}
        numberOfLines={1}
        style={[handType.wordmark, styles.mark, { fontSize: size, lineHeight: size * 1.2, letterSpacing: track, paddingLeft: track }]}>
        STORY DESK
      </Text>
    </View>
  );
}

/** The wordmark as the board's header: a way back to every project. */
export function HeaderWordmark() {
  return (
    <Pressable
      onPress={() => router.dismissTo('/')}
      accessibilityRole="link"
      accessibilityLabel="All projects"
      hitSlop={8}
      style={({ pressed }) => [styles.headerMark, pressedStyle(pressed)]}>
      <Wordmark size={16} />
    </Pressable>
  );
}

export function DeskHero({ height, wide }: { height: number; wide: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.hero, { height }]}>
      <Image source={wide ? materials.deskWide : materials.deskPortrait} style={fillImage} resizeMode="cover" accessible={false} />
      {/* Lamp light falls off toward the reader: dark at the status bar, clear over the desk, night at the bottom. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="deskScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={desk.bg} stopOpacity={0.6} />
              <Stop offset="0.16" stopColor={desk.bg} stopOpacity={0} />
              <Stop offset={wide ? '0.38' : '0.42'} stopColor={desk.bg} stopOpacity={0} />
              <Stop offset="0.72" stopColor={desk.bg} stopOpacity={0.78} />
              <Stop offset="1" stopColor={desk.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#deskScrim)" />
        </Svg>
      </View>

      <View style={[styles.top, { paddingTop: insets.top + spacing.xs }]}>
        <IconButton icon="settings" color={desk.text} accessibilityLabel="Settings" onPress={() => router.push('/settings')} />
      </View>

      <View style={[styles.copy, wide && styles.copyWide]}>
        <Wordmark size={wide ? 58 : 34} />
        <Text maxFontSizeMultiplier={1.4} style={[styles.line, wide && styles.lineWide]}>
          Run the story before you make the story.
        </Text>
        <ConnectionTag />
      </View>
    </View>
  );
}

/** The server connection, typed on a paper tag lying on the desk. */
function ConnectionTag() {
  return (
    <View style={[styles.tagWrap, paperShadow, { transform: [{ rotate: `${tiltFor('connection', 1.1).toFixed(2)}deg` }] }]}>
      <Paper style={styles.tag}>
        <TagBody />
      </Paper>
    </View>
  );
}

function TagBody() {
  const { colors } = useTheme(); // paper
  const { online, checking, serverUrl, director, refreshHealth } = useSession();
  const status = online ? 'Connected' : checking ? 'Connecting…' : 'Server unreachable';
  return (
    <>
      <View style={styles.tagRow} accessible accessibilityLabel={`${status}, ${serverUrl}`}>
        <Icon name={online ? 'server' : 'offline'} size={15} color={online ? colors.tier.success : colors.textSecondary} />
        <Text style={[styles.tagStatus, { color: colors.text }]}>{status.toUpperCase()}</Text>
        <Text numberOfLines={1} style={[styles.tagUrl, { color: colors.textSecondary }]}>
          {serverUrl}
        </Text>
      </View>
      {director && (
        <View style={styles.tagRow}>
          <Badge
            label={director.engine === 'claude' ? 'Director: Claude' : 'Director: offline'}
            color={director.engine === 'claude' ? colors.accentText : colors.textSecondary}
          />
          {online && director.engine === 'claude' && director.model ? (
            <Caption numberOfLines={1} style={styles.shrink}>
              {director.model}
            </Caption>
          ) : null}
        </View>
      )}
      {!online && !checking && (
        <>
          <Caption>Start the rehearsal server on this network (npm start in server/), or point the app at it in Settings.</Caption>
          <View style={styles.tagActions}>
            <Button title="Try again" icon="refresh" size="sm" variant="secondary" onPress={() => void refreshHealth()} />
            <Button title="Server settings" size="sm" variant="ghost" onPress={() => router.push('/settings')} />
          </View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  wordmark: { alignItems: 'center', alignSelf: 'flex-start' },
  the: { color: desk.textSecondary },
  mark: { color: desk.text },
  headerMark: { minHeight: TOUCH_TARGET, justifyContent: 'center' },
  hero: { width: '100%', overflow: 'hidden', backgroundColor: desk.bg },
  top: { position: 'absolute', top: 0, right: spacing.sm, left: 0, alignItems: 'flex-end' },
  copy: { position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: spacing.xxl, gap: spacing.lg, maxWidth: 520 },
  copyWide: { left: spacing.xxxl + spacing.lg, bottom: spacing.xxxl, maxWidth: 620, gap: spacing.xl },
  line: { fontFamily: fonts.typewriter, fontSize: 16, lineHeight: 24, color: desk.text },
  lineWide: { fontSize: 19, lineHeight: 28 },
  tagWrap: { alignSelf: 'flex-start', maxWidth: '100%', borderRadius: 2 },
  tag: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, gap: spacing.sm },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  tagStatus: { fontFamily: fonts.typewriterBold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
  tagUrl: { fontFamily: fonts.typewriter, fontSize: 12, lineHeight: 16, flexShrink: 1 },
  tagActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  shrink: { flexShrink: 1 },
});
