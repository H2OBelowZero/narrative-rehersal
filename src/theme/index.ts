import { DarkTheme, type NativeStackNavigationOptions, type Theme as NavigationTheme } from 'expo-router';
import { Platform, type TextStyle } from 'react-native';

import { useSurface } from './surface';
import { fonts, palettes, paperTypography, radii, spacing, typography, type Palette, type Scheme, type Surface } from './tokens';

export * from './surface';
export * from './tokens';

export interface Theme {
  surface: Surface;
  scheme: Scheme;
  colors: Palette;
  spacing: typeof spacing;
  radii: typeof radii;
  /** Surface-aware: Courier Prime on paper, the platform face on the desk. */
  typography: Record<keyof typeof typography, TextStyle>;
  fonts: typeof fonts;
}

const themes: Record<Surface, Theme> = {
  paper: { surface: 'paper', scheme: 'light', colors: palettes.paper, spacing, radii, typography: paperTypography, fonts },
  desk: { surface: 'desk', scheme: 'dark', colors: palettes.desk, spacing, radii, typography, fonts },
};

/** Theme for the surface this component sits on (see SurfaceProvider). */
export function useTheme(): Theme {
  return themes[useSurface()];
}

// Screens often read colours at screen scope (the desk) and hand them to things drawn on paper. Every palette
// entry has a counterpart on the other surface, so a colour can be carried across instead of turning faint.
const counterpart: Record<Surface, Map<string, string>> = { paper: new Map(), desk: new Map() };
(function pair(desk: object, paper: object) {
  for (const [key, d] of Object.entries(desk)) {
    const p = (paper as Record<string, unknown>)[key];
    if (typeof d === 'string' && typeof p === 'string') {
      counterpart.paper.set(d, p);
      counterpart.desk.set(p, d);
    } else if (d && typeof d === 'object' && p && typeof p === 'object') pair(d, p);
  }
})(palettes.desk, palettes.paper);

/** The same palette role on `surface` (unknown colours pass through). */
export function onSurface<T extends string | undefined>(color: T, surface: Surface): T {
  return (color && (counterpart[surface].get(color) as T)) || color;
}

/** React Navigation theme: the desk. */
export function useNavigationTheme(): NavigationTheme {
  const colors = palettes.desk;
  return {
    ...DarkTheme,
    colors: {
      primary: colors.accentText,
      background: colors.bg,
      card: colors.bg,
      text: colors.text,
      border: colors.separator,
      notification: colors.accent,
    },
  };
}

/** Shared Stack options: native headers on the desk, typed titles, large titles on iOS. */
export function useStackOptions(): NativeStackNavigationOptions {
  const colors = palettes.desk;
  const ios = Platform.OS === 'ios';
  // Chrome is the platform face (OWN-WORLD); typed faces live on the paper.
  const title = { color: colors.text, fontFamily: fonts.sans, fontWeight: '600' as const };
  return {
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.accentText,
    headerTitleStyle: { ...title, fontSize: 17 },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    headerLargeTitleEnabled: ios,
    headerLargeTitleShadowVisible: false,
    headerLargeStyle: { backgroundColor: colors.bg },
    headerLargeTitleStyle: { ...title, fontSize: 30 },
    contentStyle: { backgroundColor: colors.bg },
  };
}
