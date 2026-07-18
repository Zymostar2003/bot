import { dPcts } from '@/utils/signal-engine/pro-signal';
import { TDigitPct, TFullHistoryTick } from '@/utils/signal-engine/types';

// ═══════════════════════════════════════════════════════════════════════════
// SEND AGENT — multi-asset, multi-contract-family scan.
// New capability (no reference equivalent). For a single asset, analyzeDigits (analysis.ts)
// only ever frames its answer as MATCH-or-OVER/UNDER-at-a-fixed-barrier. "Send Agent" instead
// evaluates all three contract families — Even/Odd, Over/Under (searching for the strongest
// barrier, not a fixed one), and Match/Differ (picking the specific hottest/coldest digit) —
// across every asset in the selector, and surfaces whichever single combination shows the
// strongest edge anywhere.
//
// Confidence uses the same edge*10 (capped 95) scale as analyzeDigits' own confidence, applied
// uniformly across families so "best across everything" stays a simple, legible comparison.
// This is deliberately not a rigorous statistical model (different baselines — 50% for Even/
// Odd, ~10%/90% for Match/Differ, a variable fair% per barrier for Over/Under — aren't directly
// comparable in a statistically rigorous way) — Scanner already fills that role with proper
// z-scores/significance gating; Agent's whole design is a fast, simple percentage-point read.
// ═══════════════════════════════════════════════════════════════════════════

export type TAgentFamily = 'EVEN' | 'ODD' | 'OVER' | 'UNDER' | 'MATCH' | 'DIFFER';

export type TAgentOpportunity = {
    asset: string;
    asset_label: string;
    family: TAgentFamily;
    digit: number | null; // barrier for OVER/UNDER, target digit for MATCH/DIFFER, null for EVEN/ODD
    edge: number; // percentage points above this family's fair baseline
    confidence: number; // edge * 10, capped at 95
    detail: string;
};

type TCandidate = { family: TAgentFamily; digit: number | null; edge: number; detail: string };

const EVENS = [0, 2, 4, 6, 8];
// Barrier search range: 2-7, not the full 1-8 — a barrier of 1 or 8 leaves only one or two
// digits on one side, which is noisy on any single 1000-tick sample (same reasoning Scanner's
// own barrier search keeps to a narrow band around the middle rather than the extremes).
const MIN_BARRIER = 2;
const MAX_BARRIER = 7;

function evaluateEvenOdd(stats: TDigitPct[]): TCandidate {
    const even_pct = EVENS.reduce((sum, d) => sum + stats[d].pct, 0);
    const odd_pct = 100 - even_pct;
    const family: TAgentFamily = even_pct >= odd_pct ? 'EVEN' : 'ODD';
    const pct = family === 'EVEN' ? even_pct : odd_pct;
    return { family, digit: null, edge: Math.abs(even_pct - 50), detail: `${pct.toFixed(1)}% vs 50% fair` };
}

function evaluateOverUnder(stats: TDigitPct[]): TCandidate {
    let best: TCandidate | null = null;
    for (let barrier = MIN_BARRIER; barrier <= MAX_BARRIER; barrier++) {
        const lows_fair = (barrier + 1) * 10;
        const highs_fair = (9 - barrier) * 10;
        const lows_pct = stats.filter(s => s.digit <= barrier).reduce((sum, s) => sum + s.pct, 0);
        const highs_pct = 100 - lows_pct;

        const over: TCandidate = {
            family: 'OVER',
            digit: barrier,
            edge: highs_pct - highs_fair,
            detail: `OVER ${barrier}: ${highs_pct.toFixed(1)}% vs ${highs_fair}% fair`,
        };
        const under: TCandidate = {
            family: 'UNDER',
            digit: barrier,
            edge: lows_pct - lows_fair,
            detail: `UNDER ${barrier}: ${lows_pct.toFixed(1)}% vs ${lows_fair}% fair`,
        };
        if (!best || over.edge > best.edge) best = over;
        if (under.edge > best.edge) best = under;
    }
    return best as TCandidate;
}

function evaluateMatchDiffer(stats: TDigitPct[]): TCandidate {
    const sorted_desc = [...stats].sort((a, b) => b.pct - a.pct);
    const sorted_asc = [...stats].sort((a, b) => a.pct - b.pct);
    const hot = sorted_desc[0];
    const cold = sorted_asc[0];

    const match: TCandidate = {
        family: 'MATCH',
        digit: hot.digit,
        edge: hot.pct - 10, // fair MATCH baseline is 10% (1-in-10)
        detail: `MATCH ${hot.digit}: ${hot.pct.toFixed(1)}% vs 10% fair`,
    };
    const differ: TCandidate = {
        family: 'DIFFER',
        digit: cold.digit,
        edge: 10 - cold.pct, // the colder the target digit, the safer a DIFFER bet against it
        detail: `DIFFER ${cold.digit}: ${cold.pct.toFixed(1)}% vs 10% fair`,
    };
    return match.edge >= differ.edge ? match : differ;
}

// Evaluates Even/Odd, Over/Under (best barrier), and Match/Differ (best digit) for one asset's
// tick sample and returns whichever single family shows the strongest edge.
export function bestOpportunity(asset: string, asset_label: string, hist: TFullHistoryTick[]): TAgentOpportunity {
    const stats = dPcts(hist, 1000);
    const candidates = [evaluateEvenOdd(stats), evaluateOverUnder(stats), evaluateMatchDiffer(stats)];
    const best = candidates.reduce((a, b) => (b.edge > a.edge ? b : a));
    const confidence = Math.min(95, Math.max(0, Math.round(best.edge * 10)));

    return {
        asset,
        asset_label,
        family: best.family,
        digit: best.digit,
        edge: best.edge,
        confidence,
        detail: best.detail,
    };
}
