import React from 'react';
import { observer } from 'mobx-react-lite';
import SelectNative from '@/components/shared_ui/select-native';
import { useStore } from '@/hooks/useStore';
import SignalEngineChart from '@/pages/signal-engine/components/signal-engine-chart';
import { TIMEFRAME_OPTIONS } from '@/pages/signal-engine/components/signal-engine-toolbar';
import { localize } from '@deriv-com/translations';
import { useScannerStore } from '../use-scanner-store';

// Small embedded price chart for Rise/Fall scan results — new capability, no reference
// equivalent. Reuses Signal Engine's own chart + store directly rather than building a second,
// independent chart: SignalEngineStore already actively monitors ticks/candles for some symbol
// from app startup (its connectionStatus$ subscription calls initDefaultSymbol/startMonitoring
// unconditionally in its constructor, not gated on the Signal Engine tab ever having been
// opened — see signal-engine-store.ts), so calling setSymbol here just redirects that
// already-running subscription rather than starting anything new. The asset switch is
// automatic (driven by the scan's top result); the only control surfaced here is timeframe —
// there's no reason to expose an asset picker that would just fight with the scan result.
const ScannerMiniChart = observer(() => {
    const { signal_engine } = useStore();
    const { granularity, setGranularity } = signal_engine;
    const scanner_store = useScannerStore();
    const { top_result } = scanner_store;

    const is_rise_fall = top_result?.ct === 'CALL' || top_result?.ct === 'PUT';
    const asset = top_result?.asset ?? null;

    React.useEffect(() => {
        if (is_rise_fall && asset) signal_engine.setSymbol(asset);
    }, [is_rise_fall, asset, signal_engine]);

    if (!is_rise_fall || !top_result) return null;

    return (
        <div className='scanner-mini-chart'>
            <div className='scanner-mini-chart__header'>
                <span className='scanner-mini-chart__title'>
                    {localize('📈 {{asset}}', { asset: top_result.assetLabel })}
                </span>
                <SelectNative
                    className='scanner-mini-chart__timeframe'
                    list_items={TIMEFRAME_OPTIONS}
                    value={String(granularity)}
                    should_show_empty_option={false}
                    placeholder={localize('Timeframe')}
                    onChange={e => setGranularity(Number(e.target.value))}
                />
            </div>
            <div className='scanner-mini-chart__chart'>
                <SignalEngineChart />
            </div>
        </div>
    );
});

export default ScannerMiniChart;
