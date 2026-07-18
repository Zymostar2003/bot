import { dPcts } from '@/utils/signal-engine/pro-signal';
import { TDigitPct, TFullHistoryTick } from '@/utils/signal-engine/types';

// ═══════════════════════════════════════════════════════════════════════════
// AGENT — quick-glance digit-distribution decision matrix.
// New capability (no reference equivalent) — a self-contained, always-available floating
// widget rather than a dashboard tab. Pure calculation logic, no side effects; the caller
// (agent.tsx) is responsible for fetching the tick history and re-running this on demand.
// ═══════════════════════════════════════════════════════════════════════════

export type TAgentAction = 'MATCH' | 'OVER' | 'UNDER' | 'WAIT';
export type TAgentRisk = 'Low' | 'Medium' | 'High';

// The Lows(0-4)/Highs(5-9) split's own boundary doubles as the OVER/UNDER barrier — the spec
// doesn't name one explicitly beyond this grouping, and 4 is the natural boundary digit.
const BARRIER = 4;

export type TAgentAnalysis = {
    stats: TDigitPct[]; // all 10 digits, in digit order (0-9) — for the bar chart
    lowest_three: TDigitPct[]; // ascending by pct — context for a MATCH recommendation
    highest: TDigitPct;
    lowest: TDigitPct;
    range: number; // highest.pct - lowest.pct
    lows_pct: number; // sum of pct for digits 0-4
    highs_pct: number; // sum of pct for digits 5-9
    action: TAgentAction;
    target_digit: number | null; // the MATCH digit, or the OVER/UNDER barrier — null for WAIT
    confidence: number; // range * 10, capped at 95
    risk: TAgentRisk;
    streak: number; // consecutive most-recent ticks favoring the recommendation (0 for WAIT)
    sample_size: number;
};

// Faithful implementation of the spec's own decision matrix:
//   Range > 6%        -> MATCH the single lowest-occurring digit
//   4% <= Range <= 6%  -> compare Lows(0-4) vs Highs(5-9) totals; >52% either side -> OVER/UNDER
//   Range < 4%         -> WAIT, distribution too balanced
// Confidence and risk are both driven by Range: a bigger deviation from the uniform 10% is a
// stronger, more reliable statistical edge, so confidence rises and risk falls together.
export function analyzeDigits(hist: TFullHistoryTick[]): TAgentAnalysis {
    const sample_size = Math.min(1000, hist.length);
    const stats = dPcts(hist, 1000);

    const sorted_desc = [...stats].sort((a, b) => b.pct - a.pct);
    const sorted_asc = [...stats].sort((a, b) => a.pct - b.pct);
    const highest = sorted_desc[0];
    const lowest = sorted_asc[0];
    const lowest_three = sorted_asc.slice(0, 3);
    const range = highest.pct - lowest.pct;

    const lows_pct = stats.filter(s => s.digit <= BARRIER).reduce((sum, s) => sum + s.pct, 0);
    const highs_pct = stats.filter(s => s.digit > BARRIER).reduce((sum, s) => sum + s.pct, 0);

    let action: TAgentAction = 'WAIT';
    let target_digit: number | null = null;

    if (range > 6) {
        action = 'MATCH';
        target_digit = lowest.digit;
    } else if (range >= 4) {
        if (lows_pct > 52) {
            action = 'OVER';
            target_digit = BARRIER;
        } else if (highs_pct > 52) {
            action = 'UNDER';
            target_digit = BARRIER;
        }
        // else: Lows/Highs both sit in the 48-52% dead zone — falls through to WAIT.
    }

    const confidence = Math.min(95, Math.round(range * 10));
    const risk: TAgentRisk = range < 4 ? 'High' : range <= 6 ? 'Medium' : 'Low';

    // Streak — how many of the most recent ticks already confirm the recommendation:
    // MATCH: consecutive trailing ticks that ARE the target digit.
    // OVER: consecutive trailing ticks above the barrier (the Highs group OVER is betting on).
    // UNDER: consecutive trailing ticks at/below the barrier (the Lows group UNDER is betting on).
    let streak = 0;
    if (action !== 'WAIT') {
        for (let i = hist.length - 1; i >= 0; i--) {
            const { digit } = hist[i];
            const favors =
                action === 'MATCH' ? digit === target_digit : action === 'OVER' ? digit > BARRIER : digit <= BARRIER;
            if (!favors) break;
            streak++;
        }
    }

    return {
        stats,
        lowest_three,
        highest,
        lowest,
        range,
        lows_pct,
        highs_pct,
        action,
        target_digit,
        confidence,
        risk,
        streak,
        sample_size,
    };
}
