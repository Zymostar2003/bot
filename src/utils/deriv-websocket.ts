import { TCandle, TTick } from './signal-engine/types';

// ═══════════════════════════════════════════════════════════════════════════
// DERIV WEBSOCKET CLIENT — High-Reliability Data Stream Engine
// Matches the proven reference terminal architecture:
// 1. Direct WebSocket connection using public App ID 1089 (works from any origin,
//    including Vercel, GitHub Pages, custom domains, and localhost).
// 2. Parallel batch-fetching with req_id tracking and NO subscribe:1 for scans
//    (completes in < 2s with zero subscription leaks).
// 3. Isolated, auto-reconnecting stream client for continuous live ticks and
//    candles, with 25s keepalive ping and latency / network strength tracking.
// 4. Automatic recovery on page visibility change (handles mobile sleep/wake).
// ═══════════════════════════════════════════════════════════════════════════

export const PUBLIC_APP_ID = 1089;

export function getDerivWSUrl(app_id?: number): string {
    const configured_server = typeof window !== 'undefined' ? window.localStorage.getItem('config.server_url') : null;
    const configured_app_id = typeof window !== 'undefined' ? window.localStorage.getItem('config.app_id') : null;

    const server = configured_server || 'ws.binaryws.com';
    const final_app_id = configured_app_id ? parseInt(configured_app_id, 10) : app_id || PUBLIC_APP_ID;

    return `wss://${server}/websockets/v3?app_id=${final_app_id}&l=en&brand=deriv`;
}

// ── Batch History Fetcher (used by Scanner & Agent) ──────────────────────
// Sends one-shot ticks_history requests in parallel over a single dedicated
// WebSocket, without subscribing, matching responses by req_id.
export async function fetchHistoryBatch(
    symbols: string[],
    count = 1000,
    options?: {
        timeoutMs?: number;
        onProgress?: (received: number, total: number) => void;
    }
): Promise<Map<string, TTick[]>> {
    if (!symbols.length) return new Map();

    const timeoutMs = options?.timeoutMs || 15000;
    const reqMap: Record<number, string> = {};
    const results = new Map<string, TTick[]>();

    symbols.forEach((sym, idx) => {
        reqMap[9100 + idx] = sym;
    });

    return new Promise(resolve => {
        let ws: WebSocket | null = null;
        let isDone = false;
        let timer: any = null;

        const cleanup = () => {
            if (isDone) return;
            isDone = true;
            if (timer) clearTimeout(timer);
            if (ws) {
                ws.onopen = null;
                ws.onmessage = null;
                ws.onerror = null;
                ws.onclose = null;
                try {
                    ws.close();
                } catch {
                    /* ignore */
                }
                ws = null;
            }
        };

        const finish = () => {
            cleanup();
            resolve(results);
        };

        timer = setTimeout(finish, timeoutMs);

        try {
            ws = new WebSocket(getDerivWSUrl());
        } catch {
            finish();
            return;
        }

        ws.onopen = () => {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            symbols.forEach((sym, idx) => {
                const req_id = 9100 + idx;
                try {
                    ws?.send(
                        JSON.stringify({
                            ticks_history: sym,
                            count,
                            end: 'latest',
                            style: 'ticks',
                            req_id,
                        })
                    );
                } catch {
                    /* ignore */
                }
            });
        };

        ws.onmessage = (event: MessageEvent) => {
            let data: any;
            try {
                data = JSON.parse(event.data);
            } catch {
                return;
            }

            if (!data || data.msg_type !== 'history' || !data.history) return;

            const req_id = data.req_id || data.echo_req?.req_id;
            const sym = reqMap[req_id];
            if (!sym) return;

            const prices: number[] = data.history.prices || [];
            const times: number[] = data.history.times || [];
            const ticks: TTick[] = [];

            for (let i = 0; i < prices.length; i++) {
                ticks.push({
                    epoch: times[i] ?? Math.floor(Date.now() / 1000),
                    quote: typeof prices[i] === 'number' ? prices[i] : parseFloat(prices[i]),
                });
            }

            results.set(sym, ticks);
            options?.onProgress?.(results.size, symbols.length);

            if (results.size >= symbols.length) {
                finish();
            }
        };

        ws.onerror = finish;
        ws.onclose = finish;
    });
}

// ── Persistent Stream Client (used by Signal Engine, Smart Analysis, Scanner, Agent) ────
export type TStreamCallbacks = {
    onTick?: (tick: TTick, pip_size: number, allTicks: TTick[]) => void;
    onTickHistory?: (ticks: TTick[], pip_size: number) => void;
    onCandle?: (candle: TCandle) => void;
    onCandleHistory?: (candles: TCandle[]) => void;
    onSymbols?: (symbols: any[]) => void;
    onLatency?: (latencyMs: number, strength: 1 | 2 | 3 | 4) => void;
    onStatusChange?: (isConnected: boolean) => void;
};

export type TDerivStreamOptions = {
    tag?: string;
    symbol?: string;
    count?: number;
    granularity?: number;
    callbacks?: TStreamCallbacks;
    onTick?: (tick: TTick, allTicks: TTick[], pip_size: number) => void;
    onTickHistory?: (ticks: TTick[], pip_size: number) => void;
    onCandle?: (candle: TCandle) => void;
    onCandleHistory?: (candles: TCandle[]) => void;
};

export class DerivStream {
    private ws: WebSocket | null = null;
    private is_destroyed = false;
    private ping_timer: any = null;
    private reconnect_timer: any = null;
    private ping_sent_time = 0;
    private history_count = 1000;

    public active_symbol: string | null = null;
    public active_granularity: number | null = null;
    public is_connected = false;
    public pip_size = 2;
    public tick_history: TTick[] = [];
    public candle_history: TCandle[] = [];

    private callbacks: TStreamCallbacks = {};
    private tag: string;

    constructor(options?: TDerivStreamOptions) {
        this.tag = options?.tag || 'DerivStream';
        if (options?.symbol) {
            this.active_symbol = options.symbol;
        }
        if (options?.granularity) {
            this.active_granularity = options.granularity;
        }
        if (options?.count) {
            this.history_count = options.count;
        }
        if (options?.callbacks) {
            this.callbacks = { ...options.callbacks };
        }
        if (options?.onTick) {
            const userOnTick = options.onTick;
            this.callbacks.onTick = (tick, pips, allTicks) => userOnTick(tick, allTicks, pips);
        }
        if (options?.onTickHistory) {
            this.callbacks.onTickHistory = options.onTickHistory;
        }
        if (options?.onCandle) {
            this.callbacks.onCandle = options.onCandle;
        }
        if (options?.onCandleHistory) {
            this.callbacks.onCandleHistory = options.onCandleHistory;
        }
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.handleVisibilityChange);
        }
    }

    public start = () => {
        this.connect();
    };

    public setCallbacks(callbacks: Partial<TStreamCallbacks>) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    public connect = () => {
        if (this.is_destroyed) return;
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this.clearTimers();

        try {
            this.ws = new WebSocket(getDerivWSUrl());
        } catch (e) {
            this.scheduleReconnect();
            return;
        }

        this.ws.onopen = this.handleOpen;
        this.ws.onmessage = this.handleMessage;
        this.ws.onerror = this.handleError;
        this.ws.onclose = this.handleClose;
    };

    private handleOpen = () => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.is_connected = true;
        this.callbacks.onStatusChange?.(true);

        this.startHeartbeat();

        // Request active symbols if listener attached
        if (this.callbacks.onSymbols) {
            try {
                this.ws.send(JSON.stringify({ active_symbols: 'brief', req_id: 1001 }));
            } catch {
                /* ignore */
            }
        }

        // Resubscribe to active streams
        if (this.active_symbol) {
            this.resubscribe();
        }
    };

    private handleMessage = (event: MessageEvent) => {
        let d: any;
        try {
            d = JSON.parse(event.data);
        } catch {
            return;
        }

        if (!d) return;

        // Heartbeat pong: compute latency
        if (d.msg_type === 'pong' || d.ping === 'pong') {
            if (this.ping_sent_time > 0) {
                const rtt = Math.max(0, performance.now() - this.ping_sent_time);
                this.ping_sent_time = 0;
                const strength: 1 | 2 | 3 | 4 = rtt < 250 ? 4 : rtt < 600 ? 3 : rtt < 1500 ? 2 : 1;
                this.callbacks.onLatency?.(Math.round(rtt), strength);
            }
            return;
        }

        // Active symbols
        if (d.msg_type === 'active_symbols' && d.active_symbols) {
            this.callbacks.onSymbols?.(d.active_symbols);
            return;
        }

        // Ticks History
        if (d.msg_type === 'history' && d.history) {
            const sym = d.echo_req?.ticks_history || this.active_symbol;
            if (sym !== this.active_symbol) return;

            const pips = d.pip_size || d.history.pip_size || this.pip_size;
            this.pip_size = pips;

            const prices: number[] = d.history.prices || [];
            const times: number[] = d.history.times || [];
            const ticks: TTick[] = [];

            for (let i = 0; i < prices.length; i++) {
                ticks.push({
                    epoch: times[i] ?? Math.floor(Date.now() / 1000),
                    quote: typeof prices[i] === 'number' ? prices[i] : parseFloat(prices[i]),
                });
            }

            this.tick_history = ticks;
            this.callbacks.onTickHistory?.(ticks, pips);
            if (this.callbacks.onTick && ticks.length) {
                const last = ticks[ticks.length - 1];
                this.callbacks.onTick(last, pips, this.tick_history);
            }
            return;
        }

        // Live Tick
        if (d.msg_type === 'tick' && d.tick) {
            const sym = d.tick.symbol;
            if (sym !== this.active_symbol) return;

            const pips = d.tick.pip_size || this.pip_size;
            this.pip_size = pips;

            const tick: TTick = {
                epoch: d.tick.epoch,
                quote: typeof d.tick.quote === 'number' ? d.tick.quote : parseFloat(d.tick.quote),
            };

            const last = this.tick_history[this.tick_history.length - 1];
            if (!last || last.epoch < tick.epoch) {
                this.tick_history = [...this.tick_history.slice(-999), tick];
            }

            this.callbacks.onTick?.(tick, pips, this.tick_history);
            return;
        }

        // Candles History
        if (d.msg_type === 'candles' && Array.isArray(d.candles)) {
            const sym = d.echo_req?.ticks_history || this.active_symbol;
            if (sym !== this.active_symbol) return;

            const candles: TCandle[] = d.candles.map((c: any) => ({
                epoch: Number(c.epoch),
                open: parseFloat(c.open),
                high: parseFloat(c.high),
                low: parseFloat(c.low),
                close: parseFloat(c.close),
            }));

            this.callbacks.onCandleHistory?.(candles);
            return;
        }

        // Live OHLC Candle Update
        if (d.msg_type === 'ohlc' && d.ohlc) {
            const sym = d.ohlc.symbol;
            if (sym !== this.active_symbol) return;

            const candle: TCandle = {
                epoch: Number(d.ohlc.open_time || d.ohlc.epoch),
                open: parseFloat(d.ohlc.open),
                high: parseFloat(d.ohlc.high),
                low: parseFloat(d.ohlc.low),
                close: parseFloat(d.ohlc.close),
            };

            this.callbacks.onCandle?.(candle);
            return;
        }
    };

    private handleError = () => {
        this.is_connected = false;
        this.callbacks.onStatusChange?.(false);
        this.scheduleReconnect();
    };

    private handleClose = () => {
        this.is_connected = false;
        this.callbacks.onStatusChange?.(false);
        this.scheduleReconnect();
    };

    private scheduleReconnect = () => {
        if (this.is_destroyed || this.reconnect_timer) return;
        this.clearTimers();
        this.reconnect_timer = setTimeout(() => {
            this.reconnect_timer = null;
            this.connect();
        }, 3000);
    };

    private startHeartbeat = () => {
        if (this.ping_timer) clearInterval(this.ping_timer);
        this.ping_timer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ping_sent_time = performance.now();
                try {
                    this.ws.send(JSON.stringify({ ping: 1 }));
                } catch {
                    /* ignore */
                }
            }
        }, 25000);
    };

    private handleVisibilityChange = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
            if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
                this.connect();
            }
        }
    };

    private clearTimers = () => {
        if (this.ping_timer) {
            clearInterval(this.ping_timer);
            this.ping_timer = null;
        }
        if (this.reconnect_timer) {
            clearTimeout(this.reconnect_timer);
            this.reconnect_timer = null;
        }
    };

    public subscribeTicks = (
        symbol: string,
        onTick?: (tick: TTick, pip_size: number) => void,
        onHistory?: (ticks: TTick[], pip_size: number) => void
    ) => {
        if (!symbol) return;
        this.active_symbol = symbol;
        if (onTick) this.callbacks.onTick = onTick;
        if (onHistory) this.callbacks.onTickHistory = onHistory;

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.connect();
            return;
        }

        try {
            this.ws.send(JSON.stringify({ forget_all: 'ticks' }));
            setTimeout(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN && this.active_symbol === symbol) {
                    this.ws.send(
                        JSON.stringify({
                            ticks_history: symbol,
                            count: this.history_count || 1000,
                            end: 'latest',
                            style: 'ticks',
                        })
                    );
                    this.ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
                }
            }, 50);
        } catch {
            /* ignore */
        }
    };

    public subscribeCandles = (
        symbol: string,
        granularity: number,
        onCandle?: (candle: TCandle) => void,
        onHistory?: (candles: TCandle[]) => void
    ) => {
        if (!symbol) return;
        this.active_symbol = symbol;
        this.active_granularity = granularity;
        if (onCandle) this.callbacks.onCandle = onCandle;
        if (onHistory) this.callbacks.onCandleHistory = onHistory;

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.connect();
            return;
        }

        try {
            this.ws.send(JSON.stringify({ forget_all: 'candles' }));
            setTimeout(() => {
                if (
                    this.ws &&
                    this.ws.readyState === WebSocket.OPEN &&
                    this.active_symbol === symbol &&
                    this.active_granularity === granularity
                ) {
                    this.ws.send(
                        JSON.stringify({
                            ticks_history: symbol,
                            style: 'candles',
                            granularity,
                            count: 1500,
                            end: 'latest',
                            subscribe: 1,
                        })
                    );
                }
            }, 80);
        } catch {
            /* ignore */
        }
    };

    public resubscribe = () => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.active_symbol) return;
        const sym = this.active_symbol;
        const gran = this.active_granularity;

        try {
            this.ws.send(JSON.stringify({ forget_all: 'ticks' }));
            if (gran) this.ws.send(JSON.stringify({ forget_all: 'candles' }));

            setTimeout(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN && this.active_symbol === sym) {
                    this.ws.send(
                        JSON.stringify({
                            ticks_history: sym,
                            count: this.history_count || 1000,
                            end: 'latest',
                            style: 'ticks',
                        })
                    );
                    this.ws.send(JSON.stringify({ ticks: sym, subscribe: 1 }));

                    if (gran && this.active_granularity === gran) {
                        this.ws.send(
                            JSON.stringify({
                                ticks_history: sym,
                                style: 'candles',
                                granularity: gran,
                                count: 1500,
                                end: 'latest',
                                subscribe: 1,
                            })
                        );
                    }
                }
            }, 100);
        } catch {
            /* ignore */
        }
    };

    public requestActiveSymbols = (callback: (symbols: any[]) => void) => {
        this.callbacks.onSymbols = callback;
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify({ active_symbols: 'brief', req_id: 1001 }));
            } catch {
                /* ignore */
            }
        } else {
            this.connect();
        }
    };

    public unsubscribe = (type: 'ticks' | 'candles' | 'all' = 'all') => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        try {
            if (type === 'ticks' || type === 'all') {
                this.ws.send(JSON.stringify({ forget_all: 'ticks' }));
            }
            if (type === 'candles' || type === 'all') {
                this.ws.send(JSON.stringify({ forget_all: 'candles' }));
            }
        } catch {
            /* ignore */
        }
    };

    public destroy = () => {
        this.is_destroyed = true;
        this.clearTimers();
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        }
        if (this.ws) {
            this.unsubscribe('all');
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onerror = null;
            this.ws.onclose = null;
            try {
                this.ws.close();
            } catch {
                /* ignore */
            }
            this.ws = null;
        }
    };
}
