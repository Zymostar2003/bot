import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import TradeSetupSection from './trade-setup-section';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// Faithful port of Trade Setup's Digit section (reference lines 5304-5345) — only rendered
// for contract types that need a prediction digit (Match/Differ/Over/Under), matching the
// reference's tp-digit-section conditional visibility.
const DigitSection = observer(() => {
    const { trade_setup } = useStore();
    const { digit, needs_digit, setDigit } = trade_setup;

    if (!needs_digit) return null;

    return (
        <TradeSetupSection title={localize('Digit (Match / Over / Under / Differ)')}>
            <div className='trade-setup__chips'>
                {DIGITS.map(d => (
                    <button
                        key={d}
                        type='button'
                        className={classNames('trade-setup__chip', { 'trade-setup__chip--active': d === digit })}
                        onClick={() => setDigit(d)}
                    >
                        {d}
                    </button>
                ))}
            </div>
        </TradeSetupSection>
    );
});

export default DigitSection;
