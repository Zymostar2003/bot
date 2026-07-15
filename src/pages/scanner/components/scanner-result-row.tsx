import React from 'react';
import classNames from 'classnames';
import { TScanResult } from '@/utils/scanner/types';
import { localize } from '@deriv-com/translations';

type TScannerResultRowProps = {
    result: TScanResult;
    onApply?: (result: TScanResult) => void;
    onDismiss?: (result: TScanResult) => void;
    // Used by the Market Watch fallback (scanner-results.tsx) to render REJECT-quality
    // candidates without Apply/Dismiss — applying a non-qualifying combo to the bot would be
    // actively misleading, see the signal-only boundary in
    // TradeSetupStore.applyFromScanner.
    readOnly?: boolean;
};

const TREND_ICON: Record<string, string> = { up: '▲', down: '▼', flat: '—' };

// Smaller result rows shown below the top result card — asset, contract+direction chip,
// score, clickable to apply directly (faithful port of .scout-mini-card, reference/
// index-335-black-bars.html, lines 21473 / 18230: `onclick="window._scout.activateIdx(i)"`).
// Trend badge (▲/▼/—) is a new capability — see TScanResult.trend / ScannerStore.scan().
const ScannerResultRow = ({ result, onApply, onDismiss, readOnly }: TScannerResultRowProps) => {
    const content = (
        <>
            <span className='scanner-result-row__asset'>{result.assetLabel}</span>
            <span className='scanner-result-row__chip'>
                {result.ctLabel} {result.dir}
            </span>
            {result.trend && (
                <span className={classNames('scanner-result-row__trend', `scanner-result-row__trend--${result.trend}`)}>
                    {TREND_ICON[result.trend]}
                </span>
            )}
            <span className='scanner-result-row__score'>{result.score}</span>
        </>
    );

    return (
        <div className={classNames('scanner-result-row', `scanner-result-row--${result.quality.toLowerCase()}`)}>
            {readOnly ? (
                <div className='scanner-result-row__main scanner-result-row__main--readonly'>{content}</div>
            ) : (
                <button type='button' className='scanner-result-row__main' onClick={() => onApply?.(result)}>
                    {content}
                </button>
            )}
            {!readOnly && (
                <button
                    type='button'
                    className='scanner-result-row__dismiss'
                    aria-label={localize('Dismiss')}
                    onClick={() => onDismiss?.(result)}
                >
                    ✕
                </button>
            )}
        </div>
    );
};

export default ScannerResultRow;
