import React from 'react';
import { observer } from 'mobx-react-lite';
import SelectNative from '@/components/shared_ui/select-native';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';

// Faithful port of the reference's mkt-bar row — #mkt-select (asset, grouped by category)
// and #tf-select (timeframe, grouped Minutes/Hours) — reference: index-335-black-bars.html,
// lines 11978-12004. changeCat/#mkt-cat (the reference's separate category-first selector)
// collapses into SelectNative's single grouped dropdown here instead of two cascading
// selects, since api_base.active_symbols already carries a real submarket_display_name per
// symbol (see SignalEngineStore.symbol_options) rather than the reference's own
// string-matched categories.
const TIMEFRAME_OPTIONS = [
    { text: '1 min', value: '60', group: localize('Minutes') },
    { text: '2 min', value: '120', group: localize('Minutes') },
    { text: '3 min', value: '180', group: localize('Minutes') },
    { text: '5 min', value: '300', group: localize('Minutes') },
    { text: '10 min', value: '600', group: localize('Minutes') },
    { text: '15 min', value: '900', group: localize('Minutes') },
    { text: '30 min', value: '1800', group: localize('Minutes') },
    { text: '1 hr', value: '3600', group: localize('Hours') },
    { text: '2 hr', value: '7200', group: localize('Hours') },
    { text: '4 hr', value: '14400', group: localize('Hours') },
    { text: '8 hr', value: '28800', group: localize('Hours') },
    { text: '24 hr', value: '86400', group: localize('Hours') },
];

const SignalEngineToolbar = observer(() => {
    const { signal_engine } = useStore();
    const { symbol, granularity, symbol_options, setSymbol, setGranularity } = signal_engine;

    return (
        <div className='signal-engine-toolbar'>
            <SelectNative
                className='signal-engine-toolbar__select signal-engine-toolbar__select--asset'
                list_items={symbol_options}
                value={symbol}
                should_show_empty_option={false}
                placeholder={localize('Asset')}
                onChange={e => setSymbol(e.target.value)}
            />
            <SelectNative
                className='signal-engine-toolbar__select signal-engine-toolbar__select--timeframe'
                list_items={TIMEFRAME_OPTIONS}
                value={String(granularity)}
                should_show_empty_option={false}
                placeholder={localize('Timeframe')}
                onChange={e => setGranularity(Number(e.target.value))}
            />
        </div>
    );
});

export default SignalEngineToolbar;
