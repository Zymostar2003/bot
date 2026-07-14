import { TFullHistoryTick } from '@/utils/signal-engine/types';

// Faithful port of the reference's 4 category dropdown values (index-335-black-bars.html,
// lines 4502-4505: #sa-cat-select options) and saActiveCat/saActiveType globals (lines
// 10868-10869).
export type TSaCategory = 'volatility' | 'crash_boom' | 'step' | 'jump';

export type TSaContractType = 'rise_fall' | 'even_odd' | 'over_under' | 'matches_differs';

export type TSaView = 'digits' | 'worm';

export type TConcentrationStatus = 'hot' | 'cold' | 'neutral';

export type TConcentrationBar = {
    digit: number;
    count: number;
    pct: number;
    status: TConcentrationStatus;
};

export type TConcentrationSpread = 'even' | 'slight' | 'high';

export type TConcentrationResult = {
    bars: TConcentrationBar[];
    chi: number;
    spread: TConcentrationSpread;
    hottest_digit: number;
    hottest_pct: number;
    coldest_digit: number;
    coldest_pct: number;
};

export type TDigitRankTier = 'top' | 'second' | 'bottom' | 'none';

export type TDigitRank = {
    digit: number;
    pct: number;
    tier: TDigitRankTier;
};

export type TLast50NodeVariant = 'win' | 'lose' | 'neutral';

export type TLast50Node = {
    tick: TFullHistoryTick;
    label: string;
    variant: TLast50NodeVariant;
};

export type TLast50Stats = {
    left_label: string;
    left_pct: number;
    right_label: string;
    right_pct: number;
    nodes: TLast50Node[];
};

// Structured insight tips — the numeric/categorical facts a tip line needs, kept separate
// from the actual copy so the copy (and its Localize wiring) can live in insight-card.tsx.
export type TInsightTip =
    | { type: 'streak'; direction: 'RISE' | 'FALL'; len: number }
    | { type: 'rise_dominance'; pct: number; direction: 'up' | 'down' }
    | { type: 'hot_cold'; hot_digit: number; hot_pct: number; cold_digit: number; cold_pct: number }
    | { type: 'even_odd_lead'; leader: 'EVEN' | 'ODD'; gap: number }
    | { type: 'even_odd_streak'; parity: 'EVEN' | 'ODD'; len: number }
    | { type: 'over_under'; over_pct: number; under_pct: number; leader: 'OVER' | 'UNDER' };
