import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Building2, KeyRound, Mail, Trash2, User as UserIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { SubmitButton, TextField } from '@/components/auth/Form';
import { PageShell, SectionLabel } from '@/components/PageShell';
import { SettingsCard, SettingsRow, SignInRequired } from '@/components/Settings';
import { errorMessage } from '@/api/client';
import { initials, useSession } from '@/data/session';
import { updateProfile } from '@/services/account';
import { haptic } from '@/hooks/haptics';
import { colors, shadow } from '@/theme/tokens';

/** Account — edit name and company, change password, delete account. */
export default function Account() {
  const { user } = useSession();
  const [name, setName] = useState(user?.name ?? '');
  const [company, setCompany] = useState(user?.company ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <PageShell title="Account">
        <SignInRequired onSignIn={() => router.replace('/sign-in')} />
      </PageShell>
    );
  }

  // Google-only accounts have no DriveFlow password to change.
  const google = user.provider === 'google' && !user.hasPassword;
  const dirty = name.trim() !== user.name || company.trim() !== (user.company ?? '');

  const save = async () => {
    if (name.trim().length < 2) {
      setError('Enter your full name.');
      haptic.warn();
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), company: company.trim() });
      haptic.success();
      router.back();
    } catch (e) {
      setError(errorMessage(e, 'Could not save your changes. Try again.'));
      haptic.warn();
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell title="Account" footer={<SubmitButton label={dirty ? 'Save changes' : 'No changes'} loadingLabel="Saving…" loading={saving} disabled={!dirty} onPress={save} />}>
      <View className="flex-row items-center gap-3.5 rounded-[22px] bg-card p-4" style={{ boxShadow: shadow.soft }}>
        <LinearGradient
          colors={[colors.brand, '#8C98FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text className="font-jk-semibold text-[18px] text-white">{initials({ ...user, name: name.trim() || user.name })}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text className="font-jk-semibold text-[15px] text-ink">{google ? 'Signed in with Google' : 'Signed in with email'}</Text>
          <Text className="mt-0.5 font-jk text-[13px] text-muted" numberOfLines={1}>
            {user.email}
          </Text>
        </View>
      </View>

      <SectionLabel text="Profile" />
      <View className="gap-4">
        <TextField
          label="Full name"
          icon={UserIcon}
          value={name}
          onChangeText={(t) => {
            setName(t.slice(0, 80));
            setError(null);
          }}
          placeholder="Your name"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          error={error}
        />
        <TextField
          label="Company"
          icon={Building2}
          value={company}
          onChangeText={(t) => setCompany(t.slice(0, 80))}
          placeholder="Optional"
          autoCapitalize="words"
          autoComplete="organization"
          textContentType="organizationName"
          hint="Used as your brand name on decks unless you set one in Brand kit."
        />
        <TextField label="Email" icon={Mail} value={user.email} editable={false} hint="This is your sign-in email. Contact support to change it." />
      </View>

      <SectionLabel text="Security" />
      <SettingsCard>
        <SettingsRow
          icon={KeyRound}
          title="Change password"
          detail={google ? 'Managed by your Google account' : 'Use 8+ characters with a number'}
          onPress={google ? undefined : () => router.push('/change-password')}
          last
        />
      </SettingsCard>

      <SectionLabel text="Danger zone" />
      <SettingsCard>
        <SettingsRow icon={Trash2} title="Delete account" detail="Removes your account and decks. Drive files stay." tone="danger" onPress={() => router.push('/delete-account')} last />
      </SettingsCard>
    </PageShell>
  );
}
