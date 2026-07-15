import React from 'react';
import { TFullHistoryTick } from '@/utils/signal-engine/types';

type TDigitStripProps = {
    ticks: TFullHistoryTick[];
    getDotStyle: (tick: TFullHistoryTick) => { label: string; color: string };
};

// Faithful port of wormDigitHTML / wormParityHTML — same "last N ticks as a strip of
// colored dots" shape, parameterized by dot color/label instead of duplicated per tab
// (reference: index-335-black-bars.html, lines 13601-13619). Shared across pages — reused
// as-is (not moved/renamed) by Digit Psychology's Over/Under and Even/Odd panels
// (src/pages/digit-psychology/components) and Smart Analysis's Last 50 panel
// (last-50-panel.tsx duplicates this component's CSS into smart-analysis.scss for the same
// cross-page-bundle reason Digit Psychology's own scss does).
const DigitStrip = ({ ticks, getDotStyle }: TDigitStripProps) => {
    if (!ticks.length) return null;
    return (
        <div className='signal-engine-digit-strip'>
            {ticks.map((t, idx) => {
                const { label, color } = getDotStyle(t);
                return (
                    <div
                        key={`${t.time}-${idx}`}
                        className='signal-engine-digit-strip__dot'
                        style={{ background: color }}
                    >
                        {label}
                    </div>
                );
            })}
        </div>
    );
};

export default DigitStrip;
