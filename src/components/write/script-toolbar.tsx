// The Write room's type bar, pinned above the page: one button per screenplay element, each with its icon. Hover (or
// long-press on a touch screen) shows what the element is for and its keyboard shortcut. Alt+1–7 sets the type of the
// line being typed, Alt+N leaves a note on it, Alt+P shows or hides the side panel.
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { ScriptElementType } from '@shared/types';

import { Icon, haptics, pressedStyle, type IconName } from '@/components/ui';
import { alpha, fonts, palettes, radii, spacing } from '@/theme';

import { ELEMENT_ICON, ELEMENT_LABEL, ELEMENT_ORDER, ELEMENT_USE, shortcutLabel } from './format';

const desk = palettes.desk;
const web = Platform.OS === 'web';

interface Tool {
  key: string;
  label: string;
  icon: IconName;
  use: string;
  shortcut?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export interface ScriptToolbarProps {
  /** Type of the line with the caret; null when no line is being typed. */
  type: ScriptElementType | null;
  onType: (t: ScriptElementType) => void;
  onNote: () => void;
  /** Wide screens: labelled buttons with hover tooltips. Phones: a scrolling strip of icons. */
  wide: boolean;
  /** Wide bars name each button; narrower ones show icons and leave the name to the tooltip. */
  labels?: boolean;
  /** Present on wide screens, where the panel sits beside the page. */
  panel?: { collapsed: boolean; onToggle: () => void };
}

export function ScriptToolbar({ type, onType, onNote, wide, labels = true, panel }: ScriptToolbarProps) {
  const [tip, setTip] = useState<{ key: string; x: number } | null>(null);
  const [hint, setHint] = useState<Tool | null>(null);
  const [xs, setXs] = useState<Record<string, number>>({});

  const tools: Tool[] = [
    ...ELEMENT_ORDER.map((t, i) => ({
      key: t,
      label: ELEMENT_LABEL[t],
      icon: ELEMENT_ICON[t],
      use: ELEMENT_USE[t],
      shortcut: String(i + 1),
      selected: type === t,
      disabled: !type,
      onPress: () => {
        haptics.selection();
        onType(t);
      },
    })),
    { key: 'note', label: 'Note on line', icon: 'bookmark', use: 'Pin a note to the line with the caret.', shortcut: 'N', disabled: !type, onPress: onNote },
  ];
  const panelTool: Tool | null = panel
    ? {
        key: 'panel',
        label: panel.collapsed ? 'Show panel' : 'Hide panel',
        icon: panel.collapsed ? 'sidebar-right-open' : 'sidebar-right',
        use: panel.collapsed ? 'Revisions, changes and notes beside the page.' : 'Give the page the whole board.',
        shortcut: 'P',
        selected: !panel.collapsed,
        onPress: panel.onToggle,
      }
    : null;

  // Looked up each render, so a tooltip follows its button's current state ("Hide panel" becomes "Show panel").
  const tipTool = tip ? [...tools, ...(panelTool ? [panelTool] : [])].find((t) => t.key === tip.key) : undefined;

  const button = (tool: Tool, compact: boolean) => (
    <Pressable
      key={tool.key}
      // Not `disabled`: a disabled Pressable ignores hover, and the tooltip should still explain the button.
      onPress={tool.disabled ? undefined : tool.onPress}
      onHoverIn={() => setTip({ key: tool.key, x: xs[tool.key] ?? 0 })}
      onHoverOut={() => setTip((t) => (t?.key === tool.key ? null : t))}
      onFocus={() => setTip({ key: tool.key, x: xs[tool.key] ?? 0 })}
      onBlur={() => setTip(null)}
      onLongPress={() => {
        haptics.selection();
        setHint(tool);
      }}
      onLayout={(e: LayoutChangeEvent) => {
        const x = e.nativeEvent.layout.x;
        setXs((m) => (m[tool.key] === x ? m : { ...m, [tool.key]: x }));
      }}
      accessibilityRole="button"
      accessibilityLabel={tool.label}
      accessibilityHint={`${tool.use}${web && tool.shortcut ? ` Shortcut ${shortcutLabel(tool.shortcut)}.` : ''}`}
      accessibilityState={{ selected: !!tool.selected, disabled: !!tool.disabled }}
      hitSlop={compact ? { top: 4, bottom: 4 } : undefined}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        tool.selected && styles.selected,
        tool.disabled && styles.disabled,
        pressedStyle(pressed),
      ]}>
      <Icon name={tool.icon} size={compact ? 18 : 16} color={tool.selected ? desk.accentText : desk.text} />
      {!compact && <Text style={[styles.label, tool.selected && { color: desk.accentText }]}>{tool.label}</Text>}
    </Pressable>
  );

  if (wide) {
    return (
      <View style={styles.bar} accessibilityRole="toolbar" accessibilityLabel="Line type">
        <View style={styles.row}>
          {tools.map((t) => button(t, !labels))}
          {panelTool && <View style={styles.push}>{button(panelTool, !labels)}</View>}
        </View>
        {tipTool && tip && <Tooltip tool={tipTool} x={tip.x} />}
      </View>
    );
  }

  // Phones: icons only, scrolled sideways; a long-press names the button under the bar.
  return (
    <View accessibilityRole="toolbar" accessibilityLabel="Line type">
      <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {tools.map((t) => button(t, true))}
      </ScrollView>
      {hint ? (
        <Pressable onPress={() => setHint(null)} style={styles.hint} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Text style={styles.hintText}>
            <Text style={styles.hintLabel}>{hint.label}. </Text>
            {hint.use}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Tooltip({ tool, x }: { tool: Tool; x: number }) {
  // The panel button sits at the far right: its tip hangs leftward from the bar's edge.
  const at = tool.key === 'panel' ? { right: spacing.lg } : { left: spacing.lg + Math.max(0, x - 8) };
  return (
    <View pointerEvents="none" style={[styles.tip, at]} accessibilityElementsHidden>
      <View style={styles.tipHead}>
        <Text style={styles.tipLabel}>{tool.label}</Text>
        {web && tool.shortcut ? <Text style={styles.key}>{shortcutLabel(tool.shortcut)}</Text> : null}
      </View>
      <Text style={styles.tipUse}>{tool.use}</Text>
      {tool.disabled ? <Text style={[styles.tipUse, styles.tipNote]}>Put the caret in a line on the page first.</Text> : null}
      {tool.key === 'heading' && web ? <Text style={styles.tipUse}>Tab and Shift+Tab cycle through the types.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  push: { marginLeft: 'auto' },
  strip: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: desk.border,
    backgroundColor: desk.surface,
  },
  compact: { width: 44, height: 40, paddingHorizontal: 0, justifyContent: 'center' },
  selected: { backgroundColor: desk.accentSoft, borderColor: alpha(desk.accent, 0.6) },
  disabled: { opacity: 0.45 },
  label: { color: desk.text, fontSize: 13, fontWeight: '500' },
  hint: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  hintText: { color: desk.textSecondary, fontSize: 13, lineHeight: 18 },
  hintLabel: { color: desk.text, fontWeight: '600' },
  tip: {
    position: 'absolute',
    top: 50,
    width: 260,
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: desk.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: desk.border,
    zIndex: 20,
    ...Platform.select({
      web: { boxShadow: '0 6px 16px rgba(0,0,0,0.45)' } as object,
      default: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
    }),
  },
  tipHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  tipLabel: { color: desk.text, fontSize: 14, fontWeight: '600' },
  key: {
    fontFamily: fonts.typewriterBold,
    fontSize: 12,
    color: desk.accentText,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(desk.accent, 0.6),
  },
  tipUse: { color: desk.textSecondary, fontSize: 13, lineHeight: 18 },
  tipNote: { color: desk.accentText },
});
