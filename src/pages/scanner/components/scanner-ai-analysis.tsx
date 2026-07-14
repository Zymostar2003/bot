import React from 'react';
import { buildAiAnalysis } from '@/utils/scanner/ai-analysis';
import { TScanResult } from '@/utils/scanner/types';
import { Localize } from '@deriv-com/translations';

type TScannerAiAnalysisProps = {
    result: TScanResult;
};

// Faithful port of _scAIAnalyse's rendered card (reference: index-335-black-bars.html,
// lines 17993-18013) — always shown for the top result, not gated behind any button, same
// as the reference's own automatic call from _renderScoutResults (line 18277).
const ScannerAiAnalysis = ({ result }: TScannerAiAnalysisProps) => {
    const { decision, watch, entryTrigger, reversalWarning } = buildAiAnalysis(result);
    const decision_icon = result.quality === 'SIGNAL' ? (result.score >= 80 ? '🟢' : '🟡') : '⚠️';

    return (
        <div className='scanner-ai-analysis'>
            <div className='scanner-ai-analysis__title'>
                <Localize i18n_default_text='🤖 Signal Analyst — {{asset}}' values={{ asset: result.assetLabel }} />
            </div>
            <div className='scanner-ai-analysis__line'>
                {decision_icon} {decision}
            </div>
            <div className='scanner-ai-analysis__line'>👁 {watch}</div>
            <div className='scanner-ai-analysis__line'>⚡ {entryTrigger}</div>
            <div className='scanner-ai-analysis__warning'>⚠️ {reversalWarning}</div>
        </div>
    );
};

export default ScannerAiAnalysis;
