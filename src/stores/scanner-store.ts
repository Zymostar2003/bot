import { action, computed, makeObservable, observable, reaction, runInAction } from 'mobx';
import { toast } from 'react-toastify';
import { DBOT_TABS } from '@/constants/bot-contents';
import { api_base } from '@/external/bot-skeleton';
import TicksService from '@/external/bot-skeleton/services/api/ticks_service';
import {
    CONTRACT_TYPES,
    CT_LABELS,
    DEFAULT_MIN_TICKS,
    FILTER_TAB_CONTRACT_TYPES,
    SCAN_ASSETS,
} from '@/utils/scanner/constants';
import { dsRegime } from '@/utils/scanner/helpers';
import { applyScannerFilters, scoreCombo } from '@/utils/scanner/scoring';
import {
    TContractType,
    TDigitPct,
    TFullHistoryTick,
    TRegimeCounts,
    TScannerFilterTab,
    TScanResult,
    TScanTrend,
    TScoreResult,
} from '@/utils/scanner/types';
import { toFullHistoryTicks } from '@/utils/signal-engine/adapters';
import { dPcts } from '@/utils/signal-engine/pro-signal';
import { beep } from '@/utils/signal-engine/sound';
import { TTick } from '@/utils/signal-engine/types';
import RootStore from './root-store';

export type TScanStatus = 'idle' | 'scanning' | 'done' | 'stopped';

// Extracts the barrier/prediction digit from a scan result — reuses the OU branch's
// already-numeric `barrier` field where present, otherwise falls back to pulling the
// trailing digit out of `dir` (e.g. "MATCH 7", "DIFF 5"), faithfully matching
// _activateResult's own extraction (reference/index-335-black-bars.html, lines 22924-22931:
// `res.dir.match(/\d+/)`, clamped to 0-9). Exported so scanner-live-digits.tsx can highlight
// the same digit its live grid is tracking.
export function extractBarrierDigit(result: TScanResult): number | undefined {
    if (result.barrier != null) return result.barrier;
    const match = result.dir.match(/\d+/);
    if (!match) return undefined;
    return Math.max(0, Math.min(9, parseInt(match[0], 10)));
}

export default class ScannerStore {
    root_store: RootStore;
    ticks_service: TicksService | null = null;

    // Left over from Scanner's original toolbar-icon/overlay design (superseded — Scanner
    // is now a dashboard tab, mounted/unmounted by Tabs' active-tab switching instead of
    // this flag; see main.tsx's id-scanner entry). Unused, kept intact rather than removed.
    is_open = false;

    active_tab: TScannerFilterTab = 'all';
    min_ticks = DEFAULT_MIN_TICKS;
    status: TScanStatus = 'idle';
    progress = 0;
    progress_text = '';
    received_count = 0;
    total_count = SCAN_ASSETS.length;
    results: TScanResult[] = [];

    // Every asset's best-scoring combo regardless of quality, REJECT included — a superset
    // of `results` (which stays SIGNAL/WATCH only, unchanged from before, so Apply/Dismiss
    // and the risk-disclaimer flow keep working exactly as before). Lets the UI fall back to
    // showing the closest candidates for context when `results` comes back empty, instead of
    // a bare "no signals" message — see scanner-results.tsx's Market Watch fallback.
    all_scored: TScanResult[] = [];

    // Tally of dsRegime() across every scanned asset this scan — new market-context signal,
    // no reference equivalent. See scanner-regime-summary.tsx.
    regime_counts: TRegimeCounts = { quiet: 0, normal: 0, volatile: 0, spiking: 0 };

    // Not observable — internal bookkeeping only (compared against, never rendered directly;
    // the derived `trend` on each TScanResult is what the UI reads). Keyed by asset symbol,
    // not asset+contract-type, since the "best" contract type for an asset can change between
    // scans and what matters is whether that asset is getting hotter or colder overall.
    _previous_scores: Record<string, number> = {};

    // Live digit monitor — new capability, no reference equivalent as a standing panel (the
    // reference's closest analogue, _scLiveValidate's livePcts computation, was one part of
    // the deferred full live-validator engine, gated behind its own dedicated per-signal
    // WebSocket). Tracks a live, continuously-updating rolling window (TicksService.monitor's
    // `[...ticks.slice(1), newTick]` keeps it pinned at the initial fetch size — `count:1000`
    // in ticks_service.js's requestStream, so this is always "last ~1000 ticks") for whichever
    // asset is currently the scan's top result. See scanner-live-digits.tsx.
    live_asset: string | null = null;
    live_tick_history: TTick[] = [];
    live_monitor_key: string | null = null;

    is_confirm_open = false;
    pending_result: TScanResult | null = null;

    // Faithful port of the reference's soundOn/_scSoundType-gated scan pulse + found beep
    // (reference: _scStartPulse/_scStopPulse/_scPlaySound, lines 16685-16810). Reuses
    // signal-engine/sound.ts's beep() primitive rather than re-implementing oscillator
    // construction — the reference's per-sound-type biquad-filter/multi-tone shaping
    // (chime/alert variants, lines 16783-16810) is not ported; only its default "supermarket
    // beep" (type 1, the only one wired to a toggle here) is, via beep()'s simpler
    // sine/square envelope. The 4-way sound-type picker itself is deferred (v1 scope).
    sound_enabled = false;
    _audio_ctx: AudioContext | null = null;
    _pulse_timer: ReturnType<typeof setInterval> | null = null;

    // Bumped on every scan()/stop() call so in-flight async work from a superseded or
    // stopped scan can recognise itself as stale and become a no-op — the reference relies
    // on aborting/closing its scan-specific WebSocket for the same purpose (reference lines
    // 17071-17092); TicksService's shared connection has no per-scan socket to close, so
    // this token substitutes for that.
    scan_token = 0;

    constructor(root_store: RootStore) {
        makeObservable(this, {
            is_open: observable,
            active_tab: observable,
            min_ticks: observable,
            status: observable,
            progress: observable,
            progress_text: observable,
            received_count: observable,
            total_count: observable,
            results: observable,
            all_scored: observable,
            regime_counts: observable,
            live_asset: observable,
            live_tick_history: observable,
            is_confirm_open: observable,
            pending_result: observable,
            sound_enabled: observable,
            is_scanning: computed,
            status_label: computed,
            top_result: computed,
            live_full_history: computed,
            live_digit_pcts: computed,
            setOpen: action.bound,
            toggle: action.bound,
            setActiveTab: action.bound,
            setMinTicks: action.bound,
            toggleSound: action.bound,
            scan: action.bound,
            stop: action.bound,
            dismissResult: action.bound,
            applyResult: action.bound,
            cancelApply: action.bound,
            confirmApply: action.bound,
            startLiveDigitMonitor: action.bound,
            stopLiveDigitMonitor: action.bound,
            onLiveTicksUpdate: action.bound,
        });
        this.root_store = root_store;

        // Keeps the live digit monitor pointed at whichever asset is currently the scan's
        // top result — switches to a new asset when a fresh scan produces a different
        // leader, stops cleanly when there's nothing to show (idle, or a scan with zero
        // results and zero fallback candidates).
        reaction(
            () => this.top_result?.asset ?? null,
            asset => {
                if (asset) this.startLiveDigitMonitor(asset);
                else this.stopLiveDigitMonitor();
            }
        );
    }

    get is_scanning(): boolean {
        return this.status === 'scanning';
    }

    // The asset currently worth showing live digit data for — the top qualifying result, or
    // (Market Watch fallback) the closest non-qualifying candidate. New capability, no
    // reference equivalent.
    get top_result(): TScanResult | null {
        return this.results[0] ?? this.all_scored[0] ?? null;
    }

    get live_full_history(): TFullHistoryTick[] {
        if (!this.live_asset) return [];
        const pip_size = (api_base.pip_sizes as Record<string, number>)?.[this.live_asset] ?? 2;
        return toFullHistoryTicks(this.live_tick_history, pip_size);
    }

    get live_digit_pcts(): TDigitPct[] {
        return dPcts(this.live_full_history, 1000);
    }

    // Faithful port of the scout-status-badge text states (reference: setBadge calls at
    // lines 16848, 16942, 17093-onward stop handler) — 'Idle' before any scan, 'Scanning…'
    // while a scan is in flight, 'Done (1/1)' once complete (v1 always scans once — the
    // reference's repeat-scan count is deferred, see task scope notes), 'Stopped' after an
    // explicit stop.
    get status_label(): string {
        switch (this.status) {
            case 'scanning':
                return 'Scanning…';
            case 'done':
                return 'Done (1/1)';
            case 'stopped':
                return 'Stopped';
            default:
                return 'Idle';
        }
    }

    setOpen = (is_open: boolean) => {
        this.is_open = is_open;
        if (!is_open && this.status === 'scanning') this.stop();
    };

    toggle = () => {
        this.setOpen(!this.is_open);
    };

    // Faithful port of _scSetFilter (reference lines 17113-17139) — switching tabs isn't
    // just a display filter over already-fetched results, it stops any running scan and
    // immediately fires a fresh scan scoped to the new tab's contract types (scan() clears
    // `results` itself, synchronously, before its first await). Without this, clicking a tab
    // only changed `active_tab` silently; a scan would only ever pick that up if the user
    // separately pressed "Scan All Assets" again — which is why every tab except the default
    // "All" appeared to do nothing.
    setActiveTab = (active_tab: TScannerFilterTab) => {
        this.active_tab = active_tab;
        if (this.status === 'scanning') this.stop();
        this.scan();
    };

    setMinTicks = (min_ticks: number) => {
        this.min_ticks = min_ticks;
    };

    toggleSound = () => {
        this.sound_enabled = !this.sound_enabled;
    };

    // ── Sound (lazy AudioContext, matching SignalEngineStore.getAudioCtx exactly) ──

    getAudioCtx = (): AudioContext => {
        if (!this._audio_ctx) {
            const AudioCtxCtor =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            this._audio_ctx = new AudioCtxCtor();
        }
        return this._audio_ctx;
    };

    // Faithful port of _scStartPulse's rhythm (reference lines 16713-16748: an immediate
    // first tick, then every ~0.6s) — a soft repeating tick while a scan is in flight.
    startPulse = () => {
        if (this._pulse_timer) return;
        const tick = () => beep(this.getAudioCtx, this.sound_enabled, 2730, 0.05, 'square');
        tick();
        this._pulse_timer = setInterval(tick, 600);
    };

    // Faithful port of _scStopPulse (reference lines 16749-16754).
    stopPulse = () => {
        if (this._pulse_timer) {
            clearInterval(this._pulse_timer);
            this._pulse_timer = null;
        }
    };

    // Faithful port of _runScan (reference lines 16814-17069) using dbot's shared
    // TicksService instead of the reference's own dedicated scan WebSocket — see task
    // notes on TicksService.request()'s subscribe-and-cache behaviour making repeat scans
    // resolve instantly.
    scan = async () => {
        if (this.status === 'scanning') return;
        const token = ++this.scan_token;

        this.status = 'scanning';
        this.results = [];
        this.received_count = 0;
        this.total_count = SCAN_ASSETS.length;
        this.progress = 5;
        this.progress_text = 'Requesting all assets…';
        this.startPulse();

        if (!this.ticks_service) {
            this.ticks_service = new TicksService();
        }
        const ticks_service = this.ticks_service;

        const activeCTs: TContractType[] = FILTER_TAB_CONTRACT_TYPES[this.active_tab] ?? CONTRACT_TYPES;
        const minTicks = this.min_ticks || DEFAULT_MIN_TICKS;

        // Parallel batch-fetch — Promise.allSettled so one bad symbol doesn't kill the scan
        // (reference fires all requests over one socket in parallel too, see lines
        // 17010-17023).
        const settled = await Promise.allSettled(
            SCAN_ASSETS.map(asset =>
                ticks_service.request({ symbol: asset.v, granularity: undefined }).then((ticks: TTick[]) => {
                    if (token === this.scan_token) {
                        runInAction(() => {
                            this.received_count++;
                            this.progress = 10 + (this.received_count / this.total_count) * 80;
                            this.progress_text = `Received ${this.received_count} / ${this.total_count} assets…`;
                        });
                    }
                    return ticks;
                })
            )
        );

        if (token !== this.scan_token) return; // superseded by a newer scan() or stop()

        const results: TScanResult[] = [];
        const all_scored: TScanResult[] = [];
        const regime_counts: TRegimeCounts = { quiet: 0, normal: 0, volatile: 0, spiking: 0 };
        const next_scores: Record<string, number> = {};

        settled.forEach((outcome, i) => {
            if (outcome.status !== 'fulfilled') return;
            const asset = SCAN_ASSETS[i];
            const pip_size = (api_base.pip_sizes as Record<string, number>)?.[asset.v] ?? 2;
            const hist: TFullHistoryTick[] = toFullHistoryTicks(outcome.value, pip_size);
            if (hist.length < minTicks) return;

            regime_counts[dsRegime(hist)]++;

            // Best-by-score regardless of quality (REJECT included) — `results` below still
            // only keeps SIGNAL/WATCH, so the Apply flow's guarantees are unchanged; this
            // wider `best` only feeds `all_scored`, the read-only Market Watch fallback.
            let best: (TScoreResult & { ct: TContractType }) | null = null;
            for (const ct of activeCTs) {
                let res = scoreCombo(hist, ct);
                res = applyScannerFilters(res, hist, ct);
                if (best === null || res.score > best.score) {
                    best = { ...res, ct };
                }
            }

            if (best !== null) {
                const found: TScoreResult & { ct: TContractType } = best;
                const prev_score = this._previous_scores[asset.v];
                let trend: TScanTrend | undefined;
                if (prev_score !== undefined) {
                    if (found.score > prev_score + 2) trend = 'up';
                    else if (found.score < prev_score - 2) trend = 'down';
                    else trend = 'flat';
                }
                next_scores[asset.v] = found.score;

                const entry: TScanResult = {
                    asset: asset.v,
                    assetLabel: asset.l,
                    ct: found.ct,
                    ctLabel: CT_LABELS[found.ct],
                    dir: found.dir,
                    score: found.score,
                    reasons: found.reasons,
                    ticks: hist.length,
                    barrier: found.barrier ?? null,
                    quality: found.quality,
                    trend,
                };
                // Same object reference in both arrays on purpose — dismissResult/
                // confirmApply filter by identity, so acting on an entry removes it from
                // both the qualifying list and the Market Watch fallback in one step.
                all_scored.push(entry);
                if (found.quality !== 'REJECT') results.push(entry);
            }
        });

        results.sort((a, b) => b.score - a.score);
        all_scored.sort((a, b) => b.score - a.score);

        // Faithful port of _stopPulse() + _scPlaySound(_scSoundType) firing together once
        // the scan completes (reference lines 16935-16936).
        this.stopPulse();
        beep(this.getAudioCtx, this.sound_enabled, 2730, 0.13, 'square');

        runInAction(() => {
            this.results = results;
            this.all_scored = all_scored;
            this.regime_counts = regime_counts;
            this._previous_scores = next_scores;
            this.status = 'done';
            this.progress = 100;
            this.progress_text = `Scan complete — ${results.length} asset${results.length === 1 ? '' : 's'} scored`;
        });
    };

    stop = () => {
        this.scan_token++;
        this.status = 'stopped';
        this.progress = 0;
        this.progress_text = '';
        this.stopPulse();
    };

    // ── Live digit monitor (new capability, no reference equivalent) ──

    startLiveDigitMonitor = (asset: string) => {
        if (this.live_asset === asset) return; // already tracking this asset, avoid WS churn
        this.stopLiveDigitMonitor();
        if (!this.ticks_service) {
            this.ticks_service = new TicksService();
        }
        this.live_asset = asset;
        this.ticks_service
            .monitor({
                symbol: asset,
                granularity: undefined,
                callback: ticks => {
                    // Superseded by a newer startLiveDigitMonitor/stopLiveDigitMonitor call —
                    // TicksService.monitor() delivers its initial history batch as soon as
                    // it's fetched (see ticks_service.js's monitor() fix), so a slow response
                    // for an asset we've since moved away from can otherwise land after a
                    // faster one and silently overwrite it with stale data.
                    if (this.live_asset !== asset) return;
                    this.onLiveTicksUpdate(ticks);
                },
            })
            .then(key => {
                if (this.live_asset === asset) {
                    runInAction(() => {
                        this.live_monitor_key = key;
                    });
                } else {
                    // Superseded by a newer startLiveDigitMonitor/stopLiveDigitMonitor call
                    // while this monitor() call was still resolving — tear the now-orphaned
                    // subscription back down instead of leaking it.
                    this.ticks_service?.stopMonitor({ symbol: asset, granularity: undefined, key });
                }
            });
    };

    stopLiveDigitMonitor = () => {
        if (this.ticks_service && this.live_monitor_key && this.live_asset) {
            this.ticks_service.stopMonitor({
                symbol: this.live_asset,
                granularity: undefined,
                key: this.live_monitor_key,
            });
        }
        this.live_monitor_key = null;
        this.live_asset = null;
        this.live_tick_history = [];
    };

    onLiveTicksUpdate = (ticks: TTick[]) => {
        this.live_tick_history = ticks;
    };

    dismissResult = (result: TScanResult) => {
        this.results = this.results.filter(r => r !== result);
        this.all_scored = this.all_scored.filter(r => r !== result);
    };

    // Opens the risk-disclaimer confirm step — the actual apply-to-bot call only happens
    // in confirmApply(), mirroring the reference's window._scout.activate/activateIdx
    // (which always route through _scShowRiskDisclaimer first — reference lines 23033-23053).
    applyResult = (result: TScanResult) => {
        this.pending_result = result;
        this.is_confirm_open = true;
    };

    cancelApply = () => {
        this.is_confirm_open = false;
        this.pending_result = null;
    };

    // Faithful port of _activateResult's own handoff target (reference lines 22885-22972):
    // Scanner never places a trade itself — it configures the Trade Setup panel with the
    // scan result, switches to it, and leaves the actual Run Bot press to the user (steps
    // 1-4, 9 of _activateResult; step 5 "enable bot mode" has no equivalent since dbot has
    // no separate bot-mode toggle; steps 7-8, syncing the main chart/payout preview, aren't
    // ported either — TradeSetupStore has no chart/payout preview of its own to sync).
    confirmApply = () => {
        const result = this.pending_result;
        this.is_confirm_open = false;
        this.pending_result = null;
        if (!result) return;

        this.root_store.trade_setup.applyFromScanner(result);
        this.root_store.dashboard.setActiveTab(DBOT_TABS.TRADE_SETUP);
        toast.success(`✅ ${result.assetLabel} | ${result.ctLabel} — ready!`);

        this.results = this.results.filter(r => r !== result);
        this.all_scored = this.all_scored.filter(r => r !== result);
    };
}
