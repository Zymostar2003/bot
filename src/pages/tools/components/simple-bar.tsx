import React from 'react';
import { Localize } from '@deriv-com/translations';

type TSimpleBarProps = {
    value: number;
    color: string;
    label?: string;
};

// Faithful port of sBar (reference: index-335-black-bars.html, lines 8314-8317) — a plain
// 0-100 progress bar with an optional label + percentage readout.
const SimpleBar = ({ value, color, label }: TSimpleBarProps) => {
    const v = Math.min(Math.max(value, 0), 100);

    return (
        <div className='tools-simple-bar'>
            <div className='tools-simple-bar__track'>
                <div className='tools-simple-bar__fill' style={{ width: `${v}%`, background: color }} />
            </div>
            {label && (
                <div className='tools-simple-bar__labels'>
                    <span>{label}</span>
                    <span className='tools-simple-bar__value'>
                        <Localize i18n_default_text='{{value}}%' values={{ value: v.toFixed(1) }} />
                    </span>
                </div>
            )}
        </div>
    );
};

export default SimpleBar;
