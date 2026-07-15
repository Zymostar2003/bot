import { action, computed, makeObservable, observable, reaction } from 'mobx';
import { api_base } from '@/external/bot-skeleton';
import {
    CONNECTION_STATUS,
    connectionStatus$,
} from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { CT_NEEDS_PREDICTION, CT_TO_TRADETYPE } from '@/utils/scanner/constants';
import { TContractType, TScanResult } from '@/utils/scanner/types';
import { filterSymbolsByCategory } from '@/utils/smart-analysis/category';
import { TSaCategory } from '@/utils/smart-analysis/types';
import { ActiveSymbols } from '@deriv/api-types';
import RootStore from './root-store';
import { extractBarrierDigit } from './scanner-store';

// Faithful port of Trade Setup's contract-type chip order (reference:
// index-335-black-bars.html, lines 5161-5172: MATCH, DIFFER, EVEN, ODD, OVER, UNDER, RISE,
// FALL) — a different display order than Scanner's own CONTRACT_TYPES array, so kept as its
// own constant rather than reusing that one.
export const TRADE_SETUP_CONTRACT_TYPES: TContractType[] = [
    'DIGITMATCH',
    'DIGITDIFF',
    'DIGITEVEN',
    'DIGITODD',
    'DIGITOVER',
    'DIGITUNDER',
    'CALL',
    'PUT',
];

export type TDurationUnit = 't' | 'm';

// Faithful port of Trade Setup's duration button rows (reference lines 5211-5237).
export const TICK_DURATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const MINUTE_DURATIONS = [1, 2, 3, 5, 10, 15, 30];

// Faithful port of Trade Setup's stake preset grid (reference lines 5270-5276).
export const STAKE_PRESETS = [0.5, 1.0, 2.0, 5.0, 10.0, 25.0];

// dbot's own Quick Strategy engine excludes crash_index/step_index submarkets from trading
// (QUICK_STRATEGY.DISABLED.SUBMARKETS, src/external/bot-skeleton/constants/config.ts) — the
// reference's Trade Setup offers all 4 categories (volatility/crash_boom/step/jump) since its
// own trade engine has no such restriction, but routing "Run Bot" through Quick Strategy here
// means offering Crash & Boom / Step Indices would let a user configure a combination Quick
// Strategy can't actually run. Scoped to the two categories that work, matching Smart
// Analysis's shouldShowContractNav precedent.
export const TRADE_SETUP_CATEGORIES: TSaCategory[] = ['volatility', 'jump'];

// Faithful port of the reference's FAB_KEY (reference line 25910) — persists the floating
// Run Bot button's on/off state across reloads, same as the reference's localStorage-backed
// toggle.
const FAB_VISIBLE_KEY = 'dbot_fab_visible';

export default class TradeSetupStore {
    root_store: RootStore;
    connection_subscription: { unsubscribe: () => void } | null = null;
    has_set_initial_symbol = false;

    category: TSaCategory = 'volatility';
    symbol = '';
    available_symbols: ActiveSymbols = [];

    // Faithful default: reference's tp-contract-chips has DIGITMATCH pre-active (reference
    // line 5161), digit 0 pre-active (line 5333) — same as dbot's own
    // QUICK_STRATEGY.DEFAULT.prediction (config.ts).
    contract_type: TContractType = 'DIGITMATCH';
    digit = 0;

    duration_value = 1;
    duration_unit: TDurationUnit = 't';

    stake = 1.0;

    // Faithful defaults from bpc-mart (value="1"), bpc-tp (placeholder only, no value attr —
    // reference leaves Take Profit UNSET by default, reference lines 5379-5411), bpc-sl
    // (value="25", reference lines 5430-5434).
    martingale_size = 1;
    take_profit: number | null = null;
    stop_loss = 25;

    // Faithful port of the reference's Floating Bot Button toggle (reference lines 4744-4746:
    // the "🎯 Floating Bot Button" menu item; engine at lines 25887-26153) — shows/hides a
    // draggable Run/Stop button (src/components/floating-run-bot) that stays visible across
    // every tab, not just this one. Defaults OFF, matching the reference's own
    // `setFabVisible(localStorage.getItem(FAB_KEY) === '1')` (line 26152, falsy until set).
    is_fab_visible = localStorage.getItem(FAB_VISIBLE_KEY) === '1';

    constructor(root_store: RootStore) {
        makeObservable(this, {
            category: observable,
            symbol: observable,
            available_symbols: observable,
            contract_type: observable,
            digit: observable,
            duration_value: observable,
            duration_unit: observable,
            stake: observable,
            martingale_size: observable,
            take_profit: observable,
            stop_loss: observable,
            is_fab_visible: observable,
            needs_digit: computed,
            filtered_symbols: computed,
            symbol_options: computed,
            setCategory: action.bound,
            setSymbol: action.bound,
            setAvailableSymbols: action.bound,
            setContractType: action.bound,
            setDigit: action.bound,
            setDuration: action.bound,
            setStake: action.bound,
            setMartingaleSize: action.bound,
            setTakeProfit: action.bound,
            setStopLoss: action.bound,
            toggleFab: action.bound,
            applyFromScanner: action.bound,
            runBot: action.bound,
        });

        this.root_store = root_store;

        // Same api_base.init()/RootStore-construction race as SmartAnalysisStore/
        // SignalEngineStore — active_symbols must not be read until the connection is
        // confirmed OPENED.
        this.connection_subscription = connectionStatus$.subscribe(status => {
            if (status === CONNECTION_STATUS.OPENED && api_base.api) {
                this.loadAvailableSymbols();
            }
        });

        // Faithful port of Trade Setup's asset section auto-selecting the first symbol of
        // the active category once the market list loads (same convention as
        // SmartAnalysisStore/ScannerStore) — fires once, then setCategory/setSymbol own
        // things one-way from there.
        reaction(
            () => this.filtered_symbols,
            filtered => {
                if (this.has_set_initial_symbol || !filtered.length) return;
                this.has_set_initial_symbol = true;
                this.symbol = filtered[0].symbol;
            }
        );
    }

    get needs_digit(): boolean {
        return CT_NEEDS_PREDICTION[this.contract_type];
    }

    get filtered_symbols(): ActiveSymbols {
        return filterSymbolsByCategory(this.available_symbols, this.category);
    }

    get symbol_options() {
        return this.filtered_symbols.map(s => ({ text: s.display_name, value: s.symbol }));
    }

    loadAvailableSymbols = async () => {
        if (!api_base.has_active_symbols) {
            await api_base.active_symbols_promise;
        }
        const symbols = (api_base.active_symbols ?? []) as ActiveSymbols;
        this.setAvailableSymbols(symbols.filter(s => s.market === 'synthetic_index'));
    };

    setAvailableSymbols = (available_symbols: ActiveSymbols) => {
        this.available_symbols = available_symbols;
    };

    // Faithful port of tpSetCategory (reference lines 23245+) — switching category re-scopes
    // the asset list and jumps to its first symbol if the current one falls outside it, same
    // convention as SmartAnalysisStore.setCategory.
    setCategory = (category: TSaCategory) => {
        if (category === this.category) return;
        this.category = category;
        const filtered = filterSymbolsByCategory(this.available_symbols, category);
        if (filtered.length && !filtered.some(s => s.symbol === this.symbol)) {
            this.symbol = filtered[0].symbol;
        }
    };

    setSymbol = (symbol: string) => {
        this.symbol = symbol;
    };

    // Faithful port of tpSetContract's chip-selection (reference: sets active chip) — the
    // reference also auto-expands its collapsible digit section here, but that section is
    // always visible in this port (see trade-setup-section.tsx), so there's nothing to
    // expand; DigitSection's own needs_digit check already handles showing/hiding it.
    setContractType = (contract_type: TContractType) => {
        this.contract_type = contract_type;
    };

    setDigit = (digit: number) => {
        this.digit = digit;
    };

    // Faithful port of tpSetDur(value, unit) (reference lines 5212-5236).
    setDuration = (value: number, unit: TDurationUnit) => {
        this.duration_value = value;
        this.duration_unit = unit;
    };

    // Faithful port of tpSetStake/tpSetStakeCustom (reference lines 5270-5299) — same preset
    // + custom-stepper duality, collapsed into one setter since both ultimately just set the
    // stake value.
    setStake = (stake: number) => {
        this.stake = stake;
    };

    // Faithful port of bpcSetMart, clamped to dbot's own Quick Strategy validation floor
    // (config.ts's SIZE() field requires size >= QUICK_STRATEGY.DEFAULT.size, which is 1) —
    // the reference's own stepper allows down to 0 (tpStepField('bpc-mart', -0.5, 0, 10,
    // ...)), but 0 would fail validation once this actually routes into Quick Strategy.
    setMartingaleSize = (size: number) => {
        this.martingale_size = Math.max(1, size);
    };

    setTakeProfit = (take_profit: number | null) => {
        this.take_profit = take_profit;
    };

    setStopLoss = (stop_loss: number) => {
        this.stop_loss = stop_loss;
    };

    // Faithful port of tpToggleFab (reference lines 25944-25950).
    toggleFab = () => {
        this.is_fab_visible = !this.is_fab_visible;
        localStorage.setItem(FAB_VISIBLE_KEY, this.is_fab_visible ? '1' : '0');
    };

    // ── SCANNER INTEGRATION BOUNDARY ──
    // Faithful port of _activateResult's Trade-Setup-configuration steps (reference lines
    // 22907-22951: switch asset, set contract type, set barrier/prediction digit, fill risk
    // defaults only if still empty) — called by ScannerStore.confirmApply once the user
    // clears the risk disclaimer. Martingale/Stop Loss are deliberately left untouched here:
    // they already default to 1/25 (the same fallback values the reference fills in), so
    // preserving whatever the user currently has — whether still-default or customized — is
    // simpler than replicating the reference's own "is the field empty" check, and produces
    // the same result. Take Profit is the one field with a real empty state in this store
    // (defaults to null, not a number), so it alone gets the explicit fallback-if-empty
    // check, matching reference line 22944-22947's fallback value of 10.
    applyFromScanner = (result: TScanResult) => {
        // Every SCAN_ASSETS entry is either a volatility or a jump symbol (never crash_boom/
        // step — Scanner doesn't scan those), so this always lands in a category Trade Setup
        // actually supports (see TRADE_SETUP_CATEGORIES).
        this.category = result.asset.startsWith('JD') ? 'jump' : 'volatility';
        this.symbol = result.asset;
        this.contract_type = result.ct;
        if (CT_NEEDS_PREDICTION[result.ct]) {
            // Reference line 22928's own fallback is 5 (not extractBarrierDigit's usual
            // `undefined`), so it's applied locally here rather than changing that shared
            // helper's behaviour for its other callers (e.g. scanner-live-digits.tsx).
            this.digit = extractBarrierDigit(result) ?? 5;
        }
        if (this.take_profit == null) this.take_profit = 10;
    };

    // ── TRADE SETUP INTEGRATION BOUNDARY ──
    // Faithful port of tpBotRunToggle's "configure + run" behaviour (reference lines
    // 5719-5742's "▶ RUN BOT 1" button), routed through dbot's own QuickStrategyStore/Blockly
    // bot engine instead of the reference's separate direct-WebSocket trade executor — see
    // task notes on why: dbot already has a tested execution engine, and duplicating one
    // would mean re-implementing martingale/stake progression, take-profit/stop-loss
    // monitoring, and trade placement from scratch. This passes action:'RUN' — starting the
    // bot immediately is the entire point of a "Run Bot" button here, matching the
    // reference's own behaviour.
    runBot = () => {
        const quick_strategy = this.root_store.quick_strategy;
        quick_strategy.setSelectedStrategy('MARTINGALE');
        quick_strategy.form_data = {
            ...quick_strategy.form_data,
            symbol: this.symbol,
            tradetype: CT_TO_TRADETYPE[this.contract_type],
            type: this.contract_type,
            durationtype: this.duration_unit,
            duration: this.duration_value,
            stake: this.stake,
            size: this.martingale_size,
            loss: this.stop_loss,
            ...(this.take_profit != null ? { profit: this.take_profit } : {}),
            ...(this.needs_digit ? { last_digit_prediction: this.digit } : {}),
        };
        quick_strategy.onSubmit({ ...quick_strategy.form_data, action: 'RUN' });
    };
}
