import React from 'react';
import { observer } from 'mobx-react-lite';
import SelectNative from '@/components/shared_ui/select-native';
import { useStore } from '@/hooks/useStore';
import { TSaCategory } from '@/utils/smart-analysis/types';
import { localize } from '@deriv-com/translations';

// Faithful port of #sa-cat-select's option list (reference: index-335-black-bars.html,
// lines 4502-4505) — a static list, so (matching signal-engine-toolbar.tsx's
// TIMEFRAME_OPTIONS convention) it lives here as a page-level constant rather than a store
// computed.
const CATEGORY_OPTIONS: { value: TSaCategory; text: string }[] = [
    { value: 'volatility', text: '📈 Volatility' },
    { value: 'crash_boom', text: '💥 Crash & Boom' },
    { value: 'step', text: '📉 Step Indices' },
    { value: 'jump', text: '🚀 Jump Indices' },
];

// Faithful port of .sa-market-bar's two dropdowns — #sa-cat-select (category) and
// #sa-market-select (asset, scoped to the active category) — reference:
// index-335-black-bars.html, lines 4485-4522.
const MarketBar = observer(() => {
    const { smart_analysis } = useStore();
    const { category, symbol, symbol_options, setCategory, setSymbol } = smart_analysis;

    return (
        <div className='smart-analysis-market-bar'>
            <SelectNative
                className='smart-analysis-market-bar__select smart-analysis-market-bar__select--category'
                list_items={CATEGORY_OPTIONS}
                value={category}
                should_show_empty_option={false}
                placeholder={localize('Category')}
                onChange={e => setCategory(e.target.value as TSaCategory)}
            />
            <SelectNative
                className='smart-analysis-market-bar__select smart-analysis-market-bar__select--asset'
                list_items={symbol_options}
                value={symbol}
                should_show_empty_option={false}
                placeholder={localize('Asset')}
                onChange={e => setSymbol(e.target.value)}
            />
        </div>
    );
});

export default MarketBar;
