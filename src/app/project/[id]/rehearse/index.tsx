// Simulation Room (PRD §17–23, §26–29, §35, §47–50): the live rehearsal.
// Non-directors are briefed first (logline, character, scene, stakes) and step in with one tap; directors go straight
// to the stage with the structural layer. On stage there is one thing to do at a time: ask for choices (or type),
// choose, watch the dice, then say why.
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type ScrollView } from 'react-native';

import type { Approach, Resolution } from '@shared/types';

import { BriefBar, BriefingCurtain } from '@/components/rehearse/briefing';
import { Composer, useActor } from '@/components/rehearse/composer';
import { DiceMoment } from '@/components/rehearse/dice';
import { EventFeed } from '@/components/rehearse/event-feed';
import { MetaLayer } from '@/components/rehearse/meta-layer';
import { PendingPanel, YourMove } from '@/components/rehearse/pending-panel';
import { Reflection, type Ask } from '@/components/rehearse/reflection';
import { SituationCards } from '@/components/rehearse/scene-cards';
import { Button, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { useProject } from '@/lib/session';

/** Older moments stay one tap away so a long rehearsal doesn't render hundreds of cards. */
const FEED_WINDOW = 60;

/** The web tab bar sits on top, so the composer meets the bottom edge; native tabs inset themselves (see Composer). */
const EDGES: 'bottom'[] = Platform.OS === 'web' ? ['bottom'] : [];

export default function RehearseScreen() {
  const { sim, can, call, refresh } = useProject();
  const director = can('direct');
  const scrollRef = useRef<ScrollView>(null);
  const [entered, setEntered] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const { actingId } = useActor(picked);
  const [roll, setRoll] = useState<{ approachId: string; label: string; resolution: Resolution | null } | null>(null);
  const [rollError, setRollError] = useState<{ pendingId: string; message: string } | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const settled = useRef(false);

  // Follow the story: jump to the newest moment on arrival, then glide to each new one.
  const eventCount = sim?.events.length ?? 0;
  const pendingId = sim?.pending?.id;
  const onStage = director || entered;
  useEffect(() => {
    if (!onStage) return;
    const animated = settled.current;
    settled.current = true;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated }), 80);
    return () => clearTimeout(timer);
  }, [eventCount, pendingId, onStage]);

  if (!sim) return null;
  if (!onStage) return <BriefingCurtain edges={EDGES} onEnter={() => setEntered(true)} />;

  const choose = async (approach: Approach) => {
    const pending = sim.pending;
    setRollError(null);
    setAsk(null);
    setRoll({ approachId: approach.id, label: approach.label, resolution: null });
    try {
      const next = await call('resolveAction', { approachId: approach.id });
      const events = next.branches.find((b) => b.id === next.activeBranchId)?.state.events ?? [];
      const resolved = events.filter((e) => e.kind === 'resolution').at(-1);
      const resolution = resolved?.resolution ?? null;
      setRoll(resolution ? { approachId: approach.id, label: approach.label, resolution } : null);
      if (resolved && resolution && pending) {
        setAsk({ eventId: resolved.id, characterId: pending.characterId, label: approach.label, risk: approach.risk, tier: resolution.tier });
      }
    } catch (e) {
      setRoll(null);
      setRollError({ pendingId: pending?.id ?? '', message: errorMessage(e) });
    }
  };

  const hidden = showAll ? 0 : Math.max(0, sim.events.length - FEED_WINDOW);
  // The reason is asked once the dice have landed and the consequence is on screen.
  const reflecting = ask && !roll;
  const footer = reflecting ? (
    <Reflection ask={ask} onDone={() => setAsk(null)} />
  ) : can('act') ? (
    <Composer picked={picked} onPick={setPicked} />
  ) : undefined;

  return (
    <View style={styles.fill}>
      <Screen onRefresh={refresh} keyboard edges={EDGES} scrollRef={scrollRef} footer={footer}>
        {director ? (
          <>
            <SituationCards />
            <MetaLayer />
          </>
        ) : (
          <BriefBar />
        )}
        {hidden > 0 && (
          <Button
            title={`Show ${hidden} earlier ${hidden === 1 ? 'moment' : 'moments'}`}
            icon="history"
            variant="ghost"
            size="sm"
            onPress={() => setShowAll(true)}
            style={styles.centre}
          />
        )}
        {/* Events hang after the three situation cards (orders 0-2), so the whole rehearsal is one string. */}
        <EventFeed events={hidden ? sim.events.slice(hidden) : sim.events} start={3 + hidden} />
        {sim.pending ? (
          <PendingPanel
            pending={sim.pending}
            onChoose={(a) => void choose(a)}
            chosenId={roll?.approachId ?? null}
            error={rollError?.pendingId === sim.pending.id ? rollError.message : null}
          />
        ) : can('act') && actingId && !reflecting ? (
          <YourMove characterId={actingId} />
        ) : null}
      </Screen>
      {roll && <DiceMoment label={roll.label} resolution={roll.resolution} onDone={() => setRoll(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { alignSelf: 'center' },
});
