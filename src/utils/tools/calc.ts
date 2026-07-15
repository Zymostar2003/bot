import { dPcts } from '@/utils/signal-engine/pro-signal';
import { TFullHistoryTick } from '@/utils/signal-engine/types';

// Faithful ports of Tools' remaining standalone helpers (reference/index-335-black-bars.html,
// lines 8164-8337) not already covered by pro-signal.ts/scanner/helpers.ts — dPcts, rsiCalc,
// ema, curStreak, consecDir, consecEO, and shannonEnt (== chaosScore, already normalized by
// log2(10)) are reused from there instead of re-derived here.

// Faithful port of isStable (reference lines 8164-8168).
export function isStable(fullHistory: TFullHistoryTick[], d: number, windowA = 50, windowB = 20): boolean {
    const p1 = dPcts(fullHistory, windowA)[d].pct;
    const p2 = dPcts(fullHistory, windowB)[d].pct;
    return Math.abs(p1 - p2) < 0.5;
}

// Faithful port of barStatus (reference lines 8176-8184) — ranks digits by 1000-tick
// frequency: top-2 are "green-bar" (hot), bottom-1 is "red-bar" (cold).
export type TBarStatus = 'normal' | 'green-bar' | 'red-bar';

export function barStatus(fullHistory: TFullHistoryTick[]): TBarStatus[] {
    const s = dPcts(fullHistory, 1000);
    const sorted = [...s].sort((a, b) => b.pct - a.pct);
    const status: TBarStatus[] = Array(10).fill('normal');
    status[sorted[0].digit] = 'green-bar';
    status[sorted[1].digit] = 'green-bar';
    status[sorted[9].digit] = 'red-bar';
    return status;
}

// Faithful port of cursor (reference lines 8187-8189).
export function cursor(fullHistory: TFullHistoryTick[]): number {
    return fullHistory.length ? fullHistory[fullHistory.length - 1].digit : 0;
}

// Faithful port of calcVol (reference lines 8249-8255) — average absolute tick movement
// (atr) and its standard deviation over the last 100 ticks, bucketed into a HIGH/MEDIUM/LOW
// volatility level.
export type TVolLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type TVolResult = {
    atr: number;
    std: number;
    level: TVolLevel;
};

export function calcVol(fullHistory: TFullHistoryTick[]): TVolResult {
    const d = fullHistory.slice(-100).map(t => Math.abs(t.diff));
    const n = d.length || 1;
    const atr = d.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(d.reduce((a, b) => a + (b - atr) ** 2, 0) / n);
    const level: TVolLevel = std > 0.5 ? 'HIGH' : std > 0.2 ? 'MEDIUM' : 'LOW';
    return { atr, std, level };
}

// Faithful port of kellySafe (reference lines 8258-8262) — a capped-at-20% fractional Kelly
// stake-sizing suggestion (b=0.95 fixed payout assumption, matching the reference exactly).
export function kellySafe(winP: number): number {
    const q = 1 - winP;
    const b = 0.95;
    return Math.max(0, Math.min((b * winP - q) / b, 0.2)) * 100;
}

// Faithful port of suppRes (reference lines 8265-8268).
export type TSuppRes = { support: number; resistance: number };

export function suppRes(fullHistory: TFullHistoryTick[]): TSuppRes {
    const w = fullHistory.slice(-50).map(t => t.price);
    if (!w.length) return { support: 0, resistance: 0 };
    return { support: Math.min(...w), resistance: Math.max(...w) };
}

// Faithful port of _kcRender's stake/TP/SL calculation (reference lines 14938-14947) — the
// "Calc" tab's keypad-driven risk calculator. Martingale is always a fixed suggestion of ×2
// in the reference (never computed from balance), kept as-is here.
export const CALC_MIN_STAKE = 0.35;

export type TCalcResult = {
    stake: number;
    martingale: number;
    takeProfit: number;
    stopLoss: number;
};

export function calcFromBalance(balance: number): TCalcResult {
    const stake = Math.max(balance * 0.02, CALC_MIN_STAKE);
    return {
        stake,
        martingale: 2,
        takeProfit: balance * 0.1,
        stopLoss: balance * 0.3,
    };
}
