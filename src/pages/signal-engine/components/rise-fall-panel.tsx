import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { Localize } from '@deriv-com/translations';
import DualBar from './dual-bar';
import GroupBox from './group-box';
import PriceStrip from './price-strip';
import RunMeter from './run-meter';

const MIN_CANDLES = 40;
const MIN_TICKS = 100;
const HOT_SCORE = 85;

// Faithful port of renderRF's activeRoom===0 branch (reference:
// reference/index-335-black-bars.html, lines 7136-7231). The "Patterns room" block
// (reference's `if(false){...}` at line 7234) is dead code in the reference and is not
// ported.
const RiseFallPanel = observer(() => {
    const { signal_engine } = useStore();
    const { rf_gating, pro_signal, full_history, candle_history, granularity } = signal_engine;

    if (candle_history.length < MIN_CANDLES || full_history.length < MIN_TICKS) {
        return (
            <div className='signal-engine-rf-panel signal-engine-rf-panel--loading'>
                <Localize i18n_default_text='Gathering market data…' />
            </div>
        );
    }

    const { rCnt, fCnt, riseReady, fallReady, bias } = rf_gating;
    const timeframe_label = granularity >= 60 ? `${Math.round(granularity / 60)}min` : '1min';
    const window50 = full_history.slice(-50);
    const rises50 = window50.filter(t => t.diff >= 0).length;
    const rise_pct = (rises50 / window50.length) * 100;

    const is_hot = !!pro_signal && pro_signal.rf.score >= HOT_SCORE;
    const hot_direction = is_hot ? pro_signal!.rf.dir : null;

    return (
        <div
            className={classNames('signal-engine-rf-panel', {
                'signal-engine-rf-panel--hot-up': hot_direction === 'RISE',
                'signal-engine-rf-panel--hot-dn': hot_direction === 'FALL',
            })}
        >
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
        </div>
    );
});

export default RiseFallPanel;
