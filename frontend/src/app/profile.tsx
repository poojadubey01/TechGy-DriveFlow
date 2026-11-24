import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChevronRight, FileText, HardDrive, LayoutTemplate, LifeBuoy, LogOut, type LucideIcon, Palette, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { FilterPills, PageShell, SectionLabel } from '@/components/PageShell';
import { PressableScale } from '@/components/ui/PressableScale';
import { Toggle } from '@/components/ui/Toggle';
import { useBrand } from '@/data/brand';
import { setSettings, useSettings } from '@/data/settings';
import { getTemplate, useDefaultTemplate } from '@/data/templates';
import { errorMessage } from '@/api/client';
import { confirmAction, showError } from '@/lib/confirm';
import { resetTo } from '@/lib/nav';
import { initials, useSession } from '@/data/session';
import { signOut as endSession } from '@/services/auth';
import { disconnectDrive, syncDrive } from '@/services/drive';
import { relativeTime } from '@/data/store';
import { colors, shadow } from '@/theme/tokens';

const SIZES = ['8 slides', '12 slides', '15 slides'] as const;
type Size = (typeof SIZES)[number];

function Card({ children }: { children: ReactNode }) {
  return <View style={{ borderRadius: 22, backgroundColor: colors.card, boxShadow: shadow.soft, paddingHorizontal: 16 }}>{children}</View>;
}

function Row({ icon: Icon, title, detail, right, last }: { icon?: LucideIcon; title: string; detail?: string; right?: ReactNode; last?: boolean }) {
  return (
    <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line }}>
      {Icon && (
        <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sky }}>
          <Icon size={18} color={colors.brand} strokeWidth={1.9} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text className="font-jk-semibold text-[15px] text-ink">{title}</Text>
        {detail ? <Text className="mt-0.5 font-jk text-[13px] text-muted">{detail}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Profile & settings — account, Google Drive, brand kit, defaults, notifications, sign out. */
export default function Profile() {
  const { user, drive } = useSession();
  const driveReady = drive.connected && !!drive.folder;
  const brand = useBrand();
  const defaultTemplate = getTemplate(useDefaultTemplate());
  const settings = useSettings();
  const size: Size = `${settings.defaultSlides} slides`;
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const syncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncNote(null);
    try {
      const r = await syncDrive();
      setSyncNote(r.newPhotos ? `${r.newPhotos} new ${r.newPhotos === 1 ? 'photo' : 'photos'} found` : 'Up to date');
    } catch (e) {
      showError('Couldn’t sync Google Drive', errorMessage(e));
    } finally {
      setSyncing(false);
    }
  };
  const synced = drive.lastSyncAt ? relativeTime(drive.lastSyncAt).toLowerCase() : null;

  // Signing out also clears this account's decks, brand kit and settings from the phone.
  const signOut = () =>
    confirmAction('Sign out?', 'Your decks stay in your account. You can sign back in any time.', 'Sign out', () => {
      void endSession().then(() => resetTo('/'));
    });

  const confirmDisconnect = () =>
    confirmAction('Disconnect Google Drive?', 'DriveFlow will stop reading your projects folder. Your files are not touched.', 'Disconnect', () => {
      disconnectDrive().catch((e) => showError('Could not disconnect Drive', errorMessage(e)));
    });

  return (
    <PageShell title="Profile">
      <PressableScale
        onPress={() => router.push('/account')}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={`Account: ${user?.name ?? ''}, ${user?.email ?? ''}. Edit account`}
        className="flex-row items-center gap-4 rounded-[24px] bg-card p-4"
        style={{ boxShadow: shadow.card }}
      >
        <LinearGradient
          colors={[colors.brand, '#8C98FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text className="font-jk-semibold text-[22px] text-white">{initials(user)}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text className="font-jk-semibold text-[19px] text-ink" accessibilityRole="header">
            {user?.name}
          </Text>
          <Text className="mt-0.5 font-jk text-[13px] text-muted" numberOfLines={1}>
            {user?.email}
          </Text>
          {user?.company ? (
            <View className="mt-2 self-start rounded-full bg-brand-sky px-2.5 py-1">
              <Text className="font-jk-semibold text-[11px] text-brand-deep">{user.company}</Text>
            </View>
          ) : null}
        </View>
        <ChevronRight size={20} color={colors.muted} strokeWidth={2} />
      </PressableScale>

      <SectionLabel text="Workspace" />
      <Card>
        <Row
          icon={HardDrive}
          title="Google Drive"
          detail={
            driveReady
              ? `${drive.folder} folder · ${syncing ? 'syncing…' : (syncNote ?? (synced ? `synced ${synced}` : 'not synced yet'))}`
              : drive.connected
                ? 'Connected · choose a folder'
                : 'Not connected'
          }
          right={
            driveReady ? (
              <PressableScale
                onPress={syncNow}
                disabled={syncing}
                accessibilityLabel={syncing ? 'Syncing Google Drive' : 'Sync Google Drive now'}
                style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.sky, opacity: syncing ? 0.6 : 1 }}
              >
                {syncing ? <ActivityIndicator size="small" color={colors.brand} /> : <RefreshCw size={14} color={colors.brand} strokeWidth={2.4} />}
                <Text className="font-jk-semibold text-[13px] text-brand-deep">{syncing ? 'Syncing' : 'Sync now'}</Text>
              </PressableScale>
            ) : (
              <PressableScale
                onPress={() => router.push(drive.connected ? { pathname: '/choose-folder', params: { from: 'profile' } } : { pathname: '/connect-drive', params: { from: 'profile' } })}
                accessibilityLabel={drive.connected ? 'Choose folder' : 'Connect Google Drive'}
                style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: colors.brand }}
              >
                <Text className="font-jk-semibold text-[13px] text-white">{drive.connected ? 'Choose' : 'Connect'}</Text>
              </PressableScale>
            )
          }
        />
        {driveReady && (
          <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <PressableScale
              onPress={() => router.push({ pathname: '/choose-folder', params: { from: 'profile' } })}
              accessibilityLabel="Change Drive folder"
              containerStyle={{ flex: 1 }}
              style={{ height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sky }}
            >
              <Text className="font-jk-semibold text-[13px] text-brand-deep">Change folder</Text>
            </PressableScale>
            <PressableScale
              onPress={confirmDisconnect}
              feedback="warn"
              accessibilityLabel="Disconnect Google Drive"
              containerStyle={{ flex: 1 }}
              style={{ height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.edge, backgroundColor: colors.card }}
            >
              <Text className="font-jk-semibold text-[13px] text-ink-soft">Disconnect</Text>
            </PressableScale>
          </View>
        )}
        <PressableScale onPress={() => router.push('/brand-kit')} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`Brand kit, ${brand.on ? 'on' : 'off'}`}>
          <Row
            icon={Palette}
            title="Brand kit"
            detail={brand.on ? `${brand.name} name and colour on every deck` : 'Off · decks are unbranded'}
            right={
              <View className="flex-row items-center gap-1">
                <Text className="font-jk-semibold text-[13px]" style={{ color: brand.on ? colors.brandDeep : colors.muted }}>
                  {brand.on ? 'On' : 'Off'}
                </Text>
                <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
              </View>
            }
          />
        </PressableScale>
        <PressableScale
          onPress={() => router.push({ pathname: '/templates', params: { mode: 'default' } })}
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel={`Default template, ${defaultTemplate.name}`}
        >
          <Row
            icon={LayoutTemplate}
            title="Default template"
            detail="New decks start with this look"
            right={
              <View className="flex-row items-center gap-1">
                <Text className="font-jk-semibold text-[13px] text-brand-deep">{defaultTemplate.name}</Text>
                <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
              </View>
            }
            last
          />
        </PressableScale>
      </Card>

      <SectionLabel text="Default deck size" />
      <View className="px-1">
        <FilterPills bleed={20} options={SIZES} value={size} onChange={(v) => setSettings({ defaultSlides: Number.parseInt(v, 10) as 8 | 12 | 15 })} />
      </View>

      <SectionLabel text="Notifications" />
      <Card>
        <Row title="Deck is ready" right={<Toggle value={settings.notifyReady} onChange={(v) => setSettings({ notifyReady: v })} label="Notify when a deck is ready" />} />
        <Row title="Client opens a deck" right={<Toggle value={settings.notifyViews} onChange={(v) => setSettings({ notifyViews: v })} label="Notify when a client opens a deck" />} />
        <Row title="New photos in Drive" right={<Toggle value={settings.notifyPhotos} onChange={(v) => setSettings({ notifyPhotos: v })} label="Notify about new Drive photos" />} last />
      </Card>

      <SectionLabel text="About" />
      <Card>
        <PressableScale onPress={() => router.push('/help')} scaleTo={0.98} accessibilityRole="button" accessibilityLabel="Help and support">
          <Row icon={LifeBuoy} title="Help & support" detail="Questions, feedback and contact" right={<ChevronRight size={18} color={colors.muted} strokeWidth={2} />} />
        </PressableScale>
        <PressableScale onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} scaleTo={0.98} accessibilityRole="link" accessibilityLabel="Privacy Policy">
          <Row icon={ShieldCheck} title="Privacy" detail="Photos stay in your Google Drive. Decks stay private until you share a link." right={<ChevronRight size={18} color={colors.muted} strokeWidth={2} />} />
        </PressableScale>
        <PressableScale onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} scaleTo={0.98} accessibilityRole="link" accessibilityLabel="Terms of Service">
          <Row icon={FileText} title="Terms of Service" right={<ChevronRight size={18} color={colors.muted} strokeWidth={2} />} last />
        </PressableScale>
      </Card>
      <Text className="mt-3 text-center font-jk text-[12px] text-muted">DriveFlow 1.0.0 · by TechGy Link</Text>

      <PressableScale
        onPress={signOut}
        feedback="warn"
        accessibilityLabel="Sign out"
        containerStyle={{ marginTop: 18 }}
        style={{ height: 56, borderRadius: 28, backgroundColor: colors.card, boxShadow: shadow.soft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        <LogOut size={18} color={colors.brandDeep} strokeWidth={2} />
        <Text className="font-jk-semibold text-[16px] text-brand-deep">Sign out</Text>
      </PressableScale>
    </PageShell>
  );
}
