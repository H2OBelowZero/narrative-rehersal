import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { onSurface, useTheme } from '@/theme';

type SymbolNames = Extract<SymbolViewProps['name'], object>;
type IconDef = { ios: NonNullable<SymbolNames['ios']>; android: NonNullable<SymbolNames['android']> };

/** SF Symbols on iOS, Material Symbols on Android and web. */
export const icons = {
  home: { ios: 'house', android: 'home' },
  story: { ios: 'book.closed', android: 'menu_book' },
  rehearse: { ios: 'theatermasks', android: 'theater_comedy' },
  crew: { ios: 'person.3', android: 'groups' },
  discover: { ios: 'lightbulb', android: 'lightbulb' },
  settings: { ios: 'gearshape', android: 'settings' },
  close: { ios: 'xmark', android: 'close' },
  'chevron-right': { ios: 'chevron.right', android: 'chevron_right' },
  'chevron-left': { ios: 'chevron.left', android: 'chevron_left' },
  'arrow-right': { ios: 'arrow.right', android: 'arrow_forward' },
  /** Platform back affordance: chevron on iOS, arrow on Android/web. */
  back: { ios: 'chevron.left', android: 'arrow_back' },
  plus: { ios: 'plus', android: 'add' },
  minus: { ios: 'minus', android: 'remove' },
  check: { ios: 'checkmark', android: 'check' },
  lock: { ios: 'lock.fill', android: 'lock' },
  question: { ios: 'questionmark', android: 'help' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning' },
  info: { ios: 'info.circle', android: 'info' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh' },
  server: { ios: 'server.rack', android: 'dns' },
  offline: { ios: 'wifi.slash', android: 'wifi_off' },
  person: { ios: 'person', android: 'person' },
  'person-add': { ios: 'person.badge.plus', android: 'person_add' },
  dice: { ios: 'dice', android: 'casino' },
  film: { ios: 'film', android: 'movie' },
  script: { ios: 'doc.text', android: 'description' },
  structure: { ios: 'rectangle.split.3x1', android: 'view_timeline' },
  branch: { ios: 'arrow.triangle.branch', android: 'call_split' },
  graph: { ios: 'point.3.connected.trianglepath.dotted', android: 'hub' },
  flag: { ios: 'flag', android: 'flag' },
  clock: { ios: 'clock', android: 'schedule' },
  history: { ios: 'clock.arrow.circlepath', android: 'history' },
  target: { ios: 'scope', android: 'my_location' },
  promote: { ios: 'arrow.up.circle', android: 'upgrade' },
  edit: { ios: 'pencil', android: 'edit' },
  trash: { ios: 'trash', android: 'delete' },
  eye: { ios: 'eye', android: 'visibility' },
  'eye-off': { ios: 'eye.slash', android: 'visibility_off' },
  link: { ios: 'link', android: 'link' },
  send: { ios: 'paperplane.fill', android: 'send' },
  play: { ios: 'play.fill', android: 'play_arrow' },
  stop: { ios: 'stop.fill', android: 'stop' },
  bookmark: { ios: 'bookmark', android: 'bookmark' },
  star: { ios: 'star', android: 'star' },
  search: { ios: 'magnifyingglass', android: 'search' },
  more: { ios: 'ellipsis', android: 'more_horiz' },
  dot: { ios: 'circle.fill', android: 'fiber_manual_record' },
  // Screenplay elements (the Write room's type bar).
  'el-heading': { ios: 'mappin.and.ellipse', android: 'location_on' },
  'el-action': { ios: 'text.alignleft', android: 'subject' },
  'el-character': { ios: 'person.fill', android: 'person' },
  'el-parenthetical': { ios: 'waveform', android: 'record_voice_over' },
  'el-dialogue': { ios: 'text.bubble', android: 'chat_bubble' },
  'el-transition': { ios: 'arrow.right.to.line', android: 'keyboard_tab' },
  'el-shot': { ios: 'camera.viewfinder', android: 'videocam' },
  'sidebar-left': { ios: 'sidebar.left', android: 'left_panel_close' },
  'sidebar-left-open': { ios: 'sidebar.left', android: 'left_panel_open' },
  'sidebar-right': { ios: 'sidebar.right', android: 'right_panel_close' },
  'sidebar-right-open': { ios: 'sidebar.right', android: 'right_panel_open' },
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof icons;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
}

/** Decorative icon; give the surrounding control the accessible label. */
export function Icon({ name, size = 20, color, style }: IconProps) {
  const { colors, surface } = useTheme();
  const { ios, android } = icons[name];
  return (
    <SymbolView
      name={{ ios, android, web: android }}
      size={size}
      tintColor={(typeof color === 'string' ? onSurface(color, surface) : color) ?? colors.text}
      style={style}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    />
  );
}
