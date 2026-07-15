import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import DigitStrip from '@/pages/signal-engine/components/digit-strip';
import DualBar from '@/pages/signal-engine/components/dual-bar';
import { buildReportSnapshot } from '@/utils/tools/report';
import { Localize } from '@deriv-com/translations';
import PriceBars from './price-bars';
import SimpleBar from './simple-bar';

const RF_COLOR: Record<string, string> = { RISE: 'var(--status-success)', FALL: 'var(--status-danger)' };
const VOL_COLOR: Record<string, string> = {
    LOW: 'var(--status-success)',
    MEDIUM: 'var(--status-warning)',
    HIGH: 'var(--status-danger)',
};

// Faithful port of build_report (reference: index-335-black-bars.html, lines 9382-9467) —
// reuses signal_engine's live full_history/candle_history, same rationale as risk-panel.tsx.
// The "worm" strip (reference's wormHTML) reuses DigitStrip parameterized for R/F dots
// instead of a dedicated component — same primitive Digit Psychology's Over/Under and
// Even/Odd panels already use for their own tick strips.
const ReportPanel = observer(() => {
    const { signal_engine } = useStore();
    const { full_history, candle_history } = signal_engine;

    if (!full_history.length) {
        return (
            <div className='tools-panel__loading'>
                <Localize i18n_default_text='Gathering market data…' />
            </div>
        );
    }

    const report = buildReportSnapshot(full_history, candle_history);
    const rises50pct = (full_history.slice(-50).filter(t => t.diff >= 0).length / 50) * 100;

    return (
        <div className='tools-report-panel'>
            <div className='tools-card tools-card--green'>
                <div className='tools-card__title'>
                    {'📋 '}
                    <Localize i18n_default_text='Market Snapshot — All Strategies' />
                </div>
                <div className='tools-snapshot-grid'>
                    <div className='tools-snapshot-cell'>
                        <div className='tools-snapshot-cell__value' style={{ color: RF_COLOR[report.rfSig] }}>
                            {report.rfSig}
                        </div>
                        <div className='tools-snapshot-cell__label'>
                            <Localize i18n_default_text='Rise/Fall' />
                        </div>
                    </div>
                    <div className='tools-snapshot-cell'>
                        <div className='tools-snapshot-cell__value'>{report.eoSig}</div>
                        <div className='tools-snapshot-cell__label'>
                            <Localize i18n_default_text='Even/Odd' />
                        </div>
                    </div>
                    <div className='tools-snapshot-cell'>
                        <div className='tools-snapshot-cell__value'>{report.ouSig}</div>
                        <div className='tools-snapshot-cell__label'>
                            <Localize i18n_default_text='Over/Under' />
                        </div>
                    </div>
                    <div className='tools-snapshot-cell'>
                        <div className='tools-snapshot-cell__value' style={{ color: VOL_COLOR[report.volLevel] }}>
                            {report.volLevel}
                        </div>
                        <div className='tools-snapshot-cell__label'>
                            <Localize i18n_default_text='Volatility' />
                        </div>
                    </div>
                </div>
            </div>

            <div className='tools-card'>
                <div className='tools-card__title'>
                    {'📊 '}
                    <Localize i18n_default_text='Live Price Direction' />
                </div>
                <PriceBars ticks={full_history} />
                <DualBar rise_pct={rises50pct} />
                <DigitStrip
                    ticks={full_history.slice(-20)}
                    getDotStyle={t => ({
                        label: t.diff >= 0 ? 'R' : 'F',
                        color: t.diff >= 0 ? 'var(--status-success)' : 'var(--status-danger)',
                    })}
                />
            </div>

            <div className='tools-card'>
                <div className='tools-card__title'>
                    {'⚡ '}
                    <Localize i18n_default_text="What's Active Right Now" />
                </div>
                <div className='tools-stat-row'>
                    <span className='tools-stat-row__label'>
                        <Localize i18n_default_text='3-Candle setup' />
                    </span>
                    <span
                        className={`tools-pill ${report.consDir.rise >= 3 || report.consDir.fall >= 3 ? 'tools-pill--ok' : 'tools-pill--neutral'}`}
                    >
                        {report.consDir.rise >= 3
                            ? `${report.consDir.rise} RISE ready`
                            : report.consDir.fall >= 3
                              ? `${report.consDir.fall} FALL ready`
                              : 'Not ready yet'}
                    </span>
                </div>
                <div className='tools-stat-row'>
                    <span className='tools-stat-row__label'>
                        <Localize i18n_default_text='Even/Odd (3-in-a-row)' />
                    </span>
                    <span
                        className={`tools-pill ${report.consEvenStreak >= 3 ? 'tools-pill--ok' : report.consOddStreak >= 3 ? 'tools-pill--odd' : 'tools-pill--neutral'}`}
                    >
                        {report.consEvenStreak >= 3
                            ? `EVEN ×${report.consEvenStreak}`
                            : report.consOddStreak >= 3
                              ? `ODD ×${report.consOddStreak}`
                              : 'Waiting'}
                    </span>
                </div>
                <div className='tools-stat-row'>
                    <span className='tools-stat-row__label'>
                        <Localize i18n_default_text='Cursor position' />
                    </span>
                    <span className='tools-stat-row__value'>
                        <Localize
                            i18n_default_text='Digit {{digit}} ({{pct}}%) — {{state}}'
                            values={{
                                digit: report.cur,
                                pct: report.curPct.toFixed(2),
                                state: report.curStable ? 'FROZEN 🔒' : 'moving',
                            }}
                        />
                    </span>
                </div>
                <div className='tools-stat-row'>
                    <span className='tools-stat-row__label'>
                        <Localize i18n_default_text='Hottest digit' />
                    </span>
                    <span className='tools-stat-row__value' style={{ color: 'var(--status-success)' }}>
                        {report.hottestDigit} ({report.hottestPct.toFixed(1)}%)
                    </span>
                </div>
                <div className='tools-stat-row'>
                    <span className='tools-stat-row__label'>
                        <Localize i18n_default_text='Best DIFFERS pick' />
                    </span>
                    <span className='tools-stat-row__value' style={{ color: 'var(--status-danger)' }}>
                        {report.diffTarget
                            ? `Digit ${report.diffTarget.digit} (${report.diffTarget.pct.toFixed(2)}%)`
                            : 'No clean target yet'}
                    </span>
                </div>
                <div className='tools-stat-row'>
                    <span className='tools-stat-row__label'>
                        <Localize i18n_default_text='Streak' />
                    </span>
                    <span
                        className={`tools-pill ${report.streak.len >= 5 ? 'tools-pill--warn' : report.streak.len >= 3 ? 'tools-pill--odd' : 'tools-pill--ok'}`}
                    >
                        {report.streak.type} ×{report.streak.len}
                    </span>
                </div>
                <div className='tools-stat-row'>
                    <span className='tools-stat-row__label'>
                        <Localize i18n_default_text='Market predictability' />
                    </span>
                    <span className='tools-stat-row__value'>
                        {report.predictable ? 'HIGH — patterns visible' : 'LOW — close to random'}
                    </span>
                </div>
            </div>

            <div className='tools-card tools-card--orange'>
                <div className='tools-card__title'>
                    {'🎯 '}
                    <Localize i18n_default_text='Best Trade Setup Right Now' />
                </div>
                <div className='tools-warning-row'>
                    <div className='tools-warning-row__dot tools-warning-row__dot--low'>1</div>
                    <div>
                        <strong>{report.bestSetupText}</strong>
                        <div className='tools-warning-row__sub'>
                            <Localize i18n_default_text='Check the relevant tab above for the full entry checklist' />
                        </div>
                    </div>
                </div>
            </div>

            <div className='tools-card tools-card--teal'>
                <div className='tools-card__title'>
                    {'💰 '}
                    <Localize i18n_default_text='Safe Risk Per Trade' />
                </div>
                <SimpleBar value={report.kelly} color='var(--status-info)' label='recommended risk size' />
                <div className='tools-kelly-text'>
                    <Localize
                        i18n_default_text='Risk <0>{{kelly}}%</0> of your account | RSI: {{rsi}} | Ticks: {{ticks}}'
                        values={{
                            kelly: report.kelly.toFixed(1),
                            rsi: report.rsi14 !== null ? report.rsi14.toFixed(1) : 'N/A',
                            ticks: report.n,
                        }}
                        components={[<strong key={0} />]}
                    />
                </div>
            </div>

            <div className='tools-card tools-card--red'>
                <div className='tools-card__title'>
                    {'⛔ '}
                    <Localize i18n_default_text='Avoid Right Now' />
                </div>
                <div className='tools-card__desc'>{report.avoidText}</div>
            </div>

            <div className='tools-card tools-card--purple'>
                <div className='tools-card__title'>
                    {'📈 '}
                    <Localize i18n_default_text='Beginner Path (CEOskit Week-by-Week)' />
                </div>
                <div className='tools-warning-row'>
                    <div className='tools-warning-row__dot tools-warning-row__dot--info'>W1</div>
                    <div>
                        <Localize i18n_default_text='Practice UNDER 9 only — safest for beginners' />
                    </div>
                </div>
                <div className='tools-warning-row'>
                    <div className='tools-warning-row__dot tools-warning-row__dot--info'>W2</div>
                    <div>
                        <Localize i18n_default_text='Add UNDER 8 strategy' />
                    </div>
                </div>
                <div className='tools-warning-row'>
                    <div className='tools-warning-row__dot tools-warning-row__dot--info'>W3</div>
                    <div>
                        <Localize i18n_default_text='Try 3-Candle Rise/Fall on demo' />
                    </div>
                </div>
                <div className='tools-warning-row'>
                    <div className='tools-warning-row__dot tools-warning-row__dot--info'>W4</div>
                    <div>
                        <Localize i18n_default_text='Add Even/Odd strategy' />
                    </div>
                </div>
                <div className='tools-warning-row'>
                    <div className='tools-warning-row__dot tools-warning-row__dot--info'>M2+</div>
                    <div>
                        <Localize i18n_default_text='Advanced: OVER/UNDER levels + Differs' />
                    </div>
                </div>
            </div>
        </div>
    );
});

export default ReportPanel;
