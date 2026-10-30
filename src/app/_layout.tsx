import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ToastHost } from '@/components/ui';
import { SessionProvider, useSession } from '@/lib/session';
import { useNavigationTheme, useStackOptions } from '@/theme';
import { fontAssets } from '@/theme/fonts';

// Hold the splash until saved server/identities are read and the desk's typefaces are loaded.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <SessionProvider>
      <Root />
    </SessionProvider>
  );
}

function Root() {
  const { ready } = useSession();
  // A font that fails to load falls back to the platform face rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const loaded = fontsLoaded || !!fontError;
  const navigationTheme = useNavigationTheme();
  const stackOptions = useStackOptions();

  useEffect(() => {
    if (ready && loaded) SplashScreen.hideAsync().catch(() => {});
  }, [ready, loaded]);

  if (!loaded) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack screenOptions={stackOptions}>
        <Stack.Screen name="index" options={{ title: 'Projects', headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="project/[id]" options={{ headerShown: false }} />
      </Stack>
      <ToastHost />
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
