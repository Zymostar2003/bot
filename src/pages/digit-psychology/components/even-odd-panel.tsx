import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import DigitStrip from '@/pages/signal-engine/components/digit-strip';
import RunMeter from '@/pages/signal-engine/components/run-meter';
import { Localize } from '@deriv-com/translations';

// Faithful port of renderEO's activeRoom===0 branch (reference: index-335-black-bars.html,
// lines 14269-14382). Rooms 1/2 (`if(false){...}` at lines 14384/14422) are dead code in the
// reference and are not ported, same as the RF "Patterns room" precedent. Moved here from
// src/pages/signal-engine/components (with its digit-psychology- class rename) — still reads
// from signal_engine (not a separate store), same rationale as over-under-panel.tsx.
// DigitStrip/RunMeter are reused from their original signal-engine location (unrenamed), see
// over-under-panel.tsx's comment on why they weren't moved too.
const EvenOddPanel = observer(() => {
    const { signal_engine } = useStore();
    const { full_history, eo_gating, pro_signal } = signal_engine;

    if (!full_history.length) {
        return (
            <div className='digit-psychology-eo-panel'>
                <div className='digit-psychology-panel__loading'>
                    <Localize i18n_default_text='Gathering market data…' />
                </div>
            </div>
        );
    }

    const { p1000, evenD, oddD, evenAbove10, oddAbove10, evenReady, oddReady, eoStreak, sig, conf } = eo_gating;
    const last = full_history[full_history.length - 1];
    const is_even = last.digit % 2 === 0;
    const need_streak = sig === 'EVEN' ? eoStreak.even : eoStreak.odd;

    return (
        <div className='digit-psychology-eo-panel'>
            <div className='digit-psychology-live-row'>
                <span
                    className='digit-psychology-live-row__price'
                    style={{ color: last.diff >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}
                >
                    {last.price.toFixed(2)}
                </span>
                <span
                    className='digit-psychology-live-row__digit'
                    style={{
                        borderColor: is_even ? 'var(--status-success)' : 'var(--status-warning)',
                        color: is_even ? 'var(--status-success)' : 'var(--status-warning)',
                    }}
                >
                    {last.digit}
                </span>
                <span className='digit-psychology-live-row__verdict'>
                    {is_even ? <Localize i18n_default_text='🟢 EVEN' /> : <Localize i18n_default_text='🟠 ODD' />}{' '}
                    <Localize i18n_default_text='digit {{digit}}' values={{ digit: last.digit }} />
                </span>
            </div>

            <DigitStrip
                ticks={full_history.slice(-20)}
                getDotStyle={t => ({
                    label: t.digit % 2 === 0 ? 'E' : 'O',
                    color: t.digit % 2 === 0 ? 'var(--status-success)' : 'var(--status-warning)',
                })}
            />

            <div className='digit-psychology-eo-best-signal'>
                <Localize i18n_default_text='Best signal:' />{' '}
                <span
                    className={classNames('digit-psychology-eo-best-signal__value', {
                        'digit-psychology-eo-best-signal__value--even': sig === 'EVEN',
                        'digit-psychology-eo-best-signal__value--odd': sig === 'ODD',
                    })}
                >
                    {sig}
                </span>
                <span
                    className={classNames(
                        'digit-psychology-eo-best-signal__badge',
                        `digit-psychology-eo-best-signal__badge--${conf.toLowerCase()}`
                    )}
                >
                    {conf}
                </span>
            </div>

            <div className='digit-psychology-eo-group digit-psychology-eo-group--even'>
                <div className='digit-psychology-eo-group__header'>
                    <Localize i18n_default_text='EVEN (0, 2, 4, 6, 8)' />
                </div>
                <div className='digit-psychology-eo-group__cells'>
                    {evenD.map(d => {
                        const pct = p1000[d].pct;
                        const strong = pct >= 11;
                        const warm = pct >= 9 && pct < 11;
                        return (
                            <div
                                key={d}
                                className={classNames('digit-psychology-eo-cell', {
                                    'digit-psychology-eo-cell--strong': strong,
                                    'digit-psychology-eo-cell--warm': warm,
                                })}
                            >
                                <span className='digit-psychology-eo-cell__digit'>{d}</span>
                                <span className='digit-psychology-eo-cell__pct'>{pct.toFixed(1)}%</span>
                                <div
                                    className='digit-psychology-eo-cell__bar'
                                    style={{ width: `${Math.min(100, (pct / 15) * 100)}%` }}
                                />
                            </div>
                        );
                    })}
                </div>
                <div className='digit-psychology-eo-group__status'>
                    <span>
                        <Localize i18n_default_text='{{count}}/5 digits ≥ 10%' values={{ count: evenAbove10 }} />
                    </span>
                    <span>
                        {evenReady ? (
                            <Localize i18n_default_text='✅ STRONG' />
                        ) : (
                            <Localize i18n_default_text='Needs 3+ at 10%' />
                        )}
                    </span>
                </div>
                <div
                    className={classNames('digit-psychology-signal-box', {
                        'digit-psychology-signal-box--ready': evenReady && eoStreak.even >= 3,
                    })}
                >
                    <div className='digit-psychology-signal-box__title'>
                        <Localize
                            i18n_default_text='📈 EVEN ENTRY: {{count}}/3 in a row'
                            values={{ count: eoStreak.even }}
                        />
                    </div>
                    <div className='digit-psychology-signal-box__desc'>
                        {evenReady && eoStreak.even >= 3 ? (
                            <Localize i18n_default_text='✅ Enter EVEN now — 3+ even digits hit AND percentages are strong.' />
                        ) : evenReady ? (
                            <Localize
                                i18n_default_text='Wait for {{count}}/3 even digits in a row, then enter.'
                                values={{ count: eoStreak.even }}
                            />
                        ) : (
                            <Localize i18n_default_text='Percentages not strong enough for EVEN yet.' />
                        )}
                    </div>
                </div>
            </div>

            <div className='digit-psychology-eo-group digit-psychology-eo-group--odd'>
                <div className='digit-psychology-eo-group__header'>
                    <Localize i18n_default_text='ODD (1, 3, 5, 7, 9)' />
                </div>
                <div className='digit-psychology-eo-group__cells'>
                    {oddD.map(d => {
                        const pct = p1000[d].pct;
                        const strong = pct >= 11;
                        const warm = pct >= 9 && pct < 11;
                        return (
                            <div
                                key={d}
                                className={classNames('digit-psychology-eo-cell', 'digit-psychology-eo-cell--odd', {
                                    'digit-psychology-eo-cell--strong': strong,
                                    'digit-psychology-eo-cell--warm': warm,
                                })}
                            >
                                <span className='digit-psychology-eo-cell__digit'>{d}</span>
                                <span className='digit-psychology-eo-cell__pct'>{pct.toFixed(1)}%</span>
                                <div
                                    className='digit-psychology-eo-cell__bar'
                                    style={{ width: `${Math.min(100, (pct / 15) * 100)}%` }}
                                />
                            </div>
                        );
                    })}
                </div>
                <div className='digit-psychology-eo-group__status'>
                    <span>
                        <Localize i18n_default_text='{{count}}/5 digits ≥ 10%' values={{ count: oddAbove10 }} />
                    </span>
                    <span>
                        {oddReady ? (
                            <Localize i18n_default_text='✅ STRONG' />
                        ) : (
                            <Localize i18n_default_text='Needs 3+ at 10%' />
                        )}
                    </span>
                </div>
                <div
                    className={classNames('digit-psychology-signal-box', {
                        'digit-psychology-signal-box--ready': oddReady && eoStreak.odd >= 3,
                    })}
                >
                    <div className='digit-psychology-signal-box__title'>
                        <Localize
                            i18n_default_text='🟠 ODD ENTRY: {{count}}/3 in a row'
                            values={{ count: eoStreak.odd }}
                        />
                    </div>
                    <div className='digit-psychology-signal-box__desc'>
                        {oddReady && eoStreak.odd >= 3 ? (
                            <Localize i18n_default_text='✅ Enter ODD now — 3+ odd digits hit AND percentages are strong.' />
                        ) : oddReady ? (
                            <Localize
                                i18n_default_text='Wait for {{count}}/3 odd digits in a row, then enter.'
                                values={{ count: eoStreak.odd }}
                            />
                        ) : (
                            <Localize i18n_default_text='Percentages not strong enough for ODD yet.' />
                        )}
                    </div>
                </div>
            </div>

            <div className='digit-psychology-eo-consec'>
                <div className='digit-psychology-eo-consec__dots'>
                    {[0, 1, 2].map(i => (
                        <div
                            key={i}
                            className={classNames('digit-psychology-eo-consec__dot', {
                                'digit-psychology-eo-consec__dot--hit': i < need_streak,
                            })}
                        >
                            {i < need_streak ? (sig === 'EVEN' ? 'E' : 'O') : i + 1}
                        </div>
                    ))}
                </div>
                <div className='digit-psychology-eo-consec__text'>
                    <Localize
                        i18n_default_text='{{count}}/3 {{sig}} in a row — {{status}}'
                        values={{
                            count: need_streak,
                            sig,
                            status:
                                need_streak >= 3
                                    ? 'ENTER NOW!'
                                    : need_streak === 2
                                      ? '1 more to go!'
                                      : `waiting for ${sig} digits`,
                        }}
                    />
                </div>
            </div>

            {pro_signal && (
                <div className='digit-psychology-meter-card'>
                    <div className='digit-psychology-meter-card__title'>
                        <Localize i18n_default_text='RUN METER — {{dir}}' values={{ dir: pro_signal.eo.dir }} />
                    </div>
                    <RunMeter
                        runs={pro_signal.eo.runs}
                        score={pro_signal.eo.score}
                        variant={pro_signal.eo.dir === 'EVEN' ? 'success' : 'danger'}
                    />
                </div>
            )}
        </div>
    );
});

export default EvenOddPanel;
