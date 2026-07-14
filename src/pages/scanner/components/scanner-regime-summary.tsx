import React from 'react';
import { TRegimeCounts } from '@/utils/scanner/types';
import { Localize } from '@deriv-com/translations';

type TScannerRegimeSummaryProps = {
    regime_counts: TRegimeCounts;
};

const VERDICT: Record<keyof TRegimeCounts, string> = {
    quiet: 'Most assets are quiet right now — low volatility means fewer statistically significant edges to find. A "no signals" result is expected, not a fault.',
    normal: 'Market conditions are normal across most assets — a typical scan.',
    volatile:
        'Elevated volatility across the board — treat any signal found with extra caution, edges can flip faster than usual.',
    spiking:
        'Multiple assets are spiking right now — high risk of false signals. Consider waiting for conditions to settle before entering.',
};

const REGIME_LABEL: Record<keyof TRegimeCounts, string> = {
    quiet: 'Quiet',
    normal: 'Normal',
    volatile: 'Volatile',
    spiking: 'Spiking',
};

// New capability, no reference equivalent — tallies ScannerStore's per-asset dsRegime()
// classification (already computed for scoring, previously discarded) across the whole
// scan into a market-wide context banner. Explains *why* a scan may have found nothing
// qualifying, instead of the result looking broken.
const ScannerRegimeSummary = ({ regime_counts }: TScannerRegimeSummaryProps) => {
    const total = regime_counts.quiet + regime_counts.normal + regime_counts.volatile + regime_counts.spiking;
    if (!total) return null;

    const dominant = (Object.keys(regime_counts) as (keyof TRegimeCounts)[]).reduce((a, b) =>
        regime_counts[b] > regime_counts[a] ? b : a
    );

    return (
        <div className='scanner-regime-summary'>
            <div className='scanner-regime-summary__tally'>
                <Localize i18n_default_text='Market regime:' />
                {(Object.keys(regime_counts) as (keyof TRegimeCounts)[]).map(key => (
                    <span key={key} className={`scanner-regime-summary__chip scanner-regime-summary__chip--${key}`}>
                        {REGIME_LABEL[key]} {regime_counts[key]}
                    </span>
                ))}
            </div>
            <div className='scanner-regime-summary__verdict'>{VERDICT[dominant]}</div>
        </div>
    );
};

export default ScannerRegimeSummary;
