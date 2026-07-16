import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { heatColor } from '@/pages/signal-engine/components/digit-color';
import { extractBarrierDigit } from '@/stores/scanner-store';
import { driftOf } from '@/utils/signal-engine/pro-signal';
import { Localize } from '@deriv-com/translations';
import DigitStrip from '../../signal-engine/components/digit-strip';
import { useScannerStore } from '../use-scanner-store';

// Live digit percentage monitor for the scan's current top asset (results[0], or the
// closest candidate shown in the Market Watch fallback) — new capability, no direct
// reference equivalent as a standing panel. The reference's closest analogue,
// _scLiveValidate's livePcts computation, was one part of the deferred full live-validator
// engine, gated behind a dedicated per-signal WebSocket the reference opened itself
// (reference lines 17538-17862). Reuses dPcts/driftOf (pro-signal.ts, via
// ScannerStore.live_digit_pcts) and heatColor (digit-color.ts) — the same digit-percentage
// math and colour scale already built for Signal Engine's Over/Under grid — rather than
// re-deriving either, but renders its own scanner-namespaced markup instead of importing
// DigitHeatGrid directly: that component's CSS lives in signal-engine.scss, which isn't
// guaranteed to be loaded in a session that only ever visits the Scanner tab.
const ScannerLiveDigits = observer(() => {
    const scanner_store = useScannerStore();
    const { top_result, live_asset, live_tick_history, live_digit_pcts, live_full_history } = scanner_store;

    if (!top_result || !live_asset) return null;

    // Rise/Fall is a price-direction contract, not a digit contract — a digit-percentage grid
    // is meaningless for it, so show a Last 50 rise/fall tick strip instead of the digit grid
    // entirely (not alongside it).
    if (top_result.ct === 'CALL' || top_result.ct === 'PUT') {
        const last_50 = live_full_history.slice(-50);
        return (
            <div className='scanner-live-digits'>
                <div className='scanner-live-digits__header'>
                    <span className='scanner-live-digits__title'>
                        <Localize
                            i18n_default_text='📡 Last 50 — {{asset}}'
                            values={{ asset: top_result.assetLabel }}
                        />
                    </span>
                    <span className='scanner-live-digits__count'>
                        <Localize i18n_default_text='{{count}} / 50 ticks' values={{ count: last_50.length }} />
                    </span>
                </div>
                {!!last_50.length && (
                    <DigitStrip
                        ticks={last_50}
                        getDotStyle={t => ({
                            label: t.diff >= 0 ? 'R' : 'F',
                            color: t.diff >= 0 ? 'var(--status-success)' : 'var(--status-danger)',
                        })}
                    />
                )}
            </div>
        );
    }

    const highlight_digit = extractBarrierDigit(top_result);
    const tick_count = Math.min(live_tick_history.length, 1000);

    return (
        <div className='scanner-live-digits'>
            <div className='scanner-live-digits__header'>
                <span className='scanner-live-digits__title'>
                    <Localize
                        i18n_default_text='📡 Live Digits — {{asset}}'
                        values={{ asset: top_result.assetLabel }}
                    />
                </span>
                <span className='scanner-live-digits__count'>
                    <Localize i18n_default_text='{{count}} / 1000 ticks' values={{ count: tick_count }} />
                </span>
            </div>
            <div className='scanner-live-digits__grid'>
                {live_digit_pcts.map(({ digit, pct }) => {
                    const drift = driftOf(live_full_history, digit);
                    const arrow = drift > 0.5 ? '▲' : drift < -0.5 ? '▼' : '–';
                    const is_highlighted = digit === highlight_digit;
                    return (
                        <div
                            key={digit}
                            className={classNames('scanner-live-digits__cell', {
                                'scanner-live-digits__cell--highlighted': is_highlighted,
                            })}
                            style={{ background: is_highlighted ? 'var(--status-warning)' : heatColor(pct) }}
                        >
                            <span className='scanner-live-digits__digit'>{digit}</span>
                            <span className='scanner-live-digits__pct'>{pct.toFixed(1)}%</span>
                            <span className='scanner-live-digits__arrow'>{arrow}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

export default ScannerLiveDigits;
