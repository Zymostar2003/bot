import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { TScannerFilterTab } from '@/utils/scanner/types';
import { Localize } from '@deriv-com/translations';
import { useScannerStore } from '../use-scanner-store';

// Filter-tab switcher — reuses the icon+label button visual pattern established by Signal
// Engine's own tab switcher (src/pages/signal-engine/signal-engine.tsx's TABS array +
// .signal-engine__tab, dbot design tokens for the active accent colour) but is its own
// scanner-scoped component/markup, not an import of Signal Engine's. Faithful port of the
// reference's per-tab ctsFilter passed to window._scout.scanFor (reference lines
// 22981-22990) — see FILTER_TAB_CONTRACT_TYPES.
const TABS: { key: TScannerFilterTab; icon: string; label: React.ReactNode; accent: string }[] = [
    { key: 'all', icon: '🧭', label: <Localize i18n_default_text='All' />, accent: 'var(--text-prominent)' },
    { key: 'eo', icon: '🔢', label: <Localize i18n_default_text='Even/Odd' />, accent: 'var(--status-warning)' },
    { key: 'ou', icon: '🔼', label: <Localize i18n_default_text='Over/Under' />, accent: 'var(--status-danger)' },
    { key: 'rf', icon: '📈', label: <Localize i18n_default_text='Rise/Fall' />, accent: 'var(--status-success)' },
    { key: 'md', icon: '🎯', label: <Localize i18n_default_text='Match/Differ' />, accent: 'var(--status-info)' },
];

const ScannerTabs = observer(() => {
    const scanner_store = useScannerStore();
    const { active_tab, setActiveTab } = scanner_store;

    return (
        <div className='scanner__tabs' role='tablist'>
            {TABS.map(tab => (
                <button
                    key={tab.key}
                    type='button'
                    role='tab'
                    aria-selected={active_tab === tab.key}
                    className={classNames('scanner__tab', { 'scanner__tab--active': active_tab === tab.key })}
                    style={{ '--scanner-tab-accent': tab.accent } as React.CSSProperties}
                    onClick={() => setActiveTab(tab.key)}
                >
                    <span className='scanner__tab-icon'>{tab.icon}</span>
                    <span className='scanner__tab-label'>{tab.label}</span>
                </button>
            ))}
        </div>
    );
});

export default ScannerTabs;
