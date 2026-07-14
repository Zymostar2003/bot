import { consecEO, curStreak, dPcts } from '@/utils/signal-engine/pro-signal';
import { TFullHistoryTick } from '@/utils/signal-engine/types';
import { TInsightTip } from './types';

const MIN_TICKS = 30;
const SAMPLE_SIZE = 1000;
const LAST_N = 50;
const EVEN_DIGITS = [0, 2, 4, 6, 8];
const ODD_DIGITS = [1, 3, 5, 7, 9];
const OVER_DIGITS = [5, 6, 7, 8, 9];
const UNDER_DIGITS = [0, 1, 2, 3, 4];
const RISE_DOMINANCE_HIGH = 60;
const RISE_DOMINANCE_LOW = 40;
const EVEN_ODD_LEAD_THRESHOLD = 3;
const EVEN_ODD_STREAK_THRESHOLD = 3;
const STREAK_TIP_THRESHOLD = 3;

// Faithful port of saUpdateInsight's tip-building logic (reference:
// index-335-black-bars.html, lines 11452-11517). Structural change: returns structured
// TInsightTip facts instead of building HTML strings — insight-card.tsx owns the actual
// copy/Localize wiring, keeping this function pure and independently testable.
//
// Reuses curStreak/consecEO (pro-signal.ts) instead of re-walking history by hand: the
// reference's streak loop (lines 11463-11468, diff>=0 based, tick-only — candleHistory.length
// is never >=3 for Smart Analysis since it doesn't monitor candles) is identical in shape to
// curStreak(fullHistory, []); its even/odd streak loop (lines 11487-11492) is identical to
// consecEO(fullHistory).
export function buildInsightTips(fullHistory: TFullHistoryTick[]): TInsightTip[] | null {
    if (fullHistory.length < MIN_TICKS) return null;

    const p1000 = dPcts(fullHistory, SAMPLE_SIZE);
    const sortedByPct = [...p1000].sort((a, b) => b.pct - a.pct);
    const hot = sortedByPct[0];
    const cold = sortedByPct[sortedByPct.length - 1];

    const streak = curStreak(fullHistory, []);

    const last50 = fullHistory.slice(-LAST_N);
    const rises = last50.filter(t => t.diff >= 0).length;
    const risePct = Math.round((rises / last50.length) * 100);

    const evenSum = EVEN_DIGITS.reduce((a, d) => a + p1000[d].pct, 0);
    const oddSum = ODD_DIGITS.reduce((a, d) => a + p1000[d].pct, 0);
    const eoLeader: 'EVEN' | 'ODD' = evenSum > oddSum ? 'EVEN' : 'ODD';
    const eoGap = Math.abs(evenSum - oddSum);

    const overSum = OVER_DIGITS.reduce((a, d) => a + p1000[d].pct, 0);
    const underSum = UNDER_DIGITS.reduce((a, d) => a + p1000[d].pct, 0);

    const eoStreak = consecEO(fullHistory);
    const lastParity: 'EVEN' | 'ODD' = fullHistory[fullHistory.length - 1].digit % 2 === 0 ? 'EVEN' : 'ODD';
    const eoStreakLen = lastParity === 'EVEN' ? eoStreak.even : eoStreak.odd;

    const tips: TInsightTip[] = [];

    if (streak.type !== 'N/A' && streak.len >= STREAK_TIP_THRESHOLD) {
        tips.push({ type: 'streak', direction: streak.type, len: streak.len });
    }
    if (risePct > RISE_DOMINANCE_HIGH) {
        tips.push({ type: 'rise_dominance', pct: risePct, direction: 'up' });
    } else if (risePct < RISE_DOMINANCE_LOW) {
        tips.push({ type: 'rise_dominance', pct: risePct, direction: 'down' });
    }
    tips.push({ type: 'hot_cold', hot_digit: hot.digit, hot_pct: hot.pct, cold_digit: cold.digit, cold_pct: cold.pct });
    if (eoGap > EVEN_ODD_LEAD_THRESHOLD) {
        tips.push({ type: 'even_odd_lead', leader: eoLeader, gap: eoGap });
    }
    if (eoStreakLen >= EVEN_ODD_STREAK_THRESHOLD) {
        tips.push({ type: 'even_odd_streak', parity: lastParity, len: eoStreakLen });
    }
    tips.push({
        type: 'over_under',
        over_pct: overSum,
        under_pct: underSum,
        leader: overSum > underSum ? 'OVER' : 'UNDER',
    });

    return tips;
}
