import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import CopyTradingConfirmDialog from './components/copy-trading-confirm-dialog';
import './copy-trading.scss';

const maskToken = (token: string): string => (token.length <= 8 ? token : `${token.slice(0, 4)}••••${token.slice(-4)}`);

const formatSince = (ms: number): string => new Date(ms).toLocaleDateString();

// A Leader panel (share your own trading via allow_copiers) and a Copier panel (follow
// another trader's token via copy_start/copy_stop), built on Deriv's real copy trading API —
// new capability, no reference equivalent. A regular dashboard tab like every other icon,
// following the same layout conventions (Agent, Digit Psychology) rather than a bespoke
// design. Pure API/state logic lives in copy-trading-store.ts; this component only renders it.
const CopyTrading = observer(() => {
    const { copy_trading } = useStore();
    const {
        own_token,
        allow_copiers,
        is_loading_settings,
        is_saving_allow_copiers,
        copiers,
        is_real_account,
        trader_token,
        traders,
        is_loading_list,
        stats,
        stats_error,
        is_loading_stats,
        is_starting,
        is_stopping_token,
        since_map,
        init,
        setAllowCopiers,
        setTraderToken,
        previewStats,
        requestStartCopy,
        stopCopy,
    } = copy_trading;

    React.useEffect(() => {
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [copied, setCopied] = React.useState(false);
    const copyOwnToken = () => {
        if (!own_token) return;
        navigator.clipboard?.writeText(own_token);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className='copy-trading'>
            <div className='copy-trading__header'>
                <span className='copy-trading__title'>
                    <Localize i18n_default_text='🤝 Copy Trading' />
                </span>
                <button
                    type='button'
                    className='copy-trading__refresh'
                    disabled={is_loading_settings || is_loading_list}
                    onClick={init}
                >
                    <Localize i18n_default_text='Refresh' />
                </button>
            </div>

            <div className='copy-trading__body'>
                <div className='copy-trading-card'>
                    <div className='copy-trading-card__title'>
                        <Localize i18n_default_text='Leader — Share Your Trades' />
                    </div>

                    <div className='copy-trading-card__row'>
                        <span className='copy-trading-card__label'>
                            <Localize i18n_default_text='Your Trading Token' />
                        </span>
                        <div className='copy-trading-card__token-row'>
                            <input
                                className='copy-trading-card__input'
                                type='text'
                                readOnly
                                value={own_token ?? ''}
                                placeholder={localize('Not available')}
                            />
                            <button
                                type='button'
                                className='copy-trading-card__btn'
                                disabled={!own_token}
                                onClick={copyOwnToken}
                            >
                                {copied ? (
                                    <Localize i18n_default_text='Copied!' />
                                ) : (
                                    <Localize i18n_default_text='Copy' />
                                )}
                            </button>
                        </div>
                        <span className='copy-trading-card__hint'>
                            <Localize i18n_default_text='Share this token with people you want to let copy your trades. Never share it publicly.' />
                        </span>
                    </div>

                    <div className='copy-trading-card__row copy-trading-card__row--between'>
                        <span className='copy-trading-card__label'>
                            <Localize i18n_default_text='Allow Copiers' />
                        </span>
                        <button
                            type='button'
                            className={`copy-trading-card__toggle ${allow_copiers ? 'copy-trading-card__toggle--on' : ''}`}
                            disabled={!is_real_account || is_saving_allow_copiers || is_loading_settings}
                            onClick={() => setAllowCopiers(!allow_copiers)}
                        >
                            {allow_copiers ? <Localize i18n_default_text='On' /> : <Localize i18n_default_text='Off' />}
                        </button>
                    </div>
                    {!is_real_account && (
                        <span className='copy-trading-card__hint'>
                            <Localize i18n_default_text='Only available for real money accounts — switch to a real account to allow copiers.' />
                        </span>
                    )}

                    <div className='copy-trading-card__row'>
                        <span className='copy-trading-card__label'>
                            <Localize
                                i18n_default_text='Copiers Following You ({{count}})'
                                values={{ count: copiers.length }}
                            />
                        </span>
                        {copiers.length === 0 ? (
                            <span className='copy-trading-card__empty'>
                                <Localize i18n_default_text='No one is copying you yet.' />
                            </span>
                        ) : (
                            <div className='copy-trading-card__list'>
                                {copiers.map(c => (
                                    <div key={c.loginid} className='copy-trading-card__list-row'>
                                        <span>{c.loginid}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className='copy-trading-card'>
                    <div className='copy-trading-card__title'>
                        <Localize i18n_default_text='Copier — Follow a Trader' />
                    </div>

                    <div className='copy-trading-card__row'>
                        <span className='copy-trading-card__label'>
                            <Localize i18n_default_text="Trader's Token" />
                        </span>
                        <div className='copy-trading-card__token-row'>
                            <input
                                className='copy-trading-card__input'
                                type='text'
                                value={trader_token}
                                placeholder={localize('Paste a trader token')}
                                onChange={e => setTraderToken(e.target.value)}
                            />
                            <button
                                type='button'
                                className='copy-trading-card__btn'
                                disabled={!trader_token.trim() || is_loading_stats}
                                onClick={previewStats}
                            >
                                {is_loading_stats ? (
                                    <Localize i18n_default_text='Loading…' />
                                ) : (
                                    <Localize i18n_default_text='Preview Stats' />
                                )}
                            </button>
                        </div>
                        <span className='copy-trading-card__hint'>
                            <Localize i18n_default_text="Stats preview depends on the trader's ID being accepted by the API — it may not work for every pasted token." />
                        </span>
                    </div>

                    {stats_error && <div className='copy-trading-card__error'>{stats_error}</div>}

                    {stats && (
                        <div className='copy-trading-stats'>
                            <div className='copy-trading-stats__item'>
                                <span className='copy-trading-stats__label'>
                                    <Localize i18n_default_text='Win Rate' />
                                </span>
                                <span className='copy-trading-stats__value'>
                                    {stats.total_trades
                                        ? `${((stats.trades_profitable / stats.total_trades) * 100).toFixed(1)}%`
                                        : '—'}
                                </span>
                            </div>
                            <div className='copy-trading-stats__item'>
                                <span className='copy-trading-stats__label'>
                                    <Localize i18n_default_text='Total Trades' />
                                </span>
                                <span className='copy-trading-stats__value'>{stats.total_trades ?? '—'}</span>
                            </div>
                            <div className='copy-trading-stats__item'>
                                <span className='copy-trading-stats__label'>
                                    <Localize i18n_default_text='Avg Profit' />
                                </span>
                                <span className='copy-trading-stats__value'>
                                    {stats.avg_profit != null ? `${stats.avg_profit.toFixed(2)}%` : '—'}
                                </span>
                            </div>
                            <div className='copy-trading-stats__item'>
                                <span className='copy-trading-stats__label'>
                                    <Localize i18n_default_text='Avg Loss' />
                                </span>
                                <span className='copy-trading-stats__value'>
                                    {stats.avg_loss != null ? `${stats.avg_loss.toFixed(2)}%` : '—'}
                                </span>
                            </div>
                            <div className='copy-trading-stats__item'>
                                <span className='copy-trading-stats__label'>
                                    <Localize i18n_default_text='Copiers' />
                                </span>
                                <span className='copy-trading-stats__value'>{stats.copiers ?? '—'}</span>
                            </div>
                            <div className='copy-trading-stats__item'>
                                <span className='copy-trading-stats__label'>
                                    <Localize i18n_default_text='Active Since' />
                                </span>
                                <span className='copy-trading-stats__value'>
                                    {stats.active_since
                                        ? new Date(stats.active_since * 1000).toLocaleDateString()
                                        : '—'}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className='copy-trading-card__row'>
                        <button
                            type='button'
                            className='copy-trading-card__start-btn'
                            disabled={!trader_token.trim() || is_starting}
                            onClick={requestStartCopy}
                        >
                            {is_starting ? (
                                <Localize i18n_default_text='Starting…' />
                            ) : (
                                <Localize i18n_default_text='Start Copying' />
                            )}
                        </button>
                    </div>

                    <div className='copy-trading-card__row'>
                        <span className='copy-trading-card__label'>
                            <Localize
                                i18n_default_text='Currently Copying ({{count}})'
                                values={{ count: traders.length }}
                            />
                        </span>
                        {traders.length === 0 ? (
                            <span className='copy-trading-card__empty'>
                                <Localize i18n_default_text="You're not copying anyone yet." />
                            </span>
                        ) : (
                            <div className='copy-trading-card__list'>
                                {traders.map(t => (
                                    <div key={t.token ?? t.loginid} className='copy-trading-card__list-row'>
                                        <div className='copy-trading-card__list-main'>
                                            <span className='copy-trading-card__list-token'>
                                                {t.token ? maskToken(t.token) : (t.loginid ?? '—')}
                                            </span>
                                            <span className='copy-trading-card__list-since'>
                                                {t.token && since_map[t.token] ? (
                                                    <Localize
                                                        i18n_default_text='Since {{date}}'
                                                        values={{ date: formatSince(since_map[t.token]) }}
                                                    />
                                                ) : (
                                                    <Localize i18n_default_text='Since — unknown' />
                                                )}
                                            </span>
                                        </div>
                                        <button
                                            type='button'
                                            className='copy-trading-card__stop-btn'
                                            disabled={!t.token || is_stopping_token === t.token}
                                            onClick={() => t.token && stopCopy(t.token)}
                                        >
                                            {is_stopping_token === t.token ? (
                                                <Localize i18n_default_text='Stopping…' />
                                            ) : (
                                                <Localize i18n_default_text='Stop' />
                                            )}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <CopyTradingConfirmDialog />
        </div>
    );
});

export default CopyTrading;
