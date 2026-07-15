import React, { useState } from 'react';
import classNames from 'classnames';
import { calcFromBalance } from '@/utils/tools/calc';
import { Localize } from '@deriv-com/translations';

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '⌫'];

// Faithful port of the Calc tab's keypad risk calculator (reference: index-335-black-bars.html,
// _kcPress/_kcRender, lines 14925-15021) — type an account balance, instantly see 2% stake /
// ×2 martingale / 10% take profit / 30% stop loss. Fully self-contained (no live tick data
// needed), so — unlike Risk/Report — this doesn't touch signal_engine at all.
const CalcPanel = () => {
    const [value, setValue] = useState('30');

    const press = (key: string) => {
        if (key === 'C') {
            setValue('0');
        } else if (key === '⌫') {
            setValue(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
        } else {
            setValue(prev => {
                if (prev === '0') return key;
                if (prev.length < 9) return prev + key;
                return prev;
            });
        }
    };

    const balance = parseFloat(value) || 0;
    const result = calcFromBalance(balance);
    // Trims trailing zeros on stake like the reference ($0.6 not $0.60).
    const stake_text = (+result.stake.toFixed(2)).toString();

    return (
        <div className='tools-calc-panel'>
            <div className='tools-calc-panel__intro'>
                <Localize i18n_default_text='Calculate optimal stakes and manage risk effectively' />
            </div>
            <div className='tools-calc-panel__display'>
                <span className='tools-calc-panel__display-currency'>$</span>
                <span className='tools-calc-panel__display-value'>{value}</span>
            </div>
            <div className='tools-calc-panel__keypad'>
                {KEYS.map(key => (
                    <button
                        key={key}
                        type='button'
                        className={classNames('tools-calc-panel__key', {
                            'tools-calc-panel__key--clear': key === 'C',
                            'tools-calc-panel__key--backspace': key === '⌫',
                        })}
                        onClick={() => press(key)}
                    >
                        {key}
                    </button>
                ))}
            </div>
            <div className='tools-calc-panel__results'>
                <div className='tools-calc-panel__result-row'>
                    <span>
                        {'💰 '}
                        <Localize i18n_default_text='Stake:' />
                    </span>
                    <span className='tools-calc-panel__result-value tools-calc-panel__result-value--success'>
                        ${stake_text}
                    </span>
                </div>
                <div className='tools-calc-panel__result-row'>
                    <span>
                        {'📈 '}
                        <Localize i18n_default_text='Martingale Size:' />
                    </span>
                    <span className='tools-calc-panel__result-value'>x{result.martingale}</span>
                </div>
                <div className='tools-calc-panel__result-row'>
                    <span>
                        {'⬆️ '}
                        <Localize i18n_default_text='Take Profit:' />
                    </span>
                    <span className='tools-calc-panel__result-value tools-calc-panel__result-value--success'>
                        ${result.takeProfit.toFixed(2)}
                    </span>
                </div>
                <div className='tools-calc-panel__result-row tools-calc-panel__result-row--last'>
                    <span>
                        {'⬇️ '}
                        <Localize i18n_default_text='Stop Loss:' />
                    </span>
                    <span className='tools-calc-panel__result-value tools-calc-panel__result-value--danger'>
                        ${result.stopLoss.toFixed(2)}
                    </span>
                </div>
            </div>
            <div className='tools-calc-panel__hint'>
                <Localize i18n_default_text='Stake 2% · TP 10% · SL 30% of balance' />
            </div>
        </div>
    );
};

export default CalcPanel;
