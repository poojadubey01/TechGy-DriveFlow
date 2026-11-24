import { Check, Palette } from 'lucide-react-native';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { TextField } from '@/components/auth/Form';
import { PageShell, SectionLabel } from '@/components/PageShell';
import { SlideView } from '@/components/SlideView';
import { SettingsCard, SettingsRow } from '@/components/Settings';
import { Toggle } from '@/components/ui/Toggle';
import { ACCENTS, setBrand, useBrand } from '@/data/brand';
import { getClient } from '@/data/clients';
import { useSession } from '@/data/session';
import { getTemplate, useDefaultTemplate } from '@/data/templates';
import { haptic } from '@/hooks/haptics';
import { colors, shadow } from '@/theme/tokens';

/** Brand kit — brand name and accent colour on every deck cover, PDF and client view. Changes apply at once. */
export default function BrandKit() {
  const brand = useBrand();
  const { user } = useSession();
  const { width } = useWindowDimensions();
  const sample = getClient('highrize');
  const template = useDefaultTemplate();

  return (
    <PageShell title="Brand kit">
      {/* Live preview of a deck cover */}
      <View style={{ borderRadius: 22, boxShadow: shadow.card }} accessible accessibilityLabel={`Cover preview${brand.on ? ` with ${brand.name} brand` : ', no brand'}`}>
        <SlideView
          template={template}
          source={sample.cover}
          title="Luxury villa portfolio"
          eyebrow={sample.name}
          index={0}
          brand={brand.on ? { name: brand.name, accent: brand.accent } : null}
          width={width - 32}
          radius={22}
          textScale={1.2}
        />
      </View>
      <Text className="mt-2 px-2 text-center font-jk text-[12px] text-muted">Preview in your default template ({getTemplate(template).name})</Text>

      <SectionLabel text="Branding" />
      <SettingsCard>
        <SettingsRow
          icon={Palette}
          title="Show my brand on decks"
          detail="Cover, PDF and the client’s view"
          right={<Toggle value={brand.on} onChange={(v) => setBrand({ on: v })} label="Show my brand on decks" />}
          last
        />
      </SettingsCard>

      <View className="mt-5" style={{ opacity: brand.on ? 1 : 0.5 }} pointerEvents={brand.on ? 'auto' : 'none'}>
        <TextField
          label="Brand name"
          value={brand.customName}
          onChangeText={(t) => setBrand({ name: t })}
          placeholder={user?.company || 'TechGy Link'}
          autoCapitalize="words"
          maxLength={40}
          hint="Leave empty to use your company name."
        />

        <Text className="mb-2 mt-5 px-1 font-jk-semibold text-[13px] text-ink-soft">Accent colour</Text>
        <View className="flex-row flex-wrap gap-3 px-1" accessibilityRole="radiogroup">
          {ACCENTS.map((a) => {
            const on = a.hex === brand.accent;
            return (
              <Pressable
                key={a.hex}
                onPress={() => {
                  if (on) return;
                  haptic.select();
                  setBrand({ accent: a.hex });
                }}
                hitSlop={4}
                accessibilityRole="radio"
                accessibilityLabel={a.name}
                accessibilityState={{ checked: on }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: a.hex,
                    borderWidth: 3,
                    borderColor: on ? colors.white : 'transparent',
                    boxShadow: on ? `0 0 0 2px ${a.hex}` : shadow.soft,
                  }}
                >
                  {on ? <Check size={20} color={colors.white} strokeWidth={2.8} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text className="mt-3 px-1 font-jk text-[12px] text-muted">{ACCENTS.find((a) => a.hex === brand.accent)?.name}</Text>
      </View>
    </PageShell>
  );
}
