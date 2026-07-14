import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import ScannerApplyDialog from './components/scanner-apply-dialog';
import ScannerHeader from './components/scanner-header';
import ScannerResults from './components/scanner-results';
import ScannerScanControls from './components/scanner-scan-controls';
import ScannerSettings from './components/scanner-settings';
import ScannerTabs from './components/scanner-tabs';
import { useScannerStore } from './use-scanner-store';
import './scanner.scss';

// Faithful port of #scanner-overlay's content (reference/index-335-black-bars.html) as a
// dashboard TAB (see main.tsx's id-scanner entry) rather than the reference's own fixed
// full-viewport overlay — mounted/unmounted by Tabs' active-tab switching, same as
// SignalEngine/SmartAnalysis. ScannerStore.is_open/setOpen predate this relocation (from
// when Scanner was opened via a toolbar icon) and are unused here now, but are left intact
// per task scope — this component still doesn't read or gate on them.
const Scanner = observer(() => {
    const scanner_store = useScannerStore();

    // The live digit monitor (ScannerStore.startLiveDigitMonitor) opens its own persistent
    // tick subscription independent of scan()'s lifecycle — it must be torn down when the
    // Scanner tab unmounts, or it keeps streaming ticks for a symbol nobody's looking at.
    useEffect(() => {
        return () => scanner_store.stopLiveDigitMonitor();
    }, [scanner_store]);

    return (
        <div className='scanner'>
            <ScannerHeader />
            <div className='scanner__body'>
                <ScannerTabs />
                <ScannerSettings />
                <ScannerScanControls />
                <ScannerResults />
            </div>
            <ScannerApplyDialog />
        </div>
    );
});

export default Scanner;
