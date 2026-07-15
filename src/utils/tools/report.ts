import { consecDir, consecEO, curStreak, dPcts, rsiCalc, shannonEnt } from '@/utils/signal-engine/pro-signal';
import { TCandle, TDigitPct, TFullHistoryTick } from '@/utils/signal-engine/types';
import { barStatus, calcVol, cursor, isStable, kellySafe, TVolLevel } from './calc';

export type TReportSnapshot = {
    rfSig: 'RISE' | 'FALL';
    eoSig: 'EVEN' | 'ODD' | 'NEUTRAL';
    ouSig: 'OVER' | 'UNDER';
    volLevel: TVolLevel;
    consDir: { rise: number; fall: number };
    consEvenStreak: number;
    consOddStreak: number;
    cur: number;
    curPct: number;
    curStable: boolean;
    hottestDigit: number;
    hottestPct: number;
    diffTarget: TDigitPct | null;
    streak: { type: 'RISE' | 'FALL' | 'N/A'; len: number };
    predictable: boolean;
    kelly: number;
    rsi14: number | null;
    n: number;
    // Best-setup / avoid-right-now text is left as plain strings (not run through Localize)
    // — same precedent as utils/scanner/ai-analysis.ts: these are too dynamically composed
    // (nested ternaries selecting between entirely different sentences) to cleanly localize,
    // so they're kept as faithful ports of the reference's own template-string assembly.
    bestSetupText: string;
    avoidText: string;
};

// Faithful port of build_report's snapshot computation (reference/index-335-black-bars.html,
// lines 9382-9467) — kept separate from build_report's own HTML string assembly (ported
// instead as report-panel.tsx's JSX).
export function buildReportSnapshot(fullHistory: TFullHistoryTick[], candleHistory: TCandle[]): TReportSnapshot {
    const p1000 = dPcts(fullHistory, 1000);
    const prices = fullHistory.map(t => t.price);
    const rsi14 = rsiCalc(prices, 14);
    const vol = calcVol(fullHistory);
    const streak = curStreak(fullHistory, candleHistory);
    const cur = cursor(fullHistory);
    const consDir = consecDir(fullHistory, candleHistory);
    const consEO = consecEO(fullHistory);
    const rises50 = fullHistory.slice(-50).filter(t => t.diff >= 0).length;
    const sorted = [...p1000].sort((a, b) => b.pct - a.pct);
    const bars = barStatus(fullHistory);
    const evenD = [0, 2, 4, 6, 8];
    const oddD = [1, 3, 5, 7, 9];
    const evenAbove10 = evenD.filter(d => p1000[d].pct >= 10).length;
    const oddAbove10 = oddD.filter(d => p1000[d].pct >= 10).length;
    const oSum = [5, 6, 7, 8, 9].reduce((a, d) => a + p1000[d].pct, 0);
    const uSum = [0, 1, 2, 3, 4].reduce((a, d) => a + p1000[d].pct, 0);
    const chaos = shannonEnt(fullHistory);
    const kelly = kellySafe(0.6);
    const n = fullHistory.length;

    const rfSig: 'RISE' | 'FALL' =
        consDir.rise >= 3 ? 'RISE' : consDir.fall >= 3 ? 'FALL' : rises50 > 27 ? 'RISE' : 'FALL';
    const eoSig: 'EVEN' | 'ODD' | 'NEUTRAL' =
        evenAbove10 >= 3 && !oddD.some(d => p1000[d].pct >= 9.7)
            ? 'EVEN'
            : oddAbove10 >= 3 && !evenD.some(d => p1000[d].pct >= 9.7)
              ? 'ODD'
              : 'NEUTRAL';
    const ouSig: 'OVER' | 'UNDER' = oSum > uSum ? 'OVER' : 'UNDER';
    const diffTarget = p1000.filter(s => s.pct < 9 && bars[s.digit] === 'normal').sort((a, b) => a.pct - b.pct)[0];
    const predictable = chaos < 0.93;

    const bestSetupText =
        consDir.rise >= 3 || consDir.fall >= 3
            ? `3-Candle ${rfSig} — enter on next tick`
            : eoSig !== 'NEUTRAL' && (consEO.even >= 3 || consEO.odd >= 3)
              ? `Even/Odd ${eoSig} — 3 in a row`
              : diffTarget
                ? `Differs on Digit ${diffTarget.digit} — ${diffTarget.pct.toFixed(2)}%`
                : `Watch for setup — no clear trigger yet`;

    const avoidText =
        streak.len >= 5
            ? `${streak.type} streak at ${streak.len} — wait for a break before entering`
            : vol.level === 'HIGH'
              ? 'Price is very jumpy — wait for it to calm down before risking real money'
              : !predictable
                ? 'Market is very random — no strong patterns visible yet. Wait for better setup.'
                : 'No major red flags. Follow your strategy rules and be patient.';

    return {
        rfSig,
        eoSig,
        ouSig,
        volLevel: vol.level,
        consDir,
        consEvenStreak: consEO.even,
        consOddStreak: consEO.odd,
        cur,
        curPct: p1000[cur].pct,
        curStable: isStable(fullHistory, cur),
        hottestDigit: sorted[0].digit,
        hottestPct: sorted[0].pct,
        diffTarget: diffTarget ?? null,
        streak,
        predictable,
        kelly,
        rsi14,
        n,
        bestSetupText,
        avoidText,
    };
}
