import React from 'react';
import TradingViewComponent from '@/components/trading-view-chart/trading-view';
import './tradingview.scss';

// Faithful port of the reference's #chart-modal (reference/index-335-black-bars.html, lines
// 4078-4082: an iframe pointing at a TradingView chart embed) — ported as a dashboard TAB
// (see main.tsx's id-tradingview entry) rather than the reference's own fixed-position modal
// overlay, same relocation rationale as Signal Engine/Smart Analysis/Scanner. Reuses dbot's
// own existing TradingViewComponent (src/components/trading-view-chart/trading-view.tsx,
// already wired to the Bot Builder toolbar's draggable TradingView modal) instead of
// duplicating an iframe pointing at the reference's older tradingview.binary.com domain —
// that component already embeds dbot's own production chart at charts.deriv.com, which is
// the same underlying chart, just via dbot's current URL rather than the reference's.
const TradingView = () => (
    <div className='tradingview-tab'>
        <TradingViewComponent />
    </div>
);

export default TradingView;
