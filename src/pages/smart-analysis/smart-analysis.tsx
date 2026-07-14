import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import ConcentrationCard from './components/concentration-card';
import ContractTypeNav from './components/contract-type-nav';
import DigitStatsPanel from './components/digit-stats-panel';
import InsightCard from './components/insight-card';
import LastFiftyPanel from './components/last-50-panel';
import LivePriceHeader from './components/live-price-header';
import MarketBar from './components/market-bar';
import ViewToggle from './components/view-toggle';
import './smart-analysis.scss';

// Faithful port of #smart-overlay's content (reference: index-335-black-bars.html, lines
// 4478-4733) as a dashboard TAB rather than a slide-up overlay — the reference opens Smart
// Analysis as a full-screen modal over the chat/chart UI; here it's mounted directly into
// dbot's `id-smart-analysis` tab (see main.tsx), so there's no open/close chrome (.sa-header,
// .sa-close, the saSlide animation) to port, only the market bar down through the insight card.
const SmartAnalysis = observer(() => {
    const { smart_analysis } = useStore();
    const { active_view } = smart_analysis;

    return (
        <div className='smart-analysis'>
            <MarketBar />
            <ContractTypeNav />
            <div className='smart-analysis__body'>
                <LivePriceHeader />
                <ViewToggle />
                {active_view === 'digits' ? <DigitStatsPanel /> : <LastFiftyPanel />}
                <ConcentrationCard />
                <InsightCard />
            </div>
        </div>
    );
});

export default SmartAnalysis;
