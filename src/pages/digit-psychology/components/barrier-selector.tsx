import React from 'react';
import classNames from 'classnames';
import { TDigitPct } from '@/utils/signal-engine/types';
import { Localize } from '@deriv-com/translations';

type TOUDirection = 'over' | 'under';

type TBarrierSelectorProps = {
    active_barrier: number;
    active_dir: TOUDirection;
    p1000: TDigitPct[];
    onSelectBarrier: (digit: number) => void;
    onSelectDir: (dir: TOUDirection) => void;
};

const DIGITS = Array.from({ length: 10 }, (_, i) => i);

// Faithful port of setDir/initOUGrid (reference: index-335-black-bars.html, lines 14075-14090)
// — the Over/Under direction toggle and the 0-9 barrier grid with live percentages. Moved
// here from src/pages/signal-engine/components (with its digit-psychology- class rename)
// when Over/Under and Even/Odd were split out of Signal Engine into their own Digit
// Psychology tab — see digit-psychology.tsx's header comment.
const BarrierSelector = ({
    active_barrier,
    active_dir,
    p1000,
    onSelectBarrier,
    onSelectDir,
}: TBarrierSelectorProps) => (
    <div className='digit-psychology-barrier-selector'>
        <div className='digit-psychology-barrier-selector__dir-toggle'>
            <button
                type='button'
                className={classNames(
                    'digit-psychology-barrier-selector__dir-btn',
                    'digit-psychology-barrier-selector__dir-btn--over',
                    {
                        'digit-psychology-barrier-selector__dir-btn--selected': active_dir === 'over',
                    }
                )}
                onClick={() => onSelectDir('over')}
            >
                <Localize i18n_default_text='Over' />
            </button>
            <button
                type='button'
                className={classNames(
                    'digit-psychology-barrier-selector__dir-btn',
                    'digit-psychology-barrier-selector__dir-btn--under',
                    {
                        'digit-psychology-barrier-selector__dir-btn--selected': active_dir === 'under',
                    }
                )}
                onClick={() => onSelectDir('under')}
            >
                <Localize i18n_default_text='Under' />
            </button>
        </div>
        <div className='digit-psychology-barrier-selector__grid'>
            {DIGITS.map(digit => (
                <button
                    key={digit}
                    type='button'
                    className={classNames('digit-psychology-barrier-selector__btn', {
                        'digit-psychology-barrier-selector__btn--selected': digit === active_barrier,
                    })}
                    onClick={() => onSelectBarrier(digit)}
                >
                    <span className='digit-psychology-barrier-selector__digit'>{digit}</span>
                    <span className='digit-psychology-barrier-selector__pct'>{p1000[digit].pct.toFixed(1)}%</span>
                </button>
            ))}
        </div>
    </div>
);

export default BarrierSelector;
