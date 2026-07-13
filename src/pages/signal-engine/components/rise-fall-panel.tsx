import React from 'react';
import { observer } from 'mobx-react-lite';
import SignalEngineChart from './signal-engine-chart';

// Signal-generating UI (rise/fall group boxes, VFPI bias badge, run meter, price strip,
// dual bar) has been removed — this panel now shows only the shared chart. The underlying
// store computed (rf_gating, pro_signal) and components (group-box.tsx, run-meter.tsx,
// price-strip.tsx, dual-bar.tsx, bias-badge.tsx) are left intact and unused in case this UI
// is restored later.
const RiseFallPanel = observer(() => (
    <div className='signal-engine-rf-panel'>
        <SignalEngineChart />
    </div>
));

export default RiseFallPanel;
