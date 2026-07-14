import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { Localize } from '@deriv-com/translations';

const DIGITS = Array.from({ length: 10 }, (_, i) => i);

// Faithful port of #sa-digit-panel / saUpdateDigitRanks / saMoveCursor (reference:
// index-335-black-bars.html, lines 4585-4613 markup, 11173-11218/11411-11450 logic) — the
// "Digit Stats" view: 10 ranked digit circles with a cursor over the latest tick's digit.
//
// Structural change: the reference measures the target circle's DOM position with
// offsetLeft/offsetWidth (saMoveCursor) to place one shared absolutely-positioned cursor
// element. That's replaced here with a cursor rendered inside whichever digit cell is
// currently active — declarative, no DOM measurement, and correct at any grid width.
const DigitStatsPanel = observer(() => {
    const { smart_analysis } = useStore();
    const { digit_pcts, digit_ranks, full_history } = smart_analysis;

    if (!full_history.length) {
        return (
            <div className='smart-analysis-loading'>
                <Localize i18n_default_text='Gathering market data…' />
            </div>
        );
    }

    const current_digit = full_history[full_history.length - 1].digit;

    return (
        <div className='smart-analysis-digit-panel'>
            {DIGITS.map(digit => {
                const rank = digit_ranks[digit]?.tier ?? 'none';
                const pct = digit_pcts[digit]?.pct ?? 0;
                return (
                    <div key={digit} className='smart-analysis-digit-panel__cell'>
                        {digit === current_digit && (
                            <div className='smart-analysis-digit-panel__cursor' aria-hidden='true' />
                        )}
                        <div
                            className={classNames('smart-analysis-digit-panel__circle', {
                                [`smart-analysis-digit-panel__circle--${rank}`]: rank !== 'none',
                            })}
                        >
                            {digit}
                        </div>
                        <span className='smart-analysis-digit-panel__pct'>{pct.toFixed(1)}%</span>
                    </div>
                );
            })}
        </div>
    );
});

export default DigitStatsPanel;
