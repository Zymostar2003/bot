import React from 'react';
import { observer } from 'mobx-react-lite';
import Dialog from '@/components/shared_ui/dialog';
import Text from '@/components/shared_ui/text';
import { localize } from '@deriv-com/translations';
import { useScannerStore } from '../use-scanner-store';

// Faithful port of _scShowRiskDisclaimer (reference/index-335-black-bars.html, lines
// 23063-23113) — shown before activating any scanned signal, reusing dbot's existing
// Dialog primitive (src/components/shared_ui/dialog/dialog.tsx) rather than building a new
// modal from scratch, per task instructions.
const ScannerApplyDialog = observer(() => {
    const scanner_store = useScannerStore();
    const { is_confirm_open, pending_result, cancelApply, confirmApply } = scanner_store;

    return (
        <Dialog
            title={localize('Risk Check — Before You Activate')}
            is_visible={is_confirm_open}
            confirm_button_text={localize("I've rechecked — Proceed")}
            cancel_button_text={localize('Cancel')}
            onConfirm={confirmApply}
            onCancel={cancelApply}
            is_mobile_full_width={false}
            // Dialog's TDialog type marks `login` required even though it's only used for
            // the cancel button's special-cased "Log in" label (dialog.tsx's handleCancel) —
            // every other Dialog consumer in the codebase (delete-dialog.tsx,
            // route-prompt-dialog.tsx, etc.) has the same pre-existing gap; this is a no-op
            // stub, not a real login flow, since Scanner's cancel button never reads "Log in".
            login={() => {}}
        >
            <div className='scanner-apply-dialog'>
                <Text as='p' size='xs' color='prominent'>
                    {localize(
                        'Scanner signals are based on past tick patterns and can change in an instant. Before you continue, please:'
                    )}
                </Text>
                <ul className='scanner-apply-dialog__checklist'>
                    <li>{localize('Re-check the live analysis — confirm the pattern still holds')}</li>
                    <li>{localize("Verify the market hasn't reversed since the scan")}</li>
                    <li>{localize('Only risk what you can afford to lose')}</li>
                </ul>
                <Text as='p' size='xxs' color='less-prominent'>
                    {localize('No signal is a guarantee. You are responsible for every trade you place.')}
                </Text>
                {pending_result && (
                    <Text as='p' size='xs' weight='bold'>
                        {pending_result.assetLabel} — {pending_result.ctLabel} {pending_result.dir}
                    </Text>
                )}
            </div>
        </Dialog>
    );
});

export default ScannerApplyDialog;
