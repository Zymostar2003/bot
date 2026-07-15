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
    CHART: 2,
    TUTORIAL: 3,
    TRADINGVIEW: 4,
    SIGNAL_ENGINE: 5,
    SMART_ANALYSIS: 6,
    SCANNER: 7,
    TRADE_SETUP: 8,
    DIGIT_PSYCHOLOGY: 9,
    TOOLS: 10,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-charts',
    'id-tutorials',
    'id-tradingview',
    'id-signal-engine',
    'id-smart-analysis',
    'id-scanner',
    'id-trade-setup',
    'id-digit-psychology',
    'id-tools',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
