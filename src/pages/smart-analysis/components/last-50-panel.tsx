import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { TFullHistoryTick } from '@/utils/signal-engine/types';
import { Localize } from '@deriv-com/translations';
import DigitStrip from '../../signal-engine/components/digit-strip';
import RunMeter from '../../signal-engine/components/run-meter';
import DigitPicker from './digit-picker';

// Faithful port of #sa-view-worm — the barrier picker (Over/Under & Matches/Differs only),
// left/right percentage readout, and the 50-node rolling tick strip (reference:
// index-335-black-bars.html, lines 4616-4655 markup, 11343-11409 logic).
//
// Reuses signal-engine's DigitStrip as-is for the 50-node strip (its `getDotStyle(tick)`
// callback API matches by tick object reference — buildLast50Stats's nodes carry the exact
// tick objects from full_history, so a Map keyed by tick reference reproduces the reference's
// per-node coloring without modifying that shared component).
//
// Also surfaces proSignal's already-computed `.mtch`/`.diff` (best-match / best-differ digit,
// score, runs) via RunMeter when Matches/Differs is active — the reference's Smart Analysis
// overlay doesn't have this data-driven suggestion (it only shows the descriptive rolling
// window %), but proSignal already computes it and RunMeter already renders it, so this reuses
// both rather than leaving that scoring engine untapped for this contract type.
const LastFiftyPanel = observer(() => {
    const { smart_analysis } = useStore();
    const { last50_stats, contract_type, active_barrier, setActiveBarrier, resetActiveBarrier, pro_signal } =
        smart_analysis;

    if (!last50_stats) {
        return (
            <div className='smart-analysis-loading'>
                <Localize i18n_default_text='Gathering market data…' />
            </div>
        );
    }

    const show_barrier_picker = contract_type === 'over_under' || contract_type === 'matches_differs';
    const variant_color: Record<string, string> = {
        win: 'var(--status-success)',
        lose: 'var(--status-danger)',
        neutral: 'var(--text-less-prominent)',
    };
    const style_by_tick = new Map<TFullHistoryTick, { label: string; color: string }>(
        last50_stats.nodes.map(n => [n.tick, { label: n.label, color: variant_color[n.variant] }])
    );

    return (
        <div className='smart-analysis-last-50'>
            {show_barrier_picker && (
                <DigitPicker active_barrier={active_barrier} onSelect={setActiveBarrier} onReset={resetActiveBarrier} />
            )}

            <div className='smart-analysis-last-50__stats'>
                <div>
                    {last50_stats.left_label}: <strong>{last50_stats.left_pct}%</strong>
                </div>
                <div>
                    {last50_stats.right_label}: <strong>{last50_stats.right_pct}%</strong>
                </div>
            </div>

            <DigitStrip
                ticks={last50_stats.nodes.map(n => n.tick)}
                getDotStyle={t => style_by_tick.get(t) ?? { label: '', color: 'var(--text-less-prominent)' }}
            />

            {contract_type === 'matches_differs' && pro_signal && (
                <div className='smart-analysis-last-50__meters'>
                    <div className='smart-analysis-meter-card'>
                        <div className='smart-analysis-meter-card__title'>
                            <Localize
                                i18n_default_text='BEST MATCH — digit {{digit}}'
                                values={{ digit: pro_signal.mtch.digit }}
                            />
                        </div>
                        <RunMeter runs={pro_signal.mtch.runs} score={pro_signal.mtch.score} variant='success' />
                    </div>
                    <div className='smart-analysis-meter-card'>
                        <div className='smart-analysis-meter-card__title'>
                            <Localize
                                i18n_default_text='BEST DIFFER — digit {{digit}}'
                                values={{ digit: pro_signal.diff.digit }}
                            />
                        </div>
                        <RunMeter runs={pro_signal.diff.runs} score={pro_signal.diff.score} variant='danger' />
                    </div>
                </div>
            )}
        </div>
    );
});

export default LastFiftyPanel;
