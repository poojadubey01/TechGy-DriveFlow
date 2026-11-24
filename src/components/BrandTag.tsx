import { Text, View } from 'react-native';

import { colors, fonts, shadow } from '@/theme/tokens';

/** White pill with the brand name in the brand's accent colour (deck covers, client view). */
export function BrandTag({ name, accent, size = 'md' }: { name: string; accent: string; size?: 'sm' | 'md' }) {
  const sm = size === 'sm';
  return (
    <View
      style={{
        height: sm ? 24 : 28,
        paddingHorizontal: sm ? 10 : 12,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: colors.white,
        boxShadow: shadow.card,
      }}
    >
      <View style={{ width: sm ? 6 : 7, height: sm ? 6 : 7, borderRadius: 4, backgroundColor: accent }} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: sm ? 11 : 12, color: accent }} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}
