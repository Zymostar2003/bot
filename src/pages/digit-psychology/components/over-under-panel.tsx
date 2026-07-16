import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import DigitStrip from '@/pages/signal-engine/components/digit-strip';
import RunMeter from '@/pages/signal-engine/components/run-meter';
import { Localize } from '@deriv-com/translations';
import BarrierSelector from './barrier-selector';
import DigitHeatGrid from './digit-heat-grid';

// Faithful port of renderOU's activeRoom===0 branch (reference: index-335-black-bars.html,
// lines 14093-14200). Rooms 1/2 (`if(false){...}` at lines 14202/14234) are dead code in the
// reference and are not ported, same as the RF "Patterns room" precedent. Moved here from
// src/pages/signal-engine/components (with its digit-psychology- class rename) — still reads
// from signal_engine (not a separate store): the underlying live tick data, active_barrier/
// active_dir, and ou_gating computed all stayed on SignalEngineStore, since Digit Psychology
// shares the same live symbol/history Signal Engine's Rise/Fall view uses rather than
// opening a second subscription — see digit-psychology.tsx's header comment. DigitStrip/
// RunMeter are reused from their ORIGINAL signal-engine location (unrenamed) rather than
// moved — they're also used by Smart Analysis's Last 50 panel, so digit-psychology.scss
// duplicates their CSS the same way smart-analysis.scss already does, instead of moving the
// components and breaking that other consumer.
const OverUnderPanel = observer(() => {
    const { signal_engine } = useStore();
    const { full_history, ou_gating, pro_signal, active_barrier, active_dir, setActiveBarrier, setActiveDir } =
        signal_engine;

    if (!full_history.length) {
        return (
            <div className='digit-psychology-ou-panel'>
                <div className='digit-psychology-panel__loading'>
                    <Localize i18n_default_text='Gathering market data…' />
                </div>
            </div>
        );
    }

    const { p1000, cur, canEnter, overDigits, underDigits, overPct, underPct } = ou_gating;
    const last = full_history[full_history.length - 1];
    const is_over = cur > active_barrier;

    return (
        <div className='digit-psychology-ou-panel'>
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
                        borderColor: is_over ? 'var(--status-success)' : 'var(--status-danger)',
                        color: is_over ? 'var(--status-success)' : 'var(--status-danger)',
                    }}
                >
                    {cur}
                </span>
                <span className='digit-psychology-live-row__verdict'>
                    {is_over ? <Localize i18n_default_text='▲ OVER' /> : <Localize i18n_default_text='▼ UNDER' />}{' '}
                    <Localize i18n_default_text='barrier {{barrier}}' values={{ barrier: active_barrier }} />
                </span>
            </div>

            <DigitStrip
                ticks={full_history.slice(-20)}
                getDotStyle={t => ({
                    label: String(t.digit),
                    color: t.digit > active_barrier ? 'var(--status-success)' : 'var(--status-danger)',
                })}
            />

            <BarrierSelector
                active_barrier={active_barrier}
                active_dir={active_dir}
                p1000={p1000}
                onSelectBarrier={setActiveBarrier}
                onSelectDir={setActiveDir}
            />

            <DigitHeatGrid p1000={p1000} full_history={full_history} highlight_digit={active_barrier} />

            <div
                className={classNames('digit-psychology-ou-group', 'digit-psychology-ou-group--over', {
                    'digit-psychology-ou-group--active': active_dir === 'over',
                })}
            >
                <div className='digit-psychology-ou-group__header'>
                    <Localize
                        i18n_default_text='🔼 OVER {{barrier}} GROUP (digits > {{barrier}})'
                        values={{ barrier: active_barrier }}
                    />
                </div>
                <div className='digit-psychology-ou-group__digits'>
                    {overDigits.map(d => (
                        <div
                            key={d}
                            className={classNames('digit-psychology-ou-group__digit', {
                                'digit-psychology-ou-group__digit--strong': p1000[d].pct >= 10,
                            })}
                        >
                            <span className='digit-psychology-ou-group__digit-num'>{d}</span>
                            <span>{p1000[d].pct.toFixed(1)}%</span>
                        </div>
                    ))}
                </div>
                <div className='digit-psychology-ou-group__total'>
                    <Localize i18n_default_text='Over side total: {{pct}}%' values={{ pct: overPct.toFixed(1) }} />
                </div>
                {active_dir === 'over' && (
                    <div
                        className={classNames('digit-psychology-signal-box', {
                            'digit-psychology-signal-box--ready': canEnter,
                        })}
                    >
                        {canEnter ? (
                            <div className='digit-psychology-signal-box__title'>
                                {'✅ '}
                                <Localize
                                    i18n_default_text='ENTER OVER {{barrier}}'
                                    values={{ barrier: active_barrier }}
                                />
                            </div>
                        ) : (
                            <div className='digit-psychology-signal-box__desc'>
                                {'⏳ '}
                                <Localize i18n_default_text='Watching for OVER entry' />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div
                className={classNames('digit-psychology-ou-group', 'digit-psychology-ou-group--under', {
                    'digit-psychology-ou-group--active': active_dir === 'under',
                })}
            >
                <div className='digit-psychology-ou-group__header'>
                    <Localize
                        i18n_default_text='🔽 UNDER {{barrier}} GROUP (digits ≤ {{barrier}})'
                        values={{ barrier: active_barrier }}
                    />
                </div>
                <div className='digit-psychology-ou-group__digits'>
                    {underDigits.map(d => (
                        <div
                            key={d}
                            className={classNames(
                                'digit-psychology-ou-group__digit',
                                'digit-psychology-ou-group__digit--under',
                                {
                                    'digit-psychology-ou-group__digit--strong': p1000[d].pct >= 10,
                                }
                            )}
                        >
                            <span className='digit-psychology-ou-group__digit-num'>{d}</span>
                            <span>{p1000[d].pct.toFixed(1)}%</span>
                        </div>
                    ))}
                </div>
                <div className='digit-psychology-ou-group__total'>
                    <Localize i18n_default_text='Under side total: {{pct}}%' values={{ pct: underPct.toFixed(1) }} />
                </div>
                {active_dir === 'under' && (
                    <div
                        className={classNames('digit-psychology-signal-box', {
                            'digit-psychology-signal-box--ready': canEnter,
                        })}
                    >
                        {canEnter ? (
                            <div className='digit-psychology-signal-box__title'>
                                {'✅ '}
                                <Localize
                                    i18n_default_text='ENTER UNDER {{barrier}}'
                                    values={{ barrier: active_barrier }}
                                />
                            </div>
                        ) : (
                            <div className='digit-psychology-signal-box__desc'>
                                {'⏳ '}
                                <Localize i18n_default_text='Watching for UNDER entry' />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {pro_signal && (
                <div className='digit-psychology-meter-card'>
                    <div className='digit-psychology-meter-card__title'>
                        <Localize
                            i18n_default_text='RUN METER — {{dir}} {{barrier}}'
                            values={{ dir: pro_signal.ou.dir, barrier: active_barrier }}
                        />
                    </div>
                    <RunMeter
                        runs={pro_signal.ou.runs}
                        score={pro_signal.ou.score}
                        variant={pro_signal.ou.dir === 'OVER' ? 'success' : 'danger'}
                    />
                </div>
            )}
        </div>
    );
});

export default OverUnderPanel;
