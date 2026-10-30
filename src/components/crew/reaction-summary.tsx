// Reaction capture summary: the moments of the active simulation that landed hardest, by reaction count.
import { REACTIONS, TIER_LABEL } from '@shared/structure';
import type { Reaction, ReactionKind, StoryEvent } from '@shared/types';

import { Caption, EmptyState, List, ListRow, Section } from '@/components/ui';
import { useProject } from '@/lib/session';

const TOP = 5;

export function ReactionSummary() {
  const { project, sim, charName } = useProject();
  if (!project || !sim) return null;

  const events = new Map(sim.events.map((e) => [e.id, e]));
  const byEvent = new Map<string, Reaction[]>();
  for (const r of project.reactions) {
    if (!events.has(r.eventId)) continue; // another branch
    const list = byEvent.get(r.eventId);
    if (list) list.push(r);
    else byEvent.set(r.eventId, [r]);
  }
  const top = [...byEvent].sort((a, b) => b[1].length - a[1].length).slice(0, TOP);

  const moment = (e: StoryEvent): string => {
    if (e.kind === 'action') return `${charName(e.actorId)}: “${(e.playerInput ?? e.text).replace(/^["“]|["”]$/g, '')}”`;
    if (e.kind === 'resolution' && e.resolution) return `${TIER_LABEL[e.resolution.tier]}: ${e.text}`;
    return e.text;
  };

  const breakdown = (reactions: Reaction[]): string => {
    const counts = new Map<ReactionKind, number>();
    for (const r of reactions) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
    const notes = reactions.filter((r) => r.note).length;
    return [
      ...[...counts].sort((a, b) => b[1] - a[1]).map(([kind, n]) => `${REACTIONS[kind].emoji} ${n}`),
      ...(notes ? [`${notes} ${notes === 1 ? 'note' : 'notes'}`] : []),
    ].join('  ·  ');
  };

  return (
    <Section title="Reaction capture" note="what landed hardest">
      {top.length === 0 ? (
        <EmptyState title="No reactions yet" message="React to moments in Rehearse. The ones that land show up here." />
      ) : (
        <List>
          {top.map(([id, reactions]) => (
            <ListRow
              key={id}
              title={moment(events.get(id)!)}
              subtitle={breakdown(reactions)}
              subtitleLines={1}
              trailing={
                <Caption tone="primary" strong accessibilityLabel={`${reactions.length} reactions`}>
                  {reactions.length}
                </Caption>
              }
            />
          ))}
        </List>
      )}
    </Section>
  );
}
