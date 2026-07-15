import React from 'react';
import { TScanResult } from '@/utils/scanner/types';
import { Localize } from '@deriv-com/translations';
import ScannerScoreBar from './scanner-score-bar';

type TScannerWatchCardProps = {
    result: TScanResult;
};

// Shown instead of ScannerResultCard when nothing in this scan cleared the SIGNAL/WATCH bar
// — surfaces the closest candidate for context instead of a bare "no signals" message. New
// capability, no reference equivalent (the reference just showed nothing in this case too).
// Deliberately has no Apply/Dismiss controls: applying a REJECT-quality combo to the bot
// would be actively misleading — see the signal-only boundary in
// TradeSetupStore.applyFromScanner.
const ScannerWatchCard = ({ result }: TScannerWatchCardProps) => (
    <div className='scanner-result-card scanner-result-card--reject'>
        <div className='scanner-result-card__banner'>
            <Localize i18n_default_text="🔍 Closest candidate — didn't clear the signal bar this scan" />
        </div>
        <div className='scanner-result-card__main'>
            <span className='scanner-result-card__asset'>{result.assetLabel}</span>
            <span className='scanner-result-card__contract'>
                {result.ctLabel} — {result.dir}
            </span>
        </div>
        <ScannerScoreBar score={result.score} quality={result.quality} />
        <ul className='scanner-result-card__reasons'>
            {result.reasons.map((reason, idx) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={idx}>{reason}</li>
            ))}
        </ul>
    </div>
);

export default ScannerWatchCard;
