// Bundled materials and the illustrative "Undertow" photographs (see assets/story/PROVENANCE.md).
import { StyleSheet, type ImageSourcePropType } from 'react-native';

import type { Character, Scene } from '@shared/types';

/** Absolute fill for texture images. Explicit size: react-native-web otherwise uses the source's pixel size. */
export const fillImage = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
}).fill;

export const materials = {
  cork: require('@/assets/story/cork.jpg'),
  paper: require('@/assets/story/paper.jpg'),
  walnut: require('@/assets/story/walnut.jpg'),
  pinRed: require('@/assets/story/pin-red.png'),
  pinBrass: require('@/assets/story/pin-brass.png'),
  tape: require('@/assets/story/tape.png'),
  deskPortrait: require('@/assets/story/desk-portrait.jpg'),
  deskWide: require('@/assets/story/desk-wide.jpg'),
  deskProps: require('@/assets/story/desk-props.png'),
  /** Lamp falloff: transparent centre darkening toward the frame. */
  lampFalloff: require('@/assets/story/lamp-falloff.png'),
} satisfies Record<string, ImageSourcePropType>;

/** Photographs addressable by the `image` key a character or scene carries. */
export const storyImages: Record<string, ImageSourcePropType> = {
  ines: require('@/assets/story/ines.jpg'),
  mara: require('@/assets/story/mara.jpg'),
  teodor: require('@/assets/story/teodor.jpg'),
  jonah: require('@/assets/story/jonah.jpg'),
  priya: require('@/assets/story/priya.jpg'),
  'container-yard': require('@/assets/story/scene-container-yard.jpg'),
  'pier-9': require('@/assets/story/scene-pier-9.jpg'),
  dockside: require('@/assets/story/scene-dockside.jpg'),
  photograph: require('@/assets/story/scene-photograph.jpg'),
  'harbor-office': require('@/assets/story/scene-harbor-office.jpg'),
};

/** Scene headings mentioning these places borrow the matching photograph (illustrative only). */
const PLACES: [RegExp, string][] = [
  [/container|yard/i, 'container-yard'],
  [/pier|crane|dock gate/i, 'pier-9'],
  [/office|authority|commission/i, 'harbor-office'],
  [/bar|street|dockside|alley/i, 'dockside'],
  [/photo|envelope|evidence/i, 'photograph'],
];

export function characterImage(c: Pick<Character, 'name'> & { image?: string }): ImageSourcePropType | undefined {
  return storyImages[c.image ?? ''] ?? storyImages[c.name.trim().split(/\s+/)[0]!.toLowerCase()];
}

export function sceneImage(s: Pick<Scene, 'heading'> & { image?: string }): ImageSourcePropType | undefined {
  const key = s.image ?? PLACES.find(([re]) => re.test(s.heading))?.[1];
  return key ? storyImages[key] : undefined;
}
