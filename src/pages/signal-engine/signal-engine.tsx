import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import EvenOddPanel from './components/even-odd-panel';
import OverUnderPanel from './components/over-under-panel';
import RiseFallPanel from './components/rise-fall-panel';
import './signal-engine.scss';

// Faithful port of the reference's bottom nav / setTab (index-335-black-bars.html, lines
// 12146-12156, 12234-12248) — an internal tab switcher within the Signal Engine page, not
// separate dashboard-level tabs. TABS order/icons/accent colors match the reference; accent
// colors are dbot design tokens (status-success/danger/warning) rather than the reference's
// literal hex, consistent with the rest of this port.
const TABS: { key: 'rf' | 'ou' | 'eo'; icon: string; label: React.ReactNode; accent: string }[] = [
    { key: 'rf', icon: '📈', label: <Localize i18n_default_text='Rise/Fall' />, accent: 'var(--status-success)' },
    { key: 'ou', icon: '🔼', label: <Localize i18n_default_text='Over/Under' />, accent: 'var(--status-danger)' },
    { key: 'eo', icon: '🔢', label: <Localize i18n_default_text='Even/Odd' />, accent: 'var(--status-warning)' },
];

const SignalEngine = observer(() => {
    const { signal_engine } = useStore();
    const { symbol, sound_enabled, toggleSound, active_tab, setActiveTab } = signal_engine;

    return (
        <div className='signal-engine'>
            <div className='signal-engine__header'>
                <span className='signal-engine__symbol'>{symbol || localize('Loading…')}</span>
                <button
                    type='button'
                    className='signal-engine__sound-toggle'
                    onClick={toggleSound}
                    aria-pressed={sound_enabled}
                    aria-label={localize('Toggle signal sound')}
                >
                    {sound_enabled ? '🔊' : '🔇'}
                </button>
            </div>
            <div className='signal-engine__tabs' role='tablist'>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        type='button'
                        role='tab'
                        aria-selected={active_tab === tab.key}
                        className={classNames('signal-engine__tab', {
                            'signal-engine__tab--active': active_tab === tab.key,
                        })}
                        style={{ '--signal-engine-tab-accent': tab.accent } as React.CSSProperties}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        <span className='signal-engine__tab-icon'>{tab.icon}</span>
                        <span className='signal-engine__tab-label'>{tab.label}</span>
                    </button>
                ))}
            </div>
            {active_tab === 'rf' && <RiseFallPanel />}
            {active_tab === 'ou' && <OverUnderPanel />}
            {active_tab === 'eo' && <EvenOddPanel />}
        </div>
    );
});

export default SignalEngine;
