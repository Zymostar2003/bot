import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import { toast } from 'react-toastify';
import { api_base } from '@/external/bot-skeleton';
import { V2GetActiveToken } from '@/external/bot-skeleton/services/api/appId';
import {
    CopyTradingListResponse,
    CopyTradingStartResponse,
    CopyTradingStatisticsResponse,
    CopyTradingStopResponse,
} from '@deriv/api-types';
import RootStore from './root-store';

type TActiveTrader = NonNullable<CopyTradingListResponse['copytrading_list']>['traders'][number];
type TActiveCopier = NonNullable<CopyTradingListResponse['copytrading_list']>['copiers'][number];
type TStats = NonNullable<CopyTradingStatisticsResponse['copytrading_statistics']>;

// localStorage key for client-side-tracked "since" timestamps, keyed by trader token — the
// live API's copytrading_list response has no start-date field on its traders[] entries (see
// the plan presented to the user), so "since when" a copy relationship started can only be
// recorded locally, the moment this session's own copy_start call succeeds. Namespaced/
// versioned like the rest of the app's localStorage usage (see appId.js's authToken,
// active_loginid keys).
const SINCE_STORAGE_KEY = 'dbot_copy_trading_since_v1';

function loadSinceMap(): Record<string, number> {
    try {
        const raw = localStorage.getItem(SINCE_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveSinceMap(map: Record<string, number>) {
    try {
        localStorage.setItem(SINCE_STORAGE_KEY, JSON.stringify(map));
    } catch {
        // localStorage unavailable (private browsing, quota) — "since" just won't persist
        // across reloads; not worth surfacing to the user for a display-only value.
    }
}

// New capability, no reference equivalent — a Leader panel (share your own trading, via
// allow_copiers) and a Copier panel (follow another trader's token, via copy_start/copy_stop)
// built directly on top of Deriv's real copy trading API (@deriv/api-types' CopyTrading*
// interfaces), using dbot's existing api_base.api.send({...}) pattern (see
// tnc-status-update-modal.tsx for the confirmed precedent) rather than a bespoke client.
export default class CopyTradingStore {
    root_store: RootStore;

    // ── Leader panel ──
    own_token: string | null = null;
    allow_copiers: boolean | null = null; // null = not yet loaded
    is_loading_settings = false;
    is_saving_allow_copiers = false;
    copiers: TActiveCopier[] = [];

    // ── Copier panel ──
    trader_token = '';
    traders: TActiveTrader[] = [];
    is_loading_list = false;

    stats: TStats | null = null;
    stats_error: string | null = null;
    is_loading_stats = false;

    is_starting = false;
    is_stopping_token: string | null = null;

    // Risk-disclaimer confirm step — mirrors ScannerStore.is_confirm_open/pending_result/
    // applyResult/cancelApply/confirmApply exactly: copy_start is a real trading-permission
    // action (per the standing rule established for Scanner's apply-to-bot flow), so it must
    // never fire directly off a button click without this explicit confirmation step.
    is_confirm_open = false;
    pending_token: string | null = null;

    since_map: Record<string, number> = loadSinceMap();

    constructor(root_store: RootStore) {
        makeObservable(this, {
            own_token: observable,
            allow_copiers: observable,
            is_loading_settings: observable,
            is_saving_allow_copiers: observable,
            copiers: observable,
            trader_token: observable,
            traders: observable,
            is_loading_list: observable,
            stats: observable,
            stats_error: observable,
            is_loading_stats: observable,
            is_starting: observable,
            is_stopping_token: observable,
            is_confirm_open: observable,
            pending_token: observable,
            since_map: observable,
            is_real_account: computed,
            init: action.bound,
            fetchSettings: action.bound,
            setAllowCopiers: action.bound,
            fetchList: action.bound,
            setTraderToken: action.bound,
            previewStats: action.bound,
            requestStartCopy: action.bound,
            cancelStartCopy: action.bound,
            confirmStartCopy: action.bound,
            stopCopy: action.bound,
        });
        this.root_store = root_store;
        this.own_token = V2GetActiveToken();
    }

    // allow_copiers is "not applicable for Virtual account. Only allow for real money
    // account" per @deriv/api-types' own field comment — gates the Leader panel's toggle.
    get is_real_account(): boolean {
        return !this.root_store.client.is_virtual;
    }

    init = () => {
        this.fetchSettings();
        this.fetchList();
    };

    fetchSettings = async () => {
        this.is_loading_settings = true;
        try {
            const response = await api_base.api.send({ get_settings: 1 });
            runInAction(() => {
                this.allow_copiers = !!response?.get_settings?.allow_copiers;
            });
        } catch (error) {
            toast.error('Could not load your copy trading settings.');
        } finally {
            runInAction(() => {
                this.is_loading_settings = false;
            });
        }
    };

    setAllowCopiers = async (value: boolean) => {
        if (!this.is_real_account) return;
        this.is_saving_allow_copiers = true;
        try {
            await api_base.api.send({ set_settings: 1, allow_copiers: value ? 1 : 0 });
            runInAction(() => {
                this.allow_copiers = value;
            });
            toast.success(value ? 'Copiers can now follow your trades.' : 'Copiers can no longer follow your trades.');
        } catch (error) {
            toast.error('Could not update your copy trading settings.');
        } finally {
            runInAction(() => {
                this.is_saving_allow_copiers = false;
            });
        }
    };

    fetchList = async () => {
        this.is_loading_list = true;
        try {
            const response: CopyTradingListResponse = await api_base.api.send({ copytrading_list: 1 });
            runInAction(() => {
                this.copiers = response?.copytrading_list?.copiers ?? [];
                this.traders = response?.copytrading_list?.traders ?? [];
            });
        } catch (error) {
            toast.error('Could not load your copy trading status.');
        } finally {
            runInAction(() => {
                this.is_loading_list = false;
            });
        }
    };

    setTraderToken = (value: string) => {
        this.trader_token = value;
        this.stats = null;
        this.stats_error = null;
    };

    // copytrading_statistics takes a `trader_id`, not a token (confirmed from
    // @deriv/api-types — a discrepancy flagged before this was built). Passing the pasted
    // trader token through in that field on the chance the live API accepts a token-shaped
    // string there; if it doesn't, this surfaces as stats_error instead of a silent failure.
    previewStats = async () => {
        const trader_id = this.trader_token.trim();
        if (!trader_id) return;
        this.is_loading_stats = true;
        this.stats = null;
        this.stats_error = null;
        try {
            const response: CopyTradingStatisticsResponse = await api_base.api.send({
                copytrading_statistics: 1,
                trader_id,
            });
            runInAction(() => {
                this.stats = response?.copytrading_statistics ?? null;
            });
        } catch (error) {
            const message = (error as { message?: string })?.message || 'Could not load stats for this trader.';
            runInAction(() => {
                this.stats_error = message;
            });
        } finally {
            runInAction(() => {
                this.is_loading_stats = false;
            });
        }
    };

    // Opens the risk-disclaimer confirm step — the actual copy_start call only happens in
    // confirmStartCopy(), same invariant as ScannerStore.applyResult/confirmApply.
    requestStartCopy = () => {
        const token = this.trader_token.trim();
        if (!token) return;
        this.pending_token = token;
        this.is_confirm_open = true;
    };

    cancelStartCopy = () => {
        this.is_confirm_open = false;
        this.pending_token = null;
    };

    confirmStartCopy = async () => {
        const token = this.pending_token;
        this.is_confirm_open = false;
        this.pending_token = null;
        if (!token) return;

        this.is_starting = true;
        try {
            const response: CopyTradingStartResponse = await api_base.api.send({ copy_start: token });
            if (response?.copy_start) {
                runInAction(() => {
                    this.since_map = { ...this.since_map, [token]: Date.now() };
                    saveSinceMap(this.since_map);
                });
                toast.success('Now copying this trader.');
                await this.fetchList();
            }
        } catch (error) {
            const message = (error as { message?: string })?.message || 'Could not start copying this trader.';
            toast.error(message);
        } finally {
            runInAction(() => {
                this.is_starting = false;
            });
        }
    };

    stopCopy = async (token: string) => {
        this.is_stopping_token = token;
        try {
            const response: CopyTradingStopResponse = await api_base.api.send({ copy_stop: token });
            if (response?.copy_stop) {
                const next_since = { ...this.since_map };
                delete next_since[token];
                runInAction(() => {
                    this.since_map = next_since;
                });
                saveSinceMap(next_since);
                toast.success('Stopped copying this trader.');
                await this.fetchList();
            }
        } catch (error) {
            const message = (error as { message?: string })?.message || 'Could not stop copying this trader.';
            toast.error(message);
        } finally {
            runInAction(() => {
                this.is_stopping_token = null;
            });
        }
    };
}
