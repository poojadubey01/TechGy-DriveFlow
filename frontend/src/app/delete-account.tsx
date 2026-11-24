import { router, useNavigation } from 'expo-router';
import { Check, Mail, TriangleAlert, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { BackHandler, Text, View } from 'react-native';

import { SubmitButton, TextField } from '@/components/auth/Form';
import { PageShell, SectionLabel } from '@/components/PageShell';
import { SettingsCard, SignInRequired } from '@/components/Settings';
import { useSession } from '@/data/session';
import { haptic } from '@/hooks/haptics';
import { resetTo } from '@/lib/nav';
import { AuthError, deleteAccount } from '@/services/auth';
import { colors, shadow } from '@/theme/tokens';

const GONE = ['Your account and profile', 'Every deck and your slide edits', 'Share links: clients will see “no longer active”', 'Brand kit and settings'] as const;
const KEPT = ['Your Google Drive files: DriveFlow never changes them'] as const;

function Line({ text, kept }: { text: string; kept?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 11 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, marginTop: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: kept ? '#E7F6EC' : '#FDECEE' }}>
        {kept ? <Check size={13} color={colors.success} strokeWidth={2.6} /> : <X size={13} color={colors.danger} strokeWidth={2.6} />}
      </View>
      <Text className="flex-1 font-jk text-[14px] leading-[21px] text-ink-soft">{text}</Text>
    </View>
  );
}

/** Delete account — explains what goes and what stays, then confirm by typing the account email. */
export default function DeleteAccount() {
  const { user } = useSession();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const toStart = () => resetTo('/');

  // While deleting, Back (button, gesture or Android back) can't leave the screen half-way.
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !loading });
    if (!loading) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [loading, navigation]);

  if (done) {
    return (
      <PageShell title="Delete account" footer={<SubmitButton label="Back to start" loadingLabel="" loading={false} onPress={toStart} />}>
        <View className="items-center pt-10">
          <View style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, boxShadow: shadow.card }}>
            <Check size={40} color={colors.success} strokeWidth={2} />
          </View>
          <Text className="mt-6 font-jk-semibold text-[22px] text-ink" accessibilityRole="header">
            Account deleted
          </Text>
          <Text className="mt-2 text-center font-jk text-[15px] leading-[22px] text-ink-soft">Your data is removed within 30 days. Your Google Drive files were not touched.</Text>
        </View>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell title="Delete account">
        <SignInRequired onSignIn={() => router.replace('/sign-in')} />
      </PageShell>
    );
  }

  const matches = typed.trim().toLowerCase() === user.email.toLowerCase();

  const remove = async () => {
    if (!matches) {
      setError('Type your account email exactly.');
      haptic.warn();
      return;
    }
    setLoading(true);
    try {
      // Deletes everything on the server, then forgets the account on this phone.
      await deleteAccount(user.email, typed);
      haptic.success();
      setDone(true);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
      haptic.warn();
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      title="Delete account"
      onBack={loading ? () => undefined : undefined}
      footer={<SubmitButton tone="danger" label="Delete my account" loadingLabel="Deleting…" loading={loading} disabled={!matches} onPress={remove} />}
    >
      <View className="flex-row items-start gap-3 rounded-[20px] px-4 py-3.5" style={{ backgroundColor: '#FDECEE' }}>
        <TriangleAlert size={18} color={colors.danger} strokeWidth={2} style={{ marginTop: 1 }} />
        <Text className="flex-1 font-jk-medium text-[14px] leading-[20px]" style={{ color: colors.danger }}>
          This can’t be undone. You’ll be signed out straight away.
        </Text>
      </View>

      <SectionLabel text="What gets deleted" />
      <SettingsCard>
        <View style={{ paddingVertical: 4 }}>
          {GONE.map((t) => (
            <Line key={t} text={t} />
          ))}
        </View>
      </SettingsCard>

      <SectionLabel text="What stays" />
      <SettingsCard>
        <View style={{ paddingVertical: 4 }}>
          {KEPT.map((t) => (
            <Line key={t} text={t} kept />
          ))}
        </View>
      </SettingsCard>

      <View className="mt-6 gap-4">
        <TextField
          label="Type your email to confirm"
          icon={Mail}
          value={typed}
          onChangeText={(t) => {
            setTyped(t.slice(0, 120));
            setError(null);
          }}
          placeholder={user.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={error}
          returnKeyType="done"
          onSubmitEditing={remove}
        />
      </View>
    </PageShell>
  );
}
