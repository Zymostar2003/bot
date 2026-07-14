import React from 'react';
import classNames from 'classnames';
import { TScanQuality } from '@/utils/scanner/types';
import { Localize } from '@deriv-com/translations';

type TScannerScoreBarProps = {
    score: number;
    quality: TScanQuality;
};

// A simpler 0-100 sibling of Signal Engine's RunMeter bar-fill (src/pages/signal-engine/
// components/run-meter.tsx) — reuses its bar-fill visual/CSS approach (track + width%
// fill) but not RunMeter itself, since RunMeter is scoped to the 1-7 "runs" concept which
// doesn't apply to Scanner's plain 0-100 score.
const ScannerScoreBar = ({ score, quality }: TScannerScoreBarProps) => {
    const variant = quality === 'SIGNAL' ? 'success' : 'warning';
    return (
        <div className='scanner-score-bar'>
            <div className='scanner-score-bar__track'>
                <div
                    className={classNames('scanner-score-bar__fill', `scanner-score-bar__fill--${variant}`)}
                    style={{ width: `${score}%` }}
                />
            </div>
            <span className='scanner-score-bar__value'>
                <Localize i18n_default_text='Score' />: {score}/100
            </span>
        </div>
    );
};

export default ScannerScoreBar;
