import { dPcts } from '@/utils/signal-engine/pro-signal';
import { TContractType, TEntryDigit, TFullHistoryTick } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// FIND ENTRY POINT — pullback + confirmation entry-timing engine.
// Faithful port of the reference's Entry Point Engine (reference/index-335-black-bars.html,
// lines 21081-21324: _scIsPullback/_scIsConfirm/_scEntryDigit/_scEntryDesc), deferred out of
// the original Scanner port (see ai-analysis.ts's and scoring.ts's "Find Entry Point" advisory
// copy, which already referenced this as a feature to build later).
//
// Rationale (reference lines 21082-21098): applying a scan result the moment it's found can
// catch a run mid-move — the reference's own scoring already rewards momentum/streaks, so a
// signal is often strongest right as it's about to mean-revert. Instead of firing immediately,
// this watches live ticks for a genuine counter-move (pullback) against the predicted
// direction, then waits for the single statistically strongest "entry digit" to confirm before
// signalling ready — a real accuracy improvement over apply-at-scan-time, not just cosmetic.
// ═══════════════════════════════════════════════════════════════════════════

function barrierFromDir(dir: string): number {
    const match = dir.match(/\d+/);
    return match ? parseInt(match[0], 10) : 4;
}

// Faithful port of _scIsPullback (reference lines 21245-21276) — true when `tick` moves
// AGAINST the result's predicted direction (a counter-move worth waiting out before entering).
export function isPullbackTick(tick: TFullHistoryTick, ct: TContractType, dir: string): boolean {
    switch (ct) {
        case 'DIGITEVEN':
            return tick.digit % 2 !== 0;
        case 'DIGITODD':
            return tick.digit % 2 === 0;
        case 'CALL':
            return tick.diff < 0;
        case 'PUT':
            return tick.diff >= 0;
        case 'DIGITOVER':
            return tick.digit <= barrierFromDir(dir);
        case 'DIGITUNDER':
            return tick.digit > barrierFromDir(dir);
        case 'DIGITMATCH':
            return tick.digit !== barrierFromDir(dir);
        case 'DIGITDIFF':
            return tick.digit === barrierFromDir(dir);
        default:
            return false;
    }
}

// Faithful port of _scIsConfirm (reference lines 21279-21310) — true when `tick` resumes the
// predicted direction after a pullback. `pullbacks` is the running pullback count so far,
// matching the reference's own MATCH/DIFF minimum-pullback gates (>=3 / >=4).
export function isConfirmTick(tick: TFullHistoryTick, ct: TContractType, dir: string, pullbacks: number): boolean {
    switch (ct) {
        case 'DIGITEVEN':
            return tick.digit % 2 === 0;
        case 'DIGITODD':
            return tick.digit % 2 !== 0;
        case 'CALL':
            return tick.diff >= 0;
        case 'PUT':
            return tick.diff < 0;
        case 'DIGITOVER':
            return tick.digit > barrierFromDir(dir);
        case 'DIGITUNDER':
            return tick.digit <= barrierFromDir(dir);
        case 'DIGITMATCH':
            return tick.digit === barrierFromDir(dir) && pullbacks >= 3;
        case 'DIGITDIFF':
            return tick.digit !== barrierFromDir(dir) && pullbacks >= 4;
        default:
            return false;
    }
}

// Faithful port of _scEntryDigit (reference lines 21131-21244) — the single most
// statistically powerful digit to wait for as the actual entry trigger, computed from the
// asset's recent digit-percentage distribution (`hist`, the same rolling ~1000-tick window
// Scanner already tracks — no separate fresh-history fetch needed, unlike the reference's own
// _scFindEntry pre-check, which re-fetched 1000 ticks over a dedicated socket before starting;
// dbot's TicksService.monitor() keeps this window live already).
export function computeEntryDigit(
    hist: TFullHistoryTick[],
    recentTicks: TFullHistoryTick[],
    ct: TContractType,
    dir: string,
    barrier: number | null
): TEntryDigit {
    const pcts = dPcts(hist, hist.length).map(p => p.pct);
    const b = barrier ?? barrierFromDir(dir);

    switch (ct) {
        case 'DIGITEVEN': {
            const evens = [0, 2, 4, 6, 8];
            const best = evens.reduce((a, d) => (pcts[d] > pcts[a] ? d : a), evens[0]);
            return { digit: best, label: `Even digit ${best} (${pcts[best].toFixed(1)}%)` };
        }
        case 'DIGITODD': {
            const odds = [1, 3, 5, 7, 9];
            const best = odds.reduce((a, d) => (pcts[d] > pcts[a] ? d : a), odds[0]);
            return { digit: best, label: `Odd digit ${best} (${pcts[best].toFixed(1)}%)` };
        }
        case 'DIGITOVER': {
            const winning: number[] = [];
            for (let d = b + 1; d <= 9; d++) winning.push(d);
            if (!winning.length) return { digit: b + 1, label: `Digit ${b + 1}` };
            const best = winning.reduce((a, d) => (pcts[d] > pcts[a] ? d : a), winning[0]);
            return { digit: best, label: `Digit ${best} (${pcts[best].toFixed(1)}% — top OVER digit)` };
        }
        case 'DIGITUNDER': {
            const winning: number[] = [];
            for (let d = 0; d < b; d++) winning.push(d);
            if (!winning.length) return { digit: 0, label: 'Digit 0' };
            const best = winning.reduce((a, d) => (pcts[d] > pcts[a] ? d : a), winning[0]);
            return { digit: best, label: `Digit ${best} (${pcts[best].toFixed(1)}% — top UNDER digit)` };
        }
        case 'DIGITMATCH':
            return { digit: b, label: `Digit ${b} itself (${pcts[b].toFixed(1)}%)` };
        case 'DIGITDIFF': {
            const rivals = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => d !== b);
            const healthiest = rivals.reduce((a, d) => (pcts[d] > pcts[a] ? d : a), rivals[0]);
            return {
                digit: healthiest,
                label: `Digit ${healthiest} (${pcts[healthiest].toFixed(1)}% — confirms cold digit absent)`,
            };
        }
        case 'CALL': {
            const last3 = recentTicks.slice(-3).filter(t => t.digit <= 3);
            if (last3.length) {
                const best = last3.reduce((a, t) => (t.digit < a ? t.digit : a), 3);
                return { digit: best, label: `Low digit ${best} (digit-direction lock → RISE)` };
            }
            return { digit: null, label: 'Low digit 0-3 (any low digit confirms RISE)' };
        }
        case 'PUT': {
            const last3 = recentTicks.slice(-3).filter(t => t.digit >= 6);
            if (last3.length) {
                const best = last3.reduce((a, t) => (t.digit > a ? t.digit : a), 6);
                return { digit: best, label: `High digit ${best} (digit-direction lock → FALL)` };
            }
            return { digit: null, label: 'High digit 6-9 (any high digit confirms FALL)' };
        }
        default:
            return { digit: null, label: 'Any confirm tick' };
    }
}

// Faithful port of the digit_hunt phase's per-tick check (reference lines 21586-21598) — is
// `tick` the specific entry digit computed above (CALL/PUT use a range check instead of an
// exact digit, matching the reference's own special-case there). Only called when
// entryDigit.digit isn't null — the caller falls back to isConfirmTick itself when it is,
// matching the reference's own `if (ed.digit === null) { isEntryDigit = _scIsConfirm(...) }`
// branch rather than folding that fallback in here.
export function isEntryDigitMatch(tick: TFullHistoryTick, entryDigit: TEntryDigit, ct: TContractType): boolean {
    if (ct === 'CALL') return tick.digit <= 3;
    if (ct === 'PUT') return tick.digit >= 6;
    return tick.digit === entryDigit.digit;
}

// Faithful port of _scEntryDesc (reference lines 21312-21324).
const ENTRY_DESC: Record<TContractType, string> = {
    DIGITEVEN: 'Watching for 2-3 ODD digits (pullback), then EVEN confirmation',
    DIGITODD: 'Watching for 2-3 EVEN digits (pullback), then ODD confirmation',
    CALL: 'Watching for 2-3 FALL ticks (dip), then RISE confirmation',
    PUT: 'Watching for 2-3 RISE ticks (bounce), then FALL confirmation',
    DIGITOVER: 'Watching for digits ≤ barrier (dip under), then OVER confirmation',
    DIGITUNDER: 'Watching for digits > barrier (spike over), then UNDER confirmation',
    DIGITMATCH: 'Waiting for 3+ ticks without target digit, then reappearance',
    DIGITDIFF: 'Waiting for 4+ ticks of cold digit absence (cooldown period)',
};

export function entryWatchDescription(ct: TContractType): string {
    return ENTRY_DESC[ct] ?? 'Watching for optimal entry…';
}

// Faithful port of the reference's tuning constants (lines 21111-21113).
export const PULLBACK_MIN = 2;
export const PULLBACK_MAX = 5;
export const MAX_WAIT_TICKS = 80;
export const DIGIT_HUNT_REFRESH_TICKS = 20;
