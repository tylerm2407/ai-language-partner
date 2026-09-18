/**
 * "Have an invite code?" — the one field a new learner uses to credit the
 * friend who invited them. Shared by Profile › Invite friends and the sheet on
 * the paywall, because the code has to be entered BEFORE the first purchase
 * (a purchase with no code attached credits nobody) and the paywall is where
 * a new learner is at that moment.
 *
 * The server decides whether the code is accepted (migration 148
 * `redeem_referral_code`); this only pre-checks the shape so an obvious typo
 * does not cost a round trip.
 */
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Ui2Input } from '../ui2/Ui2Input';
import { SlabButton } from '../ui2/SlabButton';
import { Body, Caption } from '../ui2/Ui2Text';
import { redeemReferralCode } from '../../lib/supabase-queries';
import { saveErrorCopy } from '../../lib/error-copy';
import { trackEvent } from '../../lib/analytics';
import { haptic } from '../../lib/haptics';
import { isWellFormedReferralCode, redeemErrorMessage } from '../../lib/referrals';
import { spacing } from '../../config/theme';

interface InviteCodeFormProps {
  initialCode?: string;
  onRedeemed: () => void;
}

export function InviteCodeForm({ initialCode = '', onRedeemed }: InviteCodeFormProps) {
  const [entry, setEntry] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    if (!isWellFormedReferralCode(entry)) {
      setError('Invite codes are 8 letters and numbers, like ABCD-2345.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await redeemReferralCode(entry);
      trackEvent('referral_code_redeemed', result.ok ? { ok: true } : { ok: false, code: result.error });
      if (result.ok) {
        haptic('complete');
        onRedeemed();
      } else {
        setError(redeemErrorMessage(result.error));
      }
    } catch (err) {
      setError(saveErrorCopy(err, 'the invite code').message);
    } finally {
      setBusy(false);
    }
  }, [entry, onRedeemed]);

  return (
    <View>
      <Body weight="semibold">Have an invite code?</Body>
      <Caption style={{ marginTop: spacing.xs }}>
        Enter it before you subscribe so your friend gets their reward.
      </Caption>
      <Ui2Input
        value={entry}
        onChangeText={(text) => {
          setEntry(text);
          setError(null);
        }}
        placeholder="ABCD-2345"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={12}
        error={error ?? undefined}
        accessibilityLabel="Friend's invite code"
        containerStyle={{ marginTop: spacing.sm }}
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
      />
      <SlabButton
        label="Apply code"
        arrow={false}
        loading={busy}
        disabled={busy || entry.trim().length === 0}
        onPress={() => void submit()}
        style={{ marginTop: spacing.sm }}
      />
    </View>
  );
}
