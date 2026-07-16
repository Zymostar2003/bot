import React from 'react';
import { observer } from 'mobx-react-lite';
import { Localize } from '@deriv-com/translations';
import { useScannerStore } from '../use-scanner-store';
import ScannerAiAnalysis from './scanner-ai-analysis';
import ScannerEntryWatch from './scanner-entry-watch';
import ScannerLiveDigits from './scanner-live-digits';
import ScannerMiniChart from './scanner-mini-chart';
import ScannerRegimeSummary from './scanner-regime-summary';
import ScannerResultCard from './scanner-result-card';
import ScannerResultRow from './scanner-result-row';
import ScannerWatchCard from './scanner-watch-card';

// Results area: _sc.results is already sorted score-descending by ScannerStore.scan()
// (faithful port of the reference's `_sc.results.sort(...)`, reference lines 16913-16915) —
// the top result renders as a larger card + its AI analysis, the rest as smaller rows
// (reference's scout-hero-card + scout-mini-card split). No scan log / performance panel /
// live validator in v1 (deferred).
//
// Market Watch fallback (new, no reference equivalent): when a completed scan finds zero
// qualifying (SIGNAL/WATCH) results, `results` is empty but `all_scored` — every asset's
// best combo regardless of quality — usually isn't. Rather than a bare "no signals" message,
// show the regime context (why nothing qualified) plus the closest candidates for
// informational reference. Nothing in this fallback is applyable to the bot.
const ScannerResults = observer(() => {
    const scanner_store = useScannerStore();
    const { results, all_scored, regime_counts, status, is_scanning, applyResult, dismissResult, startEntryWatch } =
        scanner_store;

    if (!results.length) {
        if (is_scanning) {
            return (
                <div className='scanner__empty'>
                    <Localize i18n_default_text='Scanning assets…' />
                </div>
            );
        }
        if (status === 'done') {
            if (all_scored.length) {
                const [watch_top, ...watch_rest] = all_scored;
                return (
                    <div className='scanner__results'>
                        <ScannerRegimeSummary regime_counts={regime_counts} />
                        <ScannerLiveDigits />
                        <ScannerMiniChart />
                        <div className='scanner__watch-heading'>
                            <Localize i18n_default_text="No qualifying signals this scan — here's the closest candidate." />
                        </div>
                        <ScannerWatchCard result={watch_top} />
                        <ScannerAiAnalysis result={watch_top} />
                        {!!watch_rest.length && (
                            <div className='scanner__results-list'>
                                {watch_rest.slice(0, 4).map(result => (
                                    <ScannerResultRow key={`${result.asset}-${result.ct}`} result={result} readOnly />
                                ))}
                            </div>
                        )}
                    </div>
                );
            }
            return (
                <div className='scanner__empty'>
                    <Localize i18n_default_text='No qualifying signals found on this scan.' />
                </div>
            );
        }
        return (
            <div className='scanner__empty'>
                <Localize i18n_default_text='Pick a filter tab and press Scan All Assets to find a signal.' />
            </div>
        );
    }

    const [top, ...rest] = results;

    return (
        <div className='scanner__results'>
            <ScannerRegimeSummary regime_counts={regime_counts} />
            <ScannerLiveDigits />
            <ScannerMiniChart />
            <ScannerResultCard
                result={top}
                onApply={applyResult}
                onDismiss={dismissResult}
                onFindEntry={startEntryWatch}
            />
            <ScannerEntryWatch />
            <ScannerAiAnalysis result={top} />
            {!!rest.length && (
                <div className='scanner__results-list'>
                    {rest.map(result => (
                        <ScannerResultRow
                            key={`${result.asset}-${result.ct}`}
                            result={result}
                            onApply={applyResult}
                            onDismiss={dismissResult}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});

export default ScannerResults;
