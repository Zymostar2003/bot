import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import NumberStepper from './number-stepper';
import TradeSetupSection from './trade-setup-section';

// Faithful port of Trade Setup's "⚙️ Advanced — Bot Controls" section (reference lines
// 5348-5443: Martingale/Take Profit/Stop Loss). Max Loss Streak, Daily Loss limit, Trade
// Delay, and Wait-for-candle-close (reference lines 5444-5566) are deferred — dbot's Quick
// Strategy engine (which Run Bot routes into, see TradeSetupStore.runBot) has no equivalent
// fields for any of those; porting them would mean extending the underlying bot engine
// itself rather than this configuration panel, which was explicitly out of scope for this
// pass (see task notes: "same panel UI, routes into dbot's engine").
const AdvancedSection = observer(() => {
    const { trade_setup } = useStore();
    const { martingale_size, take_profit, stop_loss, setMartingaleSize, setTakeProfit, setStopLoss } = trade_setup;

    return (
        <TradeSetupSection title={`⚙️ ${localize('Advanced — Bot Controls')}`}>
            <div className='trade-setup__bot-row'>
                <span className='trade-setup__lbl'>
                    <Localize i18n_default_text='Martingale ×' />
                </span>
                <NumberStepper value={martingale_size} min={1} max={10} step={0.5} onChange={setMartingaleSize} />
            </div>
            <div className='trade-setup__hint'>
                <Localize i18n_default_text='1 = flat stake · 2 = double after loss' />
            </div>

            <div className='trade-setup__bot-row'>
                <span className='trade-setup__lbl trade-setup__lbl--success'>
                    <Localize i18n_default_text='Take Profit $' />
                </span>
                <NumberStepper
                    value={take_profit}
                    min={0}
                    max={999999}
                    step={0.5}
                    placeholder='e.g. 10.00'
                    onChange={setTakeProfit}
                />
            </div>

            <div className='trade-setup__bot-row'>
                <span className='trade-setup__lbl trade-setup__lbl--danger'>
                    <Localize i18n_default_text='Stop Loss $' />
                </span>
                <NumberStepper
                    value={stop_loss}
                    min={0}
                    max={999999}
                    step={0.5}
                    placeholder='e.g. 25.00'
                    onChange={setStopLoss}
                />
            </div>
        </TradeSetupSection>
    );
});

export default AdvancedSection;
