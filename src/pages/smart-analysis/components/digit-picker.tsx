import React from 'react';
import classNames from 'classnames';
import { Localize } from '@deriv-com/translations';

type TDigitPickerProps = {
    active_barrier: number | null;
    onSelect: (digit: number) => void;
    onReset: () => void;
};

const DIGITS = Array.from({ length: 10 }, (_, i) => i);

// Own simpler barrier-digit picker for Smart Analysis's Last 50 view — inspired by
// signal-engine's barrier-selector.tsx visual pattern (0-9 grid + reset button) but without
// its Over/Under direction toggle, which Smart Analysis's barrier picker doesn't need (it's
// used for both Over/Under and Matches/Differs here). Faithful port of saSetupDigitGrid's
// #sa-barrier-panel buttons + reset ("X") button (reference: index-335-black-bars.html,
// lines 11177-11209).
const DigitPicker = ({ active_barrier, onSelect, onReset }: TDigitPickerProps) => (
    <div className='smart-analysis-digit-picker'>
        {DIGITS.map(digit => (
            <button
                key={digit}
                type='button'
                className={classNames('smart-analysis-digit-picker__btn', {
                    'smart-analysis-digit-picker__btn--selected': digit === active_barrier,
                })}
                onClick={() => onSelect(digit)}
            >
                {digit}
            </button>
        ))}
        <button
            type='button'
            className='smart-analysis-digit-picker__btn smart-analysis-digit-picker__btn--reset'
            onClick={onReset}
            aria-label='Reset barrier'
        >
            <Localize i18n_default_text='X' />
        </button>
    </div>
);

export default DigitPicker;
