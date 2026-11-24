import { router } from 'expo-router';
import { CheckCheck, Eye, Images, type LucideIcon, Presentation, Users } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { PageShell, SectionLabel } from '@/components/PageShell';
import { IconButton } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { type AppNotification, markAllRead, markRead, type NotificationKind, notifications, useReadIds, useUnreadCount } from '@/data/app';
import { colors, shadow } from '@/theme/tokens';

const ICONS: Record<NotificationKind, LucideIcon> = { ready: Presentation, viewed: Eye, photos: Images, team: Users };

function Row({ n, unread }: { n: AppNotification; unread: boolean }) {
  const Icon = ICONS[n.kind];
  return (
    <PressableScale
      onPress={() => {
        markRead(n.id);
        router.push(n.target);
      }}
      scaleTo={0.98}
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${n.title}. ${n.body}. ${n.when}`}
      style={{ borderRadius: 22, backgroundColor: colors.card, boxShadow: unread ? shadow.card : shadow.soft, padding: 14, flexDirection: 'row', gap: 12 }}
    >
      <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sky }}>
        <Icon size={19} color={colors.brand} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1 }}>
        <View className="flex-row items-start gap-2">
          <Text className={`flex-1 text-[15px] leading-[20px] text-ink ${unread ? 'font-jk-semibold' : 'font-jk-medium'}`}>{n.title}</Text>
          {unread && <View style={{ width: 9, height: 9, borderRadius: 5, marginTop: 6, backgroundColor: colors.brand }} accessibilityElementsHidden />}
        </View>
        <Text className="mt-0.5 font-jk text-[13px] leading-[18px] text-muted">{n.body}</Text>
        <Text className="mt-1.5 font-jk text-[12px] text-muted">{n.when}</Text>
      </View>
    </PressableScale>
  );
}

/** Notifications — deck ready, client views, new Drive photos, team changes. */
export default function Notifications() {
  const readIds = useReadIds();
  const unread = useUnreadCount();
  const groups = (['Today', 'Earlier'] as const).map((g) => ({ g, items: notifications.filter((n) => n.group === g) }));

  return (
    <PageShell
      title="Notifications"
      right={<IconButton icon={CheckCheck} label="Mark all as read" tint={unread ? colors.brand : colors.muted} onPress={markAllRead} />}
    >
      <Text className="px-2 font-jk text-[14px] text-muted" accessibilityLiveRegion="polite">
        {unread > 0 ? `${unread} unread` : 'You are all caught up'}
      </Text>
      {groups.map(({ g, items }) => (
        <View key={g}>
          <SectionLabel text={g} />
          <View className="gap-2.5">
            {items.map((n) => (
              <Row key={n.id} n={n} unread={!readIds.has(n.id)} />
            ))}
          </View>
        </View>
      ))}
    </PageShell>
  );
}
