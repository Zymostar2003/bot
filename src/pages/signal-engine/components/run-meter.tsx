import React from 'react';
import classNames from 'classnames';
import { Localize } from '@deriv-com/translations';

type TRunMeterProps = {
    runs: number;
    score: number;
    variant: 'success' | 'danger';
};

// Faithful port of runMeterHTML's thresholds/labels (reference: index-335-black-bars.html,
// lines 7103-7120). Structural change: JSX + dbot design tokens replace the string-built
// inline-styled HTML; the run/score thresholds and labels are unchanged.
const RunMeter = ({ runs, score, variant }: TRunMeterProps) => {
    const label =
        runs === 0
            ? 'WAIT'
            : runs <= 2
              ? 'WEAK'
              : runs <= 4
                ? 'MODERATE'
                : runs <= 5
                  ? 'STRONG'
                  : runs === 6
                    ? 'VERY STRONG'
                    : 'MAX POWER 🔥';
    const barVariant = score >= 80 ? variant : score >= 55 ? 'warning' : 'muted';

    return (
        <div
            className='signal-engine-run-meter'
            style={{ '--rm-color': `var(--status-${variant})` } as React.CSSProperties}
        >
            <div className='signal-engine-run-meter__dots'>
                {Array.from({ length: 7 }, (_, idx) => idx + 1).map(ri => {
                    const active = ri <= runs;
                    const isMaxTier = ri > 5;
                    return (
                        <div
                            key={ri}
                            className={classNames('signal-engine-run-meter__dot', {
                                'signal-engine-run-meter__dot--active': active,
                                'signal-engine-run-meter__dot--max': active && isMaxTier,
                            })}
                        >
                            {ri}
                        </div>
                    );
                })}
            </div>
            <div className='signal-engine-run-meter__summary'>
                <span className='signal-engine-run-meter__label'>
                    {runs} <Localize i18n_default_text='Run' />
                    {runs !== 1 ? 's' : ''} — {label}
                </span>
                <span className='signal-engine-run-meter__score'>
                    <Localize i18n_default_text='Score' />: {score}/100
                </span>
            </div>
            <div className='signal-engine-run-meter__bar'>
                <div
                    className={classNames(
                        'signal-engine-run-meter__bar-fill',
                        `signal-engine-run-meter__bar-fill--${barVariant}`
                    )}
                    style={{ width: `${score}%` }}
                />
            </div>
        </div>
    );
};

export default RunMeter;
