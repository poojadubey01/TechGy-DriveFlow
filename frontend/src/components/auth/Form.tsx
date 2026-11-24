import { router } from 'expo-router';
import { Check, Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { type ComponentRef, forwardRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, type TextInputProps, View } from 'react-native';

import { haptic } from '@/hooks/haptics';
import { colors, fonts, shadow } from '@/theme/tokens';

import { PressableScale } from '../ui/PressableScale';

/** Ref to the underlying input (RN 0.88: use the component's instance type). */
export type TextInputRef = ComponentRef<typeof TextInput>;

type FieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string | null;
  icon?: LucideIcon;
  /** Password field with a show/hide button. */
  secure?: boolean;
  hint?: string;
};

/** Labelled input: white pill, brand border on focus, red border + message on error. */
export const TextField = forwardRef<TextInputRef, FieldProps>(function TextField({ label, error, icon: Icon, secure, hint, ...input }, ref) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const border = error ? colors.danger : focused ? colors.brand : colors.edge;

  return (
    <View>
      <Text className="mb-1.5 px-1 font-jk-semibold text-[13px] text-ink-soft">{label}</Text>
      <View
        style={{
          height: 54,
          borderRadius: 18,
          borderWidth: 1.5,
          borderColor: border,
          backgroundColor: colors.card,
          boxShadow: shadow.soft,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 16,
          paddingRight: secure ? 6 : 16,
          gap: 10,
        }}
      >
        {Icon && <Icon size={18} color={focused ? colors.brand : colors.muted} strokeWidth={1.9} />}
        <TextInput
          ref={ref}
          {...input}
          secureTextEntry={secure ? hidden : undefined}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, paddingVertical: 0 }, { outlineStyle: 'none' } as object]}
        />
        {secure && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}
          >
            {hidden ? <Eye size={19} color={colors.muted} strokeWidth={1.9} /> : <EyeOff size={19} color={colors.muted} strokeWidth={1.9} />}
          </Pressable>
        )}
      </View>
      {error ? (
        <Text className="mt-1.5 px-1 font-jk-medium text-[12px]" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text className="mt-1.5 px-1 font-jk text-[12px] text-muted">{hint}</Text>
      ) : null}
    </View>
  );
});

/** Three-step strength bar under a password field. */
export function StrengthBar({ level }: { level: 0 | 1 | 2 | 3 }) {
  const label = ['', 'Weak', 'Okay', 'Strong'][level];
  const tone = level >= 3 ? colors.success : level === 2 ? colors.brand : colors.danger;
  return (
    <View className="mt-2 flex-row items-center gap-2 px-1" accessibilityLabel={level ? `Password strength: ${label}` : undefined}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: level >= i ? tone : colors.line }} />
      ))}
      <Text className="w-12 text-right font-jk-semibold text-[12px]" style={{ color: level ? tone : colors.muted }}>
        {label}
      </Text>
    </View>
  );
}

/** Square checkbox with a label (label may contain inline links). */
export function Checkbox({ checked, onChange, children, error }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; error?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onChange(!checked);
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={6}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          marginTop: 1,
          borderWidth: 1.5,
          alignItems: 'center',
          justifyContent: 'center',
          borderColor: checked ? colors.brand : error ? colors.danger : colors.edge,
          backgroundColor: checked ? colors.brand : colors.card,
        }}
      >
        {checked && <Check size={14} color={colors.white} strokeWidth={3} />}
      </View>
      <Text className="flex-1 font-jk text-[13px] leading-[19px] text-ink-soft">{children}</Text>
    </Pressable>
  );
}

/** Primary 56 px action with a loading state. tone="danger" for destructive actions (delete account). */
export function SubmitButton({
  label,
  loadingLabel,
  loading,
  onPress,
  disabled,
  tone = 'brand',
}: {
  label: string;
  loadingLabel: string;
  loading: boolean;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'brand' | 'danger';
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={loading || disabled}
      feedback={tone === 'danger' ? 'warn' : 'press'}
      accessibilityLabel={loading ? loadingLabel : label}
      accessibilityState={{ busy: loading } as object}
      style={{
        height: 56,
        borderRadius: 28,
        backgroundColor: tone === 'danger' ? colors.danger : colors.brand,
        boxShadow: tone === 'danger' ? shadow.soft : shadow.brand,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        opacity: disabled && !loading ? 0.55 : 1,
      }}
    >
      {loading && <ActivityIndicator size="small" color={colors.white} />}
      <Text className="font-jk-semibold text-[16px] text-white">{loading ? loadingLabel : label}</Text>
    </PressableScale>
  );
}

/** White "Continue with Google" pill. */
export function GoogleButton({ onPress, loading, label = 'Continue with Google' }: { onPress: () => void; loading?: boolean; label?: string }) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={loading}
      accessibilityLabel={loading ? 'Connecting to Google' : label}
      style={{
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.card,
        boxShadow: shadow.card,
        borderWidth: 1.5,
        borderColor: colors.edge,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.brand} />
      ) : (
        <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sky }}>
          <Text className="font-jk-bold text-[14px] text-brand-deep">G</Text>
        </View>
      )}
      <Text className="font-jk-semibold text-[16px] text-ink">{loading ? 'Connecting…' : label}</Text>
    </PressableScale>
  );
}

export function OrDivider() {
  return (
    <View className="flex-row items-center gap-3" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
      <Text className="font-jk text-[12px] text-muted">or</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
    </View>
  );
}

/** Inline text button, e.g. "Forgot password?", "Create account". */
/** Shown under every Google button: signing up with Google means agreeing to the terms too. */
export function GoogleTermsNotice() {
  return (
    <Text className="text-center font-jk text-[12px] leading-[18px] text-muted">
      By continuing with Google you agree to the{' '}
      <Text className="font-jk-semibold text-brand-deep" onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} accessibilityRole="link">
        Terms
      </Text>{' '}
      and{' '}
      <Text className="font-jk-semibold text-brand-deep" onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} accessibilityRole="link">
        Privacy Policy
      </Text>
      .
    </Text>
  );
}

export function TextLink({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
  // The text is ~32 px tall; the extra touch area makes the tap target 44 px+ without moving anything.
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={label} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
      <Text suppressHighlighting className={`font-jk-semibold text-[14px] ${muted ? 'text-ink-soft' : 'text-brand-deep'}`} style={{ paddingVertical: 6 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** "Step 2 of 3" with three dots. */
export function StepDots({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <View className="flex-row items-center gap-2" accessibilityLabel={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ width: i + 1 === step ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i + 1 <= step ? colors.brand : colors.edge }} />
      ))}
      <Text className="ml-1 font-jk-semibold text-[12px] text-muted">
        Step {step} of {total}
      </Text>
    </View>
  );
}
