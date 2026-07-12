import { TCandle, TIndicatorBias, TVfpiResult } from './types';

// Faithful port of calcVFPI (reference: reference/index-335-black-bars.html, lines 6041-6336).
// STGAMA-VFPI ENGINE v2.0 — Synthetic Tick Geometry Adaptive MA. Higuchi Fractal
// Dimension, Synthetic Tick Momentum Signature, and Bar Profile Skewness layered on top
// of a dual fractal-adaptive MA crossover. See the reference's lines 6021-6040 for the
// full algorithm description.
//
// Structural change from the reference: `sigConf` is passed explicitly instead of being
// read from the global IND_SETTINGS.vfpi_sig_conf (reference line 6297).
//
// One line of the reference is deliberately omitted: an `erEma` (ER EMA for regime
// detection, reference lines 6236-6239) is computed but never read anywhere else in the
// function — it's dead code in the original. Omitting it changes no observable output.
export function calcVFPI(candles: TCandle[], sigConf: number): TVfpiResult[] {
    if (!candles || candles.length < 55) return [];

    const len = candles.length;
    const closes: number[] = [],
        highs: number[] = [],
        lows: number[] = [],
        opens: number[] = [];
    for (let ii = 0; ii < len; ii++) {
        closes.push(parseFloat(String(candles[ii].close)));
        highs.push(parseFloat(String(candles[ii].high)));
        lows.push(parseFloat(String(candles[ii].low)));
        opens.push(parseFloat(String(candles[ii].open)));
    }

    const N = 14; // ER lookback period (internal to VFPI engine)
    const fk = 2 / (2 + 1); // fast EMA constant
    const sk = 2 / (50 + 1); // slow EMA constant

    // ── ATR (Wilder smoothing) ──
    const tr = new Float64Array(len),
        atr = new Float64Array(len);
    let i: number, j: number, s: number;
    for (i = 0; i < len; i++) {
        const pc = i > 0 ? closes[i - 1] : closes[i];
        tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - pc), Math.abs(lows[i] - pc));
    }
    s = 0;
    for (i = 0; i < N; i++) s += tr[i];
    atr[N - 1] = s / N;
    for (i = N; i < len; i++) atr[i] = (atr[i - 1] * (N - 1) + tr[i]) / N;

    // ── Efficiency Ratio (ER) — raw then triple-smoothed ──
    const erRaw = new Float64Array(len);
    for (i = N; i < len; i++) {
        const direction = Math.abs(closes[i] - closes[i - N]);
        let noise = 0;
        for (j = i - N + 1; j <= i; j++) noise += Math.abs(closes[j] - closes[j - 1]);
        erRaw[i] = noise < 1e-12 ? 0 : direction / noise;
    }
    const er = erRaw; // keep alias for rest of function that reads er[]
    const erSmF = new Float64Array(len); // fast-smoothed ER (EMA 3)
    const erSmS = new Float64Array(len); // slow-smoothed ER (EMA 5 of erSmF)
    const kEF = 2.0 / 4.0,
        kES = 2.0 / 6.0;
    erSmF[N] = erRaw[N];
    erSmS[N] = erRaw[N];
    for (i = N + 1; i < len; i++) {
        erSmF[i] = erSmF[i - 1] + kEF * (erRaw[i] - erSmF[i - 1]);
        erSmS[i] = erSmS[i - 1] + kES * (erSmF[i] - erSmS[i - 1]);
    }

    // ── FAMA FAST — High-Reactivity Adaptive MA ──
    const SC_FAST_FLOOR = 2.0 / 9.0; // EMA(8) — snappy minimum, hugs price
    const famaFast = new Float64Array(len);
    famaFast[N] = closes[N];
    let ffCommit = 0;
    for (i = N + 1; i < len; i++) {
        if (erSmF[i] >= 0.38) ffCommit = Math.min(ffCommit + 1, 5);
        else ffCommit = Math.max(ffCommit - 1, 0);
        // commitScale: 1.0 when committed, 0.6 forming, 0.35 idle
        const commitScale = ffCommit >= 2 ? 1.0 : ffCommit === 1 ? 0.6 : 0.35;
        const erF = erSmF[i] * commitScale;
        const scRaw = Math.pow(erF * erF * (fk - sk) + sk, 2);
        const sc = Math.max(SC_FAST_FLOOR, scRaw);
        famaFast[i] = famaFast[i - 1] + sc * (closes[i] - famaFast[i - 1]);
    }

    // ── FAMA SLOW — Long-Lag Adaptive MA ──
    const SC_SLOW_FLOOR = 2.0 / 101.0; // EMA(100) — drifts slowly, wide gap from Fast
    const SC_SLOW_MAX = 2.0 / 18.0; // EMA(17) — even in trends stays clearly lagged
    const famaSlow = new Float64Array(len);
    famaSlow[N] = closes[N];
    for (i = N + 1; i < len; i++) {
        const erS = erSmS[i];
        // Soft damping: 20% of raw ER in noise, 55% in transition, full in strong trend
        const erSgated = erS < 0.22 ? erS * 0.2 : erS < 0.42 ? erS * 0.55 : erS;
        // ER^0.45 — highly sub-linear: penalises noise, rewards only committed trends
        const erSp = Math.pow(Math.max(0, erSgated), 0.45);
        const sc2Raw = Math.pow(erSp * (fk - sk) + sk, 2);
        // Clamp between EMA(100) floor and EMA(17) ceiling
        const sc2 = Math.max(SC_SLOW_FLOOR, Math.min(SC_SLOW_MAX, sc2Raw));
        famaSlow[i] = famaSlow[i - 1] + sc2 * (closes[i] - famaSlow[i - 1]);
    }

    // ── FAMA Velocity & Acceleration ──
    const famaVel = new Float64Array(len);
    const famaAcc = new Float64Array(len);
    for (i = N + 2; i < len; i++) {
        famaVel[i] = famaFast[i] - famaFast[i - 1];
        famaAcc[i] = famaVel[i] - famaVel[i - 1];
    }

    // ── Higuchi Fractal Dimension (HFD) ──
    const hfd = new Float64Array(len);
    for (i = N + 4; i < len; i++) {
        const hStart = i - N;
        const logk: number[] = [],
            logL: number[] = [];
        for (let k = 1; k <= 4; k++) {
            const m = Math.floor((N - 1) / k);
            if (m < 2) continue;
            let Lk = 0;
            for (let mi = 1; mi <= k; mi++) {
                let Lm = 0;
                for (let jj = 1; jj <= m; jj++) {
                    const i1 = hStart + mi + (jj - 1) * k;
                    const i0 = hStart + mi + (jj - 2) * k;
                    if (i1 < len && i0 >= 0) Lm += Math.abs(closes[i1] - closes[i0]);
                }
                Lk += (Lm * (N - 1)) / (k * k * m);
            }
            logk.push(Math.log(1 / k));
            logL.push(Math.log(Math.max(1e-12, Lk / k)));
        }
        if (logk.length < 2) {
            hfd[i] = 1.5;
            continue;
        }
        let sx = 0,
            sy = 0,
            sxy = 0,
            sxx = 0;
        const nn = logk.length;
        for (let p = 0; p < nn; p++) {
            sx += logk[p];
            sy += logL[p];
            sxy += logk[p] * logL[p];
            sxx += logk[p] * logk[p];
        }
        const denom = nn * sxx - sx * sx;
        hfd[i] = denom === 0 ? 1.5 : Math.max(1.0, Math.min(2.0, (nn * sxy - sx * sy) / denom));
    }

    // ── Synthetic Tick Momentum Signature (STMS) ──
    const stms = new Float64Array(len);
    for (i = 3; i < len; i++) {
        if (atr[i] < 1e-12) continue;
        const d0 = closes[i] > opens[i] ? 1 : -1;
        let ok = true,
            scoreS = 0;
        for (let b = i; b >= i - 3; b--) {
            const dB = closes[b] > opens[b] ? 1 : -1;
            if (dB !== d0) {
                ok = false;
                break;
            }
            const rng = highs[b] - lows[b];
            const bod = Math.abs(closes[b] - opens[b]);
            scoreS += rng > 0 ? bod / rng : 0.5;
        }
        stms[i] = ok ? (scoreS / 4) * d0 : 0;
    }

    // ── Bar Profile Skewness (BPS) — 5-bar rolling ──
    const bps = new Float64Array(len);
    for (i = 4; i < len; i++) {
        let bpsSum = 0,
            bpsW = 0;
        for (let bb = i; bb >= i - 4; bb--) {
            const btop = Math.max(closes[bb], opens[bb]);
            const bbot = Math.min(closes[bb], opens[bb]);
            const uw = highs[bb] - btop,
                lw = bbot - lows[bb],
                tw = uw + lw;
            const wt = 1.0 / (i - bb + 1);
            bpsSum += (tw > 1e-12 ? (uw - lw) / tw : 0) * wt;
            bpsW += wt;
        }
        bps[i] = bpsW > 0 ? bpsSum / bpsW : 0;
    }

    // ── ROC Divergence Layer ──
    const roc = new Float64Array(len),
        rocEma = new Float64Array(len);
    const roc_k = 2.0 / 6.0;
    for (i = 3; i < len; i++) roc[i] = closes[i] - closes[i - 3];
    rocEma[3] = roc[3];
    for (i = 4; i < len; i++) rocEma[i] = rocEma[i - 1] + roc_k * (roc[i] - rocEma[i - 1]);
    const divLayer = new Float64Array(len);
    for (i = N + 1; i < len; i++) {
        if (atr[i] < 1e-12) continue;
        divLayer[i] = (roc[i] - rocEma[i]) / atr[i];
    }

    // ── TAMP (Tick-Range Adaptive Momentum Pressure) ──
    const tamp = new Float64Array(len);
    for (i = N + 1; i < len; i++) {
        if (atr[i] < 1e-12) continue;
        tamp[i] = ((closes[i] - famaFast[i]) / atr[i]) * (0.5 + 0.5 * er[i]);
    }

    // ── VFPI Composite (5-layer) ──
    const vfpi = new Float64Array(len);
    const vfpiSmooth = new Float64Array(len);
    const sm_k = 2.0 / 4.0;
    for (i = N + 5; i < len; i++) {
        let raw = tamp[i] * 50 + divLayer[i] * 20;

        // HFD modifier: trending regime amplifies signal, noise dampens it
        const hfdF = hfd[i] > 0 ? Math.max(0.45, Math.min(1.55, (1.98 - hfd[i]) / 0.43)) : 1.0;
        raw *= hfdF;

        // STMS generator drift boost (signed — direction critical)
        if (Math.abs(stms[i]) > 0.38) raw += stms[i] * 22;

        // BPS wick-skewness layer (lower wick dominant = bullish push)
        raw += -bps[i] * 12;

        // FAMA acceleration bonus/penalty (trend gaining vs losing speed)
        if (atr[i] > 1e-12) {
            const normAcc = famaAcc[i] / atr[i];
            raw += Math.max(-14, Math.min(14, normAcc * 28));
        }

        vfpi[i] = Math.max(-150, Math.min(150, raw));
    }
    vfpiSmooth[N + 5] = vfpi[N + 5];
    for (i = N + 6; i < len; i++) vfpiSmooth[i] = vfpiSmooth[i - 1] + sm_k * (vfpi[i] - vfpiSmooth[i - 1]);

    // ── Confidence Score (0-100) ──
    const confidence = new Uint8Array(len);
    for (i = N + 5; i < len; i++) {
        const hfdBonus = hfd[i] > 0 && hfd[i] < 1.48 ? 18 : hfd[i] < 1.62 ? 9 : 0;
        const stmsBonus = Math.abs(stms[i]) > 0.62 ? 14 : Math.abs(stms[i]) > 0.4 ? 7 : 0;
        const bpsBonus = Math.abs(bps[i]) > 0.35 ? 8 : 0;
        const velBonus =
            famaVel[i] !== 0 && famaAcc[i] !== 0 && Math.sign(famaVel[i]) === Math.sign(famaAcc[i]) ? 10 : 0;
        const erScore = er[i] * 36;
        const tampScore = (Math.min(Math.abs(tamp[i]), 2) / 2) * 28;
        const divScore = Math.min(Math.abs(divLayer[i]), 1) * 10;
        confidence[i] = Math.round(
            Math.min(100, erScore + tampScore + divScore + hfdBonus + stmsBonus + bpsBonus + velBonus)
        );
    }

    // ── DUAL FAMA CROSSOVER SIGNAL (no-repaint: bar i-1 -> bar i) ──
    // Separation guard: after the cross, fast and slow must be apart by at least
    // 0.08 x ATR. Prior bar (i-2) must be on opposite side to confirm a real crossover.
    const SIG_CONF = typeof sigConf === 'number' ? sigConf : 52;
    const results: TVfpiResult[] = [];
    for (i = N + 7; i < len; i++) {
        if (!vfpi[i] && vfpi[i] !== 0) continue;
        const regime: TVfpiResult['regime'] = erSmF[i] > 0.3 ? 'trending' : 'ranging';
        const conf = confidence[i];
        const fastPrev2 = famaFast[i - 2],
            slowPrev2 = famaSlow[i - 2];
        const fastCur = famaFast[i],
            slowCur = famaSlow[i];
        const minSepV = atr[i] * 0.08;
        const bullCross = fastPrev2 < slowPrev2 && fastCur > slowCur && fastCur - slowCur >= minSepV;
        const bearCross = fastPrev2 > slowPrev2 && fastCur < slowCur && slowCur - fastCur >= minSepV;
        const isExhaust = Math.abs(vfpi[i]) > 85 && erSmF[i] < 0.16;

        let signal: TVfpiResult['signal'] = null;
        if (bullCross && conf >= SIG_CONF && vfpi[i] > 0) signal = 'buy';
        else if (bearCross && conf >= SIG_CONF && vfpi[i] < 0) signal = 'sell';
        else if (isExhaust) signal = 'exhaustion';

        results.push({
            time: candles[i].epoch,
            vfpi: vfpi[i],
            smooth: vfpiSmooth[i],
            fama: famaFast[i],
            famaSlow: famaSlow[i],
            confidence: conf,
            regime,
            er: er[i],
            hfd: hfd[i],
            stms: stms[i],
            bps: bps[i],
            famaVel: famaVel[i],
            famaAcc: famaAcc[i],
            bullCross,
            bearCross,
            signal,
        });
    }
    return results;
}

// Faithful port of getIndicatorBias (reference lines 6798-6802).
// Structural change: takes the latest VFPI value explicitly instead of reading the
// global _lastVfpiValue (which updateVFP() wrote as a side effect in the reference).
export function getIndicatorBias(lastVfpiValue: number): TIndicatorBias {
    if (lastVfpiValue > 15) return 'bull';
    if (lastVfpiValue < -15) return 'bear';
    return 'neutral';
}
