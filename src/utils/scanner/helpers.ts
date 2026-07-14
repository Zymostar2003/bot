import { TDigitPct, TFullHistoryTick } from '@/utils/signal-engine/types';

// ── Scanner-only math helpers ──
// (reference/index-335-black-bars.html, lines 18330-18523, 20251-20273). These are
// genuinely new compositions on top of dbot's already-ported pro-signal.ts primitives
// (dPcts/ema/rsiCalc/iframeZScore are reused directly from there — see scoring.ts) rather
// than re-ports of those primitives: none of them exist in pro-signal.ts already, and
// where a reference helper's math actually differs from an existing port (e.g.
// _volatility's RMS-of-diffs vs pro-signal's stdDev, or _chi2Uniform's 10-bucket
// chi-square vs iframeChi2's 2-bucket form) it's kept as its own function rather than
// forced onto the existing one.

export function dCounts(hist: TFullHistoryTick[], n: number): { counts: number[]; total: number } {
    const slice = hist.slice(-Math.min(hist.length, n));
    const counts = Array(10).fill(0);
    slice.forEach(t => counts[t.digit]++);
    return { counts, total: slice.length };
}

// Chi-square for the full 10-digit distribution vs uniform (each expected = n/10).
// Reference: _chi2Uniform (line 18311-18317). df=9, critical @p<.05 = 16.92, @p<.01 = 21.67.
export function chi2Uniform(counts: number[], total: number): number {
    if (total < 10) return 0;
    const ex = total / 10;
    let stat = 0;
    for (let i = 0; i < 10; i++) stat += Math.pow(counts[i] - ex, 2) / ex;
    return stat;
}

// RMS of the last 100 tick-to-tick diffs. Reference: _volatility (line 18399-18409) —
// deliberately NOT the same formula as pro-signal.ts's stdDev (which subtracts the mean
// first); the reference's scanner uses raw RMS here.
export function volatility(hist: TFullHistoryTick[]): number {
    const diffs = hist.slice(-100).map(t => t.diff);
    if (!diffs.length) return 1;
    const s = diffs.reduce((a, b) => a + b * b, 0) / diffs.length;
    return Math.sqrt(s);
}

// Wald-Wolfowitz Runs Test on a binary sequence. Reference: _runsTest (line 18330-18345).
export function runsTest(binarySeq: number[]): { z: number; runs: number; mu?: number } {
    const n = binarySeq.length;
    if (n < 20) return { z: 0, runs: 0 };
    const n1 = binarySeq.filter(x => x === 1).length;
    const n0 = n - n1;
    if (n0 < 2 || n1 < 2) return { z: 0, runs: 0 };
    let runs = 1;
    for (let i = 1; i < n; i++) if (binarySeq[i] !== binarySeq[i - 1]) runs++;
    const mu = (2 * n0 * n1) / (n0 + n1) + 1;
    const sig2 = (2 * n0 * n1 * (2 * n0 * n1 - n0 - n1)) / ((n0 + n1) * (n0 + n1) * (n0 + n1 - 1));
    const z = sig2 > 0 ? (runs - mu) / Math.sqrt(sig2) : 0;
    return { z, runs, mu };
}

// Lag-1 autocorrelation (Pearson r on (x_t, x_{t+1}) pairs). Reference: _autocorr1
// (line 18417-18432).
export function autocorr1(binarySeq: number[]): number {
    const n = binarySeq.length;
    if (n < 30) return 0;
    const sl = binarySeq.slice(-Math.min(n, 500));
    const m = sl.reduce((a, b) => a + b, 0) / sl.length;
    let num = 0,
        den = 0;
    for (let i = 0; i < sl.length - 1; i++) {
        num += (sl[i] - m) * (sl[i + 1] - m);
        den += (sl[i] - m) * (sl[i] - m);
    }
    return den === 0 ? 0 : num / den;
}

// Splits the sequence into 4 quarters and scores how consistent the win-rate is across
// them (1 = perfectly consistent). Reference: _biasConsistency (line 18441-18465).
export function biasConsistency(binarySeq: number[]): number {
    const n = binarySeq.length;
    if (n < 80) return 0.5;
    const q = Math.floor(n / 4);
    const rates: number[] = [];
    for (let qi = 0; qi < 4; qi++) {
        const sl = binarySeq.slice(qi * q, (qi + 1) * q);
        rates.push(sl.reduce((a, b) => a + b, 0) / sl.length);
    }
    const mean = rates.reduce((a, b) => a + b, 0) / 4;
    const variance = rates.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / 4;
    return Math.max(0, 1 - variance * 20);
}

// Cross-window agreement multiplier — penalises a direction whose z-scores disagree
// across windows. Reference: _agreementGate (line 18471-18490).
export function agreementGate(zScores: number[], dir: string): number {
    const positiveSign =
        dir === 'EVEN' || dir === 'RISE' || dir === 'OVER' || dir.startsWith('MATCH') || dir.startsWith('RISE')
            ? 1
            : -1;
    const agreeing = zScores.filter(z => positiveSign * z > 0).length;
    const total = zScores.length;
    const ratio = agreeing / total;
    if (ratio >= 0.8) return 1.0;
    if (ratio >= 0.6) return 0.85;
    if (ratio >= 0.4) return 0.65;
    return 0.4;
}

export type TClusterCompression = {
    range: number;
    digits: number[];
    compressed: boolean;
    compression: number;
    entryProb: number;
};

// Finds the tightest 3-digit window (by pct) among `digits` and derives an entry
// probability from its compression. Reference: _clusterCompression (line 18498-18523).
export function clusterCompression(p1000: TDigitPct[], digits: number[]): TClusterCompression {
    const vals = digits.map(d => ({ d, p: p1000[d].pct })).sort((a, b) => a.p - b.p);
    if (vals.length < 3) return { range: 999, digits: [], compressed: false, compression: 0, entryProb: 0 };
    let best = { range: 999, digits: [] as number[] };
    for (let i = 0; i + 2 <= vals.length - 1; i++) {
        const r = vals[i + 2].p - vals[i].p;
        if (r < best.range) best = { range: r, digits: [vals[i].d, vals[i + 1].d, vals[i + 2].d] };
    }
    const compression = Math.max(0, 1 - best.range / 20);
    const clusterSize = best.digits.length;
    const entryProb = (clusterSize / 10) * (1 + compression);
    return {
        range: best.range,
        digits: best.digits,
        compressed: best.range <= 2.0,
        compression,
        entryProb: Math.min(0.99, entryProb),
    };
}

// Confidence multiplier from net z-score + sample size. Reference: _significanceGate
// (line 18532-18550). `relaxedScoring` is always false in v1 (see SCANNER_FILTER_DEFAULTS)
// so only the "HONEST mode" branch is reachable — the relaxed branch is kept for fidelity
// but is dead in practice.
export function significanceGate(zNet: number, sampleSize: number, relaxedScoring = false): number {
    const absZ = Math.abs(zNet);
    if (relaxedScoring) {
        if (absZ >= 1.5) return 1.0;
        if (absZ >= 1.0) return 0.85;
        if (absZ >= 0.7) return 0.7;
        return 0.55;
    }
    if (sampleSize < 200) return 0.5;
    if (absZ >= 2.33) return 1.0;
    if (absZ >= 1.96) return 0.92;
    if (absZ >= 1.64) return 0.8;
    if (absZ >= 1.28) return 0.6;
    return 0.35;
}

// Average True Range on a price series. Reference: _atr (line 20251-20258).
export function atr(prices: number[], n = 14): number {
    if (prices.length < n + 1) return 0;
    const sl = prices.slice(-n - 1);
    let sum = 0;
    for (let i = 1; i < sl.length; i++) sum += Math.abs(sl[i] - sl[i - 1]);
    return sum / n;
}

// Is the current price a new local high/low over the lookback window? Reference:
// _breakout (line 20263-20273).
export function breakout(prices: number[], lookback = 20): 'high' | 'low' | 'none' {
    if (prices.length < lookback) return 'none';
    const recent = prices.slice(-lookback);
    const curP = prices[prices.length - 1];
    const maxP = Math.max(...recent);
    const minP = Math.min(...recent);
    if (curP >= maxP) return 'high';
    if (curP <= minP) return 'low';
    return 'none';
}

// ── DeepSeek improvement-layer helpers (used by dsApplyImprovements in scoring.ts) ──
// Reference: lines 18588-18664.

export function dsLastDigits(hist: TFullHistoryTick[], n: number): number[] {
    return hist.slice(-n).map(t => t.digit);
}

// ATR-style volatility regime classifier. Reference: _dsRegime (line 18595-18616).
export function dsRegime(hist: TFullHistoryTick[]): 'normal' | 'quiet' | 'volatile' | 'spiking' {
    if (hist.length < 60) return 'normal';
    const tr = (arr: TFullHistoryTick[]) => {
        let s = 0;
        for (let i = 1; i < arr.length; i++) s += Math.abs(arr[i].price - arr[i - 1].price);
        return s / (arr.length - 1);
    };
    const recent = tr(hist.slice(-20));
    const base = tr(hist.slice(-200));
    if (!base) return 'normal';
    const ratio = recent / base;
    const w = hist.slice(-10).map(t => t.price);
    const spike = w.length > 1 && Math.abs(w[w.length - 1] - w[0]) / Math.max(1e-9, w[0]) > 0.02;
    if (spike) return 'spiking';
    if (ratio < 0.5) return 'quiet';
    if (ratio > 1.5) return 'volatile';
    return 'normal';
}

// Matches cluster-strength score 0-100 — used only to FILTER, not predict. Reference:
// _dsClusterStrength (line 18619-18641).
export function dsClusterStrength(hist: TFullHistoryTick[], digit: number): number {
    const w = dsLastDigits(hist, 6);
    const idx: number[] = [];
    w.forEach((d, i) => {
        if (d === digit) idx.push(i);
    });
    if (idx.length < 3) return 0;
    const recency = (idx[idx.length - 1] + 1) / 6;
    let freq = Math.pow(idx.length / 3, 2);
    if (freq > 1) freq = 1;
    const gaps: number[] = [];
    for (let i = 1; i < idx.length; i++) gaps.push(idx[i] - idx[i - 1]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const varc = gaps.reduce((a, b) => a + (b - mean) * (b - mean), 0) / gaps.length;
    const gapCons = Math.max(0, 1 - varc);
    return Math.round((recency * 0.4 + freq * 0.3 + gapCons * 0.3) * 100);
}

// Even/Odd spread over the last 100 digits. Reference: _dsSpread (line 18644-18655).
export function dsSpread(hist: TFullHistoryTick[]): { even: number; odd: number; spread: number; n: number } {
    const w = dsLastDigits(hist, 100);
    const even = w.filter(d => d % 2 === 0).length;
    return { even, odd: w.length - even, spread: Math.abs(even - (w.length - even)), n: w.length };
}

// Maps a contract direction to a coarse up/down bias for the cross-contract-confirmation
// improvement (#9). Reference: _dsDirBias (line 18658-18664).
export function dsDirBias(ct: string, dir: string): 'up' | 'down' | null {
    if (ct === 'CALL' || dir === 'RISE') return 'up';
    if (ct === 'PUT' || dir === 'FALL') return 'down';
    if (ct === 'DIGITOVER') return 'up';
    if (ct === 'DIGITUNDER') return 'down';
    return null;
}
