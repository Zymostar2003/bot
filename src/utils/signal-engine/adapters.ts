import { TFullHistoryTick, TTick } from './types';

// Faithful port of the tick -> fullHistory transform used in the reference's WebSocket
// message handlers (reference/index-335-black-bars.html, lines 6596-6598 / 6610-6614):
//   digit = parseInt(price.toFixed(pipSize).slice(-1))
//   diff  = price - previousPrice (0 for the very first tick)
//
// Structural change: the reference derives pipSize per-message from `d.pip_size`; dbot
// sources it from api_base.pip_sizes[symbol] instead (see SignalEngineStore.pip_size).
export function toFullHistoryTicks(ticks: TTick[], pipSize: number): TFullHistoryTick[] {
    const out: TFullHistoryTick[] = [];
    for (let i = 0; i < ticks.length; i++) {
        const price = ticks[i].quote;
        const prev = i > 0 ? out[i - 1].price : price;
        out.push({
            price,
            digit: parseInt(price.toFixed(pipSize).slice(-1), 10),
            diff: price - prev,
            time: ticks[i].epoch,
        });
    }
    return out;
}
