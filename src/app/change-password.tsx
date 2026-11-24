import { router } from 'expo-router';
import { Lock, ShieldCheck } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { StrengthBar, SubmitButton, TextField, type TextInputRef } from '@/components/auth/Form';
import { PageShell } from '@/components/PageShell';
import { SignInRequired } from '@/components/Settings';
import { useSession } from '@/data/session';
import { haptic } from '@/hooks/haptics';
import { AuthError, changePassword, isStrongEnough, passwordStrength } from '@/services/auth';
import { colors, shadow } from '@/theme/tokens';

type Errors = { current?: string; next?: string; confirm?: string; form?: string };

/** Change password while signed in: current password, new password (strength), confirm. */
export default function ChangePassword() {
  const { user } = useSession();
  const nextRef = useRef<TextInputRef>(null);
  const confirmRef = useRef<TextInputRef>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const clear = (key: keyof Errors) => setErrors((e) => (e[key] || e.form ? { ...e, [key]: undefined, form: undefined } : e));

  if (!user) {
    return (
      <PageShell title="Change password">
        <SignInRequired onSignIn={() => router.replace('/sign-in')} />
      </PageShell>
    );
  }

  if (done) {
    return (
      <PageShell title="Change password" footer={<SubmitButton label="Done" loadingLabel="" loading={false} onPress={() => router.back()} />}>
        <View className="items-center pt-10">
          <View style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, boxShadow: shadow.card }}>
            <ShieldCheck size={40} color={colors.success} strokeWidth={1.7} />
          </View>
          <Text className="mt-6 font-jk-semibold text-[22px] text-ink" accessibilityRole="header">
            Password changed
          </Text>
          <Text className="mt-2 text-center font-jk text-[15px] leading-[22px] text-ink-soft">Use your new password next time you sign in.</Text>
        </View>
      </PageShell>
    );
  }

  const submit = async () => {
    const e: Errors = {};
    if (!current) e.current = 'Enter your current password.';
    if (!isStrongEnough(next)) e.next = 'Use 8+ characters including a number.';
    if (!e.next && confirm !== next) e.confirm = 'Passwords don’t match.';
    setErrors(e);
    if (Object.keys(e).length) {
      haptic.warn();
      return;
    }
    setLoading(true);
    try {
      await changePassword(current, next);
      setDone(true);
      haptic.success();
    } catch (err) {
      const message = err instanceof AuthError ? err.message : 'Something went wrong. Try again.';
      setErrors(message.includes('current password') ? { current: message } : { form: message });
      haptic.warn();
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell title="Change password">
      <View className="gap-5">
        <TextField
          label="Current password"
          icon={Lock}
          secure
          value={current}
          onChangeText={(t) => {
            setCurrent(t.slice(0, 128));
            clear('current');
          }}
          placeholder="Your current password"
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="next"
          onSubmitEditing={() => nextRef.current?.focus()}
          error={errors.current}
        />
        <View>
          <TextField
            ref={nextRef}
            label="New password"
            icon={Lock}
            secure
            value={next}
            onChangeText={(t) => {
              setNext(t.slice(0, 128));
              clear('next');
            }}
            placeholder="At least 8 characters"
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            error={errors.next}
            hint={errors.next ? undefined : '8+ characters with a number.'}
          />
          {next.length > 0 && <StrengthBar level={passwordStrength(next)} />}
        </View>
        <TextField
          ref={confirmRef}
          label="Confirm new password"
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
        <SubmitButton label="Change password" loadingLabel="Saving…" loading={loading} onPress={submit} />
      </View>
    </PageShell>
  );
}
