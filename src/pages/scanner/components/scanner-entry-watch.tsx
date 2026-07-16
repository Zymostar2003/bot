import React from 'react';
import { observer } from 'mobx-react-lite';
import { isConfirmTick, isPullbackTick } from '@/utils/scanner/entry-point';
import { Localize } from '@deriv-com/translations';
import DigitStrip from '../../signal-engine/components/digit-strip';
import { useScannerStore } from '../use-scanner-store';

// Live status card for ScannerStore.entry_watch — new capability, no direct reference
// equivalent as a component (the reference renders this inline via _scRenderEntry, reference
// lines around 21326+). Reuses signal-engine's DigitStrip (its own CSS duplicated into
// scanner.scss below, same per-page-bundle rationale as scanner-live-digits.tsx's own
// duplicated heat-grid styling) to show the last 12 live ticks, colored by what phase of the
// pullback/confirm state machine each one represents.
const PHASE_LABEL: Record<string, string> = {
    waiting: '⏳ Waiting for pullback…',
    pullback: '↩️ Pullback in progress…',
    digit_hunt: '🎯 Hunting entry digit…',
    found: '⚡ Entry found!',
};

const ScannerEntryWatch = observer(() => {
    const scanner_store = useScannerStore();
    const { entry_watch, entry_watch_description, stopEntryWatch } = scanner_store;

    if (!entry_watch) return null;
    const { result, phase, pullbacks, entry_digit, recent_ticks } = entry_watch;

    return (
        <div className='scanner-entry-watch'>
            <div className='scanner-entry-watch__header'>
                <span className='scanner-entry-watch__title'>
                    <Localize
                        i18n_default_text='🎯 Finding entry — {{asset}} {{ct}}'
                        values={{ asset: result.assetLabel, ct: result.ctLabel }}
                    />
                </span>
                <button type='button' className='scanner-entry-watch__cancel' onClick={stopEntryWatch}>
                    <Localize i18n_default_text='Cancel' />
                </button>
            </div>
            <div className='scanner-entry-watch__phase'>{PHASE_LABEL[phase] ?? PHASE_LABEL.waiting}</div>
            <div className='scanner-entry-watch__desc'>{entry_watch_description}</div>
            {phase === 'pullback' && (
                <div className='scanner-entry-watch__progress'>
                    <Localize i18n_default_text='Pullback ticks: {{count}}' values={{ count: pullbacks }} />
                </div>
            )}
            {phase === 'digit_hunt' && entry_digit && (
                <div className='scanner-entry-watch__progress'>
                    <Localize i18n_default_text='Hunting: {{label}}' values={{ label: entry_digit.label }} />
                </div>
            )}
            {!!recent_ticks.length && (
                <DigitStrip
                    ticks={recent_ticks}
                    getDotStyle={t => {
                        // Rise/Fall is a price-direction contract, not a digit contract — the
                        // digit a tick happens to end in is meaningless here, so label each
                        // dot by direction (R/F) instead of the digit itself.
                        const is_rise_fall = result.ct === 'CALL' || result.ct === 'PUT';
                        const label = is_rise_fall ? (t.diff >= 0 ? 'R' : 'F') : String(t.digit);
                        if (isPullbackTick(t, result.ct, result.dir)) {
                            return { label, color: 'var(--status-warning)' };
                        }
                        if (isConfirmTick(t, result.ct, result.dir, pullbacks)) {
                            return { label, color: 'var(--status-success)' };
                        }
                        return { label, color: 'var(--text-less-prominent)' };
                    }}
                />
            )}
        </div>
    );
});

export default ScannerEntryWatch;
