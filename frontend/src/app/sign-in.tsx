import { router, useLocalSearchParams } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleButton, OrDivider, SubmitButton, TextField, type TextInputRef, TextLink } from '@/components/auth/Form';
import { haptic } from '@/hooks/haptics';
import { useMounted } from '@/hooks/useMounted';
import { goAfterSignIn } from '@/lib/nav';
import { AuthError, isEmail, signInWithEmail, signInWithGoogle } from '@/services/auth';
import { colors } from '@/theme/tokens';

/** Sign in — email + password, or Google. Returning users go straight to Home. */
export default function SignIn() {
  const pwRef = useRef<TextInputRef>(null);
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const [google, setGoogle] = useState(false);
  const clear = (key: 'email' | 'password') => setErrors((e) => (e[key] || e.form ? { ...e, [key]: undefined, form: undefined } : e));

  const mounted = useMounted();
  const finish = () => {
    // Left the screen while signing in: don't jump anywhere.
    if (!mounted.current) return;
    haptic.success();
    goAfterSignIn();
  };

  const submit = async () => {
    const next: typeof errors = {};
    if (!isEmail(email)) next.email = 'Enter a valid email address.';
    if (password.length < 8) next.password = 'Password must be at least 8 characters.';
    setErrors(next);
    if (next.email || next.password) {
      haptic.warn();
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      finish();
    } catch (e) {
      setErrors({ form: e instanceof AuthError ? e.message : 'Something went wrong. Try again.' });
      haptic.warn();
    } finally {
      setLoading(false);
    }
  };

  const withGoogle = async () => {
    setGoogle(true);
    try {
      await signInWithGoogle();
      finish();
    } catch (e) {
      setErrors({ form: e instanceof AuthError ? e.message : 'Google sign-in didn’t work. Try again.' });
      haptic.warn();
    } finally {
      setGoogle(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to keep creating decks for your clients."
      footer={
        <View className="flex-row items-center justify-center gap-1">
          <Text className="font-jk text-[14px] text-muted">New to DriveFlow?</Text>
          <TextLink label="Create account" onPress={() => router.replace('/sign-up')} />
        </View>
      }
    >
      <View className="gap-4">
        <TextField
          label="Email"
          icon={Mail}
          value={email}
          onChangeText={(t) => {
            setEmail(t.slice(0, 120));
            clear('email');
          }}
          placeholder="name@company.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => pwRef.current?.focus()}
          error={errors.email}
        />
        <View>
          <TextField
            ref={pwRef}
            label="Password"
            icon={Lock}
            secure
            value={password}
            onChangeText={(t) => {
            setPassword(t.slice(0, 128));
            clear('password');
          }}
            placeholder="Your password"
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            error={errors.password}
          />
          <View className="mt-1 items-end">
            <TextLink label="Forgot password?" onPress={() => router.push({ pathname: '/forgot-password', params: { email } })} />
          </View>
        </View>

        {errors.form ? (
          <Text className="text-center font-jk-medium text-[13px]" style={{ color: colors.danger }} accessibilityLiveRegion="assertive">
            {errors.form}
          </Text>
        ) : null}

        <SubmitButton label="Sign in" loadingLabel="Signing in…" loading={loading} onPress={submit} />
        <OrDivider />
        <GoogleButton onPress={withGoogle} loading={google} />
      </View>
    </AuthShell>
  );
}
