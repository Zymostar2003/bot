import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { Localize } from '@deriv-com/translations';

// Faithful port of #sa-concentration-card (reference: index-335-black-bars.html, lines
// 4658-4708 markup, 11237-11341 logic) — the 10-bar last-100-tick histogram, spread verdict,
// hottest/coldest summary, and the fixed anti-gambler's-fallacy warning whose copy sharpens
// when clustering is high.
//
// Spread color mapping is a direct port of the reference's spreadCol values (line
// 11297-11306): 'even' -> a neutral/blue tone, 'slight' -> warning, 'high' -> success. The
// reference maps "HIGHLY clustered" to its green accent rather than a warning color — kept as
// in the reference (it reads as "this clustering is significant/notable", not "this is good"),
// mapped to the closest dbot token (--status-success) rather than reinterpreting the reference's
// color choice.
const ConcentrationCard = observer(() => {
    const { smart_analysis } = useStore();
    const { concentration } = smart_analysis;

    if (!concentration) return null;

    const max_count = Math.max(...concentration.bars.map(b => b.count), 1);
    const spread_class = `smart-analysis-concentration__spread--${concentration.spread}`;
    const spread_label =
        concentration.spread === 'even' ? (
            <Localize i18n_default_text='EVEN spread' />
        ) : concentration.spread === 'slight' ? (
            <Localize i18n_default_text='SLIGHTLY clustered' />
        ) : (
            <Localize i18n_default_text='HIGHLY clustered' />
        );

    return (
        <div className='smart-analysis-concentration'>
            <div className='smart-analysis-concentration__header'>
                <span className='smart-analysis-concentration__title'>
                    {'📊 '}
                    <Localize i18n_default_text='Tick Concentration (last 100)' />
                </span>
                <span className={classNames('smart-analysis-concentration__spread', spread_class)}>{spread_label}</span>
            </div>

            <div className='smart-analysis-concentration__bars'>
                {concentration.bars.map(bar => (
                    <div key={bar.digit} className='smart-analysis-concentration__bar-col'>
                        <div className='smart-analysis-concentration__bar-track'>
                            <div
                                className={classNames(
                                    'smart-analysis-concentration__bar-fill',
                                    `smart-analysis-concentration__bar-fill--${bar.status}`
                                )}
                                style={{ height: `${Math.max(8, (bar.count / max_count) * 100)}%` }}
                            />
                        </div>
                        <span className='smart-analysis-concentration__bar-digit'>{bar.digit}</span>
                        <span className='smart-analysis-concentration__bar-pct'>{bar.pct.toFixed(0)}%</span>
                    </div>
                ))}
            </div>

            <div className='smart-analysis-concentration__summary'>
                <Localize
                    i18n_default_text='🔥 Hottest: <0>digit {{hot_digit}}</0> ({{hot_pct}}%)  •  ❄️ Coldest: <1>digit {{cold_digit}}</1> ({{cold_pct}}%)'
                    values={{
                        hot_digit: concentration.hottest_digit,
                        hot_pct: concentration.hottest_pct.toFixed(0),
                        cold_digit: concentration.coldest_digit,
                        cold_pct: concentration.coldest_pct.toFixed(0),
                    }}
                    components={[
                        <strong key={0} className='smart-analysis-concentration__hot' />,
                        <strong key={1} className='smart-analysis-concentration__cold' />,
                    ]}
                />
            </div>

            <div className='smart-analysis-concentration__trap'>
                <div className='smart-analysis-concentration__trap-title'>
                    <Localize i18n_default_text='⚠️ MIND THE TRAP' />
                </div>
                <div className='smart-analysis-concentration__trap-text'>
                    {concentration.spread === 'high' ? (
                        <Localize
                            i18n_default_text='Digit {{digit}} is "missing" right now — but that does NOT make it due. On synthetics each tick is independent; clustering happens naturally in random data and predicts nothing. Don’t bet a cold digit will "catch up."'
                            values={{ digit: concentration.coldest_digit }}
                        />
                    ) : (
                        <Localize i18n_default_text='A "missing" digit is NOT due to appear. Each tick is independent — the market has no memory. Concentration shows what HAS happened, not what WILL.' />
                    )}
                </div>
            </div>
        </div>
    );
});

export default ConcentrationCard;
