import { TCandle, TPulsePoint } from './types';

// Faithful port of calcPulse (reference: reference/index-335-black-bars.html, lines 5886-5948).
// PULSE LINE — Hilbert Momentum Trendline (HMT). Zero-lag EMA (ZLEMA), a Hilbert-style
// momentum slope, and a bounded velocity projection clamped to +-0.5 ATR. See the
// reference's lines 5854-5885 for the full algorithm description.
export function calcPulse(candles: TCandle[]): TPulsePoint[] {
    if (!candles || candles.length < 40) return [];
    const len = candles.length;
    const P = new Float64Array(len);
    for (let i = 0; i < len; i++) {
        P[i] = (+candles[i].high + +candles[i].low) / 2; // median price
    }

    // ── ATR for cross-confirmation threshold ──
    const atr = new Float64Array(len);
    let i: number, tr: number, pc: number;
    for (i = 0; i < len; i++) {
        pc = i > 0 ? +candles[i - 1].close : +candles[i].close;
        tr = Math.max(
            +candles[i].high - +candles[i].low,
            Math.abs(+candles[i].high - pc),
            Math.abs(+candles[i].low - pc)
        );
        atr[i] = i > 0 ? (atr[i - 1] * 13 + tr) / 14 : tr;
    }

    // ── LAYER 1: Zero-lag EMA (Ehlers/Mulloy ZLEMA) ──
    const PERIOD = 25;
    const lag = Math.floor((PERIOD - 1) / 2);
    const k = 2 / (PERIOD + 1);
    const zlRaw = new Float64Array(len);
    zlRaw[0] = P[0];
    for (i = 1; i < len; i++) {
        // de-lagged input: price plus its own recent momentum
        const ip = i >= lag ? 2 * P[i] - P[i - lag] : P[i];
        zlRaw[i] = zlRaw[i - 1] + k * (ip - zlRaw[i - 1]); // EMA of the de-lagged series
    }
    // Second smoothing pass — a short EMA over the ZLEMA
    const zl = new Float64Array(len);
    const k2 = 2 / (8 + 1);
    zl[0] = zlRaw[0];
    for (i = 1; i < len; i++) {
        zl[i] = zl[i - 1] + k2 * (zlRaw[i] - zl[i - 1]);
    }

    // ── LAYER 2: Hilbert-style momentum slope (signal-processing velocity) ──
    const slope = new Float64Array(len),
        sEMA = new Float64Array(len);
    const ks = 2 / (5 + 1);
    sEMA[0] = 0;
    for (i = 1; i < len; i++) {
        slope[i] = zl[i] - zl[i - 1];
        sEMA[i] = sEMA[i - 1] + ks * (slope[i] - sEMA[i - 1]);
    }

    // ── LAYER 3: bounded velocity projection ──
    const out: TPulsePoint[] = [];
    for (i = 0; i < len; i++) {
        const a = atr[i] || 1e-9;
        let lead = sEMA[i] * 1.0;
        // clamp the projection to +-0.5 ATR
        if (lead > 0.5 * a) lead = 0.5 * a;
        if (lead < -0.5 * a) lead = -0.5 * a;
        const val = zl[i] + lead;
        out.push({ time: candles[i].epoch, value: val, atr: a });
    }
    return out;
}
