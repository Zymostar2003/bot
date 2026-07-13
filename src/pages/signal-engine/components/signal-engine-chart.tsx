import React from 'react';
import {
    CandlestickData,
    ColorType,
    createChart,
    CrosshairMode,
    IChartApi,
    ISeriesApi,
    LineData,
    LineStyle,
    SeriesMarker,
    Time,
    UTCTimestamp,
} from 'lightweight-charts';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { TCandle, TChartMarker, TGravitonPoint, TPulsePoint } from '@/utils/signal-engine/types';

const VISIBLE_BARS = 80;

// Faithful port of initChart/updateChart/updateGraviton/updatePulse and the Graviton×Pulse
// crossover markers (reference: reference/index-335-black-bars.html, lines 12276-12419 and
// 12679-12748). The VFPI sub-pane (`#vfp-pane`) and indicator toggle bar (`#ind-toggle-bar`)
// are `display:none !important` / `display:none` dead code in the reference — never shown,
// never toggled — and are not ported, same as the "Patterns room" precedent.
// Reads from document.body, not document.documentElement: the .theme--light/.theme--dark
// classes that actually define --general-main-1 and friends are applied to <body>
// (MainBody, src/components/layout/main-body/index.tsx), not <html>. CSS custom properties
// only cascade down the DOM tree, so document.documentElement's computed style never sees
// them — every token read here was silently missing and falling back to the hardcoded dark
// defaults below regardless of the active theme.
const readToken = (name: string, fallback: string) => {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.body).getPropertyValue(name).trim();
    return value || fallback;
};

const buildChartOptions = () => ({
    // Lets lightweight-charts own an internal ResizeObserver on the container and keep the
    // canvas matched to it — a fixed width/height read once at mount (the previous approach)
    // locks the canvas to whatever the container's width happened to be at that instant,
    // which is wrong when the container was still being laid out (e.g. a flex item that
    // hadn't yet claimed its full row width — see .signal-engine's `width: 100%` fix).
    autoSize: true,
    layout: {
        background: { type: ColorType.Solid, color: readToken('--general-main-1', '#0e0e11') },
        textColor: readToken('--text-less-prominent', '#818181'),
    },
    grid: {
        vertLines: { color: readToken('--border-normal', '#1e2230') },
        horzLines: { color: readToken('--border-normal', '#1e2230') },
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: { borderColor: readToken('--border-normal', '#2a2d3e'), autoScale: true },
    timeScale: {
        borderColor: readToken('--border-normal', '#2a2d3e'),
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 12,
        minBarSpacing: 4,
        fixLeftEdge: false,
        fixRightEdge: false,
    },
    // Disabling vertical touch-drag panning and wheel/pinch zoom stops the chart from
    // capturing the gestures a user actually means for the page (mouse wheel over the chart
    // otherwise zooms it instead of scrolling .signal-engine__main). Horizontal panning
    // (pressedMouseMove, horzTouchDrag, axisPressedMouseMove) is left at its default so the
    // chart is still draggable left/right and the price/time axes are still adjustable.
    handleScroll: { vertTouchDrag: false },
    handleScale: { axisDoubleClickReset: false, mouseWheel: false, pinch: false },
});

const toCandleData = (candles: TCandle[]): CandlestickData<Time>[] =>
    candles
        .map(c => ({
            time: c.epoch as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
        }))
        .sort((a, b) => (a.time as number) - (b.time as number));

const toLineData = (points: (TGravitonPoint | TPulsePoint)[]): LineData<Time>[] =>
    points
        .map(p => ({ time: p.time as UTCTimestamp, value: p.value }))
        .sort((a, b) => (a.time as number) - (b.time as number));

const toMarkers = (markers: TChartMarker[]): SeriesMarker<Time>[] =>
    markers.map(m => ({
        time: m.time as UTCTimestamp,
        position: m.position,
        color: m.color,
        shape: m.shape,
        text: m.text,
    }));

const SignalEngineChart = observer(() => {
    const { signal_engine, ui } = useStore();
    const { symbol, granularity, candle_history, graviton_data, pulse_data, chart_markers, indicator_visibility } =
        signal_engine;

    const container_ref = React.useRef<HTMLDivElement | null>(null);
    const chart_ref = React.useRef<IChartApi | null>(null);
    const candle_series_ref = React.useRef<ISeriesApi<'Candlestick'> | null>(null);
    const graviton_series_ref = React.useRef<ISeriesApi<'Line'> | null>(null);
    const pulse_series_ref = React.useRef<ISeriesApi<'Line'> | null>(null);
    const last_view_key_ref = React.useRef('');

    // ── Mount / unmount (once) ──
    React.useEffect(() => {
        const container = container_ref.current;
        if (!container) return undefined;

        const chart = createChart(container, buildChartOptions());
        const candle_series = chart.addCandlestickSeries({
            upColor: readToken('--status-success', '#00c853'),
            downColor: readToken('--status-danger', '#ff5252'),
            borderUpColor: readToken('--status-success', '#00c853'),
            borderDownColor: readToken('--status-danger', '#ff5252'),
            wickUpColor: readToken('--status-success', '#00c853'),
            wickDownColor: readToken('--status-danger', '#ff5252'),
        });
        const graviton_series = chart.addLineSeries({
            color: '#ffb300',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            pointMarkersVisible: true,
            pointMarkersRadius: 1.5,
            crosshairMarkerVisible: false,
            lastValueVisible: true,
            priceLineVisible: false,
            priceScaleId: 'right',
            title: 'GRAVITON',
        });
        const pulse_series = chart.addLineSeries({
            color: '#00e5ff',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            pointMarkersVisible: true,
            pointMarkersRadius: 1.5,
            crosshairMarkerVisible: false,
            lastValueVisible: true,
            priceLineVisible: false,
            priceScaleId: 'right',
            title: 'PULSE',
        });

        chart_ref.current = chart;
        candle_series_ref.current = candle_series;
        graviton_series_ref.current = graviton_series;
        pulse_series_ref.current = pulse_series;

        return () => {
            chart.remove();
            chart_ref.current = null;
            candle_series_ref.current = null;
            graviton_series_ref.current = null;
            pulse_series_ref.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Re-theme on dark/light toggle (reference: toggleTheme, lines 12189-12202) ──
    React.useEffect(() => {
        chart_ref.current?.applyOptions(buildChartOptions());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ui.is_dark_mode_on]);

    // ── Candle data + view-snap-on-asset-change (reference: updateChart, lines 12384-12419) ──
    React.useEffect(() => {
        const chart = chart_ref.current;
        const candle_series = candle_series_ref.current;
        if (!chart || !candle_series || !candle_history.length) return;

        const data = toCandleData(candle_history);
        candle_series.setData(data);
        try {
            chart.priceScale('right').applyOptions({ autoScale: true });
        } catch {
            // price scale not ready yet — safe to ignore, next update retries
        }

        const view_key = `${symbol}|${granularity}`;
        if (last_view_key_ref.current !== view_key) {
            last_view_key_ref.current = view_key;
            try {
                chart.timeScale().setVisibleLogicalRange({
                    from: Math.max(0, data.length - VISIBLE_BARS),
                    to: data.length + 8,
                });
            } catch {
                chart.timeScale().fitContent();
            }
        }
    }, [candle_history, symbol, granularity]);

    // ── Graviton overlay (reference: updateGraviton) ──
    React.useEffect(() => {
        const graviton_series = graviton_series_ref.current;
        if (!graviton_series) return;
        graviton_series.setData(indicator_visibility.graviton ? toLineData(graviton_data) : []);
    }, [graviton_data, indicator_visibility.graviton]);

    // ── Pulse overlay (reference: updatePulse) ──
    React.useEffect(() => {
        const pulse_series = pulse_series_ref.current;
        if (!pulse_series) return;
        pulse_series.setData(indicator_visibility.pulse ? toLineData(pulse_data) : []);
    }, [pulse_data, indicator_visibility.pulse]);

    // ── Graviton×Pulse crossover markers (reference: _fireGravitonPulseSignal, line 12730) ──
    React.useEffect(() => {
        const pulse_series = pulse_series_ref.current;
        if (!pulse_series) return;
        pulse_series.setMarkers(toMarkers(chart_markers));
    }, [chart_markers]);

    return <div ref={container_ref} className='signal-engine-chart' />;
});

export default SignalEngineChart;
