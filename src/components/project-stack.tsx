import { router, Stack, useIsFocused } from "expo-router";
import { Platform } from "react-native";

import { FollowString } from "@/components/string-nav";
import { IconButton } from "@/components/ui";
import { useStackOptions, useTheme } from "@/theme";

/**
 * The Stack inside each project tab. Its root screen gets `title` and, on iOS/Android, a leading
 * "All projects" button (the web tab bar has its own). Other screens in the tab folder inherit the options.
 */
export function ProjectStack({ title }: { title: string }) {
  const options = useStackOptions();
  const { colors } = useTheme();
  const focused = useIsFocused();
  return (
    <FollowString focused={focused}>
      <Stack screenOptions={options}>
        <Stack.Screen
          name="index"
          options={{
            title,
            headerLeft:
              Platform.OS === "web"
                ? undefined
                : () => (
                    <IconButton
                      icon="back"
                      color={colors.accentText}
                      accessibilityLabel="All projects"
                      onPress={() => router.dismissTo("/")}
                    />
                  ),
          }}
        />
      </Stack>
    </FollowString>
  );
}
