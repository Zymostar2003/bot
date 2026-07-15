import { curStreak, rsiCalc } from '@/utils/signal-engine/pro-signal';
import { TCandle, TFullHistoryTick } from '@/utils/signal-engine/types';
import { calcVol, kellySafe, TVolResult } from './calc';

export type TRiskSeverity = 'high' | 'med' | 'low';

export type TRiskWarning = {
    txt: string;
    sev: TRiskSeverity;
};

export type TRiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type TRiskAnalysis = {
    score: number;
    level: TRiskLevel;
    safe: boolean;
    warnings: TRiskWarning[];
    vol: TVolResult;
    rsi14: number | null;
    streak: { type: 'RISE' | 'FALL' | 'N/A'; len: number };
    n: number;
    kelly: number;
};

// Faithful port of build_risk's scoring logic (reference/index-335-black-bars.html, lines
// 9290-9337) — the risk score/warnings/Kelly sizing computation, kept separate from
// build_risk's own HTML string assembly (ported instead as risk-panel.tsx's JSX).
export function buildRiskAnalysis(fullHistory: TFullHistoryTick[], candleHistory: TCandle[]): TRiskAnalysis {
    const vol = calcVol(fullHistory);
    const prices = fullHistory.map(t => t.price);
    const rsi14 = rsiCalc(prices, 14);
    const streak = curStreak(fullHistory, candleHistory);
    const n = fullHistory.length;

    let score = 0;
    const warnings: TRiskWarning[] = [];

    if (vol.std > 0.5) {
        score += 30;
        warnings.push({ txt: 'Price jumping a lot — reduce your risk amount', sev: 'high' });
    } else if (vol.std > 0.2) {
        score += 15;
        warnings.push({ txt: 'Price has moderate movement — trade carefully', sev: 'med' });
    }

    if (streak.len >= 6) {
        score += 30;
        warnings.push({
            txt: `${streak.type} has run ${streak.len} times in a row — a change is very likely`,
            sev: 'high',
        });
    } else if (streak.len >= 3) {
        score += 12;
        warnings.push({ txt: `Streak of ${streak.len} active — be cautious`, sev: 'med' });
    }

    if (rsi14 !== null && (rsi14 > 80 || rsi14 < 20)) {
        score += 25;
        warnings.push({
            txt: `Strength meter at extreme (${rsi14.toFixed(0)}/100) — ${rsi14 > 80 ? 'overbought' : 'oversold'}`,
            sev: 'high',
        });
    } else if (rsi14 !== null && (rsi14 > 70 || rsi14 < 30)) {
        score += 12;
        warnings.push({ txt: `Strength meter near extreme (${rsi14.toFixed(0)}/100)`, sev: 'med' });
    }

    if (n < 100) {
        score += 15;
        warnings.push({ txt: 'Not enough ticks yet — analysis less reliable', sev: 'med' });
    }

    if (warnings.length === 0) {
        warnings.push({ txt: 'No major risk factors — conditions look calm', sev: 'low' });
    }

    score = Math.min(score, 95);
    const level: TRiskLevel = score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
    const safe = score < 55;
    const winP = safe ? 0.63 : 0.53;
    const kelly = kellySafe(winP);

    return { score, level, safe, warnings, vol, rsi14, streak, n, kelly };
}
