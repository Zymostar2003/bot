import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import RiseFallPanel from './components/rise-fall-panel';
import SignalEngineToolbar from './components/signal-engine-toolbar';
import './signal-engine.scss';

// Faithful port of the reference's Rise/Fall view (index-335-black-bars.html, lines
// 12146-12156, 12234-12248) — Signal Engine used to also host Over/Under and Even/Odd as
// internal tabs here, but those were split out into their own "Digit Psychology" dashboard
// tab (src/pages/digit-psychology), so this page is Rise/Fall only now and no longer needs
// its own tab switcher. Over/Under and Even/Odd's panels still read live tick data from THIS
// store (signal_engine) rather than a separate one — see digit-psychology.tsx's header
// comment for why.
const SignalEngine = observer(() => {
    const { signal_engine } = useStore();
    const { sound_enabled, toggleSound } = signal_engine;

    return (
        <div className='signal-engine'>
            <div className='signal-engine__body'>
                <aside className='signal-engine__sidebar'>
                    <SignalEngineToolbar />
                    <button
                        type='button'
                        className='signal-engine__sound-toggle'
                        onClick={toggleSound}
                        aria-pressed={sound_enabled}
                        aria-label={localize('Toggle signal sound')}
                    >
                        {sound_enabled ? '🔊' : '🔇'}
                    </button>
                </aside>
                <main className='signal-engine__main'>
                    <RiseFallPanel />
                </main>
            </div>
        </div>
    );
});

export default SignalEngine;
