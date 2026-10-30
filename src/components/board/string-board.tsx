// The red string. A StringBoard measures every pinned card inside it and draws one thread per `thread` key,
// through the pins in `order`, above the paper and below the pin heads, the way string lies on a real board.
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Image, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { world } from '@/theme';

import { materials } from './materials';

export type PinKind = 'red' | 'brass';
/** Where the pin sits: top-left runs a thread down the card edges (stacked boards); top runs it across rows. */
export type PinAt = 'left' | 'top';

interface Anchor {
  x: number;
  y: number;
  pin: PinKind | null;
  thread?: string;
  order: number;
}

interface BoardApi {
  container: RefObject<View | null>;
  set: (key: string, anchor: Anchor | null) => void;
  /** Bumps when the board reflows, so every anchor re-measures. */
  epoch: number;
}

const BoardContext = createContext<BoardApi | null>(null);

export const PIN_SIZE = 22;

const sameAnchor = (a: Anchor | undefined, b: Anchor) =>
  !!a && a.x === b.x && a.y === b.y && a.pin === b.pin && a.thread === b.thread && a.order === b.order;

export function StringBoard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const container = useRef<View>(null);
  const [anchors, setAnchors] = useState<Record<string, Anchor>>({});
  const [epoch, setEpoch] = useState(0);

  const set = useCallback((key: string, anchor: Anchor | null) => {
    setAnchors((prev) => {
      if (!anchor) {
        if (!(key in prev)) return prev;
        const { [key]: _gone, ...rest } = prev;
        return rest;
      }
      return sameAnchor(prev[key], anchor) ? prev : { ...prev, [key]: anchor };
    });
  }, []);

  const api = useMemo(() => ({ container, set, epoch }), [set, epoch]);
  const threads = useMemo(() => {
    const byThread = new Map<string, Anchor[]>();
    for (const a of Object.values(anchors)) {
      if (!a.thread) continue;
      byThread.set(a.thread, [...(byThread.get(a.thread) ?? []), a]);
    }
    return [...byThread.values()].map((list) => list.sort((a, b) => a.order - b.order)).filter((l) => l.length > 1);
  }, [anchors]);

  return (
    <BoardContext value={api}>
      <View
        ref={container}
        collapsable={false}
        style={style}
        onLayout={(e: LayoutChangeEvent) => {
          if (e.nativeEvent.layout.height) setEpoch((n) => n + 1);
        }}>
        {children}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width="100%" height="100%">
            {threads.map((points, i) => (
              <Thread key={i} points={points} />
            ))}
          </Svg>
          {Object.entries(anchors).map(([key, a]) =>
            a.pin ? <Pin key={key} kind={a.pin} style={{ position: 'absolute', left: a.x - PIN_SIZE / 2, top: a.y - PIN_SIZE / 2 }} /> : null,
          )}
        </View>
      </View>
    </BoardContext>
  );
}

/** A string between pins: slack sags under gravity; a run down the board bows into the left gutter. */
/** minBow: the least a vertical run bows sideways; 48 clears cards pinned about 14px inside their edge. */
export function threadPath(points: { x: number; y: number }[], minBow = 48): string {
  return points.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const a = points[i - 1]!;
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    const slack = Math.min(44, 8 + Math.hypot(dx, dy) * 0.1);
    const vertical = Math.abs(dx) < Math.abs(dy) * 0.5;
    // A pin sits about 14px inside its card; the curve's midpoint moves half the control offset, so 48 clears the edge.
    const cx = (a.x + p.x) / 2 - (vertical ? Math.max(minBow, slack * 0.7) : 0);
    const cy = (a.y + p.y) / 2 + (vertical ? 0 : slack);
    return `${d} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }, '');
}

export function Thread({ points, minBow }: { points: { x: number; y: number }[]; minBow?: number }) {
  const d = threadPath(points, minBow);
  return (
    <>
      <Path d={d} stroke={world.stringShadow} strokeWidth={3} fill="none" strokeLinecap="round" translate={[1.5, 3]} />
      <Path d={d} stroke={world.string} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <Path d={d} stroke={world.stringHighlight} strokeWidth={0.7} fill="none" strokeLinecap="round" opacity={0.6} translate={[-0.3, -0.5]} />
    </>
  );
}

export function Pin({ kind = 'red', size = PIN_SIZE, style }: { kind?: PinKind; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Image
        source={kind === 'red' ? materials.pinRed : materials.pinBrass}
        // The red pin's needle hangs below its head; both heads sit in the top ~70% of the asset.
        style={{ width: size * 1.05, height: size * 1.35, marginLeft: -size * 0.025, marginTop: -size * 0.12 }}
        resizeMode="contain"
        accessible={false}
      />
    </View>
  );
}

export interface AnchorOptions {
  /** Cards sharing a thread are joined by string in `order`. */
  thread?: string;
  order?: number;
  pin?: PinKind | null;
  at?: PinAt;
}

/**
 * Registers this view's pin with the nearest StringBoard. Returns `pinned: false` outside a board, where the
 * caller draws its own pin.
 */
export function useBoardAnchor({ thread, order = 0, pin = 'red', at = 'left' }: AnchorOptions) {
  const board = use(BoardContext);
  const ref = useRef<View>(null);
  const key = useId();

  const measure = useCallback(() => {
    const node = ref.current;
    const container = board?.container.current;
    if (!board || !node || !container) return;
    node.measureLayout(
      container,
      (x, y, w) => board.set(key, { x: at === 'left' ? x + 14 : x + w / 2, y: y + 12, pin, thread, order }),
      () => {},
    );
  }, [board, key, at, pin, thread, order]);

  useEffect(() => {
    measure();
  }, [measure, board?.epoch]);
  useEffect(() => () => board?.set(key, null), [board, key]);

  return { ref, onLayout: measure, pinned: !!board };
}
