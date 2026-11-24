import { router, useLocalSearchParams } from 'expo-router';
import { Mail, MailCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { SubmitButton, TextField, TextLink } from '@/components/auth/Form';
import { haptic } from '@/hooks/haptics';
import { AuthError, isEmail, requestPasswordReset } from '@/services/auth';
import { colors, shadow } from '@/theme/tokens';

/** Forgot password — email a reset code, then on to Set new password. */
export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!isEmail(email)) {
      setError('Enter a valid email address.');
      haptic.warn();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
      haptic.success();
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle={`We sent a 6-digit reset code to
${email.trim()}
It expires in 30 minutes.`}
        footer={
          <SubmitButton
            label="Enter reset code"
            loadingLabel=""
            loading={false}
            onPress={() => router.push({ pathname: '/reset-password', params: { email: email.trim() } })}
          />
        }
      >
        <View className="items-center">
          <View style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, boxShadow: shadow.card }}>
            <MailCheck size={40} color={colors.brand} strokeWidth={1.7} />
          </View>
          <View className="mt-6 flex-row items-center gap-1">
            <Text className="font-jk text-[14px] text-muted">Didn&apos;t get it?</Text>
            <TextLink label="Resend code" onPress={send} />
          </View>
          <TextLink label="Back to sign in" muted onPress={() => router.back()} />
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset your password" subtitle="Enter your account email and we’ll send you a code to set a new password.">
      <View className="gap-5">
        <TextField
          label="Email"
          icon={Mail}
          value={email}
          onChangeText={(t) => {
            setEmail(t.slice(0, 120));
            setError(null);
          }}
          placeholder="name@company.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={send}
          error={error}
          autoFocus={!email}
        />
        <SubmitButton label="Send reset code" loadingLabel="Sending…" loading={loading} onPress={send} />
      </View>
    </AuthShell>
  );
}
