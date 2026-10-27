import { action, computed, makeObservable, observable, reaction } from 'mobx';
import { api_base } from '@/external/bot-skeleton';
import {
    CONNECTION_STATUS,
    connectionStatus$,
} from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { DerivStream } from '@/utils/deriv-websocket';
import { toFullHistoryTicks } from '@/utils/signal-engine/adapters';
import { createHysteresisState, dPcts, proSignal } from '@/utils/signal-engine/pro-signal';
import { TFullHistoryTick, THysteresisState, TProSignalResult, TTick } from '@/utils/signal-engine/types';
import { filterSymbolsByCategory, shouldShowContractNav } from '@/utils/smart-analysis/category';
import { computeConcentration } from '@/utils/smart-analysis/concentration';
import { rankDigits } from '@/utils/smart-analysis/digit-rank';
import { buildInsightTips } from '@/utils/smart-analysis/insight';
import { buildLast50Stats } from '@/utils/smart-analysis/last-50';
import {
    TConcentrationResult,
    TDigitRank,
    TInsightTip,
    TLast50Stats,
    TSaCategory,
    TSaContractType,
    TSaView,
} from '@/utils/smart-analysis/types';
import { ActiveSymbols } from '@deriv/api-types';
import RootStore from './root-store';

// Faithful default from the reference's saActiveCat/saActiveType/_saActiveView/saActiveBarrier
// globals (index-335-black-bars.html, lines 10868-10870, 10909).
const DEFAULT_CATEGORY: TSaCategory = 'volatility';
const DEFAULT_CONTRACT_TYPE: TSaContractType = 'rise_fall';
const DEFAULT_VIEW: TSaView = 'digits';

export default class SmartAnalysisStore {
    root_store: RootStore;
    stream: DerivStream | null = null;
    connection_subscription: { unsubscribe: () => void } | null = null;
    has_set_initial_symbol = false;
    _stream_pip_size = 2;

    // Algorithmic memory that proSignal mutates — kept as a plain (non-observable) field,
    // matching signal-engine-store's _hysteresis_state convention. Its effect surfaces via
    // the observable pro_signal field below.
    _hysteresis_state: THysteresisState = createHysteresisState();

    symbol = '';
    category: TSaCategory = DEFAULT_CATEGORY;
    contract_type: TSaContractType = DEFAULT_CONTRACT_TYPE;
    active_view: TSaView = DEFAULT_VIEW;
    active_barrier: number | null = null;
    tick_history: TTick[] = [];
    is_subscribed = false;

    // Local observable copy of api_base.active_symbols scoped to synthetic indices only —
    // same reuse rationale as SignalEngineStore.available_symbols (see that store's field
    // comment): dbot already fetches this once at connection open, so Smart Analysis doesn't
    // open its own separate `active_symbols:'brief'` socket call the way the reference does
    // (saConnect, reference lines 11040, 11071-11074).
    available_symbols: ActiveSymbols = [];

    pro_signal: TProSignalResult | null = null;

    constructor(root_store: RootStore) {
        makeObservable(this, {
            symbol: observable,
            category: observable,
            contract_type: observable,
            active_view: observable,
            active_barrier: observable,
            tick_history: observable,
            is_subscribed: observable,
            available_symbols: observable,
            pro_signal: observable,
            pip_size: computed,
            full_history: computed,
            digit_pcts: computed,
            digit_ranks: computed,
            concentration: computed,
            insight_tips: computed,
            last50_stats: computed,
            show_contract_nav: computed,
            filtered_symbols: computed,
            symbol_options: computed,
            setSymbol: action.bound,
            setCategory: action.bound,
            setContractType: action.bound,
            setActiveView: action.bound,
            setActiveBarrier: action.bound,
            resetActiveBarrier: action.bound,
            setAvailableSymbols: action.bound,
            onTick: action,
            onTicksUpdate: action,
            setSubscribed: action,
            setProSignal: action,
        });

        this.root_store = root_store;

        this.loadAvailableSymbols();

        this.connection_subscription = connectionStatus$.subscribe(status => {
            if (status === CONNECTION_STATUS.OPENED) {
                this.loadAvailableSymbols();
                this.startMonitoring();
            }
        });

        // Faithful port of saRenderList's "dispatch change on the first symbol of the filtered
        // list" auto-select (reference lines 11163-11170) — fires once, the first time the
        // active category's symbol list becomes non-empty. Structural change: the reference
        // re-derives this on every active_symbols refresh (guarded by a "did the leading
        // symbol change" check); here it only ever runs once because Smart Analysis has its
        // own one-way symbol sync (setSymbol) once a symbol is chosen, same as SignalEngine.
        reaction(
            () => this.filtered_symbols,
            filtered => {
                if (this.has_set_initial_symbol || !filtered.length) return;
                this.has_set_initial_symbol = true;
                this.setSymbol(filtered[0].symbol);
            }
        );

        // Faithful port of proSignal()'s call site (reference line 7206, reused here for the
        // Matches/Differs run-meter hints — see last-50-panel.tsx). No VFPI is wired up for
        // Smart Analysis (the reference's SA overlay doesn't read VFPI either), so bias is a
        // constant 'neutral' rather than a computed indicator bias.
        reaction(
            () => this.full_history,
            fullHistory => {
                const result = proSignal(fullHistory, [], 'neutral', this._hysteresis_state);
                this.setProSignal(result);
            }
        );
    }

    // ── Derived data (pure calc — safe as MobX computed) ──

    get pip_size(): number {
        return (api_base.pip_sizes as Record<string, number>)?.[this.symbol] ?? this._stream_pip_size ?? 2;
    }

    get full_history(): TFullHistoryTick[] {
        return toFullHistoryTicks(this.tick_history, this.pip_size);
    }

    get digit_pcts() {
        return dPcts(this.full_history, 1000);
    }

    get digit_ranks(): TDigitRank[] {
        return rankDigits(this.full_history);
    }

    get concentration(): TConcentrationResult | null {
        return computeConcentration(this.full_history);
    }

    get insight_tips(): TInsightTip[] | null {
        return buildInsightTips(this.full_history);
    }

    get last50_stats(): TLast50Stats | null {
        return buildLast50Stats(this.full_history, this.contract_type, this.active_barrier);
    }

    get show_contract_nav(): boolean {
        return shouldShowContractNav(this.category);
    }

    get filtered_symbols(): ActiveSymbols {
        return filterSymbolsByCategory(this.available_symbols, this.category);
    }

    get symbol_options() {
        return this.filtered_symbols.map(s => ({ text: s.display_name, value: s.symbol }));
    }

    // ── proSignal side-effect setter (called from the reaction above) ──

    setProSignal = (result: TProSignalResult | null) => {
        this.pro_signal = result;
    };

    // ── WebSocket wiring ──

    loadAvailableSymbols = async () => {
        if (api_base.has_active_symbols && (api_base.active_symbols as any[])?.length) {
            const symbols = (api_base.active_symbols ?? []) as ActiveSymbols;
            this.setAvailableSymbols(symbols.filter(s => s.market === 'synthetic_index'));
            return;
        }

        if (!this.stream) {
            this.stream = new DerivStream({ tag: 'SmartAnalysis' });
        }
        this.stream.requestActiveSymbols(symbols => {
            const synth = (symbols || []).filter((s: any) => s.market === 'synthetic_index');
            this.setAvailableSymbols(synth as ActiveSymbols);
        });
    };

    startMonitoring = () => {
        if (!this.symbol) return;
        if (!this.stream) {
            this.stream = new DerivStream({ tag: 'SmartAnalysis' });
        }

        const symbol = this.symbol;

        this.stream.subscribeTicks(
            symbol,
            (tick, pips) => {
                if (this.symbol !== symbol) return;
                this.onTick(tick, pips);
            },
            (ticks, pips) => {
                if (this.symbol !== symbol) return;
                this.onTicksUpdate(ticks, pips);
            }
        );

        this.setSubscribed(true);
        // eslint-disable-next-line no-console
        console.log('[SmartAnalysisStore] stream monitoring started', { symbol: this.symbol });
    };

    stopMonitoring = () => {
        if (this.stream) {
            this.stream.unsubscribe('ticks');
        }
        this.setSubscribed(false);
    };

    onTick = (tick: TTick, pips?: number) => {
        if (pips && pips !== this._stream_pip_size) {
            this._stream_pip_size = pips;
        }
        const last = this.tick_history[this.tick_history.length - 1];
        if (last && last.epoch >= tick.epoch) return;
        this.tick_history = [...this.tick_history.slice(-999), tick];
    };

    onTicksUpdate = (ticks: TTick[], pips?: number) => {
        if (pips && pips !== this._stream_pip_size) {
            this._stream_pip_size = pips;
        }
        this.tick_history = ticks.slice(-1000);
        // eslint-disable-next-line no-console
        console.log('[SmartAnalysisStore] tick batch', this.symbol, ticks.length);
    };

    setSubscribed = (is_subscribed: boolean) => {
        this.is_subscribed = is_subscribed;
    };

    setSymbol = (symbol: string) => {
        if (!symbol || symbol === this.symbol) return;
        this.symbol = symbol;
        this.tick_history = [];
        this.startMonitoring();
    };

    // Faithful port of saSetCategory + saRenderList's auto-dispatch-on-change (reference
    // lines 10926-10929, 11163-11170): switching category re-scopes the asset list, and if
    // the current symbol falls outside the new category, jumps to that category's first
    // symbol (matching the reference's behavior of always having *some* symbol selected).
    setCategory = (category: TSaCategory) => {
        if (category === this.category) return;
        this.category = category;
        const filtered = filterSymbolsByCategory(this.available_symbols, category);
        if (filtered.length && !filtered.some(s => s.symbol === this.symbol)) {
            this.setSymbol(filtered[0].symbol);
        }
    };

    // Faithful port of the .sa-contract-btn click handler (reference lines 10932-10940).
    setContractType = (contract_type: TSaContractType) => {
        this.contract_type = contract_type;
    };

    // Faithful port of saSetView (reference lines 10910-10924).
    setActiveView = (active_view: TSaView) => {
        this.active_view = active_view;
    };

    // Faithful port of saSetupDigitGrid's barrier-btn click handler (reference lines
    // 11188-11195).
    setActiveBarrier = (active_barrier: number) => {
        this.active_barrier = active_barrier;
    };

    // Faithful port of saSetupDigitGrid's reset ("X") button handler (reference lines
    // 11201-11207).
    resetActiveBarrier = () => {
        this.active_barrier = null;
    };

    setAvailableSymbols = (available_symbols: ActiveSymbols) => {
        this.available_symbols = available_symbols;
    };
}
