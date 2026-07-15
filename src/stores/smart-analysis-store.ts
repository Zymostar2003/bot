import { action, computed, makeObservable, observable, reaction } from 'mobx';
import { api_base } from '@/external/bot-skeleton';
import {
    CONNECTION_STATUS,
    connectionStatus$,
} from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import TicksService from '@/external/bot-skeleton/services/api/ticks_service';
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
    ticks_service: TicksService | null = null;
    tick_monitor_key: string | null = null;
    connection_subscription: { unsubscribe: () => void } | null = null;
    has_set_initial_symbol = false;

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
            onTicksUpdate: action,
            setSubscribed: action,
            setProSignal: action,
        });

        this.root_store = root_store;

        // Same api_base.init()/RootStore-construction race as SignalEngineStore — TicksService
        // must not be created until the connection is confirmed OPENED. Also calls
        // startMonitoring() directly here (matching SignalEngineStore's own subscription
        // exactly) rather than relying solely on the "auto-select first symbol" reaction
        // below — that reaction is guarded by has_set_initial_symbol to only ever fire ONCE
        // per app lifetime, so on a reconnect (a dropped connection reopening, not just the
        // very first connect) it would never fire again and monitoring would never resume,
        // permanently freezing this page on stale data. startMonitoring() itself no-ops
        // harmlessly if this.symbol is still empty (the very first connect, before the
        // reaction has picked an initial symbol yet), so this is safe to call unconditionally
        // on every OPENED event.
        this.connection_subscription = connectionStatus$.subscribe(status => {
            if (status === CONNECTION_STATUS.OPENED && api_base.api) {
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
        return (api_base.pip_sizes as Record<string, number>)?.[this.symbol] ?? 2;
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

    // Faithful port of buildMarketList/saConnect's symbol-source (reference lines
    // 11040/11071-11074), scoped to synthetic indices only. Reuses the app's existing
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

        // Captured so the callback/`.then()` below can tell whether they're still relevant
        // once they actually resolve — TicksService.monitor() now delivers its initial
        // history batch as soon as it's fetched (see ticks_service.js's monitor() fix)
        // rather than waiting for the next live tick, which means a slow response for a
        // symbol the user has since switched away from can otherwise land AFTER a faster
        // response for the new symbol and silently overwrite it with stale data.
        const symbol = this.symbol;

        this.ticks_service
            .monitor({
                symbol,
                granularity: undefined,
                callback: ticks => {
                    if (this.symbol !== symbol) return; // superseded by a newer setSymbol call
                    this.onTicksUpdate(ticks);
                },
            })
            .then(key => {
                if (this.symbol === symbol) this.tick_monitor_key = key;
            });

        this.setSubscribed(true);
        // eslint-disable-next-line no-console
        console.log('[SmartAnalysisStore] monitoring started', { symbol: this.symbol });
    };

    stopMonitoring = (symbol: string = this.symbol) => {
        if (!this.ticks_service) return;

        if (this.tick_monitor_key) {
            this.ticks_service.stopMonitor({ symbol, granularity: undefined, key: this.tick_monitor_key });
            this.tick_monitor_key = null;
        }
        this.setSubscribed(false);
    };

    onTicksUpdate = (ticks: TTick[]) => {
        this.tick_history = ticks;
        // eslint-disable-next-line no-console
        console.log('[SmartAnalysisStore] tick', this.symbol, ticks.length, ticks[ticks.length - 1]);
    };

    setSubscribed = (is_subscribed: boolean) => {
        this.is_subscribed = is_subscribed;
    };

    // One-way: this store never writes back to chart_store or any other store — mirrors
    // SignalEngineStore.setSymbol's convention exactly.
    setSymbol = (symbol: string) => {
        if (!symbol || symbol === this.symbol) return;
        const prev_symbol = this.symbol;
        this.stopMonitoring(prev_symbol);
        this.tick_history = [];
        this.symbol = symbol;
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
