import { TFullHistoryTick } from '@/utils/signal-engine/types';
import { TConcentrationResult, TConcentrationSpread } from './types';

const WINDOW_SIZE = 100;
const HOT_MULTIPLIER = 1.4;
const COLD_MULTIPLIER = 0.6;
const EVEN_CHI_CEILING = 6;
const SLIGHT_CHI_CEILING = 14;

// Faithful port of saUpdateConcentration's counts / hot-cold classification / chi-square
// "unevenness" score (reference: index-335-black-bars.html, lines 11237-11341). Structural
// change: takes fullHistory as an explicit param and returns a plain result object instead of
// writing directly into the DOM — bar pixel heights are left to the component (presentational
// only), everything else (counts/pct/hot-cold status/chi/spread label) is computed here.
//
// The chi-square-style score (reference's `chi`, lines 11290-11295) is a straightforward
// 10-way sum of (count-expected)^2/expected — a different shape from pro-signal.ts's
// iframeChi2 (a 2-outcome a/b variant used for Rise/Fall and Even/Odd), so this is new
// arithmetic rather than a call to iframeChi2.
export function computeConcentration(fullHistory: TFullHistoryTick[]): TConcentrationResult | null {
    if (!fullHistory.length) return null;

    const window = fullHistory.slice(-WINDOW_SIZE);
    const counts = Array(10).fill(0);
    window.forEach(t => counts[t.digit]++);
    const n = window.length;
    const expected = n / 10;

    const bars = counts.map((count, digit) => {
        const pct = (count / n) * 100;
        const status: TConcentrationResult['bars'][number]['status'] =
            count >= expected * HOT_MULTIPLIER ? 'hot' : count <= expected * COLD_MULTIPLIER ? 'cold' : 'neutral';
        return { digit, count, pct, status };
    });

    // Strict inequality, first-occurrence-wins on ties — matches the reference's linear scan.
    let hottest_digit = 0;
    let coldest_digit = 0;
    for (let i = 1; i < 10; i++) {
        if (counts[i] > counts[hottest_digit]) hottest_digit = i;
        if (counts[i] < counts[coldest_digit]) coldest_digit = i;
    }

    let chi = 0;
    for (let d = 0; d < 10; d++) {
        const diff = counts[d] - expected;
        chi += (diff * diff) / expected;
    }
    const spread: TConcentrationSpread = chi < EVEN_CHI_CEILING ? 'even' : chi < SLIGHT_CHI_CEILING ? 'slight' : 'high';

    return {
        bars,
        chi,
        spread,
        hottest_digit,
        hottest_pct: bars[hottest_digit].pct,
        coldest_digit,
        coldest_pct: bars[coldest_digit].pct,
    };
}
