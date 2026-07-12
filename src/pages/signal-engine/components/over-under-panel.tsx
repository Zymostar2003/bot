import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { Localize } from '@deriv-com/translations';
import BarrierSelector from './barrier-selector';
import DigitHeatGrid from './digit-heat-grid';
import DigitStrip from './digit-strip';
import RunMeter from './run-meter';

// Faithful port of renderOU's activeRoom===0 branch (reference: index-335-black-bars.html,
// lines 14093-14200). Rooms 1/2 (`if(false){...}` at lines 14202/14234) are dead code in the
// reference and are not ported, same as the RF "Patterns room" precedent.
const OverUnderPanel = observer(() => {
    const { signal_engine } = useStore();
    const { full_history, ou_gating, pro_signal, active_barrier, active_dir, setActiveBarrier, setActiveDir } =
        signal_engine;

    if (!full_history.length) {
        return (
            <div className='signal-engine-rf-panel__loading'>
                <Localize i18n_default_text='Gathering market data…' />
            </div>
        );
    }

    const { p1000, cur, canEnter, overDigits, underDigits, overPct, underPct } = ou_gating;
    const last = full_history[full_history.length - 1];
    const is_over = cur > active_barrier;

    return (
        <div className='signal-engine-ou-panel'>
            <div className='signal-engine-live-row'>
                <span
                    className='signal-engine-live-row__price'
                    style={{ color: last.diff >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}
                >
                    {last.price.toFixed(2)}
                </span>
                <span
                    className='signal-engine-live-row__digit'
                    style={{
                        borderColor: is_over ? 'var(--status-success)' : 'var(--status-danger)',
                        color: is_over ? 'var(--status-success)' : 'var(--status-danger)',
                    }}
                >
                    {cur}
                </span>
                <span className='signal-engine-live-row__verdict'>
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
                className={classNames('signal-engine-ou-group', 'signal-engine-ou-group--over', {
                    'signal-engine-ou-group--active': active_dir === 'over',
                })}
            >
                <div className='signal-engine-ou-group__header'>
                    <Localize
                        i18n_default_text='🔼 OVER {{barrier}} GROUP (digits > {{barrier}})'
                        values={{ barrier: active_barrier }}
                    />
                </div>
                <div className='signal-engine-ou-group__digits'>
                    {overDigits.map(d => (
                        <div
                            key={d}
                            className={classNames('signal-engine-ou-group__digit', {
                                'signal-engine-ou-group__digit--strong': p1000[d].pct >= 10,
                            })}
                        >
                            <span>{d}</span>
                            <span>{p1000[d].pct.toFixed(1)}%</span>
                        </div>
                    ))}
                </div>
                <div className='signal-engine-ou-group__total'>
                    <Localize i18n_default_text='Over side total: {{pct}}%' values={{ pct: overPct.toFixed(1) }} />
                </div>
                {active_dir === 'over' && (
                    <div
                        className={classNames('signal-engine-signal-box', {
                            'signal-engine-signal-box--ready': canEnter,
                        })}
                    >
                        {canEnter ? (
                            <div className='signal-engine-signal-box__title'>
                                {'✅ '}
                                <Localize
                                    i18n_default_text='ENTER OVER {{barrier}}'
                                    values={{ barrier: active_barrier }}
                                />
                            </div>
                        ) : (
                            <div className='signal-engine-signal-box__desc'>
                                {'⏳ '}
                                <Localize i18n_default_text='Watching for OVER entry' />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div
                className={classNames('signal-engine-ou-group', 'signal-engine-ou-group--under', {
                    'signal-engine-ou-group--active': active_dir === 'under',
                })}
            >
                <div className='signal-engine-ou-group__header'>
                    <Localize
                        i18n_default_text='🔽 UNDER {{barrier}} GROUP (digits ≤ {{barrier}})'
                        values={{ barrier: active_barrier }}
                    />
                </div>
                <div className='signal-engine-ou-group__digits'>
                    {underDigits.map(d => (
                        <div
                            key={d}
                            className={classNames(
                                'signal-engine-ou-group__digit',
                                'signal-engine-ou-group__digit--under',
                                {
                                    'signal-engine-ou-group__digit--strong': p1000[d].pct >= 10,
                                }
                            )}
                        >
                            <span>{d}</span>
                            <span>{p1000[d].pct.toFixed(1)}%</span>
                        </div>
                    ))}
                </div>
                <div className='signal-engine-ou-group__total'>
                    <Localize i18n_default_text='Under side total: {{pct}}%' values={{ pct: underPct.toFixed(1) }} />
                </div>
                {active_dir === 'under' && (
                    <div
                        className={classNames('signal-engine-signal-box', {
                            'signal-engine-signal-box--ready': canEnter,
                        })}
                    >
                        {canEnter ? (
                            <div className='signal-engine-signal-box__title'>
                                {'✅ '}
                                <Localize
                                    i18n_default_text='ENTER UNDER {{barrier}}'
                                    values={{ barrier: active_barrier }}
                                />
                            </div>
                        ) : (
                            <div className='signal-engine-signal-box__desc'>
                                {'⏳ '}
                                <Localize i18n_default_text='Watching for UNDER entry' />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {pro_signal && (
                <div className='signal-engine-meter-card'>
                    <div className='signal-engine-meter-card__title'>
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
