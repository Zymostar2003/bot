import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { Localize } from '@deriv-com/translations';
import DualBar from './dual-bar';
import GroupBox from './group-box';
import PriceStrip from './price-strip';
import RunMeter from './run-meter';
import SignalEngineChart from './signal-engine-chart';

const MIN_CANDLES = 40;
const MIN_TICKS = 100;
const HOT_SCORE = 85;

// Faithful port of renderRF's activeRoom===0 branch (reference:
// reference/index-335-black-bars.html, lines 13865-13961). The "Patterns room" block
// (reference's `if(false){...}` at line 13963) is dead code in the reference and is not
// ported.
//
// The chart (reference: initChart/updateChart, lines 12276-12419) is mounted unconditionally,
// above the data-gate below — the reference creates the chart canvas as soon as the RF tab is
// active, independent of candleHistory.length, and only skips *populating* series data until
// candles arrive. An empty chart is faithful; a chart that never mounts until 40 candles show
// up is not.
const RiseFallPanel = observer(() => {
    const { signal_engine } = useStore();
    const { rf_gating, pro_signal, full_history, candle_history, granularity } = signal_engine;

    const has_enough_data = candle_history.length >= MIN_CANDLES && full_history.length >= MIN_TICKS;

    const is_hot = !!pro_signal && pro_signal.rf.score >= HOT_SCORE;
    const hot_direction = is_hot ? pro_signal!.rf.dir : null;

    return (
        <div
            className={classNames('signal-engine-rf-panel', {
                'signal-engine-rf-panel--hot-up': hot_direction === 'RISE',
                'signal-engine-rf-panel--hot-dn': hot_direction === 'FALL',
            })}
        >
            <SignalEngineChart />
            {!has_enough_data ? (
                <div className='signal-engine-rf-panel__loading'>
                    <Localize i18n_default_text='Gathering market data…' />
                </div>
            ) : (
                <RiseFallSignals
                    rf_gating={rf_gating}
                    pro_signal={pro_signal}
                    full_history={full_history}
                    granularity={granularity}
                />
            )}
        </div>
    );
});

type TRiseFallSignalsProps = {
    rf_gating: ReturnType<typeof useStore>['signal_engine']['rf_gating'];
    pro_signal: ReturnType<typeof useStore>['signal_engine']['pro_signal'];
    full_history: ReturnType<typeof useStore>['signal_engine']['full_history'];
    granularity: number;
};

const RiseFallSignals = ({ rf_gating, pro_signal, full_history, granularity }: TRiseFallSignalsProps) => {
    const { rCnt, fCnt, riseReady, fallReady, bias } = rf_gating;
    const timeframe_label = granularity >= 60 ? `${Math.round(granularity / 60)}min` : '1min';
    const window50 = full_history.slice(-50);
    const rises50 = window50.filter(t => t.diff >= 0).length;
    const rise_pct = (rises50 / window50.length) * 100;

    return (
        <>
            <GroupBox direction='rise' count={rCnt} ready={riseReady} timeframe_label={timeframe_label} bias={bias} />
            <GroupBox direction='fall' count={fCnt} ready={fallReady} timeframe_label={timeframe_label} />
            {pro_signal && (
                <div className='signal-engine-meter-card'>
                    <div className='signal-engine-meter-card__title'>
                        <Localize i18n_default_text='RUN METER — {{dir}}' values={{ dir: pro_signal.rf.dir }} />
                    </div>
                    <RunMeter
                        runs={pro_signal.rf.runs}
                        score={pro_signal.rf.score}
                        variant={pro_signal.rf.dir === 'RISE' ? 'success' : 'danger'}
                    />
                </div>
            )}
            <PriceStrip ticks={full_history.slice(-20)} />
            <DualBar rise_pct={rise_pct} />
        </>
    );
};

export default RiseFallPanel;
