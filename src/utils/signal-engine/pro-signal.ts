import { TCandle, TDigitPct, TFullHistoryTick, THysteresisState, TIndicatorBias, TProSignalResult } from './types';

const _IFRAME_HOLD_REQUIRED = 5;

// ── Faithful ports of the reference's ANALYSIS HELPERS ──
// (reference/index-335-black-bars.html, lines 6718-6792). Structural change throughout:
// these read fullHistory/candleHistory as globals in the reference; here they're
// explicit parameters.

export function dPcts(fullHistory: TFullHistoryTick[], n: number): TDigitPct[] {
    const sample = fullHistory.slice(-Math.min(n, fullHistory.length));
    const total = sample.length || 1;
    const counts = Array(10).fill(0);
    sample.forEach(t => counts[t.digit]++);
    return counts.map((c, d) => ({ digit: d, count: c, pct: (c / total) * 100 }));
}

export function driftOf(fullHistory: TFullHistoryTick[], d: number, longN?: number, shortN?: number): number {
    const ln = longN || 1000;
    const sn = shortN || 50;
    return dPcts(fullHistory, sn)[d].pct - dPcts(fullHistory, ln)[d].pct;
}

export function ema(prices: number[], p: number): number | null {
    if (prices.length < p) return null;
    const k = 2 / (p + 1);
    let e = prices.slice(0, p).reduce((a, b) => a + b, 0) / p;
    for (let i = p; i < prices.length; i++) e = prices[i] * k + e * (1 - k);
    return e;
}

export function rsiCalc(prices: number[], p?: number): number | null {
    const period = p || 14;
    if (prices.length < period + 1) return null;
    const sl = prices.slice(-period - 1);
    let g = 0,
        l = 0;
    for (let i = 1; i < sl.length; i++) {
        const d = sl[i] - sl[i - 1];
        if (d > 0) g += d;
        else l -= d;
    }
    const ag = g / period,
        al = l / period;
    return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
}

export function stdDev(vals: number[]): number {
    if (!vals.length) return 0;
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - m, 2), 0) / vals.length);
}

export function curStreak(
    fullHistory: TFullHistoryTick[],
    candleHistory: TCandle[]
): { type: 'RISE' | 'FALL' | 'N/A'; len: number } {
    // Uses candleHistory so it follows switched asset AND respects timeframe
    const useCandles = candleHistory.length >= 3;
    const hist: Array<TCandle | TFullHistoryTick> = useCandles ? candleHistory : fullHistory;
    if (!hist.length) return { type: 'N/A', len: 0 };
    const last = hist[hist.length - 1];
    const isRise = useCandles
        ? parseFloat(String((last as TCandle).close)) >= parseFloat(String((last as TCandle).open))
        : (last as TFullHistoryTick).diff >= 0;
    const type: 'RISE' | 'FALL' = isRise ? 'RISE' : 'FALL';
    let len = 1;
    for (let si = hist.length - 2; si >= 0; si--) {
        const item = hist[si];
        const r2 = useCandles
            ? parseFloat(String((item as TCandle).close)) >= parseFloat(String((item as TCandle).open))
            : (item as TFullHistoryTick).diff >= 0;
        if ((r2 ? 'RISE' : 'FALL') === type) len++;
        else break;
    }
    return { type, len };
}

export function consecDir(fullHistory: TFullHistoryTick[], candleHistory: TCandle[]): { rise: number; fall: number } {
    // Uses candleHistory for candle direction (asset + timeframe aware)
    const useCandles = candleHistory.length >= 3;
    const hist: Array<TCandle | TFullHistoryTick> = useCandles ? candleHistory : fullHistory;
    let rC = 0,
        fC = 0;
    for (let di = hist.length - 1; di >= 0; di--) {
        const item = hist[di];
        const isUp = useCandles
            ? parseFloat(String((item as TCandle).close)) >= parseFloat(String((item as TCandle).open))
            : (item as TFullHistoryTick).diff >= 0;
        if (isUp) {
            rC++;
            if (fC > 0) break;
        } else {
            if (rC > 0) break;
            fC++;
        }
    }
    return { rise: rC, fall: fC };
}

export function consecEO(fullHistory: TFullHistoryTick[]): { even: number; odd: number } {
    let eC = 0,
        oC = 0;
    for (let i = fullHistory.length - 1; i >= 0; i--) {
        const isE = fullHistory[i].digit % 2 === 0;
        if (isE) {
            eC++;
            if (oC > 0) break;
        } else {
            if (eC > 0) break;
            oC++;
        }
    }
    return { even: eC, odd: oC };
}

export function shannonEnt(fullHistory: TFullHistoryTick[]): number {
    const sample = dPcts(fullHistory, 1000);
    const H = sample.reduce((a, t) => {
        const p = t.pct / 100;
        return p > 0 ? a - p * Math.log2(p) : a;
    }, 0);
    return H / Math.log2(10);
}

// ── PRO SIGNAL ENGINE v3.0 helpers ──
// (reference lines 6894-6922). iframeHysteresis mutates the passed-in `state` object,
// mirroring the reference's mutation of the module-global _iframeSigState.

export function iframeZScore(observed: number, n: number, p: number): number {
    const mu = n * p,
        sigma = Math.sqrt(n * p * (1 - p));
    return sigma < 0.001 ? 0 : (observed - mu) / sigma;
}

export function iframeChi2(a: number, b: number): number {
    const total = a + b;
    if (total < 2) return 0;
    const exp = total / 2;
    return ((a - exp) * (a - exp) + (b - exp) * (b - exp)) / exp;
}

export function iframeHysteresis(state: THysteresisState, key: keyof THysteresisState, rawDir: string): string {
    const s = state[key];
    if (s.dir === null) {
        s.dir = rawDir;
        s.holdTicks = 1;
        return rawDir;
    }
    if (rawDir === s.dir) {
        s.holdTicks = Math.min(s.holdTicks + 1, 30);
        return s.dir;
    }
    s.holdTicks = Math.max(0, s.holdTicks - 1);
    if (s.holdTicks <= 0) {
        s.dir = rawDir;
        s.holdTicks = _IFRAME_HOLD_REQUIRED;
        return rawDir;
    }
    return s.dir;
}

export function createHysteresisState(): THysteresisState {
    return {
        rf: { dir: null, holdTicks: 0 },
        eo: { dir: null, holdTicks: 0 },
        ou: { dir: null, holdTicks: 0 },
    };
}

// Faithful port of proSignal (reference lines 6924-7101).
// PRO SIGNAL ENGINE v3.0 — CEOskit Statistical Confluence System. Computes a 0-100
// confluence score + 0-7 "run" recommendation for every contract type (Rise/Fall,
// Even/Odd, Over/Under, Differs, Matches) in one pass — the reference does not split
// this into per-contract-type functions, so neither does this port.
//
// Structural change: `vfpiBias` and `hysteresisState` are passed explicitly instead of
// being read from getIndicatorBias()/the global _iframeSigState.
export function proSignal(
    fullHistory: TFullHistoryTick[],
    candleHistory: TCandle[],
    vfpiBias: TIndicatorBias,
    hysteresisState: THysteresisState
): TProSignalResult | null {
    if (fullHistory.length < 100) return null;
    const p1000 = dPcts(fullHistory, 1000),
        p50 = dPcts(fullHistory, 50);
    const prices = fullHistory.map(t => t.price);
    const evenD = [0, 2, 4, 6, 8],
        oddD = [1, 3, 5, 7, 9];
    const n = fullHistory.length;

    const cd = consecDir(fullHistory, candleHistory);
    const eoS = consecEO(fullHistory);
    const riseStreak = cd.rise,
        fallStreak = cd.fall;
    const evenStreak = eoS.even || 0,
        oddStreak = eoS.odd || 0;

    // ── Stability: variance of digit percentages around 10% ──
    const variance = p1000.reduce((a, sD) => a + Math.pow(sD.pct - 10, 2), 0) / 10;
    const ent = shannonEnt(fullHistory),
        stable = variance < 1.8 && ent < 0.99;

    // ── Volatility penalty ──
    const vol = stdDev(fullHistory.slice(-100).map(t => t.diff));
    const volPenalty = vol > 0.5 ? 0.72 : vol > 0.2 ? 0.88 : 1.0;

    // ── VFPI alignment ──
    const cBias = vfpiBias;

    // ── Technical indicators ──
    const ema8v = ema(prices, 8),
        ema20v = ema(prices, 20);
    const rsi14v = rsiCalc(prices, 14);
    const curP = prices[prices.length - 1] || 0;
    const aboveEma8 = ema8v !== null && curP > ema8v;
    const aboveEma20 = ema20v !== null && curP > ema20v;
    const rsiOB = rsi14v !== null && rsi14v > 72;
    const rsiOS = rsi14v !== null && rsi14v < 28;

    // ── Overdue / deficit ──
    const exp = n / 10;
    const overdue = p1000.map(sD => ({ digit: sD.digit, count: sD.count, deficit: exp - sD.count, pct: sD.pct }));

    // ══════════════════════════════════════════════════════════════
    // ── RISE / FALL — Z-score multi-window + EMA + RSI + VFPI ──
    // ══════════════════════════════════════════════════════════════
    const r50 = fullHistory.slice(-50).filter(t => t.diff >= 0).length;
    const r200 = fullHistory.slice(-200).filter(t => t.diff >= 0).length;
    const n200 = Math.min(n, 200);
    const r500 = fullHistory.slice(-Math.min(n, 500)).filter(t => t.diff >= 0).length;
    const n500 = Math.min(n, 500);
    const zRF50 = iframeZScore(r50, 50, 0.5);
    const zRF200 = iframeZScore(r200, n200, 0.5);
    const zRF500 = iframeZScore(r500, n500, 0.5);
    const zNetRF = (zRF50 + zRF200 + zRF500) / 3;
    const rfWindowsAgree = zRF50 > 0 === zRF200 > 0 && zRF200 > 0 === zRF500 > 0;

    let rfRawDir = zNetRF >= 0 ? 'RISE' : 'FALL';
    if (riseStreak >= 4 && riseStreak > fallStreak) rfRawDir = 'RISE';
    if (fallStreak >= 4 && fallStreak > riseStreak) rfRawDir = 'FALL';
    if (cBias === 'bull' && rfRawDir === 'FALL' && riseStreak >= 2) rfRawDir = 'RISE';
    if (cBias === 'bear' && rfRawDir === 'RISE' && fallStreak >= 2) rfRawDir = 'FALL';
    const rfDir = iframeHysteresis(hysteresisState, 'rf', rfRawDir) as 'RISE' | 'FALL';
    const rfStreak = rfDir === 'RISE' ? riseStreak : fallStreak;

    let rfScore = 0;
    rfScore += Math.min(30, Math.abs(zNetRF) * 13);
    if (rfWindowsAgree) rfScore += 22;
    else if (zRF50 > 0 === zRF200 > 0 || zRF200 > 0 === zRF500 > 0) rfScore += 10;
    rfScore += Math.min(18, rfStreak * 5);
    if (rfDir === 'RISE') {
        if (aboveEma8) rfScore += 5;
        if (aboveEma20) rfScore += 5;
        if (rsiOS) rfScore += 10;
        else if (rsi14v !== null && rsi14v > 55) rfScore += 4;
        if (cBias === 'bull') rfScore += 8;
    } else {
        if (!aboveEma8) rfScore += 5;
        if (!aboveEma20) rfScore += 5;
        if (rsiOB) rfScore += 10;
        else if (rsi14v !== null && rsi14v < 45) rfScore += 4;
        if (cBias === 'bear') rfScore += 8;
    }
    if (stable) rfScore += 8;
    rfScore = Math.round(Math.min(100, rfScore * volPenalty));
    const rfRuns =
        rfScore >= 90
            ? 7
            : rfScore >= 80
              ? 6
              : rfScore >= 68
                ? 5
                : rfScore >= 54
                  ? 4
                  : rfScore >= 40
                    ? 3
                    : rfScore >= 26
                      ? 2
                      : rfScore >= 15
                        ? 1
                        : 0;

    // ══════════════════════════════════════════════════════════════
    // ── EVEN / ODD — Chi-square + Z-score multi-window ──
    // ══════════════════════════════════════════════════════════════
    function eoCountW(wn: number) {
        const sSlice = fullHistory.slice(-Math.min(wn, n));
        const eC = sSlice.filter(t => t.digit % 2 === 0).length;
        return { even: eC, odd: sSlice.length - eC, total: sSlice.length };
    }
    const eo50c = eoCountW(50),
        eo200c = eoCountW(200),
        eo1kc = eoCountW(1000);
    const zEO50 = iframeZScore(eo50c.even, eo50c.total, 0.5);
    const zEO200 = iframeZScore(eo200c.even, eo200c.total, 0.5);
    const zEO1k = iframeZScore(eo1kc.even, eo1kc.total, 0.5);
    const zNetEO = (zEO50 + zEO200 + zEO1k) / 3;
    const chi2EO1k = iframeChi2(eo1kc.even, eo1kc.odd);
    const eoWindowsAgree = zEO50 > 0 === zEO200 > 0 && zEO200 > 0 === zEO1k > 0;
    const eoDirRaw = zNetEO >= 0 ? 'EVEN' : 'ODD';
    const eoDir = iframeHysteresis(hysteresisState, 'eo', eoDirRaw) as 'EVEN' | 'ODD';
    const eoStrk = eoDir === 'EVEN' ? evenStreak : oddStreak;

    const evenSum = evenD.reduce((a, d) => a + p1000[d].pct, 0);
    const oddSum = oddD.reduce((a, d) => a + p1000[d].pct, 0);
    const evenSum50 = evenD.reduce((a, d) => a + p50[d].pct, 0);
    const oddSum50 = oddD.reduce((a, d) => a + p50[d].pct, 0);

    let eoScore = 0;
    eoScore += Math.min(28, chi2EO1k * 14);
    eoScore += Math.min(24, Math.abs(zNetEO) * 11);
    if (eoWindowsAgree) eoScore += 18;
    eoScore += Math.min(12, eoStrk * 4);
    if (eoDir === 'EVEN' && evenSum50 > oddSum50 && evenSum > oddSum) eoScore += 8;
    if (eoDir === 'ODD' && oddSum50 > evenSum50 && oddSum > evenSum) eoScore += 8;
    if (stable) eoScore += 10;
    eoScore = Math.round(Math.min(100, eoScore));
    const eoRuns =
        eoScore >= 90
            ? 7
            : eoScore >= 80
              ? 6
              : eoScore >= 68
                ? 5
                : eoScore >= 54
                  ? 4
                  : eoScore >= 40
                    ? 3
                    : eoScore >= 26
                      ? 2
                      : eoScore >= 15
                        ? 1
                        : 0;

    // ══════════════════════════════════════════════════════════════
    // ── OVER / UNDER — Optimal barrier via max-|Z| ──
    // ══════════════════════════════════════════════════════════════
    let bestBarrier = 4,
        bestAbsZ = 0;
    for (let b = 1; b <= 8; b++) {
        const pExp = (9 - b) / 10;
        const ov1k = fullHistory.slice(-Math.min(n, 1000)).filter(t => t.digit > b).length;
        const tot1k = Math.min(n, 1000);
        if (ov1k < 10 || tot1k - ov1k < 10) continue;
        const absZ = Math.abs(iframeZScore(ov1k, tot1k, pExp));
        if (absZ > bestAbsZ) {
            bestAbsZ = absZ;
            bestBarrier = b;
        }
    }
    const pExpOU = (9 - bestBarrier) / 10;
    const ov50b = fullHistory.slice(-50).filter(t => t.digit > bestBarrier).length;
    const ov200b = fullHistory.slice(-200).filter(t => t.digit > bestBarrier).length;
    const ov1kb = fullHistory.slice(-Math.min(n, 1000)).filter(t => t.digit > bestBarrier).length;
    const zOU50 = iframeZScore(ov50b, 50, pExpOU);
    const zOU200 = iframeZScore(ov200b, Math.min(n, 200), pExpOU);
    const zOU1k = iframeZScore(ov1kb, Math.min(n, 1000), pExpOU);
    const zNetOU = (zOU50 + zOU200 + zOU1k) / 3;
    const ouWindowsAgree = zOU50 > 0 === zOU200 > 0 && zOU200 > 0 === zOU1k > 0;
    const ouDirRaw = zNetOU >= 0 ? 'OVER' : 'UNDER';
    const ouDir = iframeHysteresis(hysteresisState, 'ou', ouDirRaw) as 'OVER' | 'UNDER';
    const oSum1000 = [5, 6, 7, 8, 9].reduce((a, d) => a + p1000[d].pct, 0);
    const uSum1000 = [0, 1, 2, 3, 4].reduce((a, d) => a + p1000[d].pct, 0);
    const ouGap1000 = Math.abs(oSum1000 - uSum1000);

    let ouScore = 0;
    ouScore += Math.min(34, Math.abs(zNetOU) * 15);
    if (ouWindowsAgree) ouScore += 26;
    ouScore += Math.min(14, ouGap1000 * 2.8);
    if (stable) ouScore += 10;
    ouScore = Math.round(Math.min(100, ouScore * volPenalty));
    const ouRuns =
        ouScore >= 90
            ? 7
            : ouScore >= 80
              ? 6
              : ouScore >= 68
                ? 5
                : ouScore >= 54
                  ? 4
                  : ouScore >= 40
                    ? 3
                    : ouScore >= 26
                      ? 2
                      : ouScore >= 15
                        ? 1
                        : 0;

    // ── DIFFERS — Poisson deficit + Z-score ──
    const coldest = overdue.slice().sort((a, b) => b.deficit - a.deficit)[0];
    const zDiff = iframeZScore(coldest.count, n, 0.1);
    let diffScore = 0;
    diffScore += Math.min(38, Math.max(0, -zDiff) * 16);
    diffScore += Math.min(26, coldest.deficit * 0.52);
    if (driftOf(fullHistory, coldest.digit) < -0.5) diffScore += 20;
    if (stable) diffScore += 12;
    const curDig = fullHistory.length ? fullHistory[fullHistory.length - 1].digit : 0;
    if (curDig === coldest.digit) diffScore = Math.round(diffScore * 0.75);
    diffScore = Math.round(Math.min(100, diffScore));
    const diffRuns =
        diffScore >= 90
            ? 7
            : diffScore >= 80
              ? 6
              : diffScore >= 68
                ? 5
                : diffScore >= 54
                  ? 4
                  : diffScore >= 40
                    ? 3
                    : diffScore >= 26
                      ? 2
                      : diffScore >= 15
                        ? 1
                        : 0;

    // ── MATCHES — Z-score + drift ──
    const hottest = p1000.slice().sort((a, b) => b.pct - a.pct)[0];
    const zMatch = iframeZScore(hottest.count, n, 0.1);
    let matchScore = 0;
    matchScore += Math.min(38, Math.max(0, zMatch) * 16);
    if (driftOf(fullHistory, hottest.digit) > 0.5) matchScore += 28;
    if (stable) matchScore += 12;
    matchScore += Math.min(16, (hottest.pct - 10) * 2.8);
    matchScore = Math.round(Math.min(100, matchScore));
    const matchRuns =
        matchScore >= 90
            ? 7
            : matchScore >= 80
              ? 6
              : matchScore >= 68
                ? 5
                : matchScore >= 54
                  ? 4
                  : matchScore >= 40
                    ? 3
                    : matchScore >= 26
                      ? 2
                      : matchScore >= 15
                        ? 1
                        : 0;

    return {
        rf: { dir: rfDir, score: rfScore, runs: rfRuns, streak: rfStreak },
        eo: { dir: eoDir, score: eoScore, runs: eoRuns, streak: eoStrk },
        ou: { dir: ouDir, score: ouScore, runs: ouRuns, gap: ouGap1000.toFixed(1) },
        diff: { digit: coldest.digit, score: diffScore, runs: diffRuns, pct: coldest.pct.toFixed(2) },
        mtch: { digit: hottest.digit, score: matchScore, runs: matchRuns, pct: hottest.pct.toFixed(2) },
        entropy: ent,
        stable,
        vol: vol.toFixed(3),
    };
}
