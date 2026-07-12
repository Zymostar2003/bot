// Faithful port of heatColor/barColor (reference: index-335-black-bars.html, lines 13454-13467)
// — the two reference functions are identical, so this is the single shared version.
export const heatColor = (pct: number): string => {
    if (pct >= 11) return '#10b981';
    if (pct >= 10) return '#34d399';
    if (pct >= 9) return '#64748b';
    return '#475569';
};
