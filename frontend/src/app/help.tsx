import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ChevronDown, ChevronUp, FileText, Mail, MailCheck, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

import { Checkbox, SubmitButton, TextField, TextLink } from '@/components/auth/Form';
import { PageShell, SectionLabel } from '@/components/PageShell';
import { SettingsCard, SettingsRow } from '@/components/Settings';
import { useSession } from '@/data/session';
import { haptic } from '@/hooks/haptics';
import { isEmail } from '@/services/auth';
import { sendFeedback } from '@/services/support';
import { colors, fonts, shadow } from '@/theme/tokens';

const FAQ = [
  {
    q: 'What can DriveFlow see in my Google Drive?',
    a: 'Only the projects folder you chose, with read-only access. DriveFlow never edits, moves or deletes your files. You can disconnect any time in Profile.',
  },
  {
    q: 'How do I add a new client?',
    a: 'Create a sub-folder for the client inside your projects folder in Google Drive and add their photos. It shows up in DriveFlow after the next sync.',
  },
  {
    q: 'Can I change a deck after it’s built?',
    a: 'Yes. Open the deck, tap ••• and choose Edit deck to rename, reorder or remove slides. The preview and PDF update straight away.',
  },
  {
    q: 'How do share links work?',
    a: 'A share link is view-only. You choose whether the client can download the PDF, and you can stop sharing at any time from the share popup.',
  },
  {
    q: 'How do I put my brand on decks?',
    a: 'Go to Profile → Brand kit to set your brand name and accent colour, or turn branding off.',
  },
] as const;

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

function Question({ q, a, open, onToggle, last }: { q: string; a: string; open: boolean; onToggle: () => void; last?: boolean }) {
  const Icon = open ? ChevronUp : ChevronDown;
  return (
    <View style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={q} hitSlop={4}>
        <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
          <Text className="flex-1 font-jk-semibold text-[15px] leading-[21px] text-ink">{q}</Text>
          <Icon size={18} color={colors.muted} strokeWidth={2} />
        </View>
      </Pressable>
      {open ? <Text className="-mt-1 pb-4 font-jk text-[14px] leading-[21px] text-ink-soft">{a}</Text> : null}
    </View>
  );
}

/** Help & support — common questions, a "contact us" form, and the legal pages. */
export default function Help() {
  const { user } = useSession();
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [email, setEmail] = useState(user?.email ?? '');
  const [message, setMessage] = useState('');
  const [device, setDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(false);

  const send = async () => {
    if (!isEmail(email)) {
      setError('Enter an email we can reply to.');
      haptic.warn();
      return;
    }
    if (message.trim().length < 10) {
      setError('Tell us a little more (10+ characters).');
      haptic.warn();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await sendFeedback({ email, message, device: device ? `${Platform.OS} ${String(Platform.Version)} · DriveFlow ${APP_VERSION}` : undefined });
      setSent(true);
      setMessage('');
      haptic.success();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send. Try again.');
      haptic.warn();
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell title="Help & support">
      <SectionLabel text="Common questions" />
      <SettingsCard>
        {FAQ.map((f, i) => (
          <Question
            key={f.q}
            q={f.q}
            a={f.a}
            open={openIdx === i}
            onToggle={() => {
              haptic.select();
              setOpenIdx(openIdx === i ? null : i);
            }}
            last={i === FAQ.length - 1}
          />
        ))}
      </SettingsCard>

      <SectionLabel text="Contact us" />
      {sent ? (
        <View className="items-center rounded-[22px] bg-card px-6 py-7" style={{ boxShadow: shadow.soft }} accessibilityLiveRegion="polite">
          <MailCheck size={30} color={colors.brand} strokeWidth={1.7} />
          <Text className="mt-3 font-jk-semibold text-[16px] text-ink">Message sent</Text>
          <Text className="mt-1 text-center font-jk text-[13px] leading-[19px] text-muted">Thanks. We’ll reply to {email.trim()}.</Text>
          <TextLink label="Send another" onPress={() => setSent(false)} />
        </View>
      ) : (
        <View className="gap-4 rounded-[22px] bg-card p-4" style={{ boxShadow: shadow.soft }}>
          {!user ? (
            <TextField
              label="Your email"
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
            />
          ) : null}
          <View>
            <Text className="mb-1.5 px-1 font-jk-semibold text-[13px] text-ink-soft">Report a problem or send feedback</Text>
            <TextInput
              value={message}
              onChangeText={(t) => {
                setMessage(t.slice(0, 1000));
                setError(null);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="What happened, or what would make DriveFlow better?"
              placeholderTextColor={colors.placeholder}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Message"
              style={[
                {
                  minHeight: 120,
                  borderRadius: 18,
                  borderWidth: 1.5,
                  borderColor: error ? colors.danger : focused ? colors.brand : colors.edge,
                  backgroundColor: colors.canvas,
                  padding: 14,
                  fontFamily: fonts.regular,
                  fontSize: 15,
                  lineHeight: 21,
                  color: colors.ink,
                },
                { outlineStyle: 'none' } as object,
              ]}
            />
            <Text className="mt-1.5 px-1 text-right font-jk text-[12px] text-muted">{message.length}/1000</Text>
          </View>
          <Checkbox checked={device} onChange={setDevice}>
            Include device details (phone, app version) to help us fix it faster
          </Checkbox>
          {error ? (
            <Text className="px-1 font-jk-medium text-[12px]" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <SubmitButton label="Send message" loadingLabel="Sending…" loading={loading} onPress={send} />
          {user ? <Text className="-mt-1 text-center font-jk text-[12px] text-muted">We’ll reply to {user.email}</Text> : null}
        </View>
      )}

      <SectionLabel text="More" />
      <SettingsCard>
        <SettingsRow icon={FileText} title="Terms of Service" onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} />
        <SettingsRow icon={ShieldCheck} title="Privacy Policy" onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} last />
      </SettingsCard>
      <Text className="mt-4 text-center font-jk text-[12px] text-muted">DriveFlow {APP_VERSION} · by TechGy Link</Text>
    </PageShell>
  );
}
