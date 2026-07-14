import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { localize } from '@deriv-com/translations';
import { useScannerStore } from '../use-scanner-store';

// Faithful port of the scout-status-badge's states (reference/index-335-black-bars.html —
// setBadge calls at lines 16848, 16942, 17093-onward). The reference's own close button is
// not ported: Scanner is a dashboard tab now (see main.tsx's id-scanner entry), not an
// overlay, so there's no "close" action — switching tabs is how a user leaves it. `is_open`
// stays on ScannerStore unused by this component but is left intact per task scope.
//
// Sound toggle mirrors Signal Engine's own header button exactly (signal-engine.tsx) —
// same 🔊/🔇 icon-only pattern, same sound_enabled/toggleSound store shape.
const ScannerHeader = observer(() => {
    const scanner_store = useScannerStore();
    const { status, status_label, sound_enabled, toggleSound } = scanner_store;

    return (
        <div className='scanner__header'>
            <div className='scanner__header-titles'>
                <span className='scanner__header-title'>{localize('Scanner')}</span>
                <span className={classNames('scanner__badge', `scanner__badge--${status}`)}>{status_label}</span>
            </div>
            <button
                type='button'
                className='scanner__sound-toggle'
                onClick={toggleSound}
                aria-pressed={sound_enabled}
                aria-label={localize('Toggle scanner sound')}
            >
                {sound_enabled ? '🔊' : '🔇'}
            </button>
        </div>
    );
});

export default ScannerHeader;
