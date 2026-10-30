// After the dice: "why did you choose that?" The answer is kept on the consequence and feeds discovery
// (what people say drove a choice vs. what the character did). Optional: Skip is always one tap away.
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { RISK_LABEL, TIER_LABEL } from '@shared/structure';
import type { Risk, Tier } from '@shared/types';

import { Button, Caption, Chip, Heading, haptics } from '@/components/ui';
import { useProject } from '@/lib/session';
import { spacing } from '@/theme';

import { AboveTabBar, TypewriterStrip } from './composer';
import { firstName } from './effects';
import { rise } from './motion';

/** A resolved choice waiting for its reason. */
export interface Ask {
  eventId: string;
  characterId: string;
  label: string;
  risk: Risk;
  tier: Tier;
}

export function Reflection({ ask, onDone }: { ask: Ask; onDone: () => void }) {
  const { call, charName } = useProject();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const name = firstName(charName(ask.characterId));
  const draft = text.trim();
  // Starting points that name the pressures the choices were built from: character, stakes, theme, curiosity.
  const starters = [
    `It’s true to who ${name} is`,
    'The stakes left no other way',
    'It tests what the story is about',
    'I wanted to see what breaks',
  ];

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      await call('explainChoice', { eventId: ask.eventId, reason: draft });
      haptics.success();
      onDone();
    } catch {
      setSaving(false); // call() has already shown the error; keep the draft
    }
  };

  return (
    <AboveTabBar>
      <Animated.View entering={rise()} style={styles.wrap}>
        <View style={styles.head}>
          <View style={styles.grow}>
            <Heading>Why did you choose that?</Heading>
            <Caption numberOfLines={2}>
              <Caption strong tone="primary">
                {ask.label}
              </Caption>
              . {RISK_LABEL[ask.risk]}, landed as {TIER_LABEL[ask.tier].toLowerCase()}.
            </Caption>
          </View>
          <Button title="Skip" variant="ghost" size="sm" onPress={onDone} disabled={saving} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.starters}>
          {starters.map((s) => (
            <Chip key={s} label={s} selected={text === s} onPress={() => setText(s)} />
          ))}
        </ScrollView>
        <TypewriterStrip
          value={text}
          onChangeText={setText}
          busy={saving}
          maxLength={500}
          maxHeight={110}
          placeholder="In a sentence, what drove it?"
          label="Why you chose it"
          sendLabel="Save your reason"
          onSend={() => void save()}
        />
      </Animated.View>
    </AboveTabBar>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  grow: { flex: 1, gap: spacing.xxs },
  starters: { gap: spacing.sm, paddingVertical: spacing.xxs },
});
