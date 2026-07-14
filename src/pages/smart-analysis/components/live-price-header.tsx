import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';

// Faithful port of #sa-live-price (reference: index-335-black-bars.html, line 4535 markup,
// lines 11087-11091 update logic) — the price string with its last digit highlighted.
// #00c853 (the reference's literal hex) maps to the dbot success token.
const LivePriceHeader = observer(() => {
    const { smart_analysis } = useStore();
    const { full_history, pip_size } = smart_analysis;

    const last = full_history[full_history.length - 1];
    const price_str = last ? last.price.toFixed(pip_size) : (0).toFixed(pip_size);
    const head = price_str.slice(0, -1);
    const last_digit = price_str.slice(-1);

    return (
        <h1 className='smart-analysis-live-price'>
            {head}
            <span className='smart-analysis-live-price__digit'>{last_digit}</span>
        </h1>
    );
});

export default LivePriceHeader;
