import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import RiseFallPanel from './components/rise-fall-panel';
import './signal-engine.scss';

// Page shell for the Signal Engine tab. Only the Rise/Fall tab is implemented so far —
// Even/Odd and Over/Under (reference's other `activeTab` branches, renderEO/renderOU) are
// a later step.
const SignalEngine = observer(() => {
    const { signal_engine } = useStore();
    const { symbol, sound_enabled, toggleSound } = signal_engine;

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
            <RiseFallPanel />
        </div>
    );
});

export default SignalEngine;
