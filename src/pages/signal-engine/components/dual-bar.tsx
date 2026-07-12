import React from 'react';
import { Localize } from '@deriv-com/translations';

type TDualBarProps = {
    rise_pct: number;
};

// Faithful port of dualB (reference: reference/index-335-black-bars.html, lines 6848-6851).
const DualBar = ({ rise_pct }: TDualBarProps) => {
    const rise = Math.min(Math.max(rise_pct, 0), 100);
    const fall = 100 - rise;

    return (
        <div className='signal-engine-dual-bar'>
            <div className='signal-engine-dual-bar__track'>
                <div
                    className='signal-engine-dual-bar__fill signal-engine-dual-bar__fill--rise'
                    style={{ width: `${rise}%` }}
                />
                <div
                    className='signal-engine-dual-bar__fill signal-engine-dual-bar__fill--fall'
                    style={{ width: `${fall}%` }}
                />
            </div>
            <div className='signal-engine-dual-bar__labels'>
                <span className='signal-engine-dual-bar__label signal-engine-dual-bar__label--rise'>
                    {'▲ '}
                    <Localize i18n_default_text='RISE {{pct}}%' values={{ pct: rise.toFixed(0) }} />
                </span>
                <span className='signal-engine-dual-bar__label signal-engine-dual-bar__label--fall'>
                    <Localize i18n_default_text='FALL {{pct}}%' values={{ pct: fall.toFixed(0) }} />
                    {' ▼'}
                </span>
            </div>
        </div>
    );
};

export default DualBar;
