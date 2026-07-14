import { TFullHistoryTick } from '@/utils/signal-engine/types';
import { TLast50Stats, TSaContractType } from './types';

const WINDOW_SIZE = 50;
const DEFAULT_BARRIER = 4;

// Faithful port of saUpdateStats' rolling-window win/loss classification and left/right
// percentage readout (reference: index-335-black-bars.html, lines 11343-11409).
//
// Deliberately NOT ported: the reference's repeat-run alternating dot color
// (node-repeat-A/node-repeat-B, driven by the `rs`/`ct`/`lrd` bookkeeping at lines
// 11355-11369) — a decorative "sequence of same-digit repeats" indicator layered on top of
// this win/loss classification for the matches_differs tab specifically. It doesn't affect
// the win/loss percentages and DigitStrip's `getDotStyle(tick)` callback (keyed by tick, no
// index) can't reconstruct the reference's sequential ct-toggle state anyway without
// modifying that shared component, so every node here is styled purely by whether it matches
// the "winning" side for the active contract type.
export function buildLast50Stats(
    fullHistory: TFullHistoryTick[],
    contractType: TSaContractType,
    activeBarrier: number | null
): TLast50Stats | null {
    if (!fullHistory.length) return null;

    const window = fullHistory.slice(-WINDOW_SIZE);
    const barrier = activeBarrier ?? DEFAULT_BARRIER;

    let leftLabel = 'RISE';
    let rightLabel = 'FALL';
    if (contractType === 'even_odd') {
        leftLabel = 'EVEN';
        rightLabel = 'ODD';
    } else if (contractType === 'over_under') {
        leftLabel = 'OVER';
        rightLabel = 'UNDER';
    } else if (contractType === 'matches_differs') {
        leftLabel = 'MATCH';
        rightLabel = 'DIFF';
    }

    let winCount = 0;
    const nodes = window.map(tick => {
        let label: string;
        let variant: TLast50Stats['nodes'][number]['variant'];
        if (contractType === 'matches_differs') {
            label = String(tick.digit);
            variant = activeBarrier === null ? 'neutral' : tick.digit === activeBarrier ? 'win' : 'lose';
        } else if (contractType === 'over_under') {
            const is_over = tick.digit > barrier;
            label = is_over ? 'O' : 'U';
            variant = is_over ? 'win' : 'lose';
        } else if (contractType === 'even_odd') {
            const is_even = tick.digit % 2 === 0;
            label = is_even ? 'E' : 'O';
            variant = is_even ? 'win' : 'lose';
        } else {
            const is_rise = tick.diff >= 0;
            label = is_rise ? 'R' : 'F';
            variant = is_rise ? 'win' : 'lose';
        }
        if (variant === 'win') winCount++;
        return { tick, label, variant };
    });

    const leftPct = Math.round((winCount / window.length) * 100);
    const rightPct = 100 - leftPct;

    return { left_label: leftLabel, left_pct: leftPct, right_label: rightLabel, right_pct: rightPct, nodes };
}
