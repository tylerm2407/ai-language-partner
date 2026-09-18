/**
 * Profile › Invite friends.
 *
 * The learner's own invite code with Share and Copy, what their friends'
 * sign-ups have earned so far, and — for a new learner who has not paid yet —
 * a field to enter the code a friend gave them. A code can arrive prefilled
 * through `fluenci://profile/invite?code=ABCD2345`.
 *
 * All the deciding (who qualifies, what they get, when) is server-side
 * (migration 148). This screen shows the result and never computes a reward.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSafeBack } from '../../../hooks/useSafeBack';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { useScreenView } from '../../../hooks/useScreenView';
import { Ui2Header } from '../../../components/ui2/Ui2Header';
import { Ui2InlineError } from '../../../components/ui2/Ui2InlineError';
import { SlabButton } from '../../../components/ui2/SlabButton';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { Body, Caption, Heading } from '../../../components/ui2/Ui2Text';
import { InviteCodeForm } from '../../../components/referrals/InviteCodeForm';
import { getReferralSummary } from '../../../lib/supabase-queries';
import { loadErrorCopy, type ErrorCopy } from '../../../lib/error-copy';
import { trackEvent } from '../../../lib/analytics';
import { haptic } from '../../../lib/haptics';
import {
  REFERRAL_RULES,
  formatReferralCode,
  referralShareMessage,
  rewardLabel,
} from '../../../lib/referrals';
import { spacing } from '../../../config/theme';
import type { ReferralSummary } from '../../../types';

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${value} ${label}`}>
      <Heading level={2}>{String(value)}</Heading>
      <Caption>{label}</Caption>
    </View>
  );
}

export default function InviteFriendsScreen() {
  useScreenView('invite_friends');
  const { c } = useUi2Theme();
  const goBack = useSafeBack('/(app)/profile');
  const params = useLocalSearchParams<{ code?: string }>();

  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loadError, setLoadError] = useState<ErrorCopy | null>(null);
  const [copied, setCopied] = useState(false);

  const [redeemed, setRedeemed] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setSummary(await getReferralSummary());
    } catch (err) {
      setLoadError(loadErrorCopy(err, 'your invite code'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onShare = useCallback(async () => {
    if (!summary) return;
    trackEvent('referral_code_shared', { source: 'share' });
    try {
      await Share.share({ message: referralShareMessage(summary.code) });
    } catch {
      // Dismissing the sheet is not an error; a real failure leaves Copy.
    }
  }, [summary]);

  const onCopy = useCallback(async () => {
    if (!summary) return;
    await Clipboard.setStringAsync(formatReferralCode(summary.code));
    trackEvent('referral_code_shared', { source: 'copy' });
    haptic('complete');
    setCopied(true);
  }, [summary]);

  const onRedeemed = useCallback(() => {
    setRedeemed(true);
    void load();
  }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <Ui2Header title="Invite friends" onBack={() => goBack()} />

      {loadError ? (
        <View style={{ padding: spacing.md }}>
          <Ui2InlineError copy={loadError} onRetry={() => void load()} />
        </View>
      ) : !summary ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} accessibilityLabel="Loading your invite code" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxxl }}
          keyboardShouldPersistTaps="handled"
        >
          <SlabCard tint="primary" style={{ marginBottom: spacing.md }}>
            <Heading level={2}>Get free months</Heading>
            <Body tone="secondary" style={{ marginTop: spacing.xs }}>
              Every friend who subscribes with your code earns you free time.
            </Body>
            <View
              style={{
                marginTop: spacing.md,
                paddingVertical: spacing.md,
                borderRadius: 18,
                backgroundColor: c.card,
                alignItems: 'center',
              }}
              accessible
              accessibilityLabel={`Your invite code is ${summary.code.split('').join(' ')}`}
            >
              <Caption>Your code</Caption>
              <Heading level={1} style={{ letterSpacing: 3, marginTop: 4 }} selectable>
                {formatReferralCode(summary.code)}
              </Heading>
            </View>
            <SlabButton label="Share invite" onPress={() => void onShare()} style={{ marginTop: spacing.md }} />
            <SlabButton
              label={copied ? 'Copied' : 'Copy code'}
              variant="tint"
              arrow={false}
              onPress={() => void onCopy()}
              style={{ marginTop: spacing.sm }}
            />
          </SlabCard>

          <SlabCard style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row' }}>
              <Stat value={summary.joined} label="joined" />
              <Stat value={summary.subscribed} label="subscribed" />
            </View>
          </SlabCard>

          <SlabCard style={{ marginBottom: spacing.md }}>
            <Body weight="semibold" style={{ marginBottom: spacing.xs }}>How it works</Body>
            {REFERRAL_RULES.map((rule) => (
              <View key={rule} style={{ flexDirection: 'row', marginTop: spacing.xs }}>
                <Ionicons name="checkmark-circle" size={18} color={c.green} style={{ marginTop: 2 }} />
                <Body style={{ marginLeft: spacing.xs, flex: 1 }}>{rule}</Body>
              </View>
            ))}
            <Caption style={{ marginTop: spacing.sm }}>
              {`Up to ${summary.annualCap} rewards a year. A refunded subscription doesn't count.`}
            </Caption>
          </SlabCard>

          {summary.rewards.length > 0 ? (
            <SlabCard style={{ marginBottom: spacing.md }}>
              <Body weight="semibold" style={{ marginBottom: spacing.xs }}>Your rewards</Body>
              {summary.rewards.map((reward) => (
                <View key={reward.id} style={{ flexDirection: 'row', marginTop: spacing.xs }}>
                  <Ionicons
                    name={reward.status === 'delivered' ? 'gift' : reward.status === 'void' ? 'close-circle-outline' : 'time-outline'}
                    size={18}
                    color={reward.status === 'delivered' ? c.primary : c.muted}
                    style={{ marginTop: 2 }}
                  />
                  <Body style={{ marginLeft: spacing.xs, flex: 1 }}>{rewardLabel(reward)}</Body>
                </View>
              ))}
            </SlabCard>
          ) : null}

          {summary.canRedeem ? (
            <SlabCard>
              <InviteCodeForm
                initialCode={typeof params.code === 'string' ? params.code : ''}
                onRedeemed={onRedeemed}
              />
            </SlabCard>
          ) : summary.hasReferrer ? (
            <Caption style={{ textAlign: 'center' }}>
              {redeemed
                ? "Code applied. Your friend gets their reward once you've been subscribed for a week."
                : "You joined with a friend's invite code."}
            </Caption>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
