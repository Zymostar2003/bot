import React from 'react';
import { observer } from 'mobx-react-lite';
import { Localize, localize } from '@deriv-com/translations';
import { useScannerStore } from '../use-scanner-store';

// Faithful port of the scout-scan-btn / scout-stop-btn + #scout-prog-bar/#scout-prog-sym
// (reference/index-335-black-bars.html, lines 17252 and setBar() calls throughout
// _runScan, e.g. lines 16839-16846, 17012, 17047-17050). Scan-count repeat is deferred
// (v1 always scans once) so there is no "repeat in Ns…" state here.
const ScannerScanControls = observer(() => {
    const scanner_store = useScannerStore();
    const { is_scanning, progress, progress_text, scan, stop } = scanner_store;

    return (
        <div className='scanner__scan-controls'>
            <button type='button' className='scanner__scan-btn' onClick={is_scanning ? stop : scan}>
                {is_scanning ? `⏹ ${localize('Stop Scan')}` : `⚡ ${localize('Scan All Assets')}`}
            </button>
            <div className='scanner__progress'>
                <div className='scanner__progress-track'>
                    <div className='scanner__progress-fill' style={{ width: `${progress}%` }} />
                </div>
                <span className='scanner__progress-text'>
                    {progress_text || <Localize i18n_default_text='Ready to scan' />}
                </span>
            </div>
        </div>
    );
});

export default ScannerScanControls;
