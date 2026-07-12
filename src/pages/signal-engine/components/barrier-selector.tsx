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
// — the Over/Under direction toggle and the 0-9 barrier grid with live percentages.
const BarrierSelector = ({
    active_barrier,
    active_dir,
    p1000,
    onSelectBarrier,
    onSelectDir,
}: TBarrierSelectorProps) => (
    <div className='signal-engine-barrier-selector'>
        <div className='signal-engine-barrier-selector__dir-toggle'>
            <button
                type='button'
                className={classNames(
                    'signal-engine-barrier-selector__dir-btn',
                    'signal-engine-barrier-selector__dir-btn--over',
                    {
                        'signal-engine-barrier-selector__dir-btn--selected': active_dir === 'over',
                    }
                )}
                onClick={() => onSelectDir('over')}
            >
                <Localize i18n_default_text='Over' />
            </button>
            <button
                type='button'
                className={classNames(
                    'signal-engine-barrier-selector__dir-btn',
                    'signal-engine-barrier-selector__dir-btn--under',
                    {
                        'signal-engine-barrier-selector__dir-btn--selected': active_dir === 'under',
                    }
                )}
                onClick={() => onSelectDir('under')}
            >
                <Localize i18n_default_text='Under' />
            </button>
        </div>
        <div className='signal-engine-barrier-selector__grid'>
            {DIGITS.map(digit => (
                <button
                    key={digit}
                    type='button'
                    className={classNames('signal-engine-barrier-selector__btn', {
                        'signal-engine-barrier-selector__btn--selected': digit === active_barrier,
                    })}
                    onClick={() => onSelectBarrier(digit)}
                >
                    <span className='signal-engine-barrier-selector__digit'>{digit}</span>
                    <span className='signal-engine-barrier-selector__pct'>{p1000[digit].pct.toFixed(1)}%</span>
                </button>
            ))}
        </div>
    </div>
);

export default BarrierSelector;
