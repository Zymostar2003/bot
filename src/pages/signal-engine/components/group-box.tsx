import React from 'react';
import classNames from 'classnames';
import { TIndicatorBias } from '@/utils/signal-engine/types';
import { Localize } from '@deriv-com/translations';
import BiasBadge from './bias-badge';

type TDirection = 'rise' | 'fall';

type TGroupBoxProps = {
    direction: TDirection;
    count: number;
    ready: boolean;
    timeframe_label: string;
    bias?: TIndicatorBias;
};

const REQUIRED = 3;

// Faithful port of renderRF's rise/fall group markup (reference:
// reference/index-335-black-bars.html, lines 7144-7203) — the two candle-count boxes with
// dots, ready-state border/background, and the "enter now" / "need N more" signal box
// beneath each. The VFPI bias badge is only ever attached to the rise group in the
// reference, so `bias` is optional here and the fall group is rendered without it.
const GroupBox = ({ direction, count, ready, timeframe_label, bias }: TGroupBoxProps) => {
    const is_rise = direction === 'rise';
    const active = count > 0;
    const remaining = Math.max(0, REQUIRED - count);

    return (
        <div
            className={classNames('signal-engine-group-box', `signal-engine-group-box--${direction}`, {
                'signal-engine-group-box--ready': ready,
                'signal-engine-group-box--active': !ready && active,
            })}
        >
            <div className='signal-engine-group-box__header'>
                <span className='signal-engine-group-box__label'>
                    {is_rise ? (
                        <Localize i18n_default_text='📈 RISE GROUP' />
                    ) : (
                        <Localize i18n_default_text='📉 FALL GROUP' />
                    )}
                </span>
                {bias && <BiasBadge bias={bias} />}
            </div>
            <div className='signal-engine-group-box__dots'>
                {Array.from({ length: REQUIRED }, (_, idx) => idx).map(idx => (
                    <div
                        key={idx}
                        className={classNames('signal-engine-group-box__dot', {
                            'signal-engine-group-box__dot--filled': idx < count,
                        })}
                    >
                        {idx < count ? (is_rise ? '▲' : '▼') : '○'}
                    </div>
                ))}
            </div>
            <div className='signal-engine-group-box__count'>
                <Localize
                    i18n_default_text='{{count}}/3 {{dir}} candles (this {{tf}} chart)'
                    values={{ count, dir: is_rise ? 'rising' : 'falling', tf: timeframe_label }}
                />
            </div>
            <div
                className={classNames('signal-engine-signal-box', {
                    'signal-engine-signal-box--ready': ready,
                })}
            >
                {ready ? (
                    <>
                        <div className='signal-engine-signal-box__title'>
                            {'✅ '}
                            <Localize
                                i18n_default_text='ENTER {{direction}} NOW'
                                values={{ direction: is_rise ? 'RISE' : 'FALL' }}
                            />
                        </div>
                        <div className='signal-engine-signal-box__desc'>
                            <Localize
                                i18n_default_text='{{count}} {{dir}} candles confirmed. Next candle opens — enter {{direction}}.'
                                values={{
                                    count,
                                    dir: is_rise ? 'rising' : 'falling',
                                    direction: is_rise ? 'RISE' : 'FALL',
                                }}
                            />
                        </div>
                    </>
                ) : (
                    <div className='signal-engine-signal-box__desc'>
                        {'⏳ '}
                        <Localize
                            i18n_default_text='Need {{remaining}} more {{dir}} candle{{plural}} + VFPI confirm'
                            values={{
                                remaining,
                                dir: is_rise ? 'rising' : 'falling',
                                plural: remaining === 1 ? '' : 's',
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default GroupBox;
