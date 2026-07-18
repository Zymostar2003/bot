import React from 'react';
import { observer } from 'mobx-react-lite';
import Dialog from '@/components/shared_ui/dialog';
import Text from '@/components/shared_ui/text';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';

// Same risk-disclaimer confirm step as Scanner's ScannerApplyDialog — copy_start is a real
// trading-permission action (it lets another account's trades be mirrored on this one), so it
// must never fire directly off a button click without this explicit confirmation.
const CopyTradingConfirmDialog = observer(() => {
    const { copy_trading } = useStore();
    const { is_confirm_open, pending_token, cancelStartCopy, confirmStartCopy } = copy_trading;

    return (
        <Dialog
            title={localize('Risk Check — Before You Copy')}
            is_visible={is_confirm_open}
            confirm_button_text={localize("I've reviewed — Start Copying")}
            cancel_button_text={localize('Cancel')}
            onConfirm={confirmStartCopy}
            onCancel={cancelStartCopy}
            is_mobile_full_width={false}
            login={() => {}}
        >
            <div className='copy-trading-confirm-dialog'>
                <Text as='p' size='xs' color='prominent'>
                    {localize(
                        'Copying a trader mirrors their trades on your account automatically, including losses. Before you continue, please:'
                    )}
                </Text>
                <ul className='copy-trading-confirm-dialog__checklist'>
                    <li>
                        {localize("Confirm you trust this trader's token — only paste tokens shared with you directly")}
                    </li>
                    <li>{localize('Review any stake limits before copying starts')}</li>
                    <li>{localize('Only risk what you can afford to lose')}</li>
                </ul>
                <Text as='p' size='xxs' color='less-prominent'>
                    {localize(
                        'Past performance is not a guarantee of future results. You are responsible for every trade copied to your account.'
                    )}
                </Text>
                {pending_token && (
                    <Text as='p' size='xs' weight='bold'>
                        <Localize i18n_default_text='Trader token: {{token}}' values={{ token: pending_token }} />
                    </Text>
                )}
            </div>
        </Dialog>
    );
});

export default CopyTradingConfirmDialog;
