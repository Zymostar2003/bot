import React from 'react';
import SelectNative from '@/components/shared_ui/select-native';
import { api_base } from '@/external/bot-skeleton';
import {
    CONNECTION_STATUS,
    connectionStatus$,
} from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { SCAN_ASSETS } from '@/utils/scanner/constants';
import { Localize, localize } from '@deriv-com/translations';
import './agent.scss';

// Live digit-flow graph. Deliberately does NOT go through a fresh TicksService instance: that
// always sends ticks_history{subscribe:1}, which the API rejects with "AlreadySubscribed" whenever
// another always-on store (e.g. Smart Analysis) already holds that symbol's stream on the shared
// connection — which left 1-second (1HZ) symbols permanently stuck on the loading message. Instead
// we (1) fetch history WITHOUT subscribing (never conflicts), (2) try to subscribe but tolerate
// AlreadySubscribed, and (3) read live ticks off the shared api_base.onMessage() stream — so it
// works whether or not the symbol is already subscribed elsewhere.

const ASSET_OPTIONS = SCAN_ASSETS.map(a => ({ text: a.l, value: a.v }));
const BARRIER_OPTIONS = Array.from({ length: 9 }, (_, i) => ({ text: String(i + 1), value: String(i + 1) }));
const TICK_OPTIONS = [
    { text: localize('120 ticks'), value: '120' },
    { text: localize('500 ticks'), value: '500' },
    { text: localize('1000 ticks'), value: '1000' },
];

const ANALYZE_N = 50; // trailing window the on-page Last-50 analyzer summarises
const SCAN_WINDOW = 500; // deeper window the "Send Agent" scan scores each asset over

const WINDOW = 20; // minimum ticks before the heatmap / prediction model are meaningful
const FETCH_COUNT = 1100; // history depth pulled up front (covers the 1000-tick view + window)
const MAX_BUFFER = 1200; // digits kept in memory

// Digit-trail panel: the line's HEIGHT follows each digit's percentage strength (its share over the
// last 1000 ticks) rather than the fixed 0-9 value — so frequent digits ride high, rare ones low.
// Each tick gets a fixed horizontal slot (TRAIL_PX_PER_TICK) so labels have room; the track scrolls
// horizontally, auto-following the newest tick but letting you scroll back through history. Each
// point's label rides above the line as "digit (%)".
const TRAIL_MAX = 250; // most recent ticks kept in the scrollable trail
const TRAIL_PX_PER_TICK = 60; // horizontal room per tick (label above + Δ% below)
const DVB_H = 240;
const DVB_PAD = 24; // vertical breathing room so the strength line never touches the top/bottom walls

type TTickMessage = { data?: { msg_type?: string; tick?: { symbol?: string; quote?: number } } };

const lastDigitOf = (price: number, pip: number): number => parseInt(Number(price).toFixed(pip).slice(-1), 10);

type THeatCell = { digit: number; pct: number; shift: number };

// Per-digit frequency (%) over an array of digits.
const digitPct = (arr: number[]): number[] => {
    const counts = new Array(10).fill(0);
    arr.forEach(d => {
        if (d >= 0 && d <= 9) counts[d] += 1;
    });
    const n = arr.length || 1;
    return counts.map(c => (c / n) * 100);
};

// Heatmap of digit frequencies over the window, plus each digit's "shift": its share in the more
// recent half of the window minus its share in the older half — i.e. how that digit's individual
// percentage is trending (positive = showing up more lately, negative = fading).
const computeHeatmap = (digits: number[], count: number): THeatCell[] => {
    const win = digits.slice(-count);
    const N = win.length;
    const freq = digitPct(win);
    const half = Math.floor(N / 2);
    const older = digitPct(win.slice(0, half));
    const recent = digitPct(win.slice(half));
    return freq.map((pct, d) => ({ digit: d, pct, shift: recent[d] - older[d] }));
};

// --- Last-50 analyzer -------------------------------------------------------------------------
// Summarises how the last ANALYZE_N digits moved, across the three digit-contract views:
//   • Even / Odd     — parity of each digit
//   • Over / Under   — each digit vs the barrier (equal to the barrier counts as neither)
//   • Matches/Differs — a "difference": did the digit repeat the previous one, or change?
// Each view also reports the current run at the end of the window (side + length).

type TSide = { label: string; val: number };
type TView = { a: TSide; b: TSide; denom: number; run: { side: string; len: number } };

// Length of the trailing run in `arr` under classifier `key` (how many in a row match the newest).
const runEnd = <T,>(arr: T[], key: (x: T) => string): { side: string; len: number } => {
    if (!arr.length) return { side: '', len: 0 };
    const side = key(arr[arr.length - 1]);
    let len = 0;
    for (let i = arr.length - 1; i >= 0 && key(arr[i]) === side; i--) len += 1;
    return { side, len };
};

const analyzeLast = (
    digits: number[],
    n: number,
    barrier: number
): { evenodd: TView; overunder: TView; matchdiff: TView } => {
    const win = digits.slice(-n);
    const len = win.length;
    const even = win.filter(d => d % 2 === 0).length;
    const over = win.filter(d => d > barrier).length;
    const under = win.filter(d => d < barrier).length;

    // Transitions (the "differences"): match = repeated the previous digit, differ = changed.
    const trans: string[] = [];
    for (let i = 1; i < len; i++) trans.push(win[i] === win[i - 1] ? 'match' : 'differ');
    const matches = trans.filter(t => t === 'match').length;

    return {
        evenodd: {
            a: { label: 'Even', val: even },
            b: { label: 'Odd', val: len - even },
            denom: len,
            run: runEnd(win, d => (d % 2 === 0 ? 'Even' : 'Odd')),
        },
        overunder: {
            a: { label: `Over ${barrier}`, val: over },
            b: { label: `Under ${barrier}`, val: under },
            denom: len,
            run: runEnd(win, d => (d > barrier ? 'Over' : d < barrier ? 'Under' : 'Equal')),
        },
        matchdiff: {
            a: { label: 'Matches', val: matches },
            b: { label: 'Differs', val: trans.length - matches },
            denom: trans.length,
            run: runEnd(trans, t => (t === 'match' ? 'Matches' : 'Differs')),
        },
    };
};

// --- Agent scan: best side to trade per contract type ------------------------------------------
// For a window of digits, finds the strongest side for each contract family by how far the observed
// win-rate beats its random baseline (the "edge"):
//   • Even/Odd     — the more frequent parity (baseline 50%).
//   • Over/Under   — the barrier + side whose observed rate most beats its baseline
//                    (Over N baseline = (9-N)/10, Under N baseline = N/10).
//   • Matches/Differs — Matches on the hottest digit (baseline 10%) vs Differs on the coldest
//                    digit (baseline 90%), whichever edge is larger.

const SIDE_COLOR: Record<string, string> = {
    Even: '#22c55e',
    Odd: '#f59e0b',
    Over: '#3b82f6',
    Under: '#ef4444',
    Matches: '#14b8a6',
    Differs: '#8a97a8',
};

type TRec = {
    eo: { side: string; win: number; edge: number };
    ou: { side: string; barrier: number; win: number; edge: number };
    md: { side: string; digit: number; win: number; edge: number };
    best: number;
};

const recommendTrade = (ds: number[]): TRec | null => {
    if (ds.length < 10) return null;
    const freq = digitPct(ds);

    // Even / Odd
    const even = freq.reduce((s, p, d) => (d % 2 === 0 ? s + p : s), 0);
    const odd = 100 - even;
    const eo = even >= odd ? { side: 'Even', win: even, edge: even - 50 } : { side: 'Odd', win: odd, edge: odd - 50 };

    // Over / Under — scan every barrier, keep the strongest edge.
    let ou = { side: 'Over', barrier: 5, win: 0, edge: -Infinity };
    for (let n = 1; n <= 8; n++) {
        const over = freq.reduce((s, p, d) => (d > n ? s + p : s), 0);
        const under = freq.reduce((s, p, d) => (d < n ? s + p : s), 0);
        const overEdge = over - (9 - n) * 10; // baseline (9-n)/10
        const underEdge = under - n * 10; // baseline n/10
        if (overEdge > ou.edge) ou = { side: 'Over', barrier: n, win: over, edge: overEdge };
        if (underEdge > ou.edge) ou = { side: 'Under', barrier: n, win: under, edge: underEdge };
    }

    // Matches / Differs
    let hot = 0;
    let cold = 0;
    freq.forEach((p, d) => {
        if (p > freq[hot]) hot = d;
        if (p < freq[cold]) cold = d;
    });
    const matchEdge = freq[hot] - 10;
    const differsWin = 100 - freq[cold];
    const differsEdge = differsWin - 90;
    const md =
        matchEdge >= differsEdge
            ? { side: 'Matches', digit: hot, win: freq[hot], edge: matchEdge }
            : { side: 'Differs', digit: cold, win: differsWin, edge: differsEdge };

    return { eo, ou, md, best: Math.max(eo.edge, ou.edge, md.edge) };
};

// --- Prediction model -------------------------------------------------------------------------
// The "4 most likely next digits" come from blending three signals rather than raw frequency:
//   1. recency-weighted frequency — recent ticks count more (exponential half-life decay),
//   2. a first-order Markov transition — P(next digit | the digit that just landed),
//   3. momentum — a small bump for digits whose share is trending up (the heatmap shift).
// The Markov signal is trusted in proportion to how many samples back it, so a sparsely-seen
// "last digit" falls back to the frequency model instead of chasing noise.

// Recency-weighted digit distribution over the window (sums to 1). Half-life scales with the window.
const weightedDigitDist = (digits: number[], count: number): number[] => {
    const win = digits.slice(-count);
    const n = win.length;
    const halfLife = Math.max(8, count / 6);
    const w = new Array(10).fill(0);
    let total = 0;
    win.forEach((d, i) => {
        if (d < 0 || d > 9) return;
        const weight = Math.pow(0.5, (n - 1 - i) / halfLife); // i = n-1 is the newest tick
        w[d] += weight;
        total += weight;
    });
    return w.map(x => (total ? x / total : 0.1));
};

// First-order Markov transition P(next | current === last), with the sample count backing it.
const transitionDist = (digits: number[], last: number, count: number): { probs: number[]; samples: number } => {
    const win = digits.slice(-count);
    const counts = new Array(10).fill(0);
    let samples = 0;
    for (let i = 1; i < win.length; i++) {
        if (win[i - 1] === last) {
            counts[win[i]] += 1;
            samples += 1;
        }
    }
    return { probs: counts.map(c => (samples ? c / samples : 0.1)), samples };
};

type TModel = { ranked: number[]; probs: number[]; confidence: number };

// Blends the three signals into a per-digit probability, ranks them, and derives a confidence score
// (how much the top-4 probability mass beats a blind 40% baseline — 4 of 10 digits picked at random).
const predictNext = (digits: number[], heat: THeatCell[], count: number): TModel => {
    const empty: TModel = { ranked: [], probs: new Array(10).fill(0), confidence: 0 };
    if (digits.length < WINDOW) return empty;
    const last = digits[digits.length - 1];
    const freq = weightedDigitDist(digits, count);
    const { probs: trans, samples } = transitionDist(digits, last, count);
    const transWeight = samples / (samples + 10); // trust Markov more as its evidence grows

    const scores = new Array(10).fill(0).map((_, d) => {
        const blended = (1 - transWeight) * freq[d] + transWeight * trans[d];
        const momentum = Math.max(0, heat[d]?.shift ?? 0) / 100; // reward digits trending up
        return Math.max(0, blended + momentum * 0.15);
    });
    const sum = scores.reduce((a, b) => a + b, 0) || 1;
    const probs = scores.map(s => s / sum);
    const ranked = probs
        .map((p, d) => ({ p, d }))
        .sort((a, b) => b.p - a.p)
        .map(x => x.d);
    const top4Mass = ranked.slice(0, 4).reduce((a, d) => a + probs[d], 0);
    const confidence = Math.max(0, Math.min(1, (top4Mass - 0.4) / 0.6));
    return { ranked: ranked.slice(0, 4), probs, confidence };
};

// Blue (least frequent) → red (most frequent) across the current digit spread.
const heatColor = (pct: number, min: number, max: number): string => {
    const t = max > min ? (pct - min) / (max - min) : 0.5;
    const hue = 210 - t * 210;
    return `hsl(${hue.toFixed(0)}, 68%, 45%)`;
};

const Agent = () => {
    const [symbol, setSymbol] = React.useState(SCAN_ASSETS[0].v);
    const [tick_count, setTickCount] = React.useState(120);
    const [barrier, setBarrier] = React.useState(5);
    const [digits, setDigits] = React.useState<number[]>([]);
    const [scanning, setScanning] = React.useState(false);
    const [scan_progress, setScanProgress] = React.useState(0);
    const [scan_results, setScanResults] = React.useState<
        { asset: (typeof SCAN_ASSETS)[number]; rec: TRec | null }[] | null
    >(null);

    // Subscribes to the symbol's live ticks (conflict-proof, see file header). Re-runs on symbol
    // change and on reconnect.
    React.useEffect(() => {
        let cancelled = false;
        let cleanupInner = () => {};

        const start = async () => {
            cleanupInner();
            let owned_sub_id: string | null = null;
            let msg_sub: { unsubscribe: () => void } | null = null;
            let inner_stopped = false;
            cleanupInner = () => {
                inner_stopped = true;
                msg_sub?.unsubscribe();
                if (owned_sub_id && api_base?.api) api_base.api.forget(owned_sub_id).catch(() => {});
            };

            if (!api_base?.api) return;
            if (!api_base.has_active_symbols) {
                try {
                    await api_base.active_symbols_promise;
                } catch {
                    /* fall through with pip fallback */
                }
            }
            if (cancelled || inner_stopped) return;
            const pip = () => (api_base.pip_sizes as Record<string, number>)?.[symbol] ?? 2;

            // 1. History without subscribe — never triggers AlreadySubscribed.
            try {
                const res = await api_base.api.send({
                    ticks_history: symbol,
                    end: 'latest',
                    count: FETCH_COUNT,
                    style: 'ticks',
                });
                if (cancelled || inner_stopped) return;
                const prices: number[] = res?.history?.prices ?? [];
                setDigits(prices.map(p => lastDigitOf(p, pip())).slice(-MAX_BUFFER));
            } catch {
                /* leave digits empty; loading message stays until ticks arrive */
            }

            // 2. Try to own the live subscription; tolerate AlreadySubscribed (piggyback instead).
            try {
                const sub = await api_base.api.send({ ticks: symbol, subscribe: 1 });
                owned_sub_id = sub?.subscription?.id ?? null;
            } catch {
                /* already subscribed elsewhere — ticks still flow on the shared connection */
            }
            if (cancelled || inner_stopped) return;

            // 3. Read live ticks off the shared connection.
            msg_sub = api_base.api.onMessage().subscribe((message: TTickMessage) => {
                if (cancelled || inner_stopped) return;
                const tick = message?.data?.tick;
                if (message?.data?.msg_type === 'tick' && tick?.symbol === symbol && typeof tick.quote === 'number') {
                    const d = lastDigitOf(tick.quote, pip());
                    setDigits(prev => [...prev, d].slice(-MAX_BUFFER));
                }
            });
        };

        setDigits([]);
        start();

        const conn = connectionStatus$.subscribe((status: string) => {
            if (status === CONNECTION_STATUS.OPENED && api_base.api) start();
        });

        return () => {
            cancelled = true;
            cleanupInner();
            conn.unsubscribe();
        };
    }, [symbol]);

    const heatmap = React.useMemo(() => computeHeatmap(digits, tick_count), [digits, tick_count]);
    const heat_min = Math.min(...heatmap.map(c => c.pct));
    const heat_max = Math.max(...heatmap.map(c => c.pct));
    // Blended recency + Markov + momentum model (see predictNext). `predictions` = the 4 most likely
    // next digits; `model.confidence` = how strong that edge is over a blind pick.
    const model = React.useMemo(() => predictNext(digits, heatmap, tick_count), [digits, heatmap, tick_count]);
    const predictions = model.ranked;

    // Last-50 analyzer across Even/Odd, Over/Under and Matches/Differs (see analyzeLast).
    const analyzer = React.useMemo(() => analyzeLast(digits, ANALYZE_N, barrier), [digits, barrier]);

    // "Send Agent" — scan every synthetic asset's last ANALYZE_N digits and rank the best side to
    // trade per contract family (see recommendTrade). History is fetched WITHOUT subscribing so it
    // never collides with live streams (same rationale as the file header).
    const runAgentScan = React.useCallback(async () => {
        if (scanning || !api_base?.api) return;
        setScanning(true);
        setScanProgress(0);
        setScanResults(null);
        try {
            if (!api_base.has_active_symbols) {
                try {
                    await api_base.active_symbols_promise;
                } catch {
                    /* fall through with pip fallback */
                }
            }
            const pipOf = (s: string) => (api_base.pip_sizes as Record<string, number>)?.[s] ?? 2;
            const out: { asset: (typeof SCAN_ASSETS)[number]; rec: TRec | null }[] = [];
            for (const asset of SCAN_ASSETS) {
                try {
                    const res = await api_base.api.send({
                        ticks_history: asset.v,
                        end: 'latest',
                        count: SCAN_WINDOW + 20,
                        style: 'ticks',
                    });
                    const prices: number[] = res?.history?.prices ?? [];
                    const ds = prices.map(p => lastDigitOf(p, pipOf(asset.v))).slice(-SCAN_WINDOW);
                    out.push({ asset, rec: recommendTrade(ds) });
                } catch {
                    out.push({ asset, rec: null });
                }
                setScanProgress(out.length);
            }
            out.sort((a, b) => (b.rec?.best ?? -Infinity) - (a.rec?.best ?? -Infinity));
            setScanResults(out);
        } finally {
            setScanning(false);
        }
    }, [scanning]);

    // Short WebAudio "blip" — no asset file (CSP-safe). The scan gesture unlocks the context.
    const audio_ref = React.useRef<AudioContext | null>(null);
    const beep = React.useCallback(() => {
        try {
            const AC =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AC) return;
            let ctx = audio_ref.current;
            if (!ctx) {
                ctx = new AC();
                audio_ref.current = ctx;
            }
            if (ctx.state === 'suspended') ctx.resume();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.13);
        } catch {
            /* audio unavailable — silent */
        }
    }, []);

    // Scanning sound while a scan runs: blip every 0.25s for two beeps, then a 1s pause, repeating
    // (a 6-tick cycle at 250ms — beeps on ticks 0,1; the next four are the 1s silence) until done.
    React.useEffect(() => {
        if (!scanning) return undefined;
        let i = 0;
        const id = setInterval(() => {
            if (i % 6 < 2) beep();
            i += 1;
        }, 250);
        return () => clearInterval(id);
    }, [scanning, beep]);

    // Each digit's share (%) over the last 1000 ticks — this is the "strength" that drives the trail's
    // vertical position and is shown in brackets on each label.
    const digit_freq_1000 = React.useMemo(() => digitPct(digits.slice(-1000)), [digits]);
    // Map a strength% to a viewBox y, scaled to the current spread (padded) so the line uses the
    // height well without ever touching the top/bottom walls.
    const strengthY = React.useMemo(() => {
        const lo0 = Math.min(...digit_freq_1000);
        const hi0 = Math.max(...digit_freq_1000);
        const pad = Math.max((hi0 - lo0) * 0.2, 0.5);
        const lo = lo0 - pad;
        const span = hi0 + pad - lo || 1;
        return (pct: number) => DVB_PAD + (1 - (pct - lo) / span) * (DVB_H - 2 * DVB_PAD);
    }, [digit_freq_1000]);

    // Digit-trail over the last TRAIL_MAX ticks. x is the tick index (one viewBox unit per tick),
    // stretched to TRAIL_PX_PER_TICK by the scroll track's CSS width; y is the digit's strength.
    const digit_view = React.useMemo(() => digits.slice(-Math.min(tick_count, TRAIL_MAX)), [digits, tick_count]);
    const trail_vb_w = Math.max(digit_view.length - 1, 1); // viewBox width in tick units
    const trail_px_w = Math.max(trail_vb_w * TRAIL_PX_PER_TICK, 1); // scroll-track pixel width
    // One <line> per step so each segment can be coloured by the digit it arrives at (even = green,
    // odd = amber — matching the Even/Odd band colours).
    const trail_segments = React.useMemo(() => {
        const n = digit_view.length;
        const segs: {
            x1: number;
            y1: number;
            x2: number;
            y2: number;
            mid: number;
            even: boolean;
            delta: number;
            changed: boolean;
        }[] = [];
        for (let i = 1; i < n; i++) {
            const d_prev = digit_view[i - 1];
            const d_cur = digit_view[i];
            segs.push({
                x1: i - 1,
                y1: strengthY(digit_freq_1000[d_prev]),
                x2: i,
                y2: strengthY(digit_freq_1000[d_cur]),
                mid: i - 0.5,
                even: d_cur % 2 === 0,
                delta: digit_freq_1000[d_cur] - digit_freq_1000[d_prev], // Δ strength vs previous
                changed: d_cur !== d_prev,
            });
        }
        return segs;
    }, [digit_view, digit_freq_1000, strengthY]);
    // Auto-follow the newest tick, but only when the user is already parked near the right edge —
    // so scrolling back to inspect history isn't yanked forward on every incoming tick.
    const trail_scroll_ref = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        const el = trail_scroll_ref.current;
        if (!el) return;
        const near_right = el.scrollWidth - el.clientWidth - el.scrollLeft < 48;
        if (near_right) el.scrollLeft = el.scrollWidth;
    }, [digit_view]);
    const ready = digits.length >= WINDOW;
    const last_digit = digits.length ? digits[digits.length - 1] : null;

    return (
        <div className='agent'>
            <div className='agent__header'>
                <span className='agent__title'>
                    <Localize i18n_default_text='🤖 Agent — Live Digit Flow' />
                </span>
                <SelectNative
                    className='agent__select'
                    list_items={ASSET_OPTIONS}
                    value={symbol}
                    should_show_empty_option={false}
                    placeholder={localize('Asset')}
                    onChange={e => setSymbol(e.target.value)}
                />
                <SelectNative
                    className='agent__select agent__select--small'
                    list_items={TICK_OPTIONS}
                    value={String(tick_count)}
                    should_show_empty_option={false}
                    placeholder={localize('Ticks')}
                    onChange={e => setTickCount(Number(e.target.value))}
                />
                <SelectNative
                    className='agent__select agent__select--small'
                    list_items={BARRIER_OPTIONS}
                    value={String(barrier)}
                    should_show_empty_option={false}
                    placeholder={localize('Barrier')}
                    onChange={e => setBarrier(Number(e.target.value))}
                />
                <button className='agent__send' onClick={runAgentScan} disabled={scanning} type='button'>
                    {scanning ? (
                        <Localize
                            i18n_default_text='Scanning {{n}}/{{t}}…'
                            values={{ n: scan_progress, t: SCAN_ASSETS.length }}
                        />
                    ) : (
                        <Localize i18n_default_text='Send Agent' />
                    )}
                </button>
            </div>

            <div className='agent__body'>
                {scan_results && (
                    <div className='agent-scan'>
                        <div className='agent-scan__head'>
                            <span className='agent-scan__title'>
                                <Localize i18n_default_text='AGENT SCAN · BEST SIDE PER ASSET (LAST 500)' />
                            </span>
                            <button
                                className='agent-scan__close'
                                onClick={() => setScanResults(null)}
                                type='button'
                                aria-label={localize('Close')}
                            >
                                ×
                            </button>
                        </div>
                        <div className='agent-scan__table'>
                            <div className='agent-scan__row agent-scan__row--head'>
                                <span>
                                    <Localize i18n_default_text='Asset' />
                                </span>
                                <span>
                                    <Localize i18n_default_text='Even / Odd' />
                                </span>
                                <span>
                                    <Localize i18n_default_text='Over / Under' />
                                </span>
                                <span>
                                    <Localize i18n_default_text='Matches / Differs' />
                                </span>
                            </div>
                            {scan_results.map(({ asset, rec }) => (
                                <div className='agent-scan__row' key={asset.v}>
                                    <span className='agent-scan__asset'>{asset.l}</span>
                                    {rec ? (
                                        <>
                                            <span
                                                className={`agent-scan__cell${rec.best === rec.eo.edge ? ' agent-scan__cell--best' : ''}`}
                                                style={{ color: SIDE_COLOR[rec.eo.side] }}
                                            >
                                                {rec.eo.side} · {rec.eo.win.toFixed(0)}%
                                            </span>
                                            <span
                                                className={`agent-scan__cell${rec.best === rec.ou.edge ? ' agent-scan__cell--best' : ''}`}
                                                style={{ color: SIDE_COLOR[rec.ou.side] }}
                                            >
                                                {rec.ou.side} {rec.ou.barrier} · {rec.ou.win.toFixed(0)}%
                                            </span>
                                            <span
                                                className={`agent-scan__cell${rec.best === rec.md.edge ? ' agent-scan__cell--best' : ''}`}
                                                style={{ color: SIDE_COLOR[rec.md.side] }}
                                            >
                                                {rec.md.side} {rec.md.digit} · {rec.md.win.toFixed(0)}%
                                            </span>
                                        </>
                                    ) : (
                                        <span className='agent-scan__cell agent-scan__cell--empty'>
                                            <Localize i18n_default_text='no data' />
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className='agent-scan__note'>
                            <Localize i18n_default_text='Ranked best → least. ★ marks each asset’s strongest edge; edge is vs a random baseline over the last 500 ticks. Synthetic indices are random — treat as short-term bias, not a guarantee.' />
                        </div>
                    </div>
                )}

                {!ready && (
                    <div className='agent-loading'>
                        <Localize i18n_default_text='Connecting to live ticks…' />
                    </div>
                )}

                {ready && (
                    <div className='agent-digits'>
                        <div className='agent-digits__scroll' ref={trail_scroll_ref}>
                            <div className='agent-digits__inner' style={{ width: `${trail_px_w}px` }}>
                                <svg
                                    className='agent-digits__svg'
                                    viewBox={`0 0 ${trail_vb_w} ${DVB_H}`}
                                    preserveAspectRatio='none'
                                >
                                    {trail_segments.map((s, i) => (
                                        <line
                                            key={i}
                                            className='agent-digits__seg'
                                            x1={s.x1}
                                            y1={s.y1}
                                            x2={s.x2}
                                            y2={s.y2}
                                            style={{ stroke: s.even ? '#22c55e' : '#f59e0b' }}
                                        />
                                    ))}
                                </svg>
                                {/* Label rides ABOVE the line at each point: "digit (% of last 1000)". */}
                                {digit_view.map((d, i) => (
                                    <span
                                        key={i}
                                        className={`agent-digits__label${i === digit_view.length - 1 ? ' agent-digits__label--last' : ''}`}
                                        style={{
                                            left: `${((i / trail_vb_w) * 100).toFixed(3)}%`,
                                            top: `${((strengthY(digit_freq_1000[d]) / DVB_H) * 100).toFixed(2)}%`,
                                            color: d % 2 === 0 ? '#22c55e' : '#f59e0b',
                                        }}
                                    >
                                        <b className='agent-digits__label-d'>{d}</b>
                                        <span className='agent-digits__label-pct'>
                                            ({digit_freq_1000[d].toFixed(1)}%)
                                        </span>
                                    </span>
                                ))}
                                {/* Horizontal Δ scale along the bottom: the strength change from the
                                    previous digit to this one. Only shown when the digit changes. */}
                                {trail_segments.map((s, i) =>
                                    s.changed ? (
                                        <span
                                            key={i}
                                            className={`agent-digits__delta agent-digits__delta--${s.delta >= 0 ? 'up' : 'down'}`}
                                            style={{ left: `${((s.mid / trail_vb_w) * 100).toFixed(3)}%` }}
                                        >
                                            {s.delta >= 0 ? '▲' : '▼'}
                                            {Math.abs(s.delta).toFixed(1)}
                                        </span>
                                    ) : null
                                )}
                            </div>
                        </div>
                        <span className='agent-digits__caption'>
                            <Localize i18n_default_text='DIGIT TRAIL · Y = % STRENGTH (LAST 1000) · Δ% BELOW · SCROLL ↔' />
                        </span>
                    </div>
                )}

                {ready && (
                    <div className='agent-analyzer'>
                        <span className='agent-analyzer__title'>
                            <Localize i18n_default_text='LAST 50 · % DIFFERENCE (BIAS)' />
                        </span>
                        <div className='agent-analyzer__grid'>
                            {[
                                { view: analyzer.evenodd, colors: ['#22c55e', '#f59e0b'] },
                                { view: analyzer.overunder, colors: ['#3b82f6', '#ef4444'] },
                                { view: analyzer.matchdiff, colors: ['#14b8a6', '#8a97a8'] },
                            ].map(({ view, colors }, ci) => {
                                const sum = view.a.val + view.b.val || 1;
                                const aw = (view.a.val / sum) * 100;
                                const pa = view.denom ? (view.a.val / view.denom) * 100 : 0;
                                const pb = view.denom ? (view.b.val / view.denom) * 100 : 0;
                                // The headline: the percentage-point gap between the two sides, and
                                // which side it leans to.
                                const diff = pa - pb;
                                const lead =
                                    diff >= 0
                                        ? { label: view.a.label, color: colors[0] }
                                        : { label: view.b.label, color: colors[1] };
                                return (
                                    <div className='agent-analyzer__card' key={ci}>
                                        <div className='agent-analyzer__diff' style={{ color: lead.color }}>
                                            <span className='agent-analyzer__diff-val'>
                                                {diff >= 0 ? '+' : '−'}
                                                {Math.abs(diff).toFixed(1)}%
                                            </span>
                                            <span className='agent-analyzer__diff-lead'>{lead.label}</span>
                                        </div>
                                        <div className='agent-analyzer__bar'>
                                            <span
                                                className='agent-analyzer__bar-seg'
                                                style={{ width: `${aw.toFixed(1)}%`, background: colors[0] }}
                                            />
                                            <span
                                                className='agent-analyzer__bar-seg'
                                                style={{ width: `${(100 - aw).toFixed(1)}%`, background: colors[1] }}
                                            />
                                        </div>
                                        <div className='agent-analyzer__row'>
                                            <span className='agent-analyzer__side' style={{ color: colors[0] }}>
                                                {view.a.label} {pa.toFixed(1)}%
                                            </span>
                                            <span
                                                className='agent-analyzer__side agent-analyzer__side--b'
                                                style={{ color: colors[1] }}
                                            >
                                                {view.b.label} {pb.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className='agent-analyzer__streak'>
                                            <Localize i18n_default_text='Now' />: <b>{view.run.side || '—'}</b> ×
                                            {view.run.len}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className='agent-legend'>
                    {ready && (
                        <div className='agent-legend__conf'>
                            <span className='agent-legend__conf-label'>
                                <Localize i18n_default_text='AI confidence' />
                            </span>
                            <span className='agent-legend__conf-bar'>
                                <span
                                    className='agent-legend__conf-fill'
                                    style={{ width: `${(model.confidence * 100).toFixed(0)}%` }}
                                />
                            </span>
                            <span className='agent-legend__conf-value'>{(model.confidence * 100).toFixed(0)}%</span>
                        </div>
                    )}
                    <div className='agent-legend__digit'>
                        <span className='agent-legend__digit-label'>
                            <Localize i18n_default_text='Last digit' />
                        </span>
                        <span
                            className='agent-legend__digit-value'
                            style={{
                                color: last_digit === null ? undefined : last_digit % 2 === 0 ? '#22c55e' : '#f59e0b',
                            }}
                        >
                            {last_digit === null ? '—' : last_digit}
                        </span>
                    </div>
                </div>

                {ready && (
                    <div className='agent-heat-wrap'>
                        <div className='agent-cursor'>
                            {last_digit !== null && (
                                <span
                                    className='agent-cursor__marker'
                                    style={{ '--i': last_digit } as React.CSSProperties}
                                >
                                    ▼
                                </span>
                            )}
                        </div>
                        <div className='agent-heatmap'>
                            {heatmap.map(cell => {
                                const up = cell.shift > 0.05;
                                const down = cell.shift < -0.05;
                                const shift_class = up
                                    ? 'agent-heatmap__shift agent-heatmap__shift--up'
                                    : down
                                      ? 'agent-heatmap__shift agent-heatmap__shift--down'
                                      : 'agent-heatmap__shift';
                                const is_last = cell.digit === last_digit;
                                const is_pred = predictions.includes(cell.digit);
                                return (
                                    <div
                                        key={cell.digit}
                                        className='agent-heatmap__cell'
                                        style={{ background: heatColor(cell.pct, heat_min, heat_max) }}
                                    >
                                        <span
                                            className={`agent-heatmap__cell-cursor${is_last ? ' agent-heatmap__cell-cursor--on' : ''}`}
                                        >
                                            ▼
                                        </span>
                                        <span className='agent-heatmap__digit'>{cell.digit}</span>
                                        <span className='agent-heatmap__pct'>{cell.pct.toFixed(1)}%</span>
                                        <span className={shift_class}>
                                            {up ? '▲' : down ? '▼' : '–'} {Math.abs(cell.shift).toFixed(1)}
                                        </span>
                                        <span
                                            className={`agent-heatmap__cell-arrow${is_pred ? ' agent-heatmap__cell-arrow--on' : ''}`}
                                        >
                                            ▲
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className='agent-arrows'>
                            {predictions.map(d => (
                                <span
                                    key={d}
                                    className='agent-arrows__marker'
                                    style={{ '--i': d } as React.CSSProperties}
                                >
                                    ▲
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className='agent__hint'>
                    <Localize i18n_default_text='Digit trail: the line’s height is each digit’s strength (its share of the last 1000 ticks) — frequent digits ride high, rare ones low — with the Δ% between consecutive digits along the bottom. Heatmap: each digit’s frequency (blue → red) with ▲/▼ its shift across the window. ▼ above marks where the last tick landed; ▲ below marks the 4 most likely next digits — from a model blending recency-weighted frequency, a Markov transition (what tends to follow the last digit) and momentum, with AI confidence showing its edge over a blind pick. These are random synthetic indices — patterns describe short-term statistics, not a guaranteed edge.' />
                </div>
            </div>
        </div>
    );
};

export default Agent;
