import { action, computed, makeObservable, observable, reaction } from 'mobx';
import { api_base } from '@/external/bot-skeleton';
import {
    CONNECTION_STATUS,
    connectionStatus$,
} from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import TicksService from '@/external/bot-skeleton/services/api/ticks_service';
import { toFullHistoryTicks } from '@/utils/signal-engine/adapters';
import { checkGravitonPulseCross } from '@/utils/signal-engine/crossover';
import { calcGraviton } from '@/utils/signal-engine/graviton';
import {
    consecDir,
    consecEO,
    createHysteresisState,
    dPcts,
    driftOf,
    proSignal,
} from '@/utils/signal-engine/pro-signal';
import { calcPulse } from '@/utils/signal-engine/pulse';
import { beepSignal } from '@/utils/signal-engine/sound';
import {
    TCandle,
    TChartMarker,
    TCrossSignal,
    TFullHistoryTick,
    TGravitonPoint,
    THysteresisState,
    TIndicatorBias,
    TProSignalResult,
    TPulsePoint,
    TTick,
    TVfpiResult,
} from '@/utils/signal-engine/types';
import { calcVFPI, getIndicatorBias } from '@/utils/signal-engine/vfpi';
import { ActiveSymbols } from '@deriv/api-types';
import RootStore from './root-store';

type TSignalEngineTab = 'rf' | 'ou' | 'eo';

type TOUDirection = 'over' | 'under';

type TIndicatorKey = 'vfpi' | 'graviton' | 'pulse';

type TIndicatorVisibility = Record<TIndicatorKey, boolean>;

type TIndicatorSettings = {
    sig_strong: number;
    sig_confirmed: number;
    sig_noise_floor: number;
    vfpi_sig_conf: number;
};

// Faithful defaults from the reference app's IS_DEF (index-335-black-bars.html, line 7946).
const DEFAULT_INDICATOR_SETTINGS: TIndicatorSettings = {
    sig_strong: 72,
    sig_confirmed: 50,
    sig_noise_floor: 30,
    vfpi_sig_conf: 52,
};

const MAX_CHART_MARKERS = 30;

export default class SignalEngineStore {
    root_store: RootStore;
    ticks_service: TicksService | null = null;
    tick_monitor_key: string | null = null;
    candle_monitor_key: string | null = null;
    connection_subscription: { unsubscribe: () => void } | null = null;
    has_set_initial_symbol = false;

    // Algorithmic memory that the ported functions mutate — kept as plain (non-observable)
    // fields, matching the reference's module-global _lastCrossSignal / _iframeSigState /
    // lastSignalPlay / audioCtx. Their effects surface via the observable fields below.
    _last_cross_signal: TCrossSignal = null;
    _hysteresis_state: THysteresisState = createHysteresisState();
    _last_signal_play = '';
    _audio_ctx: AudioContext | null = null;

    symbol = '';
    granularity = 60;
    active_tab: TSignalEngineTab = 'rf';
    tick_history: TTick[] = [];
    candle_history: TCandle[] = [];
    indicator_settings: TIndicatorSettings = { ...DEFAULT_INDICATOR_SETTINGS };
    indicator_visibility: TIndicatorVisibility = { vfpi: true, graviton: true, pulse: true };
    sound_enabled = false;
    is_subscribed = false;

    // Over/Under tab state — faithful defaults from the reference's globals
    // (index-335-black-bars.html, line 12167: "let activeBarrier = 5, activeDir = 'over'").
    active_barrier = 5;
    active_dir: TOUDirection = 'over';

    // Asset picker options — a local observable copy of api_base.active_symbols (itself a
    // plain non-reactive array) scoped to synthetic indices only, matching the reference's
    // 4 categories (volatility/jump/crash_boom/step), which are all market:'synthetic_index'
    // submarkets. Reused from the existing app-wide active_symbols fetch — the reference
    // opens its own separate `active_symbols:'brief'` socket call (buildMarketList, line
    // 13419); that's not ported since dbot already fetches this once at connection open.
    available_symbols: ActiveSymbols = [];

    // Written by the reaction watching vfpi_results, mirroring the reference's
    // _lastVfpiValue: it's "sticky" — it only updates when calcVFPI returns a non-empty
    // result, so a momentary gap (e.g. too few candles) doesn't reset bias to neutral.
    last_vfpi_value = 0;

    cross_signal: TCrossSignal = null;
    chart_markers: TChartMarker[] = [];
    pro_signal: TProSignalResult | null = null;

    constructor(root_store: RootStore) {
        makeObservable(this, {
            symbol: observable,
            granularity: observable,
            active_tab: observable,
            tick_history: observable,
            candle_history: observable,
            indicator_settings: observable,
            indicator_visibility: observable,
            sound_enabled: observable,
            is_subscribed: observable,
            last_vfpi_value: observable,
            cross_signal: observable,
            chart_markers: observable,
            pro_signal: observable,
            active_barrier: observable,
            active_dir: observable,
            available_symbols: observable,
            full_history: computed,
            graviton_data: computed,
            pulse_data: computed,
            vfpi_results: computed,
            vfpi_bias: computed,
            rf_gating: computed,
            ou_gating: computed,
            eo_gating: computed,
            symbol_options: computed,
            setSymbol: action.bound,
            setGranularity: action.bound,
            setActiveTab: action.bound,
            setActiveBarrier: action.bound,
            setActiveDir: action.bound,
            setAvailableSymbols: action.bound,
            updateIndicatorSetting: action.bound,
            resetIndicatorSettings: action.bound,
            toggleIndicator: action.bound,
            toggleSound: action.bound,
            onTicksUpdate: action,
            onCandlesUpdate: action,
            setSubscribed: action,
            initDefaultSymbol: action,
            setLastVfpiValue: action,
            setProSignal: action,
            fireCrossSignal: action,
        });

        this.root_store = root_store;

        // api_base.init() (app-root.tsx) races RootStore construction (useStore.tsx), so
        // TicksService — which only binds its onMessage listener if api_base.api already
        // exists — must not be created until the connection is confirmed OPENED.
        this.connection_subscription = connectionStatus$.subscribe(status => {
            if (status === CONNECTION_STATUS.OPENED && api_base.api) {
                this.initDefaultSymbol();
                this.startMonitoring();
                this.loadAvailableSymbols();
            }
        });

        // _lastVfpiValue is "sticky" in the reference (only updateVFP's non-empty branch
        // writes it) — replicated here instead of as a plain `computed` (see field comment).
        reaction(
            () => this.vfpi_results,
            results => {
                const last = results[results.length - 1];
                if (last) this.setLastVfpiValue(last.vfpi);
            }
        );

        // Faithful port of _checkGravitonPulseCross's call site (updatePulse, reference
        // line 5961): re-check the cross whenever either line's data changes.
        reaction(
            () => ({ graviton: this.graviton_data, pulse: this.pulse_data }),
            ({ graviton, pulse }) => {
                const { signal, lastSignal } = checkGravitonPulseCross(graviton, pulse, this._last_cross_signal);
                this._last_cross_signal = lastSignal;
                if (signal) {
                    const lastPulsePoint = pulse[pulse.length - 1];
                    this.fireCrossSignal(signal, lastPulsePoint ? lastPulsePoint.value : 0);
                }
            }
        );

        // Faithful port of proSignal()'s call site (renderRF, reference line 7206) — it's
        // one confluence engine computing rf/eo/ou/diff/mtch together, so it recomputes
        // whenever the tick history or VFPI bias changes, not just when the RF tab is open.
        reaction(
            () => ({ fullHistory: this.full_history, bias: this.vfpi_bias }),
            ({ fullHistory, bias }) => {
                const result = proSignal(fullHistory, this.candle_history, bias, this._hysteresis_state);
                this.setProSignal(result);
            }
        );

        // Faithful port of `if(hasSig && sigType) beepSignal(sigType);` (renderRF,
        // reference line 7214) — fires only when rf_gating.sigType actually changes,
        // which combined with beepSignal's own lastSignalPlay de-dupe matches the
        // reference's "don't re-beep on every render" behavior.
        reaction(
            () => this.rf_gating.sigType,
            sigType => {
                if (!sigType) return;
                this._last_signal_play = beepSignal(
                    this.getAudioCtx,
                    this.sound_enabled,
                    sigType,
                    this._last_signal_play
                );
            }
        );
    }

    // ── Derived indicator data (pure calc — safe as MobX computed) ──

    get pip_size(): number {
        return (api_base.pip_sizes as Record<string, number>)?.[this.symbol] ?? 2;
    }

    get full_history(): TFullHistoryTick[] {
        return toFullHistoryTicks(this.tick_history, this.pip_size);
    }

    get graviton_data(): TGravitonPoint[] {
        return calcGraviton(this.candle_history);
    }

    get pulse_data(): TPulsePoint[] {
        return calcPulse(this.candle_history);
    }

    get vfpi_results(): TVfpiResult[] {
        return calcVFPI(this.candle_history, this.indicator_settings.vfpi_sig_conf);
    }

    get vfpi_bias(): TIndicatorBias {
        return getIndicatorBias(this.last_vfpi_value);
    }

    // Faithful port of renderRF's riseReady/fallReady/hasSig/sigType gating
    // (reference lines 7136-7142).
    get rf_gating() {
        const cd = consecDir(this.full_history, this.candle_history);
        const bias = this.vfpi_bias;
        const biasBoostRise = bias === 'bull' ? 1 : bias === 'bear' ? -1 : 0;
        const rCnt = cd.rise;
        const fCnt = cd.fall;
        const riseReady = rCnt >= 3 && biasBoostRise >= 0;
        const fallReady = fCnt >= 3 && biasBoostRise <= 0;
        const hasSig = riseReady || fallReady;
        const sigType: 'RISE' | 'FALL' | null = riseReady ? 'RISE' : fallReady ? 'FALL' : null;
        return { rCnt, fCnt, riseReady, fallReady, hasSig, sigType, bias };
    }

    // Faithful port of renderOU's activeRoom===0 gating (reference: index-335-black-bars.html,
    // lines 14105-14189) — barrier grid percentages, cursor/stability check, and the
    // over/under group split. `bestBarrier` auto-detection lives separately in proSignal's
    // `ou` result (used for the run meter); this is specifically the user-selected
    // active_barrier/active_dir the barrier grid and entry signal box react to.
    get ou_gating() {
        const p1000 = dPcts(this.full_history, 1000);
        const cur = this.full_history[this.full_history.length - 1]?.digit ?? 0;
        const barrier = this.active_barrier;
        const cursorOnBarrier = cur === barrier;
        const isStable = Math.abs(driftOf(this.full_history, barrier)) < 0.5;
        const belowWeak =
            this.active_dir === 'over'
                ? Array.from({ length: barrier + 1 }, (_, i) => i).every(i => p1000[i].pct <= 9)
                : false;
        const aboveWeak =
            this.active_dir === 'under'
                ? Array.from({ length: 9 - barrier }, (_, i) => barrier + i).every(i => (p1000[i]?.pct ?? 0) < 10)
                : false;
        const canEnter = cursorOnBarrier && isStable && (this.active_dir === 'over' ? belowWeak : aboveWeak);

        const overDigits = [barrier + 1, barrier + 2, barrier + 3, barrier + 4, barrier + 5].filter(d => d <= 9);
        const underDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].slice(0, barrier + 1);
        const overPct = overDigits.reduce((a, d) => a + p1000[d].pct, 0);
        const underPct = underDigits.reduce((a, d) => a + p1000[d].pct, 0);
        const overStrong = overPct > underPct && overDigits.every(d => p1000[d].pct > 0);
        const underStrong = underPct > overPct;

        return {
            p1000,
            cur,
            cursorOnBarrier,
            isStable,
            canEnter,
            overDigits,
            underDigits,
            overPct,
            underPct,
            overStrong,
            underStrong,
        };
    }

    // Faithful port of renderEO's activeRoom===0 gating (reference: index-335-black-bars.html,
    // lines 14282-14310) — even/odd digit-percentage groups, streak readiness, and the "best
    // signal" verdict.
    get eo_gating() {
        const p1000 = dPcts(this.full_history, 1000);
        const evenD = [0, 2, 4, 6, 8];
        const oddD = [1, 3, 5, 7, 9];
        const evenSum = evenD.reduce((a, d) => a + p1000[d].pct, 0);
        const oddSum = oddD.reduce((a, d) => a + p1000[d].pct, 0);
        const evenAbove10 = evenD.filter(d => p1000[d].pct >= 10).length;
        const oddAbove10 = oddD.filter(d => p1000[d].pct >= 10).length;
        const noOddHigh = !oddD.some(d => p1000[d].pct >= 9.7);
        const noEvenHigh = !evenD.some(d => p1000[d].pct >= 9.7);
        const eoStreak = consecEO(this.full_history);
        const evenReady = evenAbove10 >= 3 && noOddHigh;
        const oddReady = oddAbove10 >= 3 && noEvenHigh;
        const sig: 'EVEN' | 'ODD' =
            evenReady && eoStreak.even >= 3
                ? 'EVEN'
                : oddReady && eoStreak.odd >= 3
                  ? 'ODD'
                  : evenSum > oddSum
                    ? 'EVEN'
                    : 'ODD';
        const conf: 'STRONG' | 'MODERATE' | 'WEAK' =
            (sig === 'EVEN' && evenReady && eoStreak.even >= 3) || (sig === 'ODD' && oddReady && eoStreak.odd >= 3)
                ? 'STRONG'
                : evenAbove10 >= 2 || oddAbove10 >= 2
                  ? 'MODERATE'
                  : 'WEAK';

        return {
            p1000,
            evenD,
            oddD,
            evenSum,
            oddSum,
            evenAbove10,
            oddAbove10,
            evenReady,
            oddReady,
            eoStreak,
            sig,
            conf,
        };
    }

    // Asset dropdown options, grouped by submarket (e.g. "Volatility Indices", "Crash/Boom
    // Indices") — SelectNative groups automatically via each item's `group` field.
    get symbol_options() {
        return this.available_symbols.map(s => ({
            text: s.display_name,
            value: s.symbol,
            group: s.submarket_display_name,
        }));
    }

    // ── Sound (lazy AudioContext, matching the reference's beep()) ──

    getAudioCtx = (): AudioContext => {
        if (!this._audio_ctx) {
            const AudioCtxCtor =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            this._audio_ctx = new AudioCtxCtor();
        }
        return this._audio_ctx;
    };

    // ── Crossover / pro-signal side-effect setters (called from the reactions above) ──

    setLastVfpiValue = (value: number) => {
        this.last_vfpi_value = value;
    };

    setProSignal = (result: TProSignalResult | null) => {
        this.pro_signal = result;
    };

    // Faithful port of _fireGravitonPulseSignal's marker logic (reference lines 5996-6018).
    // The reference also guards a call to `_tpBeep`, but that function is never actually
    // defined anywhere in the reference app — the `typeof _tpBeep==='function'` check
    // always fails, so it's a no-op in practice and is not ported.
    fireCrossSignal = (signal: 'BUY' | 'SELL', price: number) => {
        this.cross_signal = signal;
        const marker: TChartMarker = {
            time: this.pulse_data[this.pulse_data.length - 1]?.time ?? 0,
            position: signal === 'BUY' ? 'belowBar' : 'aboveBar',
            color: signal === 'BUY' ? '#00e676' : '#ff5252',
            shape: signal === 'BUY' ? 'arrowUp' : 'arrowDown',
            text: signal,
        };
        const next = [...this.chart_markers, marker];
        this.chart_markers = next.length > MAX_CHART_MARKERS ? next.slice(-MAX_CHART_MARKERS) : next;
        // eslint-disable-next-line no-console
        console.log('[CROSS]', `${signal === 'BUY' ? '🟢▲' : '🔴▼'} PULSE × GRAVITON ${signal} @ ${price.toFixed(2)}`);
    };

    // ── WebSocket wiring (from step a, unchanged) ──

    initDefaultSymbol = () => {
        if (this.has_set_initial_symbol) return;
        const { chart_store } = this.root_store;
        if (chart_store?.symbol) {
            this.symbol = chart_store.symbol;
        }
        this.has_set_initial_symbol = true;
    };

    // Faithful port of buildMarketList's data source (reference: index-335-black-bars.html,
    // lines 13419-13433), scoped to synthetic indices only. Reuses the app's existing
    // active_symbols fetch (api_base.active_symbols / active_symbols_promise) rather than
    // opening the reference's separate `active_symbols:'brief'` socket call.
    loadAvailableSymbols = async () => {
        if (!api_base.has_active_symbols) {
            await api_base.active_symbols_promise;
        }
        const symbols = (api_base.active_symbols ?? []) as ActiveSymbols;
        this.setAvailableSymbols(symbols.filter(s => s.market === 'synthetic_index'));
    };

    startMonitoring = () => {
        if (!this.symbol) return;
        if (!this.ticks_service) {
            this.ticks_service = new TicksService();
        }

        this.ticks_service
            .monitor({ symbol: this.symbol, granularity: undefined, callback: this.onTicksUpdate })
            .then(key => {
                this.tick_monitor_key = key;
            });

        this.ticks_service
            .monitor({ symbol: this.symbol, granularity: this.granularity, callback: this.onCandlesUpdate })
            .then(key => {
                this.candle_monitor_key = key;
            });

        this.setSubscribed(true);
        // eslint-disable-next-line no-console
        console.log('[SignalEngineStore] monitoring started', { symbol: this.symbol, granularity: this.granularity });
    };

    stopMonitoring = (symbol: string = this.symbol, granularity: number = this.granularity) => {
        if (!this.ticks_service) return;

        if (this.tick_monitor_key) {
            this.ticks_service.stopMonitor({ symbol, granularity: undefined, key: this.tick_monitor_key });
            this.tick_monitor_key = null;
        }
        if (this.candle_monitor_key) {
            this.ticks_service.stopMonitor({ symbol, granularity, key: this.candle_monitor_key });
            this.candle_monitor_key = null;
        }
        this.setSubscribed(false);
    };

    onTicksUpdate = (ticks: TTick[]) => {
        this.tick_history = ticks;
        // eslint-disable-next-line no-console
        console.log('[SignalEngineStore] tick', this.symbol, ticks.length, ticks[ticks.length - 1]);
    };

    onCandlesUpdate = (candles: TCandle[]) => {
        this.candle_history = candles;
        // eslint-disable-next-line no-console
        console.log(
            '[SignalEngineStore] candle',
            this.symbol,
            this.granularity,
            candles.length,
            candles[candles.length - 1]
        );
    };

    setSubscribed = (is_subscribed: boolean) => {
        this.is_subscribed = is_subscribed;
    };

    // One-way: reads chart_store.symbol only once as the initial default (see initDefaultSymbol).
    // Changing the Signal Engine symbol afterwards never writes back to chart_store.
    setSymbol = (symbol: string) => {
        if (!symbol || symbol === this.symbol) return;
        const prev_symbol = this.symbol;
        const prev_granularity = this.granularity;
        this.stopMonitoring(prev_symbol, prev_granularity);
        this.tick_history = [];
        this.candle_history = [];
        this.symbol = symbol;
        this.startMonitoring();
    };

    setGranularity = (granularity: number) => {
        if (granularity === this.granularity) return;
        if (this.ticks_service && this.candle_monitor_key) {
            this.ticks_service.stopMonitor({
                symbol: this.symbol,
                granularity: this.granularity,
                key: this.candle_monitor_key,
            });
            this.candle_monitor_key = null;
        }
        this.granularity = granularity;
        this.candle_history = [];
        if (this.ticks_service && this.symbol) {
            this.ticks_service
                .monitor({ symbol: this.symbol, granularity: this.granularity, callback: this.onCandlesUpdate })
                .then(key => {
                    this.candle_monitor_key = key;
                });
        }
    };

    setActiveTab = (active_tab: TSignalEngineTab) => {
        this.active_tab = active_tab;
    };

    // Faithful port of setDir/initOUGrid's barrier click handler (reference lines 14075-14090).
    setActiveBarrier = (active_barrier: number) => {
        this.active_barrier = active_barrier;
    };

    setActiveDir = (active_dir: TOUDirection) => {
        this.active_dir = active_dir;
    };

    setAvailableSymbols = (available_symbols: ActiveSymbols) => {
        this.available_symbols = available_symbols;
    };

    // Faithful port of the reference app's isUpdate ordering-enforcement
    // (index-335-black-bars.html, lines 7993-8006): noise-floor < confirmed < strong.
    updateIndicatorSetting = (key: keyof TIndicatorSettings, value: number) => {
        this.indicator_settings[key] = value;
        if (this.indicator_settings.sig_noise_floor >= this.indicator_settings.sig_confirmed) {
            this.indicator_settings.sig_confirmed = this.indicator_settings.sig_noise_floor + 5;
        }
        if (this.indicator_settings.sig_confirmed >= this.indicator_settings.sig_strong) {
            this.indicator_settings.sig_strong = this.indicator_settings.sig_confirmed + 5;
        }
    };

    resetIndicatorSettings = () => {
        this.indicator_settings = { ...DEFAULT_INDICATOR_SETTINGS };
    };

    toggleIndicator = (which: TIndicatorKey) => {
        this.indicator_visibility[which] = !this.indicator_visibility[which];
    };

    toggleSound = () => {
        this.sound_enabled = !this.sound_enabled;
    };
}
