import { TCrossoverResult, TCrossSignal, TGravitonPoint, TPulsePoint } from './types';

// Faithful port of _checkGravitonPulseCross's detection logic (reference:
// reference/index-335-black-bars.html, lines 5965-5994).
//
// Structural change from the reference: this is a pure function — it takes the previous
// latch value and returns the new fire-signal + latch instead of mutating a global
// (_lastCrossSignal) and calling _fireGravitonPulseSignal (chart marker / beep / log)
// inline. The caller is responsible for firing those side effects when `signal` is
// non-null (SignalEngineStore does this in a reaction).
export function checkGravitonPulseCross(
    gravitonData: TGravitonPoint[] | null,
    pulseData: TPulsePoint[] | null,
    lastSignal: TCrossSignal
): TCrossoverResult {
    if (!gravitonData || !pulseData) return { signal: null, lastSignal };
    const n = Math.min(gravitonData.length, pulseData.length);
    if (n < 3) return { signal: null, lastSignal };

    // Align by index from the end (both arrays are same-length candle-aligned)
    const gi = gravitonData.length - 1,
        pi = pulseData.length - 1;
    const gNow = gravitonData[gi].value,
        gPrev = gravitonData[gi - 1].value;
    const pNow = pulseData[pi].value,
        pPrev = pulseData[pi - 1].value;
    const atr = pulseData[pi].atr || 1e-9;
    const thresh = atr * 0.1; // separation must exceed 10% ATR to confirm

    const diffNow = pNow - gNow;
    const diffPrev = pPrev - gPrev;

    let rawSignal: TCrossSignal = null;
    // Bullish: Pulse was below/at Graviton, now crosses above by > threshold
    if (diffPrev <= 0 && diffNow > thresh) rawSignal = 'BUY';
    // Bearish: Pulse was above/at Graviton, now crosses below by > threshold
    if (diffPrev >= 0 && diffNow < -thresh) rawSignal = 'SELL';

    let newLastSignal = lastSignal;
    let fireSignal: TCrossSignal = null;
    if (rawSignal && rawSignal !== lastSignal) {
        newLastSignal = rawSignal;
        fireSignal = rawSignal;
    } else if (!rawSignal) {
        // Reset latch only when the lines re-tangle (small separation) so the
        // same cross doesn't re-fire, but a fresh opposite cross can.
        if (Math.abs(diffNow) < thresh) newLastSignal = null;
    }

    return { signal: fireSignal, lastSignal: newLastSignal };
}
