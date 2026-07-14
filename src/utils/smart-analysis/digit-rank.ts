import { dPcts } from '@/utils/signal-engine/pro-signal';
import { TFullHistoryTick } from '@/utils/signal-engine/types';
import { TDigitRank, TDigitRankTier } from './types';

const SAMPLE_SIZE = 1000;

// Faithful port of saUpdateDigitRanks' tie-aware rank coloring (reference:
// index-335-black-bars.html, lines 11411-11450) — reuses dPcts (the reference re-implements
// this exact count-then-percentage logic inline) instead of recomputing counts by hand.
//
// Ties are compared on the 1-decimal-rounded percentage, matching the reference's
// `toFixed(1)` string comparison (`s.pct === _gp` etc.) — digits sharing the *displayed*
// percentage of the top/2nd/bottom digit share that digit's tier, with the reference's
// if/else-if priority preserved: top > bottom > second.
export function rankDigits(fullHistory: TFullHistoryTick[]): TDigitRank[] {
    const p1000 = dPcts(fullHistory, SAMPLE_SIZE);
    const rounded = p1000.map(d => Math.round(d.pct * 10) / 10);
    const sortedIdx = p1000.map((_, digit) => digit).sort((a, b) => p1000[b].count - p1000[a].count);
    const topPct = rounded[sortedIdx[0]];
    const secondPct = rounded[sortedIdx[1]];
    const bottomPct = rounded[sortedIdx[9]];

    return p1000.map((d, digit) => {
        const pct = rounded[digit];
        const tier: TDigitRankTier =
            pct === topPct ? 'top' : pct === bottomPct ? 'bottom' : pct === secondPct ? 'second' : 'none';
        return { digit, pct: d.pct, tier };
    });
}
