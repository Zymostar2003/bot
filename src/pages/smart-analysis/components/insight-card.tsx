import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { TInsightTip } from '@/utils/smart-analysis/types';
import { Localize } from '@deriv-com/translations';

// Faithful port of #sa-insight-card / saUpdateInsight's tip copy (reference:
// index-335-black-bars.html, lines 4710-4730 markup, 11494-11517 logic). The numeric/
// categorical facts each tip needs come from buildInsightTips (utils/smart-analysis/insight.ts)
// — this component owns only the copy and Localize wiring.
const renderTip = (tip: TInsightTip, key: number) => {
    switch (tip.type) {
        case 'streak':
            return (
                <li key={key}>
                    {'🔥 '}
                    <Localize
                        i18n_default_text='<0>{{direction}}</0> has run {{len}} times in a row — {{note}}'
                        values={{
                            direction: tip.direction,
                            len: tip.len,
                            note: tip.len >= 5 ? 'expect a reversal soon' : 'momentum building',
                        }}
                        components={[<strong key={0} />]}
                    />
                </li>
            );
        case 'rise_dominance':
            return (
                <li key={key}>
                    {tip.direction === 'up' ? (
                        <Localize
                            i18n_default_text='📈 <0>{{pct}}%</0> of last 50 ticks went UP — buyers are in control'
                            values={{ pct: tip.pct }}
                            components={[<strong key={0} />]}
                        />
                    ) : (
                        <Localize
                            i18n_default_text='📉 Only <0>{{pct}}%</0> of last 50 ticks went UP — sellers are in control'
                            values={{ pct: tip.pct }}
                            components={[<strong key={0} />]}
                        />
                    )}
                </li>
            );
        case 'hot_cold':
            return (
                <li key={key}>
                    <Localize
                        i18n_default_text='🌡️ Hottest digit: <0>{{hot_digit}}</0> ({{hot_pct}}%)  |  Coldest: <1>{{cold_digit}}</1> ({{cold_pct}}%)'
                        values={{
                            hot_digit: tip.hot_digit,
                            hot_pct: tip.hot_pct.toFixed(1),
                            cold_digit: tip.cold_digit,
                            cold_pct: tip.cold_pct.toFixed(1),
                        }}
                        components={[<strong key={0} />, <strong key={1} />]}
                    />
                </li>
            );
        case 'even_odd_lead':
            return (
                <li key={key}>
                    {'🔢 '}
                    <Localize
                        i18n_default_text='{{leader}} side leads by <0>{{gap}}%</0> — {{leader}} signal active'
                        values={{ leader: tip.leader, gap: tip.gap.toFixed(1) }}
                        components={[<strong key={0} />]}
                    />
                </li>
            );
        case 'even_odd_streak':
            return (
                <li key={key}>
                    {'⚡ '}
                    <Localize
                        i18n_default_text='Last <0>{{len}}</0> digits were all <1>{{parity}}</1> — consider entering {{parity}} now'
                        values={{ len: tip.len, parity: tip.parity }}
                        components={[<strong key={0} />, <strong key={1} />]}
                    />
                </li>
            );
        case 'over_under':
            return (
                <li key={key}>
                    {'🔼 '}
                    <Localize
                        i18n_default_text='Over (5–9): <0>{{over_pct}}%</0>  |  Under (0–4): <1>{{under_pct}}%</1> → <2>{{leader}}</2>'
                        values={{
                            over_pct: tip.over_pct.toFixed(1),
                            under_pct: tip.under_pct.toFixed(1),
                            leader: tip.leader,
                        }}
                        components={[
                            <strong key={0} />,
                            <strong key={1} />,
                            <strong
                                key={2}
                                className={
                                    tip.leader === 'OVER'
                                        ? 'smart-analysis-insight__over'
                                        : 'smart-analysis-insight__under'
                                }
                            />,
                        ]}
                    />
                </li>
            );
        default:
            return null;
    }
};

const InsightCard = observer(() => {
    const { smart_analysis } = useStore();
    const { insight_tips } = smart_analysis;

    return (
        <div className='smart-analysis-insight'>
            <div className='smart-analysis-insight__title'>
                {'🧠 '}
                <Localize i18n_default_text='Smart Insight' />
            </div>
            {insight_tips ? (
                <ul className='smart-analysis-insight__list'>{insight_tips.map((tip, idx) => renderTip(tip, idx))}</ul>
            ) : (
                <div className='smart-analysis-insight__waiting'>
                    <Localize i18n_default_text='Waiting for data...' />
                </div>
            )}
        </div>
    );
});

export default InsightCard;
