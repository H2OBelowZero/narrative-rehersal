import { StyleSheet, Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { fonts, onSurface, useTheme, type Palette, type Theme } from '@/theme';

export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'danger';

export interface TextProps extends RNTextProps {
  tone?: TextTone;
  /** Emphasis: semibold on the desk, bold type on paper. */
  strong?: boolean;
}

const toneColor = (colors: Palette, tone: TextTone): string =>
  ({
    primary: colors.text,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    accent: colors.accentText,
    danger: colors.danger,
  })[tone];

type Variant = keyof Theme['typography'];

/** Chalk on the desk also sits directly on cork: a soft dark halo keeps it legible over the lighter granules. */
const lift: TextStyle = { textShadowColor: 'rgba(8, 5, 3, 0.75)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } };

/** Custom faces carry weight in the family; on paper `strong` swaps to the bold cut instead of faking it. */
const emphasis = (surface: Theme['surface']): TextStyle =>
  surface === 'paper' ? { fontFamily: fonts.typewriterBold } : { fontWeight: '600' };

function make(variant: Variant, defaults: { tone: TextTone; header?: boolean; maxScale?: number }) {
  return function Variant({ tone = defaults.tone, strong, style, ...rest }: TextProps) {
    const { colors, typography, surface } = useTheme();
    // A colour chosen at screen scope (the desk) is carried to its paper counterpart when drawn on a card.
    const given = StyleSheet.flatten(style)?.color;
    const carried = typeof given === 'string' ? { color: onSurface(given, surface) } : null;
    return (
      <RNText
        accessibilityRole={defaults.header ? 'header' : undefined}
        maxFontSizeMultiplier={defaults.maxScale}
        {...rest}
        style={[typography[variant], { color: toneColor(colors, tone) }, surface === 'desk' && lift, strong && emphasis(surface), style, carried]}
      />
    );
  };
}

/** Screen and card titles: typed in bold on paper, the platform face on the desk. */
export const Title = make('title', { tone: 'primary', header: true });
/** Section / card heading. */
export const Heading = make('heading', { tone: 'primary', header: true });
export const Body = make('body', { tone: 'primary' });
export const Caption = make('caption', { tone: 'secondary' });
/** Small tracked capitals for field labels (not above headings). */
export const Eyebrow = make('eyebrow', { tone: 'secondary', maxScale: 1.6 });
/** Screenplay text (Courier Prime). */
export const Mono = make('mono', { tone: 'primary' });
