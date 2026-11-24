import { router, useLocalSearchParams } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { CodeInput } from '@/components/auth/CodeInput';
import { SubmitButton, TextLink } from '@/components/auth/Form';
import { useSession } from '@/data/session';
import { haptic } from '@/hooks/haptics';
import { useCountdown } from '@/hooks/useCountdown';
import { useMounted } from '@/hooks/useMounted';
import { goAfterSignIn } from '@/lib/nav';
import { AuthError, resendCode, verifyEmail } from '@/services/auth';
import { colors, shadow } from '@/theme/tokens';

/** Verify email — the 6-digit code sent after sign-up, then on to Google Drive. */
export default function VerifyEmail() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { user } = useSession();
  const email = (typeof params.email === 'string' && params.email) || user?.email || '';
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const timer = useCountdown(30);
  const mounted = useMounted();

  const verify = async (value = code) => {
    if (value.length !== 6) {
      setError('Enter all 6 digits.');
      haptic.warn();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await verifyEmail(email, value);
      if (!mounted.current) return;
      haptic.success();
      goAfterSignIn();
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
      setCode('');
      haptic.warn();
    } finally {
      setLoading(false);
    }
  };

  const [resending, setResending] = useState(false);
  const resend = async () => {
    if (timer.left > 0 || resending) return;
    setError(null);
    setResending(true);
    try {
      await resendCode(email, 'verify');
      setResent(true);
      timer.restart();
      haptic.tap();
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Could not send a new code. Try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title="Verify your email"
      subtitle={`Enter the 6-digit code we sent to\n${email || 'your email'}`}
      footer={<SubmitButton label="Verify email" loadingLabel="Checking…" loading={loading} disabled={code.length !== 6} onPress={() => verify()} />}
    >
      <View className="gap-6">
        <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, boxShadow: shadow.card }}>
          <MailCheck size={32} color={colors.brand} strokeWidth={1.7} />
        </View>

        <CodeInput
          value={code}
          onChange={(c) => {
            setCode(c);
            if (error) setError(null);
          }}
          onComplete={(c) => verify(c)}
          error={error}
          autoFocus
        />

        <View className="gap-1">
          <View className="flex-row flex-wrap items-center gap-1">
            <Text className="font-jk text-[14px] text-muted">{resent ? 'New code sent.' : 'Didn’t get it?'}</Text>
            {timer.left > 0 ? (
              <Text className="font-jk-semibold text-[14px] text-muted" style={{ paddingVertical: 6, fontVariant: ['tabular-nums'] }}>
                Resend in {timer.label}
              </Text>
            ) : (
              <TextLink label="Resend code" onPress={resend} />
            )}
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="font-jk text-[14px] text-muted">Wrong address?</Text>
            <TextLink label="Change email" onPress={() => (router.canGoBack() ? router.back() : router.replace('/sign-up'))} />
          </View>
        </View>

        {__DEV__ ? <Text className="font-jk text-[12px] text-muted">Demo build: any 6-digit code works (000000 shows the error).</Text> : null}
      </View>
    </AuthShell>
  );
}
