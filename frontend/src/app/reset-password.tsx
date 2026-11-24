import { router, useLocalSearchParams } from 'expo-router';
import { Lock, ShieldCheck } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { CodeInput } from '@/components/auth/CodeInput';
import { StrengthBar, SubmitButton, TextField, type TextInputRef, TextLink } from '@/components/auth/Form';
import { haptic } from '@/hooks/haptics';
import { useCountdown } from '@/hooks/useCountdown';
import { AuthError, isStrongEnough, passwordStrength, resendCode, resetPassword } from '@/services/auth';
import { colors, shadow } from '@/theme/tokens';

type Errors = { code?: string; password?: string; confirm?: string; form?: string };

/** Set a new password — reset code from the email + new password, then back to sign in. */
export default function ResetPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const pwRef = useRef<TextInputRef>(null);
  const confirmRef = useRef<TextInputRef>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const timer = useCountdown(30);
  const clear = (key: keyof Errors) => setErrors((e) => (e[key] || e.form ? { ...e, [key]: undefined, form: undefined } : e));

  const submit = async () => {
    const next: Errors = {};
    if (code.length !== 6) next.code = 'Enter the 6-digit code from the email.';
    if (!isStrongEnough(password)) next.password = 'Use 8+ characters including a number.';
    if (!next.password && confirm !== password) next.confirm = 'Passwords don’t match.';
    setErrors(next);
    if (Object.keys(next).length) {
      haptic.warn();
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email, code, password);
      setDone(true);
      haptic.success();
    } catch (e) {
      const message = e instanceof AuthError ? e.message : 'Something went wrong. Try again.';
      setErrors(message.includes('code') ? { code: message } : { form: message });
      haptic.warn();
    } finally {
      setLoading(false);
    }
  };

  const [resending, setResending] = useState(false);
  const resend = async () => {
    if (timer.left > 0 || resending) return;
    setResending(true);
    try {
      await resendCode(email, 'reset');
      timer.restart();
      haptic.tap();
    } catch (e) {
      setErrors({ form: e instanceof AuthError ? e.message : 'Could not send a new code. Try again.' });
    } finally {
      setResending(false);
    }
  };

  const toSignIn = () => router.dismissTo({ pathname: '/sign-in', params: email ? { email } : {} });

  // Opened without an email (an old link): start again from Forgot password.
  if (!email) {
    return (
      <AuthShell
        title="Reset your password"
        subtitle="Start from Forgot password so we know which email to send the code to."
        footer={<SubmitButton label="Go to Forgot password" loadingLabel="" loading={false} onPress={() => router.replace('/forgot-password')} />}
      >
        <View />
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell
        noBack
        title="Password updated"
        subtitle="Your new password is set. Sign in with it to get back to your decks."
        footer={<SubmitButton label="Back to sign in" loadingLabel="" loading={false} onPress={toSignIn} />}
      >
        <View className="items-center">
          <View style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, boxShadow: shadow.card }}>
            <ShieldCheck size={40} color={colors.success} strokeWidth={1.7} />
          </View>
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" subtitle={`Enter the code we emailed to ${email || 'you'}, then choose a new password.`}>
      <View className="gap-5">
        <View>
          <Text className="mb-1.5 px-1 font-jk-semibold text-[13px] text-ink-soft">Reset code</Text>
          <CodeInput
            value={code}
            onChange={(c) => {
              setCode(c);
              clear('code');
            }}
            onComplete={() => pwRef.current?.focus()}
            error={errors.code}
            label="Reset code"
            autoFocus
          />
          <View className="mt-1 flex-row items-center gap-1 px-1">
            {timer.left > 0 ? (
              <Text className="font-jk text-[13px] text-muted" style={{ paddingVertical: 6, fontVariant: ['tabular-nums'] }}>
                Resend code in {timer.label}
              </Text>
            ) : (
              <TextLink label="Resend code" onPress={resend} />
            )}
          </View>
        </View>

        <View>
          <TextField
            ref={pwRef}
            label="New password"
            icon={Lock}
            secure
            value={password}
            onChangeText={(t) => {
              setPassword(t.slice(0, 128));
              clear('password');
            }}
            placeholder="At least 8 characters"
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            error={errors.password}
            hint={errors.password ? undefined : '8+ characters with a number.'}
          />
          {password.length > 0 && <StrengthBar level={passwordStrength(password)} />}
        </View>

        <TextField
          ref={confirmRef}
          label="Confirm password"
          icon={Lock}
          secure
          value={confirm}
          onChangeText={(t) => {
            setConfirm(t.slice(0, 128));
            clear('confirm');
          }}
          placeholder="Type it again"
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
          error={errors.confirm}
        />

        {errors.form ? (
          <Text className="text-center font-jk-medium text-[13px]" style={{ color: colors.danger }} accessibilityLiveRegion="assertive">
            {errors.form}
          </Text>
        ) : null}

        <SubmitButton label="Set new password" loadingLabel="Saving…" loading={loading} onPress={submit} />
      </View>
    </AuthShell>
  );
}
