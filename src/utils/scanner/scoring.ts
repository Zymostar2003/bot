import { dPcts, ema, iframeZScore, rsiCalc } from '@/utils/signal-engine/pro-signal';
import { TFullHistoryTick } from '@/utils/signal-engine/types';
import { SCANNER_FILTER_DEFAULTS } from './constants';
import {
    agreementGate,
    atr,
    autocorr1,
    biasConsistency,
    breakout,
    chi2Uniform,
    clusterCompression,
    dCounts,
    dsClusterStrength,
    dsDirBias,
    dsLastDigits,
    dsRegime,
    dsSpread,
    runsTest,
    significanceGate,
    volatility,
} from './helpers';
import { TContractType, TScannerFilterFlags, TScanQuality, TScoreResult } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// MASTER SCORER — combines all methods per contract type.
// Faithful port of _scoreCombo (reference/index-335-black-bars.html, lines 18999-20190).
// Built on top of dbot's already-ported primitives (dPcts/ema/rsiCalc/iframeZScore from
// src/utils/signal-engine/pro-signal.ts — reused directly, see the "genuinely new" note
// in helpers.ts for what's freshly ported here vs reused).
//
// The reference's own % Difference mode (_scorePctDiff, window._DS.pctDiffMode) is an
// alternate scorer deferred out of v1 scope (see task notes) — not ported; pctDiffMode is
// always false so that branch never runs.
// ═══════════════════════════════════════════════════════════════════════════
export function scoreCombo(hist: TFullHistoryTick[], ct: TContractType): TScoreResult {
    const n = hist.length;
    if (n < 100) return { score: 0, dir: '—', reasons: ['Need more ticks'], quality: 'REJECT' };

    const prices = hist.map(t => t.price);
    const vol = volatility(hist);
    const volP = vol > 0.5 ? 0.75 : vol > 0.2 ? 0.9 : 1.0;
    const dc1k = dCounts(hist, 1000);
    const p1000 = dPcts(hist, 1000);
    const chi1k = chi2Uniform(dc1k.counts, dc1k.total);

    const reasons: string[] = [];
    let score = 0;
    let dir = '—';
    let quality: TScanQuality = 'REJECT';

    // ══════════════════════════════════════════════════════════════
    // EVEN / ODD — Document Part 4.1
    // True probability = 0.5. House edge ~5%. Break-even = 53%.
    // Reference lines 19032-19356.
    //
    // NOTE ON THE REFERENCE'S OWN STRUCTURE: the reference function body for this branch
    // is actually two near-identical scoring passes pasted back-to-back (a "SPEC Bug#1/#2"
    // patch layered on top of the original z-score gate, without removing the original —
    // visible from its own comments at reference lines 19189/19215/19449). Both passes read
    // the exact same hist/tParity inputs with no side effects between them, so every
    // recomputed quantity (targetPcts, rivalPcts, strongCount, tStreak, rivStreak,
    // cursorOnTarget) is provably identical the second time — this port computes each such
    // quantity once and reuses it. What genuinely differs — and is preserved exactly, in
    // order — is: the reasons text each pass pushes, the pass-2 quality re-decision
    // (targetStrong/rivalCompressed/cursorOnTarget tri-state, independent of pass 1's
    // absZ-based tri-state), the score accumulated by pass 2 on top of pass 1's
    // already-significance-gated score, and the SECOND significanceGate application at the
    // very end (the reference gates the score twice — once per pass — which this mirrors).
    if (ct === 'DIGITEVEN' || ct === 'DIGITODD') {
        const targetGroup = ct === 'DIGITEVEN' ? [0, 2, 4, 6, 8] : [1, 3, 5, 7, 9];
        const rivalGroup = ct === 'DIGITEVEN' ? [1, 3, 5, 7, 9] : [0, 2, 4, 6, 8];
        dir = ct === 'DIGITEVEN' ? 'EVEN' : 'ODD';
        const tParity = ct === 'DIGITEVEN' ? 0 : 1;

        let tStreak = 0;
        for (let ti = hist.length - 1; ti >= 0; ti--) {
            if (hist[ti].digit % 2 === tParity) tStreak++;
            else break;
        }
        let rivStreak = 0;
        for (let ri = hist.length - 1; ri >= 0; ri--) {
            if (hist[ri].digit % 2 !== tParity) rivStreak++;
            else break;
        }

        // REVERSAL RULE (Doc Part 3, ~70% win rate): 4+ consecutive rival-parity digits.
        if (rivStreak >= 4) {
            const revScore = Math.min(95, 70 + (rivStreak - 4) * 5);
            return {
                score: revScore,
                dir,
                quality: 'SIGNAL',
                reasons: [
                    `🔥 REVERSAL ENTRY — ${rivStreak} consecutive ${tParity === 0 ? 'ODD' : 'EVEN'} digits`,
                    '📊 Reversal win rate: ~70% | Duration: 2 ticks',
                    `Streak of ${rivStreak} makes opposite parity statistically due`,
                ],
            };
        }

        // Z-SCORE across windows (Doc Part 4.1 formula).
        const eoWindows = [50, 100, 200, 500, Math.min(n, 1000)];
        const zEO = eoWindows.map(w => {
            const sl = hist.slice(-w);
            const cnt = sl.filter(t => t.digit % 2 === tParity).length;
            return iframeZScore(cnt, sl.length, 0.5);
        });
        const zNetEO = (zEO[0] + zEO[1] + zEO[2] + zEO[3] + zEO[4]) / 5;
        const posEO = zEO.filter(z => z > 0).length;
        const absZ = Math.abs(zNetEO);

        const last200 = hist.slice(-200);
        const observedWinRate = last200.filter(t => t.digit % 2 === tParity).length / last200.length;
        const edgePct = ((observedWinRate - 0.53) * 100).toFixed(1);
        const confPct = absZ >= 2.33 ? 99 : absZ >= 1.96 ? 95 : absZ >= 1.64 ? 90 : absZ >= 1.28 ? 80 : 60;

        const targetPcts = targetGroup.map(d => p1000[d].pct);
        const rivalPcts = rivalGroup.map(d => p1000[d].pct);
        const strongCount = targetPcts.filter(p => p >= 9.5).length;
        const rivalBelow10 = rivalPcts.filter(p => p < 10).length;
        const hotTarget = Math.max(...targetPcts);
        const cursorOnTarget = hist.slice(-3).filter(t => t.digit % 2 === tParity).length >= 2;

        if (absZ >= 1.96 && strongCount >= 4 && cursorOnTarget) {
            quality = 'SIGNAL';
            reasons.push(`✅ EVEN/ODD SIGNAL — Win rate ${Math.round(observedWinRate * 100)}% vs 53% break-even`);
            if (parseFloat(edgePct) > 0)
                reasons.push(`📈 Edge: +${edgePct}% above break-even | Confidence: ${confPct}%`);
        } else if (absZ >= 1.28 && strongCount >= 4) {
            quality = 'WATCH';
            reasons.push(
                `⚠ WATCH — ${Math.round(observedWinRate * 100)}% win rate forming (need ${confPct}%→95% confidence)`
            );
        } else {
            return {
                score: 0,
                dir,
                quality: 'REJECT',
                reasons: [
                    `❌ No statistical bias detected for ${dir}`,
                    `Z-score: ${zNetEO.toFixed(2)} (need ≥1.96 for 95% confidence)`,
                    `Win rate: ${Math.round(observedWinRate * 100)}% | Break-even: 53%`,
                ],
            };
        }

        if (strongCount >= 4) reasons.push(`${strongCount}/5 target digits ≥9.5%`);
        if (tStreak >= 3) reasons.push(`🔥 ${tStreak} consecutive ${dir} digits — momentum confirmed`);
        if (hotTarget >= 11.5) reasons.push(`Hot spot: ${hotTarget.toFixed(1)}% on ${dir} side`);
        if (rivalBelow10 >= 3) reasons.push(`${rivalBelow10} rival digits below 10%`);

        score = Math.round(
            Math.min(
                100,
                absZ * 20 +
                    (strongCount >= 4 ? 15 : 0) +
                    (cursorOnTarget ? 10 : 0) +
                    (tStreak >= 3 ? 10 : 0) +
                    rivalBelow10 * 4
            )
        );

        const eoSpecEnterPass1 = quality === 'SIGNAL' && strongCount >= 4 && cursorOnTarget;
        score = Math.round(score * significanceGate(zNetEO, n));
        if (
            quality === 'SIGNAL' &&
            !eoSpecEnterPass1 &&
            significanceGate(zNetEO, n) < (SCANNER_FILTER_DEFAULTS.relaxedScoring ? 0.6 : 0.8)
        ) {
            quality = 'WATCH';
        }
        if (quality === 'SIGNAL') score = Math.max(55, score);

        // ── SPEC pass 2 (reference's own second pass — see note above) ──
        const targetStrong = strongCount >= 4;
        const minTarget = Math.min(...targetPcts);
        const maxTarget = Math.max(...targetPcts);
        const hotTarget2 = maxTarget;

        const rivalTotal = rivalPcts.reduce((a, b) => a + b, 0);
        const maxRival = Math.max(...rivalPcts);
        const rivalCompressed = rivalTotal < 50 || rivalBelow10 >= 3;

        if (targetStrong && rivalCompressed && cursorOnTarget) {
            quality = 'SIGNAL';
            reasons.push(`✅ ${strongCount}/5 target ≥9.5% + cursor on ${dir} 2 of last 3`);
        } else if (targetStrong && (rivalCompressed || cursorOnTarget)) {
            quality = 'WATCH';
            if (!cursorOnTarget) reasons.push(`⚠ Waiting: cursor not on ${dir} parity (need 2 of last 3 ticks)`);
            if (!rivalCompressed)
                reasons.push(`⚠ Rivals not compressed (${rivalTotal.toFixed(1)}% total, ${rivalBelow10} below 10%)`);
        } else {
            quality = 'WATCH';
            reasons.push('⚠ Rivals strong + cursor away — monitor');
        }

        score += Math.min(20, (minTarget - 9.5) * 4);
        score += rivalBelow10 * 6;
        if (rivalCompressed) score += 10;
        if (rivalBelow10 >= 3) reasons.push(`${rivalBelow10} rival digits <10% (max rival: ${maxRival.toFixed(1)}%)`);
        if (tStreak >= 3) {
            score += 12;
            reasons.push(`🔥 ${tStreak} consecutive ${dir} digits`);
        }
        if (hotTarget2 >= 11.5) {
            score += 12;
            reasons.push(`Hot spot: ${hotTarget2.toFixed(1)}% on target digit`);
        }

        score += Math.min(18, Math.abs(zNetEO) * 8);
        if (posEO === 5 || posEO === 0) {
            score += 14;
        } else if (posEO >= 4 || posEO <= 1) {
            score += 7;
        }

        const eoSeq = hist.slice(-500).map(t => (t.digit % 2 === tParity ? 1 : 0));
        const rtEO = runsTest(eoSeq);
        if (rtEO.z < -1.5) {
            score += 12;
            reasons.push(`Parity clustering (Runs Z=${rtEO.z.toFixed(2)})`);
        } else if (rtEO.z < -0.8) {
            score += 6;
        }

        const ac1EO = autocorr1(eoSeq);
        const consEO = biasConsistency(eoSeq);
        score += Math.min(8, Math.abs(ac1EO) * 50) + Math.round(consEO * 8);
        score = Math.round(Math.min(100, Math.max(0, score)) * agreementGate(zEO, dir));

        const eoSpecEnterPass2 = quality === 'SIGNAL' && targetStrong && rivalCompressed && cursorOnTarget;
        score = Math.round(score * significanceGate(zNetEO, n));
        if (
            quality === 'SIGNAL' &&
            !eoSpecEnterPass2 &&
            significanceGate(zNetEO, n) < (SCANNER_FILTER_DEFAULTS.relaxedScoring ? 0.6 : 0.8)
        ) {
            quality = 'WATCH';
        }
        if (quality === 'SIGNAL') score = Math.max(55, score);
        if (quality === 'WATCH') score = Math.min(score, 59);
    } else if (ct === 'DIGITOVER' || ct === 'DIGITUNDER') {
        // ══════════════════════════════════════════════════════════════
        // OVER / UNDER — Document Part 4.2 + Part 5 Cluster Lock
        // p(OVER N) = (9-N)/10 | p(UNDER N) = (N+1)/10
        // Break-even at 50/50 barrier (1.85x payout) = 54.1%
        // Reference lines 19357-19625.
        // ══════════════════════════════════════════════════════════════
        const bMax = ct === 'DIGITOVER' ? 5 : 6;
        let bestB = 4,
            bestSuppr = 0,
            bestAvgSide = 100;
        for (let b = 4; b <= bMax; b++) {
            const losingPcts: number[] = [];
            if (ct === 'DIGITOVER') {
                for (let d = 0; d <= b; d++) losingPcts.push(p1000[d].pct);
            } else {
                for (let d2 = b; d2 <= 9; d2++) losingPcts.push(p1000[d2].pct);
            }
            const suppr = losingPcts.filter(p => p < 10).length;
            const avg = losingPcts.reduce((a, x) => a + x, 0) / losingPcts.length;
            if (suppr > bestSuppr || (suppr === bestSuppr && avg < bestAvgSide)) {
                bestSuppr = suppr;
                bestAvgSide = avg;
                bestB = b;
            }
        }

        const sDir = ct === 'DIGITOVER' ? 'OVER' : 'UNDER';
        dir = `${sDir} ${bestB}`;

        const losingSide: number[] = [];
        if (ct === 'DIGITOVER') {
            for (let d3 = 0; d3 <= bestB; d3++) losingSide.push(d3);
        } else {
            for (let d4 = bestB; d4 <= 9; d4++) losingSide.push(d4);
        }
        const winningSide: number[] = [];
        if (ct === 'DIGITOVER') {
            for (let d5 = bestB + 1; d5 <= 9; d5++) winningSide.push(d5);
        } else {
            for (let d6 = 0; d6 < bestB; d6++) winningSide.push(d6);
        }

        const losePcts = losingSide.map(d => p1000[d].pct);
        const winPcts = winningSide.map(d => p1000[d].pct);

        const allLoseBelow10 = losePcts.every(p => p < 10);
        const loseBelowCount = losePcts.filter(p => p < 10).length;
        const loseTotal = losePcts.length;
        const maxLose = Math.max(...losePcts);
        const failingLose = losingSide.filter(d => p1000[d].pct >= 10).map(d => `d${d}=${p1000[d].pct.toFixed(1)}%`);

        const avgWin = winPcts.length ? winPcts.reduce((a, b) => a + b, 0) / winPcts.length : 10;
        const winWeakDigits = winningSide.filter(d => p1000[d].pct < 9);
        const winSideHealthy = avgWin >= 10 && winWeakDigits.length === 0;

        const cluster = clusterCompression(p1000, winningSide);

        const ouLast4 = hist.slice(-4);
        const clusterHits = ouLast4.filter(t => cluster.digits.indexOf(t.digit) !== -1).length;
        const sideHits = ouLast4.filter(t => winningSide.indexOf(t.digit) !== -1).length;
        const cursorConc = clusterHits >= 3 || sideHits === 4;

        const barHits = hist.slice(-5).filter(t => t.digit === bestB).length;
        const barrierSafe = ct === 'DIGITUNDER' ? barHits <= 1 : true;

        if (loseBelowCount < Math.ceil(loseTotal / 2) && !cluster.compressed) {
            return {
                score: 0,
                dir,
                quality: 'REJECT',
                barrier: bestB,
                reasons: [
                    `❌ No cluster lock — only ${loseBelowCount}/${loseTotal} losing digits <10%`,
                    `Barrier ${bestB} not ready: ${failingLose.join(', ')} still too high`,
                    'Need cluster compression (range ≤2%) or all losing digits <10%',
                ],
            };
        }

        const trueP = ct === 'DIGITOVER' ? (9 - bestB) / 10 : bestB / 10;
        const breakEven = 1 / 1.85;
        const clusterEdge = cluster.entryProb - breakEven;
        const effectiveWinRate = cluster.compressed ? cluster.entryProb : trueP;
        const edgePctOU = ((effectiveWinRate - breakEven) * 100).toFixed(1);

        const loseStrongRelaxed = loseBelowCount >= loseTotal - 1;
        const clusterEntry = cluster.compressed && cursorConc && barrierSafe;

        if (clusterEntry) {
            quality = 'SIGNAL';
            reasons.push(
                `🔒 CLUSTER LOCK — ${dir} | Win prob: ${Math.round(cluster.entryProb * 100)}% vs 54% break-even`
            );
            reasons.push(
                `📊 Edge: +${edgePctOU}% | Compression: ${Math.round(cluster.compression * 100)}% | Digits: ${cluster.digits.join(',')}`
            );
            reasons.push(
                `Range ${cluster.range.toFixed(1)}% (≤2.0% = locked) | Cursor confirmed ${clusterHits}/4 ticks`
            );
        } else if (allLoseBelow10 && winSideHealthy) {
            quality = 'SIGNAL';
            reasons.push(`✅ CLASSIC SIGNAL — ALL ${loseTotal} losing digits <10% at barrier ${bestB}`);
            reasons.push(`📊 Win prob: ${Math.round(trueP * 100)}% | Max losing: ${maxLose.toFixed(1)}%`);
        } else if (SCANNER_FILTER_DEFAULTS.relaxedScoring && loseStrongRelaxed && winSideHealthy) {
            quality = 'SIGNAL';
            reasons.push(`[relaxed] ${loseBelowCount}/${loseTotal} losing <10% — strong enough for entry`);
        } else if (cluster.compressed) {
            quality = 'WATCH';
            reasons.push(
                `⚠ Cluster forming (${cluster.digits.join(',')}±${cluster.range.toFixed(1)}%) — need cursor on ${cluster.digits.join('/')} for 3 of next 4 ticks`
            );
        } else {
            quality = 'WATCH';
            reasons.push(`⚠ ${loseBelowCount}/${loseTotal} losing digits <10% — monitor: ${failingLose.join(', ')}`);
        }

        const baseScore = cluster.compressed
            ? Math.round(Math.min(100, 55 + clusterEdge * 200))
            : Math.round(Math.min(100, 45 + loseBelowCount * 8 + (allLoseBelow10 ? 15 : 0)));
        score = baseScore;
        if (cursorConc) score += 8;
        if (barrierSafe && ct === 'DIGITUNDER') score += 5;
        if (winSideHealthy) score += 7;

        const ouW = [50, 100, 200, 500, Math.min(n, 1000)];
        const pExp = trueP;
        const zOU = ouW.map(w => {
            const sl2 = hist.slice(-w);
            const cnt2 =
                ct === 'DIGITOVER' ? sl2.filter(t => t.digit > bestB).length : sl2.filter(t => t.digit < bestB).length;
            return iframeZScore(cnt2, sl2.length, pExp);
        });
        const zNetOU = (zOU[0] + zOU[1] + zOU[2] + zOU[3] + zOU[4]) / 5;
        const posOU = zOU.filter(z => z > 0).length;
        score += Math.min(10, Math.abs(zNetOU) * 5);
        if (posOU === 5 || posOU === 0) {
            score += 8;
            reasons.push(`All 5 time windows confirm ${dir}`);
        }

        score = Math.round(Math.min(100, Math.max(0, score)));
        score = Math.round(score * significanceGate(zNetOU, n));
        if (
            quality === 'SIGNAL' &&
            !clusterEntry &&
            significanceGate(zNetOU, n) < (SCANNER_FILTER_DEFAULTS.relaxedScoring ? 0.6 : 0.8)
        ) {
            quality = 'WATCH';
        }
        if (quality === 'SIGNAL') score = Math.max(60, score);
        if (quality === 'WATCH') score = Math.min(score, 69);

        return { score, dir, reasons: reasons.slice(0, 4), quality, barrier: bestB };
    } else if (ct === 'CALL' || ct === 'PUT') {
        // ══════════════════════════════════════════════════════════════
        // RISE / FALL — 8-layer structural analysis. Reference lines 19626-19903.
        // ══════════════════════════════════════════════════════════════
        dir = ct === 'CALL' ? 'RISE' : 'FALL';
        const sign2 = ct === 'CALL' ? 1 : -1;
        const n2 = prices.length;
        if (n2 < 50) return { score: 0, dir, reasons: ['Insufficient price data'], quality: 'REJECT' };

        let upStreak = 0;
        for (let ui = hist.length - 1; ui >= 0; ui--) {
            if (hist[ui].diff >= 0) upStreak++;
            else break;
        }
        let dnStreak = 0;
        for (let di = hist.length - 1; di >= 0; di--) {
            if (hist[di].diff < 0) dnStreak++;
            else break;
        }
        const myStreak = ct === 'CALL' ? upStreak : dnStreak;
        const oppStreak = ct === 'CALL' ? dnStreak : upStreak;

        // 5+ TICK REVERSAL RULE (highest win-rate ~70%).
        if (oppStreak >= 5) {
            const rfRev = Math.min(95, 72 + (oppStreak - 5) * 4);
            return {
                score: rfRev,
                dir,
                reasons: [
                    `🔥 Reversal: ${oppStreak} consecutive ${ct === 'CALL' ? 'FALL' : 'RISE'} ticks → statistical reversal, enter ${dir} (3 ticks)`,
                ],
                quality: 'SIGNAL',
            };
        }

        // DIGIT-DIRECTION LOCK: RISE wants a low last digit (0-3); FALL wants a high one (6-9).
        const rfLastDigit = hist[hist.length - 1].digit;
        if (ct === 'CALL' && [0, 1, 2, 3].indexOf(rfLastDigit) === -1) {
            return {
                score: 0,
                dir,
                reasons: [`❌ Last digit ${rfLastDigit} — RISE needs low digit (0-3)`],
                quality: 'REJECT',
            };
        }
        if (ct === 'PUT' && [6, 7, 8, 9].indexOf(rfLastDigit) === -1) {
            return {
                score: 0,
                dir,
                reasons: [`❌ Last digit ${rfLastDigit} — FALL needs high digit (6-9)`],
                quality: 'REJECT',
            };
        }

        const rfCurP = prices[n2 - 1];
        const rfEma20 = ema(prices, 20);
        const emaOK = rfEma20 !== null && (ct === 'CALL' ? rfCurP > rfEma20 : rfCurP < rfEma20);
        if (emaOK) reasons.push(`Price ${ct === 'CALL' ? 'above' : 'below'} EMA20`);

        const streakOK = myStreak >= 2 && myStreak <= 4;
        const streakExhausted = myStreak >= 5;

        let layersPassed = 0;
        if (emaOK) layersPassed++;
        if (streakOK) {
            layersPassed++;
            score += 12;
            reasons.push(`${myStreak} consecutive ${dir} ticks — entry window`);
        }
        if (streakExhausted) {
            score -= 12;
            reasons.push(`⚠ ${myStreak} consecutive ${dir} ticks — move exhausted, risk of snap-back`);
        }

        // 1. EMA stack
        const em8 = ema(prices, 8),
            em21 = ema(prices, 21),
            em50 = ema(prices, 50),
            em200 = ema(prices, Math.min(200, n2 - 1));
        const curP = prices[n2 - 1];
        const emaAligned =
            ct === 'CALL'
                ? !!em8 && !!em21 && !!em50 && em8 > em21 && em21 > em50
                : !!em8 && !!em21 && !!em50 && em8 < em21 && em21 < em50;
        let emSc = 0;
        if (em8 && sign2 * (curP - em8) > 0) emSc += 6;
        if (em21 && sign2 * (curP - em21) > 0) emSc += 6;
        if (em50 && sign2 * (curP - em50) > 0) emSc += 5;
        if (em200 && sign2 * (curP - em200) > 0) emSc += 5;
        if (emaAligned) {
            emSc += 10;
            reasons.push(`EMA stack aligned: ${dir} trend`);
            layersPassed++;
        }
        score += emSc;

        // 2. Market structure
        const swP = prices.slice(-Math.min(200, n2));
        const hh: number[] = [],
            ll: number[] = [];
        for (let si = 2; si < swP.length - 2; si++) {
            if (swP[si] > swP[si - 1] && swP[si] > swP[si + 1]) hh.push(swP[si]);
            if (swP[si] < swP[si - 1] && swP[si] < swP[si + 1]) ll.push(swP[si]);
        }
        if (hh.length >= 2 && ll.length >= 2) {
            const HH = hh[hh.length - 1] > hh[hh.length - 2],
                HL = ll[ll.length - 1] > ll[ll.length - 2];
            const LL = ll[ll.length - 1] < ll[ll.length - 2],
                LH = hh[hh.length - 1] < hh[hh.length - 2];
            if (ct === 'CALL' && HH && HL) {
                score += 18;
                reasons.push('Bullish structure: HH+HL');
                layersPassed++;
            } else if (ct === 'CALL' && HH) {
                score += 10;
            } else if (ct === 'PUT' && LL && LH) {
                score += 18;
                reasons.push('Bearish structure: LL+LH');
                layersPassed++;
            } else if (ct === 'PUT' && LL) {
                score += 10;
            }
        }

        // 3. Liquidity zones
        const rp50 = prices.slice(-50);
        const r50H = Math.max(...rp50),
            r50L = Math.min(...rp50);
        const rng = r50H - r50L + 0.000001;
        const dL = (curP - r50L) / rng,
            dH = (r50H - curP) / rng;
        if (ct === 'CALL' && dL < 0.25) {
            score += 12;
            reasons.push('Price at range floor — liquidity zone');
            layersPassed++;
        } else if (ct === 'CALL' && dL < 0.45) {
            score += 6;
        }
        if (ct === 'PUT' && dH < 0.25) {
            score += 12;
            reasons.push('Price at range ceiling — liquidity zone');
            layersPassed++;
        } else if (ct === 'PUT' && dH < 0.45) {
            score += 6;
        }

        // 4. Imbalance
        const atrV = atr(prices, 14);
        const diffs200 = hist.slice(-200).map(t => t.diff);
        const bigU = diffs200.filter(d => d > atrV * 1.5).length;
        const bigD = diffs200.filter(d => d < -atrV * 1.5).length;
        if (ct === 'CALL' && bigU > bigD + 2) {
            score += 10;
            reasons.push(`Bullish imbalance: ${bigU}↑ vs ${bigD}↓`);
            layersPassed++;
        } else if (ct === 'PUT' && bigD > bigU + 2) {
            score += 10;
            reasons.push(`Bearish imbalance: ${bigD}↓ vs ${bigU}↑`);
            layersPassed++;
        }

        // 5. RSI zones
        const rsi = rsiCalc(prices, 14);
        if (rsi !== null) {
            if (ct === 'CALL' && rsi < 25) {
                score += 14;
                reasons.push(`RSI oversold (${rsi.toFixed(0)})`);
                layersPassed++;
            } else if (ct === 'CALL' && rsi < 38) {
                score += 8;
            }
            if (ct === 'PUT' && rsi > 75) {
                score += 14;
                reasons.push(`RSI overbought (${rsi.toFixed(0)})`);
                layersPassed++;
            } else if (ct === 'PUT' && rsi > 62) {
                score += 8;
            }
        }

        // 6. Z-score on direction
        const rfW = [50, 200, 500, Math.min(n, 1000)];
        const zRF = rfW.map(w => {
            const sl3 = hist.slice(-w);
            const rc = sl3.filter(t => t.diff >= 0).length;
            return iframeZScore(rc, w, 0.5);
        });
        const zNetRF = (zRF[0] + zRF[1] + zRF[2] + zRF[3]) / 4;
        const posRF = zRF.filter(z => z > 0).length;
        score += Math.min(16, Math.abs(zNetRF) * 8);
        if (posRF === 4 || posRF === 0) {
            score += 10;
            layersPassed++;
        } else if (posRF >= 3 || posRF <= 1) {
            score += 5;
        }

        // 7. Runs test
        const rtRF = runsTest(hist.slice(-200).map(t => (t.diff >= 0 ? 1 : 0)));
        if (rtRF.z < -1.5) {
            score += 10;
            reasons.push(`Trending market (Runs Z=${rtRF.z.toFixed(2)})`);
            layersPassed++;
        } else if (rtRF.z > 1.5 && !SCANNER_FILTER_DEFAULTS.relaxedScoring) {
            score -= 8;
        }

        // 8. Breakout
        const bo = breakout(prices, 30);
        if (ct === 'CALL' && bo === 'high') {
            score += 12;
            reasons.push('Breakout: new 30-tick high');
            layersPassed++;
        }
        if (ct === 'PUT' && bo === 'low') {
            score += 12;
            reasons.push('Breakout: new 30-tick low');
            layersPassed++;
        }

        score = Math.round(Math.min(100, Math.max(0, score)) * volP * agreementGate(zRF, dir));

        if (layersPassed >= 3) {
            quality = 'SIGNAL';
        } else if (layersPassed >= 1) {
            quality = 'WATCH';
            score = Math.min(score, 59);
        } else {
            return { score: 0, dir, reasons: ['⚠ No structural layers confirmed'], quality: 'REJECT' };
        }

        // SPEC confirms required for a full SIGNAL: price on the right side of EMA20 AND
        // RSI inside the band (RISE: RSI<60 · FALL: RSI>40) AND move not exhausted.
        const rsiOK = rsi === null || (ct === 'CALL' ? rsi < 60 : rsi > 40);
        if (quality === 'SIGNAL' && (!emaOK || !rsiOK || streakExhausted)) {
            quality = 'WATCH';
            score = Math.min(score, 59);
            if (!emaOK) reasons.push(`⚠ Price on wrong side of EMA20 for ${dir}`);
            if (!rsiOK) reasons.push(`⚠ RSI ${rsi !== null ? rsi.toFixed(0) : '—'} outside ${dir} band`);
        }
    } else if (ct === 'DIGITMATCH' || ct === 'DIGITDIFF') {
        // ══════════════════════════════════════════════════════════════
        // MATCH / DIFFER — Bilateral check. Reference lines 19904-20181.
        // ══════════════════════════════════════════════════════════════
        const sorted = p1000.slice().sort((a, b) => b.pct - a.pct);

        if (ct === 'DIGITMATCH') {
            // SPEC CONTAGION RULE: a cold digit that just reappeared after a 15+ tick
            // absence tends to cluster — MATCH it for 2 ticks. (Note: this is unconditional
            // in the reference — window._DS.contagion is never actually read anywhere, see
            // helpers.ts's dsDirBias doc comment / grep confirmation, so it's not gated on
            // the "contagion" toggle despite the name overlap.)
            let contagion: { digit: number; gap: number } | null = null;
            for (let cgd = 0; cgd <= 9; cgd++) {
                let liC = -1,
                    piC = -1;
                for (let ck = hist.length - 1; ck >= 0; ck--) {
                    if (hist[ck].digit === cgd) {
                        if (liC === -1) liC = ck;
                        else {
                            piC = ck;
                            break;
                        }
                    }
                }
                if (liC >= hist.length - 2 && liC >= 0) {
                    const gapC = piC === -1 ? liC : liC - piC - 1;
                    if (gapC >= 15) {
                        contagion = { digit: cgd, gap: gapC };
                        break;
                    }
                }
            }
            if (contagion) {
                return {
                    score: 68,
                    dir: `MATCH ${contagion.digit}`,
                    reasons: [
                        `🔥 Contagion: digit ${contagion.digit} reappeared after ${contagion.gap}-tick absence — capture the cluster (2 ticks)`,
                    ],
                    quality: 'SIGNAL',
                };
            }

            const hot = sorted[0];
            dir = `MATCH ${hot.digit}`;

            // Break-even for MATCH (9x payout): p = 1/9 = 11.1%.
            const effectiveP = hot.pct / 100;
            const matchBreakEven = 1 / 9;
            const matchEdge = ((effectiveP - matchBreakEven) * 100).toFixed(1);

            if (hot.pct < 11.0) {
                return {
                    score: 0,
                    dir,
                    quality: 'REJECT',
                    reasons: [
                        `❌ Digit ${hot.digit} at ${hot.pct.toFixed(1)}% — below 11.1% break-even`,
                        'MATCH needs effective_p >11.1% to overcome house edge',
                        'Wait for a digit to reach ≥11%',
                    ],
                };
            }

            const rivals = p1000.filter(s => s.digit !== hot.digit);
            const topRival = rivals.slice().sort((a, b) => b.pct - a.pct)[0];
            const separation = hot.pct - topRival.pct;
            const competingRivals = rivals.filter(r => r.pct > 12.5);
            const rec5 = hist.slice(-5).filter(t => t.digit === hot.digit).length;

            if (hot.pct > 11.0 && separation > 1.0 && rec5 >= 1 && competingRivals.length === 0) {
                quality = 'SIGNAL';
                reasons.push(`✅ MATCH ${hot.digit} — Win prob: ${hot.pct.toFixed(1)}% vs 11.1% break-even`);
                reasons.push(
                    `📊 Edge: +${parseFloat(matchEdge) > 0 ? matchEdge : '0'}% | Gap to rival: +${separation.toFixed(1)}% | Seen in last 5 ticks`
                );
            } else {
                quality = 'WATCH';
                if (competingRivals.length > 0)
                    reasons.push(`⚠ ${competingRivals.length} rival digit(s) >12.5% — too much competition`);
                if (separation <= 1.0)
                    reasons.push(`⚠ Gap to rival only ${separation.toFixed(1)}% — need >1% to confirm dominance`);
                if (rec5 === 0) reasons.push(`⚠ Digit ${hot.digit} absent from last 5 ticks — wait for reconfirmation`);
            }

            const zM = iframeZScore(hot.count, n, 0.1);
            score = Math.round(
                Math.min(
                    100,
                    Math.min(40, Math.max(0, zM) * 16) +
                        Math.min(20, (hot.pct - 11) * 4) +
                        (separation >= 2 ? 15 : separation >= 1 ? 8 : 0) +
                        (rec5 >= 1 ? 10 : 0) +
                        (competingRivals.length === 0 ? 8 : 0)
                )
            );
            const lastDig = hist[hist.length - 1] && hist[hist.length - 1].digit;
            if (lastDig === hot.digit) {
                score = Math.round(score * 0.8);
                reasons.push(`⚠ Last tick was ${hot.digit} — slight wait recommended`);
            }
            score = Math.round(Math.min(100, Math.max(0, score)));
            if (quality === 'WATCH') score = Math.min(score, 65);
        } else {
            // DIGITDIFF
            const cold = sorted[sorted.length - 1];
            dir = `DIFF ${cold.digit}`;

            // Break-even for DIFFERS (1.11x payout): p = 1/1.11 = 90.1%.
            const diffEffectiveP = 1 - cold.pct / 100;
            const diffBreakEven = 0.901;
            const diffEdge = ((diffEffectiveP - diffBreakEven) * 100).toFixed(1);

            if (cold.pct > 8.5) {
                return {
                    score: 0,
                    dir,
                    quality: 'REJECT',
                    reasons: [
                        `❌ Digit ${cold.digit} at ${cold.pct.toFixed(1)}% — not cold enough for DIFFERS`,
                        'Need ≤8.5% for effective_p ≥91.5% (above 90.1% break-even)',
                        `Expected: 10% per digit | Current: ${cold.pct.toFixed(1)}%`,
                    ],
                };
            }

            let lastSeen = -1;
            for (let dk = hist.length - 1; dk >= 0; dk--) {
                if (hist[dk].digit === cold.digit) {
                    lastSeen = dk;
                    break;
                }
            }
            const absentFor = lastSeen === -1 ? hist.length : hist.length - 1 - lastSeen;

            if (absentFor <= 1) {
                let prevSeen = -1;
                for (let pk = lastSeen - 1; pk >= 0; pk--) {
                    if (hist[pk].digit === cold.digit) {
                        prevSeen = pk;
                        break;
                    }
                }
                const prevGap = prevSeen === -1 ? lastSeen : lastSeen - prevSeen - 1;
                if (prevGap >= 15) {
                    return {
                        score: 0,
                        dir,
                        quality: 'REJECT',
                        reasons: [
                            `❌ Contagion guard: digit ${cold.digit} just reappeared after ${prevGap}-tick absence`,
                            `→ Enter MATCH ${cold.digit} instead (cluster capture for 2 ticks)`,
                            'Hot digit tends to repeat after a long drought — do not DIFFERS yet',
                        ],
                    };
                }
            }

            const otherDigits = p1000.filter(s => s.digit !== cold.digit);
            const starving = otherDigits.filter(s => s.pct < 7);
            const avgOthers = otherDigits.reduce((a, s) => a + s.pct, 0) / otherDigits.length;

            if (cold.pct <= 8.5 && absentFor >= 10 && starving.length === 0) {
                quality = 'SIGNAL';
                reasons.push(
                    `✅ DIFFERS ${cold.digit} — Win prob: ${Math.round(diffEffectiveP * 100)}% vs 90.1% break-even`
                );
                reasons.push(
                    `📊 Edge: +${parseFloat(diffEdge) > 0 ? diffEdge : '0'}% | Absent ${absentFor} ticks | No starving rivals`
                );
            } else {
                quality = 'WATCH';
                if (absentFor < 10)
                    reasons.push(
                        `⚠ Digit ${cold.digit} seen ${absentFor} tick(s) ago — need 10+ tick absence for safety`
                    );
                if (starving.length > 0)
                    reasons.push(`⚠ ${starving.length} other digit(s) <7% — competition for cold slot`);
            }

            const zD = iframeZScore(cold.count, n, 0.1);
            score = Math.round(
                Math.min(
                    100,
                    Math.min(40, Math.max(0, -zD) * 16) +
                        Math.min(20, (8.5 - cold.pct) * 3) +
                        (absentFor >= 10 ? 20 : absentFor >= 7 ? 10 : 0) +
                        (starving.length === 0 ? 10 : 0) +
                        (avgOthers >= 10 ? 8 : 0)
                )
            );
            const lastDig2 = hist[hist.length - 1] && hist[hist.length - 1].digit;
            if (lastDig2 === cold.digit) {
                score = Math.round(score * 0.7);
                reasons.push('⚠ Cold digit just appeared — contagion risk, wait 2 ticks');
            }
            score = Math.round(Math.min(100, Math.max(0, score)));
            if (quality === 'WATCH') score = Math.min(score, 65);
        }
    }

    // Global entropy bonus + low-score floor (reference lines 20184-20189).
    if (chi1k > 16.92 && score > 20) score = Math.round(Math.min(100, score + Math.min(6, (chi1k - 16.92) * 0.3)));
    if (score < 42) score = Math.floor(score * 0.6);
    if (reasons.length === 0) reasons.push(`Score based on ${n}-tick analysis`);
    // Only the OVER/UNDER branch ever sets a barrier, and it returns directly above — so
    // every branch that falls through to this common tail (EO/RF/MD) has none, matching
    // the reference (only OU's own return literal includes a `barrier` property).
    return { score, dir, reasons: reasons.slice(0, 4), quality, barrier: null };
}

// ═══════════════════════════════════════════════════════════════════════════
// DEEPSEEK IMPROVEMENT LAYER — toggleable filters applied on top of scoreCombo.
// Faithful port of _dsApplyImprovements (reference lines 18666-18778). Flags default to
// SCANNER_FILTER_DEFAULTS (no settings UI in v1 — see task scope notes).
// ═══════════════════════════════════════════════════════════════════════════
export function applyScannerFilters(
    res: TScoreResult,
    hist: TFullHistoryTick[],
    ct: TContractType,
    flags: TScannerFilterFlags = SCANNER_FILTER_DEFAULTS
): TScoreResult {
    if (!res || res.quality === 'REJECT') return res;
    const note: string[] = [];

    // #11 Market Regime Detector (gatekeeper).
    if (flags.regimeDetector) {
        const reg = dsRegime(hist);
        if (reg === 'spiking') return { ...res, quality: 'REJECT' };
        if (reg === 'quiet' && (ct === 'DIGITMATCH' || ct === 'DIGITDIFF')) return { ...res, quality: 'REJECT' };
        if (reg === 'volatile') {
            if (ct === 'DIGITEVEN' || ct === 'DIGITODD') return { ...res, quality: 'REJECT' };
            res = { ...res, score: Math.round(res.score * 0.7) };
            note.push('volatile×0.7');
        }
    }

    // #3 Consecutive-digit filter + 4/5 trap (over/under).
    if (flags.consecFilter && (ct === 'DIGITOVER' || ct === 'DIGITUNDER')) {
        const last3 = dsLastDigits(hist, 3);
        if (last3.length === 3) {
            if (last3[0] === last3[1] && last3[1] === last3[2]) return { ...res, quality: 'REJECT' };
            if (last3[1] === last3[2]) {
                res = { ...res, score: Math.round(res.score * 0.5) };
                note.push('semi-lock×0.5');
            }
        }
        const lastD = dsLastDigits(hist, 1)[0];
        if (lastD === 4 || lastD === 5) {
            res = { ...res, score: Math.round(res.score * 0.7) };
            note.push('4/5-trap');
        }
    }

    // #6 Even/Odd spread filter.
    if (flags.spreadFilter && (ct === 'DIGITEVEN' || ct === 'DIGITODD')) {
        const sp = dsSpread(hist);
        if (sp.spread > 20) return { ...res, quality: 'REJECT' };
        if (sp.spread > 10) {
            const minorityEven = sp.even < sp.odd;
            const wantEven = ct === 'DIGITEVEN';
            if (wantEven !== minorityEven) {
                res = { ...res, score: Math.round(res.score * 0.6) };
                note.push('against-spread×0.6');
            }
        }
    }

    // #1 Matches cluster strength gate (filter only).
    if (flags.clusterScore && ct === 'DIGITMATCH' && res.barrier != null) {
        const cs = dsClusterStrength(hist, res.barrier);
        if (cs < 70) return { ...res, quality: 'REJECT' };
        res = { ...res, dsClusterStrength: cs };
        if (cs < 80) note.push(`weak-cluster(${cs})`);
    }

    // #9 Cross-Contract Confirmation — require a second independent signal to agree.
    if (flags.crossConfirm) {
        const bias = dsDirBias(ct, res.dir);
        if (bias) {
            const w = hist.slice(-10).map(t => t.price);
            const drift = w.length > 1 ? w[w.length - 1] - w[0] : 0;
            const confirmUp = drift > 0,
                confirmDown = drift < 0;
            const agree = (bias === 'up' && confirmUp) || (bias === 'down' && confirmDown);
            if (!agree) {
                res = { ...res, score: Math.round(res.score * 0.55) };
                note.push('no-confirm×0.55');
            } else {
                note.push('confirmed');
            }
        }
    }

    // #12 timeOfDay — experimental, default OFF, kept for fidelity.
    if (flags.timeOfDay) {
        const h = new Date().getUTCHours();
        if (h >= 10 && h < 14 && ct === 'DIGITMATCH') {
            res = { ...res, score: Math.round(res.score * 0.8) };
            note.push('[exp]tod');
        }
    }
    // #2 contagion, #5 stepParity, #7 resistance9 intentionally NOT given a predictive
    // score boost — enabling them would encode the gambler's fallacy. They remain as
    // flags for transparency only (and, per the reference, are never actually read).

    if (res.score < 50 && res.quality === 'SIGNAL') res = { ...res, quality: 'WATCH' };
    if (note.length) res = { ...res, reasons: [...res.reasons, ...note].slice(0, 5) };
    return res;
}
