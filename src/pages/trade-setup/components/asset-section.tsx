import React from 'react';
import { observer } from 'mobx-react-lite';
import SelectNative from '@/components/shared_ui/select-native';
import { useStore } from '@/hooks/useStore';
import { TRADE_SETUP_CATEGORIES } from '@/stores/trade-setup-store';
import { TSaCategory } from '@/utils/smart-analysis/types';
import { localize } from '@deriv-com/translations';
import TradeSetupSection from './trade-setup-section';

// Faithful port of Trade Setup's Asset section (reference lines 5061-5130: tp-cat-select +
// tp-market-select) — category options limited to volatility/jump, see
// TRADE_SETUP_CATEGORIES's comment in trade-setup-store.ts for why.
const CATEGORY_OPTIONS: { value: TSaCategory; text: string }[] = [
    { value: 'volatility', text: '📈 Volatility' },
    { value: 'jump', text: '🚀 Jump Indices' },
].filter(o => TRADE_SETUP_CATEGORIES.includes(o.value));

const AssetSection = observer(() => {
    const { trade_setup } = useStore();
    const { category, symbol, symbol_options, setCategory, setSymbol } = trade_setup;

    return (
        <TradeSetupSection title={localize('Asset')}>
            <div className='trade-setup__asset-row'>
                <SelectNative
                    className='trade-setup__select trade-setup__select--category'
                    list_items={CATEGORY_OPTIONS}
                    value={category}
                    should_show_empty_option={false}
                    placeholder={localize('Category')}
                    onChange={e => setCategory(e.target.value as TSaCategory)}
                />
                <SelectNative
                    className='trade-setup__select trade-setup__select--asset'
                    list_items={symbol_options}
                    value={symbol}
                    should_show_empty_option={false}
                    placeholder={localize('Asset')}
                    onChange={e => setSymbol(e.target.value)}
                />
            </div>
        </TradeSetupSection>
    );
});

export default AssetSection;
