import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { STAKE_PRESETS } from '@/stores/trade-setup-store';
import { Localize, localize } from '@deriv-com/translations';
import NumberStepper from './number-stepper';
import TradeSetupSection from './trade-setup-section';

// Faithful port of Trade Setup's Stake section (reference lines 5269-5300: preset grid +
// custom stepper input).
const StakeSection = observer(() => {
    const { trade_setup } = useStore();
    const { stake, setStake } = trade_setup;

    return (
        <TradeSetupSection title={localize('Stake (USD)')}>
            <div className='trade-setup__stake-grid'>
                {STAKE_PRESETS.map(preset => (
                    <button
                        key={preset}
                        type='button'
                        className={classNames('trade-setup__stake-btn', {
                            'trade-setup__stake-btn--active': stake === preset,
                        })}
                        onClick={() => setStake(preset)}
                    >
                        ${preset.toFixed(2)}
                    </button>
                ))}
            </div>
            <div className='trade-setup__custom-row'>
                <span className='trade-setup__lbl'>
                    <Localize i18n_default_text='Custom:' />
                </span>
                <NumberStepper value={stake} min={0.35} max={50000} step={0.5} onChange={setStake} />
            </div>
        </TradeSetupSection>
    );
});

export default StakeSection;
