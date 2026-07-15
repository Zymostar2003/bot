import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { buildRiskAnalysis } from '@/utils/tools/risk';
import { Localize } from '@deriv-com/translations';
import PriceBars from './price-bars';
import SimpleBar from './simple-bar';

const LEVEL_COLOR: Record<string, string> = {
    LOW: 'var(--status-success)',
    MEDIUM: 'var(--status-warning)',
    HIGH: 'var(--status-danger)',
};

const SEV_ICON: Record<string, string> = { high: '!', med: '~', low: '✓' };

// Faithful port of build_risk (reference: index-335-black-bars.html, lines 9290-9378) —
// reuses signal_engine's live full_history/candle_history (same store Digit Psychology
// reuses) rather than a dedicated one, since Tools has no live data of its own to analyze
// beyond whatever asset is currently selected there — see tools.tsx's header comment.
const RiskPanel = observer(() => {
    const { signal_engine } = useStore();
    const { full_history, candle_history } = signal_engine;

    if (!full_history.length) {
        return (
            <div className='tools-panel__loading'>
                <Localize i18n_default_text='Gathering market data…' />
            </div>
        );
    }

    const risk = buildRiskAnalysis(full_history, candle_history);
    const level_color = LEVEL_COLOR[risk.level];

    return (
        <div className='tools-risk-panel'>
            <div className={classNames('tools-card', `tools-card--${risk.level.toLowerCase()}`)}>
                <div className='tools-card__title'>
                    {'🛡️ '}
                    <Localize i18n_default_text='Current Risk Level' />
                </div>
                <div className='tools-risk-score-row'>
                    <div className='tools-risk-score-badge' style={{ borderColor: level_color }}>
                        <div className='tools-risk-score-badge__value' style={{ color: level_color }}>
                            {risk.score}
                        </div>
                        <div className='tools-risk-score-badge__label'>
                            <Localize i18n_default_text='{{level}} RISK' values={{ level: risk.level }} />
                        </div>
                    </div>
                    <div className='tools-risk-score-row__meter'>
                        <div className='tools-risk-score-row__meter-label'>
                            <Localize i18n_default_text='Risk meter (0 = safe, 100 = danger)' />
                        </div>
                        <SimpleBar value={risk.score} color={level_color} />
                        <span className={classNames('tools-pill', risk.safe ? 'tools-pill--ok' : 'tools-pill--warn')}>
                            {risk.safe ? (
                                <Localize i18n_default_text='✓ OK to trade' />
                            ) : (
                                <Localize i18n_default_text='⚠ Trade with extra care' />
                            )}
                        </span>
                    </div>
                </div>
            </div>

            <div className='tools-card'>
                <div className='tools-card__title'>
                    {'📊 '}
                    <Localize i18n_default_text='Live Price Movement' />
                </div>
                <PriceBars ticks={full_history} />
                <div className='tools-stat-row'>
                    <span className='tools-stat-row__label'>
                        <Localize i18n_default_text='Price jumping level' />
                    </span>
                    <span className='tools-stat-row__value' style={{ color: level_color }}>
                        {risk.vol.level}
                    </span>
                </div>
                <div className='tools-stat-row'>
                    <span className='tools-stat-row__label'>
                        <Localize i18n_default_text='Avg tick movement' />
                    </span>
                    <span className='tools-stat-row__value'>{risk.vol.atr.toFixed(5)}</span>
                </div>
                <div className='tools-stat-row'>
                    <span className='tools-stat-row__label'>
                        <Localize i18n_default_text='Strength meter (RSI)' />
                    </span>
                    <span
                        className='tools-stat-row__value'
                        style={{
                            color:
                                risk.rsi14 !== null && risk.rsi14 > 70
                                    ? 'var(--status-danger)'
                                    : risk.rsi14 !== null && risk.rsi14 < 30
                                      ? 'var(--status-success)'
                                      : 'var(--text-general)',
                        }}
                    >
                        {risk.rsi14 !== null ? risk.rsi14.toFixed(1) : 'N/A'} / 100
                    </span>
                </div>
                <div className='tools-stat-row'>
                    <span className='tools-stat-row__label'>
                        <Localize i18n_default_text='Active streak' />
                    </span>
                    <span className='tools-stat-row__value'>
                        {risk.streak.type} × {risk.streak.len}
                    </span>
                </div>
            </div>

            <div className='tools-card tools-card--orange'>
                <div className='tools-card__title'>
                    {'⚠ '}
                    <Localize i18n_default_text='Risk Factors Right Now' />
                </div>
                {risk.warnings.map((w, idx) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={idx} className='tools-warning-row'>
                        <div className={classNames('tools-warning-row__dot', `tools-warning-row__dot--${w.sev}`)}>
                            {SEV_ICON[w.sev]}
                        </div>
                        <div>{w.txt}</div>
                    </div>
                ))}
            </div>

            <div className='tools-card tools-card--teal'>
                <div className='tools-card__title'>
                    {'💰 '}
                    <Localize i18n_default_text='How Much to Risk Per Trade' />
                </div>
                <div className='tools-card__desc'>
                    <Localize i18n_default_text='Calculated from your signal strength and current risk level' />
                </div>
                <SimpleBar value={risk.kelly} color='var(--status-info)' label='recommended risk %' />
                <div className='tools-kelly-text'>
                    <Localize
                        i18n_default_text='Risk only <0>{{kelly}}%</0> of your account per trade'
                        values={{ kelly: risk.kelly.toFixed(1) }}
                        components={[<strong key={0} />]}
                    />
                </div>
                <div className='tools-kelly-sub'>
                    <Localize
                        i18n_default_text='Safer option: <0>{{safer}}%</0> | Max loss per session: <1>{{max}}%</1>'
                        values={{ safer: (risk.kelly / 2).toFixed(1), max: (risk.kelly * 2).toFixed(1) }}
                        components={[<strong key={0} />, <strong key={1} />]}
                    />
                </div>
            </div>

            <div className='tools-card tools-card--red'>
                <div className='tools-card__title'>
                    {'📋 '}
                    <Localize i18n_default_text='CEOskit Safety Rules (Always Follow)' />
                </div>
                <div className='tools-warning-row'>
                    <div className='tools-warning-row__dot tools-warning-row__dot--high'>1</div>
                    <div>
                        <Localize i18n_default_text='NEVER risk more than 5% of your account per trade' />
                    </div>
                </div>
                <div className='tools-warning-row'>
                    <div className='tools-warning-row__dot tools-warning-row__dot--high'>2</div>
                    <div>
                        <Localize i18n_default_text="Stop after 3 losses in a row — take a break, don't chase" />
                    </div>
                </div>
                <div className='tools-warning-row'>
                    <div className='tools-warning-row__dot tools-warning-row__dot--high'>3</div>
                    <div>
                        <Localize i18n_default_text='Watch at least 4-5 patterns before entering real trades' />
                    </div>
                </div>
                <div className='tools-warning-row'>
                    <div className='tools-warning-row__dot tools-warning-row__dot--med'>!</div>
                    <div>
                        <Localize i18n_default_text='Beginners: Start with UNDER 9 or 8 — these are safest' />
                    </div>
                </div>
                <div className='tools-warning-row'>
                    <div className='tools-warning-row__dot tools-warning-row__dot--low'>✓</div>
                    <div>
                        <Localize i18n_default_text='Practice on demo for at least 1 week before real money' />
                    </div>
                </div>
                <div className='tools-warning-row'>
                    <div className='tools-warning-row__dot tools-warning-row__dot--low'>✓</div>
                    <div>
                        <Localize i18n_default_text='Set a daily profit target and stop when you reach it' />
                    </div>
                </div>
            </div>
        </div>
    );
});

export default RiskPanel;
