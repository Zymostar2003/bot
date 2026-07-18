import React from 'react';
import classNames from 'classnames';
import SelectNative from '@/components/shared_ui/select-native';
import { api_base } from '@/external/bot-skeleton';
import TicksService from '@/external/bot-skeleton/services/api/ticks_service';
import { analyzeDigits, TAgentAnalysis } from '@/utils/agent/analysis';
import { bestOpportunity, TAgentOpportunity } from '@/utils/agent/multi-scan';
import { SCAN_ASSETS } from '@/utils/scanner/constants';
import { toFullHistoryTicks } from '@/utils/signal-engine/adapters';
import { TTick } from '@/utils/signal-engine/types';
import { Localize, localize } from '@deriv-com/translations';
import './agent.scss';

const ASSET_OPTIONS = SCAN_ASSETS.map(a => ({ text: a.l, value: a.v }));
const ASSET_LABELS: Record<string, string> = Object.fromEntries(SCAN_ASSETS.map(a => [a.v, a.l]));

const RISK_LABEL: Record<TAgentAnalysis['risk'], string> = {
    Low: '🟢 Low',
    Medium: '🟡 Medium',
    High: '🔴 High',
};

const ACTION_LABEL: Record<TAgentAnalysis['action'], string> = {
    MATCH: 'MATCH',
    OVER: 'OVER',
    UNDER: 'UNDER',
    WAIT: 'WAIT',
};

// EVEN/ODD carry no digit; OVER/UNDER's digit is the barrier, MATCH/DIFFER's is the target
// digit — see multi-scan.ts's bestOpportunity.
const opportunityLabel = (opp: TAgentOpportunity): string =>
    opp.digit === null ? opp.family : `${opp.family} ${opp.digit}`;

// A quick-glance digit-distribution decision matrix — new capability, no reference
// equivalent. A regular dashboard tab like every other icon (not a floating widget/modal),
// using the app's own design tokens instead of a bespoke theme. Pure calculation logic lives
// in utils/agent/analysis.ts; this component only fetches the tick history (a one-shot
// TicksService.request(), same primitive Scanner uses for its own per-asset scan) and renders
// the result.
const Agent = () => {
    const [asset, setAsset] = React.useState(SCAN_ASSETS[0].v);
    const [analysis, setAnalysis] = React.useState<TAgentAnalysis | null>(null);
    const [is_loading, setIsLoading] = React.useState(false);
    const [last_updated, setLastUpdated] = React.useState<Date | null>(null);
    const [send_results, setSendResults] = React.useState<TAgentOpportunity[]>([]);
    const [is_sending, setIsSending] = React.useState(false);
    const [send_updated, setSendUpdated] = React.useState<Date | null>(null);
    const ticks_service_ref = React.useRef<TicksService | null>(null);
    const send_token_ref = React.useRef(0);

    const runAnalysis = React.useCallback(async (symbol: string) => {
        setIsLoading(true);
        if (!ticks_service_ref.current) {
            ticks_service_ref.current = new TicksService();
        }
        const ticks = await ticks_service_ref.current.request({ symbol, granularity: undefined });
        const pip_size = (api_base.pip_sizes as Record<string, number>)?.[symbol] ?? 2;
        const hist = toFullHistoryTicks(ticks, pip_size);
        setAnalysis(analyzeDigits(hist));
        setLastUpdated(new Date());
        setIsLoading(false);
    }, []);

    React.useEffect(() => {
        runAnalysis(asset);
    }, [asset, runAnalysis]);

    // "Send Agent" — scans every asset in the selector, evaluating Even/Odd, Over/Under (best
    // barrier), and Match/Differ (best digit) for each (see multi-scan.ts), then ranks every
    // asset's best finding by confidence. Same parallel-fetch-with-a-superseded-token shape as
    // ScannerStore.scan() (scan_token there), so a second Send Agent click (or navigating away
    // mid-scan) makes the first run's still-in-flight results a no-op instead of racing.
    const sendAgent = React.useCallback(async () => {
        const token = ++send_token_ref.current;
        setIsSending(true);
        if (!ticks_service_ref.current) {
            ticks_service_ref.current = new TicksService();
        }
        const ticks_service = ticks_service_ref.current;

        const settled = await Promise.allSettled(
            SCAN_ASSETS.map(a => ticks_service.request({ symbol: a.v, granularity: undefined }))
        );
        if (token !== send_token_ref.current) return; // superseded by a newer Send Agent click

        const results: TAgentOpportunity[] = [];
        settled.forEach((outcome, i) => {
            if (outcome.status !== 'fulfilled') return;
            const scan_asset = SCAN_ASSETS[i];
            const pip_size = (api_base.pip_sizes as Record<string, number>)?.[scan_asset.v] ?? 2;
            const hist = toFullHistoryTicks(outcome.value as TTick[], pip_size);
            if (hist.length < 100) return;
            results.push(bestOpportunity(scan_asset.v, scan_asset.l, hist));
        });
        results.sort((a, b) => b.confidence - a.confidence);

        setSendResults(results);
        setSendUpdated(new Date());
        setIsSending(false);
    }, []);

    const max_pct = analysis ? Math.max(...analysis.stats.map(s => s.pct), 1) : 1;

    return (
        <div className='agent'>
            <div className='agent__header'>
                <span className='agent__title'>
                    <Localize i18n_default_text='🤖 Agent' />
                </span>
                <SelectNative
                    className='agent__asset-select'
                    list_items={ASSET_OPTIONS}
                    value={asset}
                    should_show_empty_option={false}
                    placeholder={localize('Asset')}
                    onChange={e => setAsset(e.target.value)}
                />
                <button
                    type='button'
                    className='agent__refresh'
                    disabled={is_loading}
                    onClick={() => runAnalysis(asset)}
                >
                    <Localize i18n_default_text='Refresh Data' />
                </button>
                <button type='button' className='agent__send' disabled={is_sending} onClick={sendAgent}>
                    {is_sending ? (
                        <Localize i18n_default_text='Scanning…' />
                    ) : (
                        <Localize i18n_default_text='📡 Send Agent' />
                    )}
                </button>
            </div>

            <div className='agent__body'>
                {!!send_results.length && (
                    <div className='agent-send-results'>
                        <div className='agent-send-results__header'>
                            <span className='agent-send-results__title'>
                                <Localize
                                    i18n_default_text='Send Agent — {{count}} assets scanned'
                                    values={{ count: send_results.length }}
                                />
                            </span>
                            {send_updated && (
                                <span className='agent-send-results__updated'>
                                    <Localize
                                        i18n_default_text='Last Updated: {{time}}'
                                        values={{ time: send_updated.toLocaleTimeString() }}
                                    />
                                </span>
                            )}
                        </div>
                        <div className='agent-send-results__list'>
                            {send_results.map(opp => (
                                <button
                                    key={opp.asset}
                                    type='button'
                                    className='agent-send-results__row'
                                    onClick={() => setAsset(opp.asset)}
                                >
                                    <span className='agent-send-results__asset'>
                                        {ASSET_LABELS[opp.asset] ?? opp.asset_label}
                                    </span>
                                    <span className='agent-send-results__chip'>{opportunityLabel(opp)}</span>
                                    <span className='agent-send-results__confidence'>{opp.confidence}%</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {!analysis ? (
                    <div className='agent__loading'>
                        <Localize i18n_default_text='Gathering the last 1000 ticks…' />
                    </div>
                ) : (
                    <>
                        <div className='agent-bar-chart'>
                            {analysis.stats.map(({ digit, pct }) => (
                                <div key={digit} className='agent-bar-chart__col'>
                                    <div className='agent-bar-chart__track'>
                                        <div
                                            className='agent-bar-chart__fill'
                                            style={{ height: `${Math.max(4, (pct / max_pct) * 100)}%` }}
                                        />
                                    </div>
                                    <span className='agent-bar-chart__digit'>{digit}</span>
                                    <span className='agent-bar-chart__pct'>{pct.toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>

                        <div className='agent__stats-row'>
                            <div className='agent__stat'>
                                <span className='agent__stat-label'>
                                    <Localize i18n_default_text='Range' />
                                </span>
                                <span className='agent__stat-value'>{analysis.range.toFixed(1)}%</span>
                            </div>
                            <div className='agent__stat'>
                                <span className='agent__stat-label'>
                                    <Localize i18n_default_text='Confidence' />
                                </span>
                                <span className='agent__stat-value'>{analysis.confidence}%</span>
                            </div>
                            <div className='agent__stat'>
                                <span className='agent__stat-label'>
                                    <Localize i18n_default_text='Risk' />
                                </span>
                                <span className='agent__stat-value'>{RISK_LABEL[analysis.risk]}</span>
                            </div>
                            <div className='agent__stat'>
                                <span className='agent__stat-label'>
                                    <Localize i18n_default_text='Streak' />
                                </span>
                                <span className='agent__stat-value'>{analysis.streak}</span>
                            </div>
                        </div>

                        <div
                            className={classNames('agent-action-box', {
                                'agent-action-box--wait': analysis.action === 'WAIT',
                                'agent-action-box--go': analysis.action !== 'WAIT',
                            })}
                        >
                            {analysis.action === 'WAIT' ? (
                                <Localize i18n_default_text='⚠️ WAIT — Distribution too balanced. No trade.' />
                            ) : (
                                <Localize
                                    i18n_default_text='BEST TRADE: {{action}} on digit {{digit}}'
                                    values={{ action: ACTION_LABEL[analysis.action], digit: analysis.target_digit }}
                                />
                            )}
                        </div>

                        {analysis.action === 'MATCH' && (
                            <div className='agent__context'>
                                <Localize
                                    i18n_default_text='Lowest 3 digits: {{list}}'
                                    values={{
                                        list: analysis.lowest_three
                                            .map(s => `${s.digit} (${s.pct.toFixed(1)}%)`)
                                            .join(', '),
                                    }}
                                />
                            </div>
                        )}
                        {(analysis.action === 'OVER' || analysis.action === 'UNDER') && (
                            <div className='agent__context'>
                                <Localize
                                    i18n_default_text='Lows (0-4): {{lows}}% · Highs (5-9): {{highs}}%'
                                    values={{
                                        lows: analysis.lows_pct.toFixed(1),
                                        highs: analysis.highs_pct.toFixed(1),
                                    }}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className='agent__footer'>
                {last_updated && (
                    <Localize
                        i18n_default_text='Last Updated: {{time}}'
                        values={{ time: last_updated.toLocaleTimeString() }}
                    />
                )}
            </div>
        </div>
    );
};

export default Agent;
