import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import SelectNative from '@/components/shared_ui/select-native';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import EvenOddPanel from './components/even-odd-panel';
import OverUnderPanel from './components/over-under-panel';
import './digit-psychology.scss';

// New dashboard tab — Over/Under and Even/Odd used to live as internal tabs inside Signal
// Engine (index-335-black-bars.html's #bnav-ou/#bnav-eo); split out here into their own tab
// so Signal Engine could become a focused Rise/Fall + chart page. Deliberately reuses
// SignalEngineStore rather than a new store of its own: full_history/symbol/active_barrier/
// active_dir/ou_gating/eo_gating were already all there, tied to the SAME live tick
// subscription Signal Engine's own Rise/Fall view uses — giving this page its own store
// would mean either duplicating that subscription (double the WS traffic for the same
// symbol) or the two pages drifting out of sync on which asset they're showing. Asset
// switches made here are visible in Signal Engine too, and vice versa, which is the correct
// behaviour, not a side effect to work around: both are reading live data for the same
// selected market.
const TABS: { key: 'ou' | 'eo'; icon: string; label: React.ReactNode; accent: string }[] = [
    { key: 'ou', icon: '🔼', label: <Localize i18n_default_text='Over/Under' />, accent: 'var(--status-danger)' },
    { key: 'eo', icon: '🔢', label: <Localize i18n_default_text='Even/Odd' />, accent: 'var(--status-warning)' },
];

const DigitPsychology = observer(() => {
    const { signal_engine } = useStore();
    const { symbol, symbol_options, setSymbol, active_tab, setActiveTab } = signal_engine;

    return (
        <div className='digit-psychology'>
            <div className='digit-psychology__body'>
                <aside className='digit-psychology__sidebar'>
                    <SelectNative
                        className='digit-psychology__asset-select'
                        list_items={symbol_options}
                        value={symbol}
                        should_show_empty_option={false}
                        placeholder={localize('Asset')}
                        onChange={e => setSymbol(e.target.value)}
                    />
                    <div className='digit-psychology__tabs' role='tablist'>
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                type='button'
                                role='tab'
                                aria-selected={active_tab === tab.key}
                                className={classNames('digit-psychology__tab', {
                                    'digit-psychology__tab--active': active_tab === tab.key,
                                })}
                                style={{ '--digit-psychology-tab-accent': tab.accent } as React.CSSProperties}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                <span className='digit-psychology__tab-icon'>{tab.icon}</span>
                                <span className='digit-psychology__tab-label'>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </aside>
                <main className='digit-psychology__main'>
                    {active_tab === 'ou' && <OverUnderPanel />}
                    {active_tab === 'eo' && <EvenOddPanel />}
                </main>
            </div>
        </div>
    );
});

export default DigitPsychology;
