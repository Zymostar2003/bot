import { TCandle, TGravitonPoint } from './types';

// Faithful port of calcGraviton (reference: reference/index-335-black-bars.html, lines 5738-5838).
// GRAVITON BAND — Gravitational Equilibrium Adaptive Mean (GEAM). Four layers: a
// fractal-adaptive period (Higuchi Fractal Dimension), a smooth gravitational damping
// kernel, DEMA-style double smoothing, and a rolling residual-sigma envelope. See the
// reference's lines 5704-5737 for the full algorithm description.
export function calcGraviton(candles: TCandle[]): TGravitonPoint[] {
    if (!candles || candles.length < 40) return [];
    const len = candles.length;
    const H = new Float64Array(len);
    const L = new Float64Array(len);
    const C = new Float64Array(len);
    for (let i = 0; i < len; i++) {
        H[i] = +candles[i].high;
        L[i] = +candles[i].low;
        C[i] = +candles[i].close;
    }

    // ── ATR (Wilder) for distance normalization ──
    const N_ATR = 14;
    const tr = new Float64Array(len);
    const atr = new Float64Array(len);
    let s = 0;
    let i: number;
    for (i = 0; i < len; i++) {
        const pc = i > 0 ? C[i - 1] : C[i];
        tr[i] = Math.max(H[i] - L[i], Math.abs(H[i] - pc), Math.abs(L[i] - pc));
    }
    for (i = 0; i < N_ATR; i++) s += tr[i];
    atr[N_ATR - 1] = s / N_ATR;
    for (i = N_ATR; i < len; i++) atr[i] = (atr[i - 1] * (N_ATR - 1) + tr[i]) / N_ATR;
    for (i = 0; i < N_ATR - 1; i++) atr[i] = atr[N_ATR - 1];

    // ── LAYER 1: Higuchi Fractal Dimension over a rolling window ──
    // HFD measures curve roughness. Computed on a 30-bar window, k=1..4.
    function higuchiFD(arr: Float64Array, start: number, win: number): number {
        const kmax = 4;
        const Lk: [number, number][] = [];
        for (let k = 1; k <= kmax; k++) {
            let Lm = 0;
            let count = 0;
            for (let m = 0; m < k; m++) {
                let sum = 0;
                let n = 0;
                for (let idx = m + k; idx < win; idx += k) {
                    sum += Math.abs(arr[start + idx] - arr[start + idx - k]);
                    n++;
                }
                if (n > 0) {
                    const norm = (win - 1) / (n * k);
                    Lm += (sum * norm) / k;
                    count++;
                }
            }
            if (count > 0) Lk.push([Math.log(1 / k), Math.log(Lm / count)]);
        }
        // slope of log-log = fractal dimension
        if (Lk.length < 2) return 1.5;
        const n = Lk.length;
        let sx = 0,
            sy = 0,
            sxy = 0,
            sxx = 0;
        for (let q = 0; q < n; q++) {
            sx += Lk[q][0];
            sy += Lk[q][1];
            sxy += Lk[q][0] * Lk[q][1];
            sxx += Lk[q][0] * Lk[q][0];
        }
        const denom = n * sxx - sx * sx;
        const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 1.5;
        return Math.max(1, Math.min(2, slope));
    }

    // ── Build the Graviton equilibrium line ──
    const N_MIN = 2.0,
        N_MAX = 34.0; // period bounds
    const FDWIN = 30; // fractal window
    const G = new Float64Array(len);
    const resid = new Float64Array(len);
    // seed with SMA of first 10 typical prices
    let seed = 0;
    for (i = 0; i < 10; i++) seed += (H[i] + L[i] + C[i]) / 3;
    G[0] = seed / 10;
    for (i = 1; i < len; i++) {
        const tp = (H[i] + L[i] + C[i]) / 3; // typical price
        // Layer 1: fractal-adaptive period
        let fd = 1.5;
        if (i >= FDWIN) fd = higuchiFD(C, i - FDWIN, FDWIN);
        const Neff = N_MIN + (N_MAX - N_MIN) * (fd - 1); // [N_MIN..N_MAX]
        const alphaBase = 2 / (Neff + 1); // EMA-equivalent base α
        // ── Layer 2: SMOOTH GRAVITATIONAL KERNEL (continuous, no shelves) ──
        //   g(d) = (1 + β·d²) / (1 + κ·d²)
        const a = atr[i] || 1e-9;
        const d = Math.abs(tp - G[i - 1]) / a; // normalized distance
        const KAP = 1.6,
            BETA = 0.9; // κ damping, β floor term
        const g = (1 + BETA * d * d) / (1 + KAP * d * d);
        const alpha = Math.min(0.9, alphaBase * g * 1.8); // scale + safety cap
        G[i] = G[i - 1] + alpha * (tp - G[i - 1]);
        resid[i] = C[i] - G[i];
    }

    // ── Layer 2b: light double-smoothing (DEMA-style) for fluid motion ──
    const Gs = new Float64Array(len),
        Gd = new Float64Array(len);
    const ks = 0.3;
    Gs[0] = G[0];
    Gd[0] = G[0];
    for (i = 1; i < len; i++) {
        Gs[i] = Gs[i - 1] + ks * (G[i] - Gs[i - 1]); // smooth the raw graviton
        Gd[i] = Gd[i - 1] + ks * (Gs[i] - Gd[i - 1]); // second pass
    }
    // DEMA reconstruction keeps responsiveness while killing the steps
    for (i = 0; i < len; i++) {
        G[i] = 2 * Gs[i] - Gd[i];
        resid[i] = C[i] - G[i];
    }

    // ── Layer 3/4: rolling residual std for the envelope + break gate ──
    const SIGWIN = 20;
    const out: TGravitonPoint[] = [];
    for (i = 0; i < len; i++) {
        let sig = 0;
        if (i >= SIGWIN) {
            let mean = 0;
            for (let w = i - SIGWIN + 1; w <= i; w++) mean += resid[w];
            mean /= SIGWIN;
            let v = 0;
            for (let w = i - SIGWIN + 1; w <= i; w++) {
                const dd = resid[w] - mean;
                v += dd * dd;
            }
            sig = Math.sqrt(v / SIGWIN);
        }
        out.push({ time: candles[i].epoch, value: G[i], sigma: sig, atr: atr[i] });
    }
    return out;
}
