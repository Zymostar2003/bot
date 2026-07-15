import React, { useState } from 'react';
import classNames from 'classnames';
import { Localize } from '@deriv-com/translations';
import CalcPanel from './components/calc-panel';
import ReportPanel from './components/report-panel';
import RiskPanel from './components/risk-panel';
import './tools.scss';

type TToolsTab = 'risk' | 'calc' | 'report';

// Faithful port of #tools-overlay's content (reference/index-335-black-bars.html, lines
// 4118-4131: #tools-tabs Risk/Calc/Report + switchToolsTab) as a dashboard TAB (see
// main.tsx's id-tools entry) rather than the reference's own slide-up overlay — same
// relocation rationale as every other feature ported this session. Risk and Report reuse
// signal_engine's live full_history/candle_history (same store Digit Psychology reuses)
// rather than a dedicated store — Tools has no live data source of its own, and analyzing
// whatever asset is currently selected on Signal Engine/Digit Psychology is more useful than
// opening a third duplicate subscription for a symbol picker nothing else needs. Calc is
// fully self-contained (a pure balance -> stake/TP/SL calculator) and doesn't touch
// signal_engine at all.
const TABS: { key: TToolsTab; icon: string; label: React.ReactNode }[] = [
    { key: 'risk', icon: '🛡️', label: <Localize i18n_default_text='Risk' /> },
    { key: 'calc', icon: '🧮', label: <Localize i18n_default_text='Calc' /> },
    { key: 'report', icon: '📋', label: <Localize i18n_default_text='Report' /> },
];

const Tools = () => {
    const [active_tab, setActiveTab] = useState<TToolsTab>('risk');

    return (
        <div className='tools'>
            <div className='tools__tabs' role='tablist'>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        type='button'
                        role='tab'
                        aria-selected={active_tab === tab.key}
                        className={classNames('tools__tab', { 'tools__tab--active': active_tab === tab.key })}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        <span className='tools__tab-icon'>{tab.icon}</span>
                        <span className='tools__tab-label'>{tab.label}</span>
                    </button>
                ))}
            </div>
            <div className='tools__body'>
                {active_tab === 'risk' && <RiskPanel />}
                {active_tab === 'calc' && <CalcPanel />}
                {active_tab === 'report' && <ReportPanel />}
            </div>
        </div>
    );
};

export default Tools;
