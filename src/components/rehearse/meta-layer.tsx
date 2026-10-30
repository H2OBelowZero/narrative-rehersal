// The Director's meta layer (PRD §35): what the performers don't see. Render inside <Gate perm="seeMeta">.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { STC_BEATS } from '@shared/structure';

import { Body, Button, Caption, Card, Eyebrow, Icon } from '@/components/ui';
import { useProject } from '@/lib/session';
import { spacing, useTheme } from '@/theme';

import { Disclosure } from './disclosure';
import { THEME_STANCE_LABEL } from './effects';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function MetaLayer() {
  const { colors } = useTheme();
  const { project, projectId, sim, beat, protagonist } = useProject();
  if (!project || !sim || !beat) return null;

  const { def, state } = beat;
  const met = new Set(state.conditionsMet.map((c) => c.requirementId));
  const metCount = def.requirements.filter((r) => met.has(r.id)).length;
  const payoffs = sim.setups.filter((s) => s.status === 'payoff-candidate');
  const arc = protagonist?.worldFit;
  const lastBehaviour = protagonist ? sim.characters[protagonist.id]?.behaviors.at(-1) : undefined;
  const lastTheme = sim.themeSignals.at(-1);
  const summary = [
    def.name,
    `${metCount} of ${def.requirements.length} required`,
    plural(payoffs.length, 'payoff ready', 'payoffs ready'),
  ].join(' · ');

  const go = (tab: 'story' | 'discover', params: Record<string, string> = {}) =>
    router.navigate({ pathname: `/project/[id]/${tab}` as const, params: { id: projectId, ...params } });

  return (
    <Card tone="sunken">
      <Disclosure title="Director’s meta layer" eyebrow summary={summary}>
        <Row label="Current beat">
          <Body strong>{def.name}</Body>
          <Caption>
            Act {def.act} · beat {sim.beatIndex + 1} of {STC_BEATS.length} · around {def.at}
          </Caption>
        </Row>
        <Row label="Story function">
          <Body>{def.purpose}</Body>
        </Row>
        <Row label="Required">
          {def.requirements.map((r) => (
            <View key={r.id} style={styles.requirement}>
              <View style={styles.requirementIcon}>
                <Icon
                  name={met.has(r.id) ? 'check' : 'dot'}
                  size={met.has(r.id) ? 15 : 6}
                  color={met.has(r.id) ? colors.tier.success : colors.textTertiary}
                />
              </View>
              <Body
                style={styles.grow}
                tone={met.has(r.id) ? 'secondary' : 'primary'}
                accessibilityLabel={`${r.text}: ${met.has(r.id) ? 'met' : 'not yet met'}`}>
                {r.text}
              </Body>
            </View>
          ))}
        </Row>
        <Row label="Active directive">
          <Body tone={sim.directive ? 'primary' : 'tertiary'}>{sim.directive ?? 'None chosen yet'}</Body>
          <Caption>{plural(sim.opportunities.length, 'opportunity', 'opportunities')} available</Caption>
        </Row>
        <Row label="Setups available for payoff">
          {payoffs.length ? (
            payoffs.map((s) => <Body key={s.id}>• {s.text}</Body>)
          ) : (
            <Body tone="tertiary">None yet</Body>
          )}
        </Row>
        <Row label="Character arc pressure">
          {arc?.requiredAdaptation ? <Body>{arc.requiredAdaptation}</Body> : null}
          {arc?.resistance ? <Caption>Resists: {arc.resistance}</Caption> : null}
          {lastBehaviour ? <Caption>Latest observed: {lastBehaviour.trait}</Caption> : null}
          {!arc?.requiredAdaptation && !lastBehaviour ? <Body tone="tertiary">Nothing observed yet</Body> : null}
        </Row>
        <Row label="Theme pressure">
          <Body tone={project.model.thematicConflict ? 'primary' : 'tertiary'}>
            {project.model.thematicConflict || 'No thematic conflict set'}
          </Body>
          {lastTheme ? (
            <Caption>
              Latest ({THEME_STANCE_LABEL[lastTheme.stance].toLowerCase()}): {lastTheme.text}
            </Caption>
          ) : null}
        </Row>
        <View style={styles.links}>
          <Button
            title="Structure"
            icon="structure"
            size="sm"
            variant="secondary"
            onPress={() => go('story', { view: 'structure' })}
          />
          <Button title="Discoveries" icon="discover" size="sm" variant="secondary" onPress={() => go('discover')} />
        </View>
      </Disclosure>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs },
  requirement: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  requirementIcon: { width: 16, height: 23, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
