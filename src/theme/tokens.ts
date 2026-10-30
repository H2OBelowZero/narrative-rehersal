// The Story Desk: a screenwriter's desk at night and the cork board above it.
// Two surfaces, not two appearances: `desk` (chalk on warm charcoal: chrome, sheets' surroundings, the nav)
// and `paper` (ink on aged ivory: every pinned card, sheet and note). Components read the surface they sit on
// (see surface.tsx), so the same Button or Caption is chalk on the desk and ink on a card.
// Red belongs to the material world (string, pins, failure), brass is the one interactive accent.
import { Platform, type TextStyle } from 'react-native';

import type { CanonStatus, Risk, Role, Tier } from '@shared/types';

export type Surface = 'desk' | 'paper';
/** Kept for components that branch on light/dark ink: paper reads as light, the desk as dark. */
export type Scheme = 'light' | 'dark';

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  separator: string;
  /** Interactive fill (brass on the desk, ink on paper). Pair with onAccent. */
  accent: string;
  onAccent: string;
  /** Accent that reads as text or icon on this surface. */
  accentText: string;
  accentSoft: string;
  danger: string;
  onDanger: string;
  scrim: string;
  tier: Record<Tier, string>;
  canon: Record<CanonStatus, string>;
  role: Record<Role, string>;
  risk: Record<Risk, string>;
}

export const palettes: Record<Surface, Palette> = {
  paper: {
    bg: '#EDE3CC',
    surface: '#F4ECDA',
    surfaceAlt: '#E2D5B8',
    text: '#241E17',
    textSecondary: '#4A4034',
    textTertiary: '#5B4F40',
    border: '#C4B38D',
    separator: '#D5C7A6',
    accent: '#2B241C',
    onAccent: '#F4ECDA',
    accentText: '#6B480E',
    accentSoft: '#E4D3AC',
    danger: '#9E2A22',
    onDanger: '#FBF3E6',
    scrim: 'rgba(8, 6, 4, 0.62)',
    tier: { critical: '#1D5A70', success: '#2D663C', complication: '#8F4E10', failure: '#9E2A22' },
    canon: {
      locked: '#241E17',
      canon: '#27507A',
      proposed: '#554A3C',
      emergent: '#8F4E10',
      unknown: '#6A5D4C',
      rejected: '#6A5D4C',
    },
    role: {
      owner: '#6B2F5E',
      director: '#3B3E8C',
      producer: '#225A56',
      writer: '#74472A',
      performer: '#8A2C4B',
      observer: '#554E42',
    },
    risk: { low: '#554A3C', medium: '#6E5410', high: '#8F4E10', extreme: '#9E2A22' },
  },
  desk: {
    bg: '#14110E',
    surface: '#1E1A16',
    surfaceAlt: '#2A241E',
    text: '#EFE7D8',
    textSecondary: '#B7AD9C',
    textTertiary: '#968C7C',
    border: '#3B332B',
    separator: '#2C2620',
    accent: '#C9A25B',
    onAccent: '#1D150A',
    accentText: '#DBB872',
    accentSoft: '#3A2E1A',
    danger: '#E4705F',
    onDanger: '#1A0B08',
    scrim: 'rgba(6, 5, 4, 0.66)',
    tier: { critical: '#6BB8D4', success: '#79C394', complication: '#E7985C', failure: '#E4705F' },
    canon: {
      locked: '#EFE7D8',
      canon: '#8DB7E2',
      proposed: '#B7AD9C',
      emergent: '#DBB872',
      unknown: '#968C7C',
      rejected: '#968C7C',
    },
    role: {
      owner: '#D493C4',
      director: '#A7AAF0',
      producer: '#82C7C0',
      writer: '#D9A987',
      performer: '#EC93AD',
      observer: '#B7AD9C',
    },
    risk: { low: '#B7AD9C', medium: '#D9B24E', high: '#E7985C', extreme: '#E4705F' },
  },
};

/** The physical materials on the board; independent of the surface. */
export const world = {
  string: '#A8201A',
  stringHighlight: '#D2473A',
  stringShadow: 'rgba(10, 6, 4, 0.45)',
  cork: '#5B3F26',
  frame: '#2A1E14',
  tape: '#D8CAA6',
  /** Sticky notes from the planning board: faded, never neon. */
  note: { yellow: '#E6D38E', pink: '#E2AFA6', blue: '#A8C4CF', green: '#B9CC9C' },
  shadow: '#000000',
} as const;

/** `#RRGGBB` + opacity → `#RRGGBBAA`. */
export const alpha = (hex: string, opacity: number): string =>
  hex + Math.round(opacity * 255).toString(16).padStart(2, '0');

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** Paper is cut, not rounded: small radii everywhere, pills only for tiny controls. */
export const radii = { sm: 2, md: 4, lg: 6, xl: 10, pill: 999 } as const;

/** Minimum touch target (Apple HIG 44pt; Material asks 48dp, reached with hitSlop on small controls). */
export const TOUCH_TARGET = 44;

/** Readable line length on tablets and web. */
export const MAX_CONTENT_WIDTH = 720;

const system = Platform.select({
  ios: 'System',
  web: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  default: 'sans-serif',
});

/** Loaded in the root layout (src/theme/fonts.ts). Custom faces carry their weight in the family name. */
export const fonts = {
  sans: system,
  typewriter: 'CourierPrime_400Regular',
  typewriterBold: 'CourierPrime_700Bold',
  typewriterItalic: 'CourierPrime_400Regular_Italic',
  hand: 'Caveat_600SemiBold',
  display: 'Cinzel_500Medium',
  /** Screenplay pages keep Courier Prime. */
  mono: 'CourierPrime_400Regular',
  /** Prose read aloud from the board (narration) is typed too. */
  serif: 'CourierPrime_400Regular',
} as const;

/** Desk type: the platform face for chrome and controls (Dynamic Type / sp scaling applies). */
export const typography = {
  title: { fontFamily: fonts.sans, fontSize: 26, lineHeight: 32, fontWeight: '600', letterSpacing: -0.3 },
  heading: { fontFamily: fonts.sans, fontSize: 18, lineHeight: 24, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 23 },
  caption: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
  eyebrow: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  mono: { fontFamily: fonts.mono, fontSize: 15, lineHeight: 21 },
} satisfies Record<string, TextStyle>;

/** Paper type: everything typed onto a card is Courier Prime. */
export const paperTypography = {
  title: { fontFamily: fonts.typewriterBold, fontSize: 22, lineHeight: 28, letterSpacing: 0.2 },
  heading: { fontFamily: fonts.typewriterBold, fontSize: 16, lineHeight: 22, letterSpacing: 0.3 },
  body: { fontFamily: fonts.typewriter, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.typewriter, fontSize: 13, lineHeight: 18 },
  eyebrow: {
    fontFamily: fonts.typewriterBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  mono: { fontFamily: fonts.mono, fontSize: 15, lineHeight: 21 },
} satisfies Record<keyof typeof typography, TextStyle>;

/** Handwriting (Caveat) for tape labels and margin notes; Cinzel for the wordmark only. */
export const handType = {
  note: { fontFamily: fonts.hand, fontSize: 22, lineHeight: 24 },
  label: { fontFamily: fonts.hand, fontSize: 26, lineHeight: 28 },
  wordmark: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22, letterSpacing: 3.2 },
} satisfies Record<string, TextStyle>;
