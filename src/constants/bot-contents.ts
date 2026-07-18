type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0,
    BOT_BUILDER: 1,
    DELTAPRIME_BOTS: 2,
    CHART: 3,
    TUTORIAL: 4,
    TRADINGVIEW: 5,
    SIGNAL_ENGINE: 6,
    SMART_ANALYSIS: 7,
    SCANNER: 8,
    TRADE_SETUP: 9,
    DIGIT_PSYCHOLOGY: 10,
    TOOLS: 11,
    AGENT: 12,
    COPY_TRADING: 13,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-deltaprime-bots',
    'id-charts',
    'id-tutorials',
    'id-tradingview',
    'id-signal-engine',
    'id-smart-analysis',
    'id-scanner',
    'id-trade-setup',
    'id-digit-psychology',
    'id-tools',
    'id-agent',
    'id-copy-trading',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
