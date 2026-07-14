import { TScanResult } from './types';

export type TAiAnalysis = {
    decision: string;
    watch: string;
    entryTrigger: string;
    reversalWarning: string;
};

// Faithful port of _scAIAnalyse (reference: index-335-black-bars.html, lines 17869-18014).
// Despite the reference's "🤖 Signal Analyst" branding, this was never a real AI/LLM call —
// it's deterministic template text keyed off the result's ct/dir/score/quality/barrier, so
// it ports directly as a pure function instead of needing any new state or async call.
// Structural change: returns the four content pieces as plain strings for the caller to lay
// out as JSX, instead of the reference's own innerHTML-string assembly (the emoji prefixes
// and the surrounding card chrome are the component's job, not this function's).
//
// "Find Entry Point" is mentioned in the Over/Under and Match/Differ entry-trigger copy
// faithfully, even though that feature is deferred out of this port — it's advisory strategy
// copy describing a manual entry technique the text also explains, not a literal button
// reference that breaks without the feature existing.
export function buildAiAnalysis(result: TScanResult): TAiAnalysis {
    const { ct, dir, score, quality, barrier, assetLabel, ctLabel } = result;

    let decision: string;
    if (quality === 'SIGNAL' && score >= 80) {
        decision = `Enter now — all conditions confirmed. ${assetLabel} shows a high-confidence ${ctLabel} signal (score ${score}/100).`;
    } else if (quality === 'SIGNAL') {
        decision = `Entry ready — conditions met on ${assetLabel}. Score of ${score} is solid but not peak — consider waiting for pullback entry before placing trade.`;
    } else {
        decision = `Watch only — conditions partially met on ${assetLabel}. Do not enter until live monitor shows ✅ STRONG status.`;
    }

    let watch: string;
    if (ct === 'DIGITOVER' || ct === 'DIGITUNDER') {
        const b = barrier ?? 4;
        const losingRange = ct === 'DIGITOVER' ? `0–${b}` : `${b}–9`;
        const winningRange = ct === 'DIGITOVER' ? `${b + 1}–9` : `0–${b - 1}`;
        watch = `Watch the live monitor. Losing digits (${losingRange}) including the barrier digit ${b} itself must ALL stay below 10%. If any rises above 10%, the edge is gone — stop immediately. Also monitor winning digits (${winningRange}) — any dropping below 9% signals weakening bias.`;
    } else if (ct === 'DIGITEVEN' || ct === 'DIGITODD') {
        const group = ct === 'DIGITEVEN' ? '0,2,4,6,8' : '1,3,5,7,9';
        watch = `Monitor digits (${group}). All five must remain ≥10%. If any drops below 10%, the signal weakens — do not enter or stop the bot.`;
    } else if (ct === 'CALL' || ct === 'PUT') {
        watch = `Watch for: price holding ${ct === 'CALL' ? 'above' : 'below'} EMA-8 and EMA-21, RSI staying in the ${
            ct === 'CALL' ? 'oversold recovery (<40)' : 'overbought reversal (>60)'
        } zone. A break ${ct === 'CALL' ? 'below EMA-21' : 'above EMA-21'} invalidates this signal.`;
    } else if (ct === 'DIGITMATCH') {
        const d = dir.replace('MATCH ', '');
        watch = `Digit ${d} must keep appearing at above-average rate. If it goes absent for more than 15 consecutive ticks, Poisson pressure builds — wait for it to reappear before entering again.`;
    } else {
        const d = dir.replace('DIFF ', '');
        watch = `Digit ${d} must stay cold (below 9%). If it suddenly spikes, the DIFFER edge disappears — exit immediately or skip the next trade.`;
    }

    let entryTrigger: string;
    if (ct === 'DIGITOVER' || ct === 'DIGITUNDER') {
        entryTrigger =
            'Best entry trigger: use Find Entry Point. Wait for 2–3 ticks of the suppressed side to appear (pullback), then enter on the first tick that crosses the barrier. This reduces entry risk from random digit sequences.';
    } else if (ct === 'DIGITEVEN' || ct === 'DIGITODD') {
        entryTrigger =
            'Best entry trigger: wait for 2–3 consecutive rival-parity digits (e.g. if EVEN, wait for ODD streak), then enter on the first target-parity digit. This is the optimal pullback entry for parity contracts.';
    } else if (ct === 'CALL' || ct === 'PUT') {
        entryTrigger = `Best entry trigger: a confirmed breakout to new ${
            ct === 'CALL' ? 'high' : 'low'
        } on the last digit with RSI confirming the zone, or a bounce from EMA-21 with increased tick momentum. Avoid entries mid-trend without a pullback.`;
    } else {
        entryTrigger =
            'Best entry trigger: Find Entry Point will track digit absence and fire when the hot/cold digit re-appears after an absence. Manual trigger: 3+ ticks without the target digit appearing is your green light.';
    }

    let reversalWarning: string;
    if (ct === 'DIGITOVER' || ct === 'DIGITUNDER') {
        reversalWarning =
            'Reversal warning: if 2 or more suppressed-side digits simultaneously rise above 9.5%, the suppression is breaking — stop the bot immediately and re-scan.';
    } else if (ct === 'DIGITEVEN' || ct === 'DIGITODD') {
        reversalWarning =
            'Reversal warning: if the rival group total exceeds 52% in the live monitor, the parity balance has flipped — exit and scan for the opposite contract.';
    } else if (ct === 'CALL' || ct === 'PUT') {
        reversalWarning = `Reversal warning: ${
            ct === 'CALL'
                ? '3 consecutive large FALL ticks while in trade = momentum reversal. If RSI crosses 60 bearish, the RISE is over.'
                : '3 consecutive large RISE ticks while in trade = momentum reversal. If RSI crosses 40 bullish, the FALL is over.'
        }`;
    } else {
        reversalWarning =
            'Reversal warning: if the target digit appears 3× in 20 ticks (for DIFFER) or goes absent 15+ ticks (for MATCH), the statistical regime has shifted — stop and re-scan.';
    }

    return { decision, watch, entryTrigger, reversalWarning };
}
