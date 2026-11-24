import { router, useLocalSearchParams } from 'expo-router';
import { Folder } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { StepDots, SubmitButton } from '@/components/auth/Form';
import { useSession } from '@/data/session';
import { haptic } from '@/hooks/haptics';
import { type DriveFolder, listFolders } from '@/services/drive';
import { colors, shadow } from '@/theme/tokens';

function FolderCard({ f, selected, onPress }: { f: DriveFolder; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${f.name}, ${f.clientFolders} client folders, ${f.photos} photos`}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderRadius: 20,
          borderWidth: 1.5,
          borderColor: selected ? colors.brand : 'transparent',
          backgroundColor: colors.card,
          boxShadow: selected ? shadow.card : shadow.soft,
        }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.brand : colors.sky }}>
          <Folder size={21} color={selected ? colors.white : colors.brand} strokeWidth={1.9} />
        </View>
        <View style={{ flex: 1 }}>
          <View className="flex-row items-center gap-2">
            <Text className="font-jk-semibold text-[16px] text-ink">{f.name}</Text>
            {f.recommended && (
              <View className="rounded-full bg-brand-sky px-2 py-0.5">
                <Text className="font-jk-semibold text-[10px] text-brand-deep">Recommended</Text>
              </View>
            )}
          </View>
          <Text className="mt-0.5 font-jk text-[13px] text-muted">
            {f.clientFolders} client folders · {f.photos.toLocaleString('en-IN')} photos
          </Text>
          <Text className="mt-0.5 font-jk text-[12px] text-muted">{f.updated}</Text>
        </View>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? colors.brand : colors.edge, alignItems: 'center', justifyContent: 'center' }}>
          {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand }} />}
        </View>
      </View>
    </Pressable>
  );
}

/** Onboarding 2/3 — pick the Drive folder that holds one sub-folder per client. */
export default function ChooseFolder() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromProfile = from === 'profile';
  const { drive } = useSession();
  const [folders, setFolders] = useState<DriveFolder[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listFolders().then((list) => {
      if (!alive) return;
      setFolders(list);
      setPicked((p) => p ?? list.find((f) => f.name === drive.folder)?.id ?? list.find((f) => f.recommended)?.id ?? list[0]?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, [drive.folder]);

  const chosen = folders?.find((f) => f.id === picked);

  return (
    <AuthShell
      eyebrow={fromProfile ? undefined : <StepDots step={2} />}
      title="Choose your projects folder"
      subtitle={`DriveFlow looks for one sub-folder per client${drive.account ? ` in ${drive.account}` : ''}.`}
      footer={
        <SubmitButton
          label={chosen ? `Use “${chosen.name}”` : 'Use this folder'}
          loadingLabel=""
          loading={false}
          disabled={!chosen}
          onPress={() => {
            if (!chosen) return;
            router.replace({
              pathname: '/syncing',
              params: { folder: chosen.name, clients: String(chosen.clientFolders), photos: String(chosen.photos), ...(fromProfile ? { from: 'profile' } : {}) },
            });
          }}
        />
      }
    >
      {folders === null ? (
        <View className="items-center py-10" accessibilityLabel="Loading your Drive folders">
          <ActivityIndicator color={colors.brand} />
          <Text className="mt-3 font-jk text-[13px] text-muted">Loading your Drive folders…</Text>
        </View>
      ) : (
        <View className="gap-3" accessibilityRole="radiogroup">
          {folders.map((f) => (
            <FolderCard
              key={f.id}
              f={f}
              selected={f.id === picked}
              onPress={() => {
                haptic.select();
                setPicked(f.id);
              }}
            />
          ))}
        </View>
      )}
    </AuthShell>
  );
}
