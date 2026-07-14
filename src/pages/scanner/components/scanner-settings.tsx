import React from 'react';
import { observer } from 'mobx-react-lite';
import { DEFAULT_MIN_TICKS } from '@/utils/scanner/constants';
import { localize } from '@deriv-com/translations';
import { useScannerStore } from '../use-scanner-store';

// Faithful port of #scout-min-ticks (reference/index-335-black-bars.html — read at line
// 16976/22976/22983: `parseInt(el.value) || 150`). Only the min-ticks field is built here —
// scan-count, sound, relaxed-signals and % Difference mode are all deferred (see task scope
// notes); this settings panel is intentionally this small in v1.
const ScannerSettings = observer(() => {
    const scanner_store = useScannerStore();
    const { min_ticks, setMinTicks, is_scanning } = scanner_store;

    return (
        <div className='scanner__settings'>
            <label className='scanner__settings-label' htmlFor='scanner-min-ticks'>
                {localize('Minimum ticks per asset')}
            </label>
            <input
                id='scanner-min-ticks'
                type='number'
                className='scanner__settings-input'
                min={1}
                value={min_ticks}
                disabled={is_scanning}
                onChange={e => setMinTicks(parseInt(e.target.value, 10) || DEFAULT_MIN_TICKS)}
            />
        </div>
    );
});

export default ScannerSettings;
