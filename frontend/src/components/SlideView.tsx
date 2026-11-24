import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import type { Asset } from '@/data/clients';
import type { TemplateId } from '@/data/templates';
import { colors, fonts } from '@/theme/tokens';

type Props = {
  template: TemplateId;
  source: Asset;
  title: string;
  /** Small line above the title (the client's name). */
  eyebrow: string;
  /** 0 = cover slide (shows the brand). */
  index: number;
  /** When set, shows the page number. */
  total?: number;
  brand: { name: string; accent: string } | null;
  width: number;
  /** Defaults to 16:9. Any height works (the Ready cover is taller). */
  height?: number;
  radius?: number;
  /** Bigger type for large covers. */
  textScale?: number;
  titleLines?: number;
};

const fill = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 } as const;

/**
 * One slide drawn in the chosen template. Designed on a 320 x 180 grid and scaled to `width`,
 * so the same slide works as a chat thumbnail, a preview page or the Ready cover.
 * Mirrors the PDF layouts in lib/deckPdf.ts.
 */
export function SlideView({ template, source, title, eyebrow, index, total, brand, width, height, radius = 14, textScale = 1, titleLines = 2 }: Props) {
  const h = height ?? Math.round((width * 9) / 16);
  const u = width / 320; // spacing unit
  const t = u * textScale; // type unit
  const accent = brand?.accent ?? colors.brandDeep;
  const cover = index === 0;
  const page = total ? `${index + 1} / ${total}` : null;
  const num = String(index + 1).padStart(2, '0');

  const tag =
    cover && brand ? (
      <View
        style={{
          position: 'absolute',
          left: 12 * u,
          top: 12 * u,
          height: 22 * u,
          paddingHorizontal: 9 * u,
          borderRadius: 11 * u,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5 * u,
          backgroundColor: colors.white,
          // Long brand names stop before the page number on the right.
          maxWidth: '64%',
        }}
      >
        <View style={{ width: 6 * u, height: 6 * u, borderRadius: 3 * u, backgroundColor: accent }} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 10.5 * u, color: accent, flexShrink: 1 }} numberOfLines={1}>
          {brand.name}
        </Text>
      </View>
    ) : null;

  const pill = page ? (
    <View style={{ position: 'absolute', right: 12 * u, top: 12 * u, height: 20 * u, paddingHorizontal: 8 * u, borderRadius: 10 * u, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)' }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 9.5 * u, color: colors.white }}>{page}</Text>
    </View>
  ) : null;

  const eyebrowStyle = { fontFamily: fonts.semibold, fontSize: 8 * t, letterSpacing: 1.1 * t, textTransform: 'uppercase' } as const;
  const frame = { width, height: h, borderRadius: radius, overflow: 'hidden' } as const;

  if (template === 'editorial') {
    const imgH = h * 0.64;
    return (
      <View style={{ ...frame, backgroundColor: colors.white }}>
        <View style={{ position: 'absolute', left: 9 * u, top: 9 * u, right: 9 * u, height: imgH, borderRadius: Math.max(6, radius - 5 * u), overflow: 'hidden' }}>
          <Image source={source} style={fill} contentFit="cover" transition={150} accessible={false} />
        </View>
        {tag}
        <View style={{ position: 'absolute', left: 15 * u, right: 44 * u, top: 9 * u + imgH + 9 * u }}>
          <Text style={{ ...eyebrowStyle, color: accent }} numberOfLines={1}>
            {eyebrow}
          </Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14 * t, lineHeight: 18 * t, letterSpacing: -0.3 * t, color: colors.ink, marginTop: 2 * u }} numberOfLines={titleLines}>
            {title}
          </Text>
        </View>
        {page ? (
          <Text style={{ position: 'absolute', right: 15 * u, bottom: 11 * u, fontFamily: fonts.semibold, fontSize: 12 * u, color: colors.placeholder }}>{num}</Text>
        ) : null}
      </View>
    );
  }

  if (template === 'split') {
    return (
      <View style={{ ...frame, backgroundColor: colors.white }}>
        <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '56%' }}>
          <Image source={source} style={fill} contentFit="cover" transition={150} accessible={false} />
        </View>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '44%', padding: 14 * u, justifyContent: 'space-between' }}>
          {cover && brand ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 10 * t, color: accent }} numberOfLines={1}>
              {brand.name}
            </Text>
          ) : (
            <Text style={{ fontFamily: fonts.bold, fontSize: 30 * t, lineHeight: 32 * t, color: accent, opacity: 0.28 }}>{num}</Text>
          )}
          <View>
            <View style={{ width: 16 * u, height: 3 * u, borderRadius: 2 * u, backgroundColor: accent }} />
            <Text style={{ ...eyebrowStyle, fontSize: 7 * t, color: colors.muted, marginTop: 7 * u }} numberOfLines={1}>
              {eyebrow}
            </Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13 * t, lineHeight: 17 * t, letterSpacing: -0.3 * t, color: colors.ink, marginTop: 2 * u }} numberOfLines={titleLines + 1}>
              {title}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (template === 'bold') {
    const imgH = h * 0.66;
    return (
      <View style={{ ...frame, backgroundColor: accent }}>
        <View style={{ position: 'absolute', left: 0, top: 0, right: 0, height: imgH }}>
          <Image source={source} style={fill} contentFit="cover" transition={150} accessible={false} />
        </View>
        {tag}
        {pill}
        <View style={{ position: 'absolute', left: 14 * u, right: 14 * u, top: imgH, bottom: 0, justifyContent: 'center' }}>
          <Text style={{ ...eyebrowStyle, fontSize: 7.5 * t, color: 'rgba(255,255,255,0.8)' }} numberOfLines={1}>
            {eyebrow}
          </Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14 * t, lineHeight: 18 * t, letterSpacing: -0.3 * t, color: colors.white, marginTop: 1 * u }} numberOfLines={titleLines}>
            {title}
          </Text>
        </View>
      </View>
    );
  }

  // classic
  return (
    <View style={{ ...frame, backgroundColor: colors.ink }}>
      <Image source={source} style={fill} contentFit="cover" transition={150} accessible={false} />
      <LinearGradient colors={['rgba(20,30,120,0)', 'rgba(20,30,120,0.75)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h * 0.6 }} />
      {tag}
      {pill}
      <View style={{ position: 'absolute', left: 14 * u, right: 14 * u, bottom: 12 * u }}>
        <Text style={{ ...eyebrowStyle, color: 'rgba(255,255,255,0.85)' }} numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16 * t, lineHeight: 20 * t, letterSpacing: -0.4 * t, color: colors.white, marginTop: 2 * u }} numberOfLines={titleLines}>
          {title}
        </Text>
      </View>
    </View>
  );
}
