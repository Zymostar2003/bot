import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { MINUTE_DURATIONS, TICK_DURATIONS } from '@/stores/trade-setup-store';
import { Localize, localize } from '@deriv-com/translations';
import TradeSetupSection from './trade-setup-section';

// Faithful port of Trade Setup's Duration section (reference lines 5205-5237: a Ticks row
// for digit/tick contracts, a Minutes row for candle-based Rise/Fall).
const DurationSection = observer(() => {
    const { trade_setup } = useStore();
    const { duration_value, duration_unit, setDuration } = trade_setup;

    return (
        <TradeSetupSection title={localize('Duration')}>
            <div className='trade-setup__dur-sub'>
                <Localize i18n_default_text='Ticks' />
            </div>
            <div className='trade-setup__dur-row'>
                {TICK_DURATIONS.map(d => (
                    <button
                        key={`t-${d}`}
                        type='button'
                        className={classNames('trade-setup__dur-btn', {
                            'trade-setup__dur-btn--active': duration_unit === 't' && duration_value === d,
                        })}
                        onClick={() => setDuration(d, 't')}
                    >
                        {d}
                    </button>
                ))}
            </div>
            <div className='trade-setup__dur-sub'>
                <Localize i18n_default_text='Minutes' />
            </div>
            <div className='trade-setup__dur-row'>
                {MINUTE_DURATIONS.map(d => (
                    <button
                        key={`m-${d}`}
                        type='button'
                        className={classNames('trade-setup__dur-btn', {
                            'trade-setup__dur-btn--active': duration_unit === 'm' && duration_value === d,
                        })}
                        onClick={() => setDuration(d, 'm')}
                    >
                        {d}m
                    </button>
                ))}
            </div>
        </TradeSetupSection>
    );
});

export default DurationSection;
