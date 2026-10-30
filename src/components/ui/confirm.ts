import { Alert, Platform } from 'react-native';

/** Asks a yes/no question. Uses window.confirm on web, where Alert buttons don't work. */
export function confirm(
  title: string,
  message?: string,
  options: { confirmLabel?: string; destructive?: boolean } = {},
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: options.confirmLabel ?? 'OK',
          style: options.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
