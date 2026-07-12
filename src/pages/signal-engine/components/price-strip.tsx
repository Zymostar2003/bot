import React from 'react';
import classNames from 'classnames';
import { TFullHistoryTick } from '@/utils/signal-engine/types';

type TPriceStripProps = {
    ticks: TFullHistoryTick[];
};

const STRIP_HEIGHT = 28;

// Faithful port of pstripHTML (reference: reference/index-335-black-bars.html, lines 6862-6865).
const PriceStrip = ({ ticks }: TPriceStripProps) => {
    if (!ticks.length) return null;
    const prices = ticks.map(t => t.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 0.001;

    return (
        <div className='signal-engine-price-strip'>
            {ticks.map((t, idx) => (
                <div
                    key={`${t.time}-${idx}`}
                    className={classNames('signal-engine-price-strip__bar', {
                        'signal-engine-price-strip__bar--rise': t.diff >= 0,
                        'signal-engine-price-strip__bar--fall': t.diff < 0,
                    })}
                    style={{ height: `${Math.max(3, ((t.price - min) / range) * STRIP_HEIGHT)}px` }}
                />
            ))}
        </div>
    );
};

export default PriceStrip;
