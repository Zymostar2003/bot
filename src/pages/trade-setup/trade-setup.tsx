import React from 'react';
import { observer } from 'mobx-react-lite';
import AdvancedSection from './components/advanced-section';
import AssetSection from './components/asset-section';
import ContractSection from './components/contract-section';
import DigitSection from './components/digit-section';
import DurationSection from './components/duration-section';
import FabToggleSection from './components/fab-toggle-section';
import RunButton from './components/run-button';
import StakeSection from './components/stake-section';
import './trade-setup.scss';

// Faithful port of #trade-setup-panel's content (reference/index-335-black-bars.html, lines
// 5053-6076) as a dashboard TAB (see main.tsx's id-trade-setup entry) rather than the
// reference's own slide-up bottom-sheet panel — same relocation rationale as Signal Engine/
// Smart Analysis/Scanner/TradingView. Bot Mode toggle, connection/token setup, Test
// Connection, and live bot stats (reference lines 5570-5673) are not ported: dbot is already
// connected/authenticated app-wide, and once the bot runs, its stats already show in the
// existing Run Panel/Transactions/Journal — duplicating them here would be redundant.
const TradeSetup = observer(() => {
    return (
        <div className='trade-setup'>
            <div className='trade-setup__scroll'>
                <FabToggleSection />
                <AssetSection />
                <ContractSection />
                <DurationSection />
                <StakeSection />
                <DigitSection />
                <AdvancedSection />
                <RunButton />
            </div>
        </div>
    );
});

export default TradeSetup;
