import { ActiveSymbols } from '@deriv/api-types';
import { TSaCategory } from './types';

// Faithful port of saRenderList's category filter (reference: index-335-black-bars.html,
// lines 11100-11109). Structural change: the reference matches against its own hard-coded
// SA_SYMBOLS list's display_name/symbol strings since that list never carries a real
// `submarket` field. dbot's api_base.active_symbols does carry a real submarket code per
// synthetic index (random_index / crash_index / step_index / jump_index), so that's checked
// first; the reference's display-name/symbol-code string matching is kept as a fallback for
// any symbol whose submarket doesn't match one of those four codes.
export function filterSymbolsByCategory(symbols: ActiveSymbols, category: TSaCategory): ActiveSymbols {
    return symbols.filter(s => matchesCategory(s, category));
}

function matchesCategory(symbol: ActiveSymbols[number], category: TSaCategory): boolean {
    const submarket = symbol.submarket?.toLowerCase() ?? '';
    const display = symbol.display_name?.toUpperCase() ?? '';
    const code = symbol.symbol?.toUpperCase() ?? '';
    switch (category) {
        case 'volatility':
            return submarket === 'random_index' || code.startsWith('R_') || code.startsWith('1HZ');
        case 'crash_boom':
            return submarket === 'crash_index' || display.includes('CRASH') || display.includes('BOOM');
        case 'step':
            return submarket === 'step_index' || display.includes('STEP');
        case 'jump':
            return submarket === 'jump_index' || display.includes('JUMP');
        default:
            return false;
    }
}

// Faithful port of saRenderList's contract-nav visibility gate (reference:
// index-335-black-bars.html, line 11161: "cat === 'volatility' || cat === 'jump'"). Note this
// hides the nav for BOTH crash_boom and step, not step alone — verified directly against the
// reference rather than the prior line-number-based research summary.
export function shouldShowContractNav(category: TSaCategory): boolean {
    return category === 'volatility' || category === 'jump';
}
