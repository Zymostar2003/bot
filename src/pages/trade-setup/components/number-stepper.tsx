import React from 'react';

type TNumberStepperProps = {
    value: number | null;
    min: number;
    max: number;
    step: number;
    placeholder?: string;
    onChange: (value: number) => void;
};

// Faithful port of Trade Setup's .tp-stepper (−/input/+) pattern (reference:
// index-335-black-bars.html — e.g. tpStepField/bpc-mart at lines 5372-5392) — reused across
// Stake custom input, Martingale, Take Profit, and Stop Loss fields instead of repeating the
// three-element markup per field.
const NumberStepper = ({ value, min, max, step, placeholder, onChange }: TNumberStepperProps) => {
    const clamp = (next: number) => Math.min(max, Math.max(min, next));

    return (
        <div className='trade-setup__stepper'>
            <button
                type='button'
                className='trade-setup__step-btn'
                onClick={() => onChange(clamp((value ?? 0) - step))}
            >
                −
            </button>
            <input
                type='number'
                min={min}
                max={max}
                step={step}
                value={value ?? ''}
                placeholder={placeholder}
                onChange={e => onChange(e.target.value === '' ? 0 : clamp(parseFloat(e.target.value)))}
            />
            <button
                type='button'
                className='trade-setup__step-btn'
                onClick={() => onChange(clamp((value ?? 0) + step))}
            >
                +
            </button>
        </div>
    );
};

export default NumberStepper;
