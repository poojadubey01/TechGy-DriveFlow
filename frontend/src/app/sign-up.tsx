import { router } from 'expo-router';
import { Building2, Lock, Mail, User as UserIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { Checkbox, GoogleButton, OrDivider, StrengthBar, SubmitButton, TextField, type TextInputRef, TextLink } from '@/components/auth/Form';
import { setUser } from '@/data/session';
import { haptic } from '@/hooks/haptics';
import { useMounted } from '@/hooks/useMounted';
import { resetTo } from '@/lib/nav';
import { AuthError, isEmail, isStrongEnough, passwordStrength, signInWithGoogle, signUpWithEmail } from '@/services/auth';
import { colors } from '@/theme/tokens';

type Errors = { name?: string; email?: string; password?: string; terms?: string; form?: string };

/** Sign up — create an account, verify the email, then connect Google Drive. */
export default function SignUp() {
  const emailRef = useRef<TextInputRef>(null);
  const companyRef = useRef<TextInputRef>(null);
  const pwRef = useRef<TextInputRef>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [google, setGoogle] = useState(false);
  // A field's error clears as soon as the user edits it.
  const clear = (key: keyof Errors) => setErrors((e) => (e[key] || e.form ? { ...e, [key]: undefined, form: undefined } : e));

  const mounted = useMounted();
  const toDrive = () => {
    if (!mounted.current) return;
    haptic.success();
    resetTo('/connect-drive');
  };

  const submit = async () => {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = 'Enter your full name.';
    if (!isEmail(email)) next.email = 'Enter a valid work email.';
    if (!isStrongEnough(password)) next.password = 'Use 8+ characters including a number.';
    if (!terms) next.terms = 'Please accept the terms to continue.';
    setErrors(next);
    if (Object.keys(next).length) {
      haptic.warn();
      return;
    }
    setLoading(true);
    try {
      const user = await signUpWithEmail({ name, email, company, password });
      if (!mounted.current) return;
      setUser(user);
      haptic.tap();
      router.push({ pathname: '/verify-email', params: { email: user.email } });
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
      setUser(await signInWithGoogle());
      toDrive();
    } finally {
      setGoogle(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up DriveFlow for your team in under a minute."
      footer={
        <View className="flex-row items-center justify-center gap-1">
          <Text className="font-jk text-[14px] text-muted">Already have an account?</Text>
          <TextLink label="Sign in" onPress={() => router.replace('/sign-in')} />
        </View>
      }
    >
      <View className="gap-4">
        <GoogleButton onPress={withGoogle} loading={google} label="Sign up with Google" />
        <OrDivider />
        <TextField
          label="Full name"
          icon={UserIcon}
          value={name}
          onChangeText={(t) => {
            setName(t.slice(0, 80));
            clear('name');
          }}
          placeholder="Aisha Khan"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          error={errors.name}
        />
        <TextField
          ref={emailRef}
          label="Work email"
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
          onSubmitEditing={() => companyRef.current?.focus()}
          error={errors.email}
        />
        <TextField
          ref={companyRef}
          label="Company (optional)"
          icon={Building2}
          value={company}
          onChangeText={(t) => setCompany(t.slice(0, 80))}
          placeholder="TechGy Link"
          autoCapitalize="words"
          autoComplete="organization"
          textContentType="organizationName"
          returnKeyType="next"
          onSubmitEditing={() => pwRef.current?.focus()}
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
            placeholder="At least 8 characters"
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            error={errors.password}
            hint={errors.password ? undefined : '8+ characters with a number. Add a capital for a strong password.'}
          />
          {password.length > 0 && <StrengthBar level={passwordStrength(password)} />}
        </View>

        <Checkbox
          checked={terms}
          onChange={(v) => {
            setTerms(v);
            clear('terms');
          }}
          error={!!errors.terms}
        >
          I agree to the Terms of Service and Privacy Policy.
        </Checkbox>
        {/* The links sit outside the checkbox so screen readers can reach them too. */}
        <View className="-mt-3 flex-row flex-wrap items-center pl-8">
          <Text className="font-jk text-[13px] text-muted">Read the </Text>
          <TextLink label="Terms of Service" onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} />
          <Text className="font-jk text-[13px] text-muted"> and </Text>
          <TextLink label="Privacy Policy" onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} />
        </View>
        {errors.terms ? (
          <Text className="-mt-2 px-1 font-jk-medium text-[12px]" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
            {errors.terms}
          </Text>
        ) : null}

        {errors.form ? (
          <Text className="text-center font-jk-medium text-[13px]" style={{ color: colors.danger }} accessibilityLiveRegion="assertive">
            {errors.form}
          </Text>
        ) : null}

        <SubmitButton label="Create account" loadingLabel="Creating account…" loading={loading} onPress={submit} />
      </View>
    </AuthShell>
  );
}
