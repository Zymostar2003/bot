import React from 'react';
import classNames from 'classnames';
import { driftOf } from '@/utils/signal-engine/pro-signal';
import { TDigitPct, TFullHistoryTick } from '@/utils/signal-engine/types';
import { heatColor } from './digit-color';

type TDigitHeatGridProps = {
    p1000: TDigitPct[];
    full_history: TFullHistoryTick[];
    highlight_digit?: number;
};

// Faithful port of the OU digit grid heatmap (reference: index-335-black-bars.html,
// lines 14150-14159) — reuses driftOf (already ported in pro-signal.ts) rather than
// recomputing per-digit drift here.
const DigitHeatGrid = ({ p1000, full_history, highlight_digit }: TDigitHeatGridProps) => (
    <div className='signal-engine-digit-heat-grid'>
        {p1000.map(({ digit, pct }) => {
            const drift = driftOf(full_history, digit);
            const arrow = drift > 0.5 ? '▲' : drift < -0.5 ? '▼' : '–';
            const is_highlighted = digit === highlight_digit;
            return (
                <div
                    key={digit}
                    className={classNames('signal-engine-digit-heat-grid__cell', {
                        'signal-engine-digit-heat-grid__cell--highlighted': is_highlighted,
                    })}
                    style={{ background: is_highlighted ? 'var(--status-warning)' : heatColor(pct) }}
                >
                    <span className='signal-engine-digit-heat-grid__digit'>{digit}</span>
                    <span className='signal-engine-digit-heat-grid__pct'>{pct.toFixed(1)}%</span>
                    <span className='signal-engine-digit-heat-grid__arrow'>{arrow}</span>
                </div>
            );
        })}
    </div>
);

export default DigitHeatGrid;
