import React from 'react';
import { TScanResult } from '@/utils/scanner/types';
import { Localize } from '@deriv-com/translations';
import ScannerScoreBar from './scanner-score-bar';

type TScannerResultCardProps = {
    result: TScanResult;
    onApply: (result: TScanResult) => void;
    onDismiss: (result: TScanResult) => void;
    onFindEntry: (result: TScanResult) => void;
};

// New capability, no reference equivalent — see TScanResult.trend / ScannerStore.scan().
const TREND_TEXT: Record<string, string> = {
    up: '▲ Strengthening since last scan',
    down: '▼ Weakening since last scan',
    flat: '— Steady since last scan',
};

// The top-scored result, shown as a larger card. Faithful port of the reference's "hero"
// result rendering (reference/index-335-black-bars.html — quality banner text at the
// SIGNAL/WATCH split, e.g. lines around 18178-18190/20977-20990) with Apply/Dismiss
// controls (`window._scout.activateIdx`/`dismiss`, reference lines 18189-18190).
const ScannerResultCard = ({ result, onApply, onDismiss, onFindEntry }: TScannerResultCardProps) => {
    const is_signal = result.quality === 'SIGNAL';
    return (
        <div className={`scanner-result-card scanner-result-card--${is_signal ? 'signal' : 'watch'}`}>
            <div className='scanner-result-card__banner'>
                {is_signal ? (
                    <Localize i18n_default_text='🔥 SIGNAL — All conditions met' />
                ) : (
                    <Localize i18n_default_text='👁 WATCH THIS ASSET — Conditions forming' />
                )}
            </div>
            <div className='scanner-result-card__main'>
                <span className='scanner-result-card__asset'>{result.assetLabel}</span>
                <span className='scanner-result-card__contract'>
                    {result.ctLabel} — {result.dir}
                </span>
                {result.barrier != null && (
                    <span className='scanner-result-card__barrier'>
                        <Localize i18n_default_text='Barrier {{barrier}}' values={{ barrier: result.barrier }} />
                    </span>
                )}
                {result.trend && (
                    <span className={`scanner-result-card__trend scanner-result-card__trend--${result.trend}`}>
                        {TREND_TEXT[result.trend]}
                    </span>
                )}
            </div>
            <ScannerScoreBar score={result.score} quality={result.quality} />
            <ul className='scanner-result-card__reasons'>
                {result.reasons.map((reason, idx) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <li key={idx}>{reason}</li>
                ))}
            </ul>
            <div className='scanner-result-card__actions'>
                <button type='button' className='scanner-result-card__apply' onClick={() => onApply(result)}>
                    <Localize i18n_default_text='Apply' />
                </button>
                <button type='button' className='scanner-result-card__find-entry' onClick={() => onFindEntry(result)}>
                    <Localize i18n_default_text='🎯 Find Entry Point' />
                </button>
                <button type='button' className='scanner-result-card__dismiss' onClick={() => onDismiss(result)}>
                    <Localize i18n_default_text='Dismiss' />
                </button>
            </div>
        </div>
    );
};

export default ScannerResultCard;
