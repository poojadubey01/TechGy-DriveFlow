import { useLocalSearchParams } from 'expo-router';
import { FileWarning } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { FilterPills, PageShell } from '@/components/PageShell';
import { colors, fonts, shadow } from '@/theme/tokens';

const DOCS = ['Terms', 'Privacy'] as const;
type Doc = (typeof DOCS)[number];

type Section = { title: string; body: string[] };

const UPDATED = '19 November 2026';

/**
 * Plain-language DRAFTS. Have your legal team review and replace the [placeholders] before launch.
 */
const CONTENT: Record<Doc, { heading: string; intro: string; sections: Section[] }> = {
  Terms: {
    heading: 'Terms of Service',
    intro: 'These terms cover how you and your team use DriveFlow to turn Google Drive photos into client decks.',
    sections: [
      {
        title: '1. Your account',
        body: [
          'You need an account to use DriveFlow. Keep your sign-in details safe; you are responsible for activity on your account.',
          'If you sign up for a company, you confirm you are allowed to accept these terms for it.',
        ],
      },
      {
        title: '2. Your content',
        body: [
          'Your photos and decks stay yours. You give DriveFlow permission to read and process them only to build, show and share the decks you ask for.',
          'Only use photos you have the right to use and share with your clients.',
        ],
      },
      {
        title: '3. Sharing decks',
        body: ['Anyone with a deck’s share link can view that deck. You can stop sharing at any time, which turns the link off.'],
      },
      {
        title: '4. Fair use',
        body: [
          'Don’t use DriveFlow for anything unlawful, to upload harmful content, or to try to break, copy or overload the service.',
          'We may suspend accounts that break these rules.',
        ],
      },
      {
        title: '5. Changes and ending',
        body: [
          'We improve DriveFlow over time and may change features. We will tell you about important changes to these terms before they apply.',
          'You can delete your account at any time from Profile or by contacting us.',
        ],
      },
      {
        title: '6. Liability',
        body: ['DriveFlow is provided “as is”. To the extent the law allows, we are not liable for indirect losses. [Governing law and company details to be added.]'],
      },
    ],
  },
  Privacy: {
    heading: 'Privacy Policy',
    intro: 'What DriveFlow collects, why, and the choices you have. In short: your photos stay in your Google Drive.',
    sections: [
      {
        title: 'What we collect',
        body: [
          'Account details: your name, work email and company (optional).',
          'Google Drive: read access to the projects folder you choose, so we can find client photos.',
          'Decks you create, and basic app and crash data to keep DriveFlow working.',
        ],
      },
      {
        title: 'How we use Google Drive',
        body: [
          'We only read photos in the folder you pick, to build your decks. We never edit, move or delete your Drive files.',
          'Drive data is used only to provide DriveFlow — never for ads and never sold. Use of Google data follows the Google API Services User Data Policy, including its Limited Use requirements.',
        ],
      },
      {
        title: 'Who sees your data',
        body: [
          'You, your team, and the clients you share a deck link with.',
          'Trusted providers that host and run DriveFlow for us, under contract. We don’t sell personal data.',
        ],
      },
      {
        title: 'Storage and security',
        body: [
          'Data is encrypted in transit and at rest. We keep it while your account is active and delete it within 30 days of account deletion.',
        ],
      },
      {
        title: 'Your choices',
        body: [
          'Disconnect Google Drive any time in Profile → Google Drive. You can also revoke access from your Google Account settings.',
          'Ask for a copy of your data, or for it to be deleted, by contacting us.',
        ],
      },
      {
        title: 'Contact',
        body: ['Questions about privacy: [support email]. [Company name and address to be added.]'],
      },
    ],
  },
};

/** Terms & Privacy — one page with a switcher. Open with ?doc=terms or ?doc=privacy. */
export default function Legal() {
  const params = useLocalSearchParams<{ doc?: string }>();
  const [doc, setDoc] = useState<Doc>(params.doc === 'privacy' ? 'Privacy' : 'Terms');
  const page = CONTENT[doc];

  return (
    <PageShell title="Terms & Privacy" scrollKey={doc} header={<FilterPills options={DOCS} value={doc} onChange={setDoc} />}>
      <View className="px-2">
        <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 26, lineHeight: 32, letterSpacing: -0.6, color: colors.ink }}>
          {page.heading}
        </Text>
        <Text className="mt-1 font-jk text-[12px] text-muted">Last updated {UPDATED}</Text>
        <Text className="mt-3 font-jk text-[15px] leading-[22px] text-ink-soft">{page.intro}</Text>
      </View>

      <View className="mt-4 flex-row items-start gap-2.5 rounded-2xl px-4 py-3" style={{ backgroundColor: colors.sky }}>
        <FileWarning size={16} color={colors.brandDeep} strokeWidth={2} style={{ marginTop: 2 }} />
        <Text className="flex-1 font-jk text-[12px] leading-[18px] text-brand-deep">Draft for review — to be checked by your legal team before launch.</Text>
      </View>

      <View className="mt-4 gap-3">
        {page.sections.map((s) => (
          <View key={s.title} style={{ borderRadius: 20, backgroundColor: colors.card, boxShadow: shadow.soft, padding: 16, gap: 8 }}>
            <Text accessibilityRole="header" className="font-jk-semibold text-[16px] text-ink">
              {s.title}
            </Text>
            {s.body.map((p, i) => (
              <Text key={i} className="font-jk text-[14px] leading-[21px] text-ink-soft">
                {p}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </PageShell>
  );
}
