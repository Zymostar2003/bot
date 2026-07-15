import React from 'react';
import { TFullHistoryTick } from '@/utils/signal-engine/types';

type TPriceBarsProps = {
    ticks: TFullHistoryTick[];
};

// Faithful port of pBarsHTML (reference: index-335-black-bars.html, lines 8284-8298) — the
// last 20 ticks as a small bar strip, height scaled to each tick's price within that
// window's min/max range, colored by up/down direction.
const PriceBars = ({ ticks }: TPriceBarsProps) => {
    const last = ticks.slice(-20);
    if (last.length < 2) return null;

    const prices = last.map(t => t.price);
    const mn = Math.min(...prices);
    const mx = Math.max(...prices);
    const range = mx - mn || 0.001;

    return (
        <div className='tools-price-bars'>
            {last.map((t, idx) => {
                const height = Math.max(3, ((t.price - mn) / range) * 26);
                return (
                    <div
                        key={`${t.time}-${idx}`}
                        className='tools-price-bars__bar'
                        style={{
                            height: `${height}px`,
                            background: t.diff >= 0 ? 'var(--status-success)' : 'var(--status-danger)',
                        }}
                    />
                );
            })}
        </div>
    );
};

export default PriceBars;
