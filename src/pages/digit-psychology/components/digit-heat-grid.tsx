import React from 'react';
import classNames from 'classnames';
import { heatColor } from '@/pages/signal-engine/components/digit-color';
import { driftOf } from '@/utils/signal-engine/pro-signal';
import { TDigitPct, TFullHistoryTick } from '@/utils/signal-engine/types';

type TDigitHeatGridProps = {
    p1000: TDigitPct[];
    full_history: TFullHistoryTick[];
    highlight_digit?: number;
};

// Faithful port of the OU digit grid heatmap (reference: index-335-black-bars.html,
// lines 14150-14159) — reuses driftOf (pro-signal.ts) and heatColor (digit-color.ts, still
// shared from its original Signal Engine location — Scanner's own live-digits panel imports
// it from there too, see scanner-live-digits.tsx) rather than duplicating either. Moved here
// from src/pages/signal-engine/components (with its digit-psychology- class rename) when
// Over/Under and Even/Odd were split out of Signal Engine into their own Digit Psychology
// tab — see digit-psychology.tsx's header comment.
const DigitHeatGrid = ({ p1000, full_history, highlight_digit }: TDigitHeatGridProps) => (
    <div className='digit-psychology-digit-heat-grid'>
        {p1000.map(({ digit, pct }) => {
            const drift = driftOf(full_history, digit);
            const arrow = drift > 0.5 ? '▲' : drift < -0.5 ? '▼' : '–';
            const is_highlighted = digit === highlight_digit;
            return (
                <div
                    key={digit}
                    className={classNames('digit-psychology-digit-heat-grid__cell', {
                        'digit-psychology-digit-heat-grid__cell--highlighted': is_highlighted,
                    })}
                    style={{ background: is_highlighted ? 'var(--status-warning)' : heatColor(pct) }}
                >
                    <span className='digit-psychology-digit-heat-grid__digit'>{digit}</span>
                    <span className='digit-psychology-digit-heat-grid__pct'>{pct.toFixed(1)}%</span>
                    <span className='digit-psychology-digit-heat-grid__arrow'>{arrow}</span>
                </div>
            );
        })}
    </div>
);

export default DigitHeatGrid;
