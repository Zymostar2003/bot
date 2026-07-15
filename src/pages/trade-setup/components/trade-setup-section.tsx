import React from 'react';

type TTradeSetupSectionProps = {
    title: string;
    children: React.ReactNode;
};

// Card chrome for each Trade Setup panel (Asset/Contract Type/Duration/Stake/Digit/
// Advanced) — the reference's own collapsible .tp-section/.tpsec-chev toggle behaviour
// (index-335-black-bars.html, e.g. lines 5061-5130) is deliberately NOT ported: every
// section is always visible here instead, so the whole form's contents are scannable at a
// glance without extra clicks.
const TradeSetupSection = ({ title, children }: TTradeSetupSectionProps) => (
    <div className='trade-setup__section'>
        <div className='trade-setup__section-title'>{title}</div>
        <div className='trade-setup__section-body'>{children}</div>
    </div>
);

export default TradeSetupSection;
