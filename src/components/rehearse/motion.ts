// Motion for the rehearsal stage: things that arrive rise into place. Reanimated follows the system reduce-motion setting.
import { Platform } from 'react-native';
import { FadeInDown } from 'react-native-reanimated';

import { EASE_OUT } from '@/components/ui';

/**
 * Entrance for newly arrived content; `index` staggers items of one group by 60ms. Native only: on web Reanimated
 * lays entering views out absolutely and hidden until the CSS animation ends, which never happens in a background
 * tab. Content must not depend on an animation finishing.
 */
export const rise = (index = 0) =>
  Platform.OS === 'web'
    ? undefined
    : FadeInDown.duration(320)
        .delay(index * 60)
        .easing(EASE_OUT)
        .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] });
