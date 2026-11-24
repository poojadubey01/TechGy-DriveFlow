import { forwardRef, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';

import { colors, fonts, shadow } from '@/theme/tokens';

import type { TextInputRef } from './Form';

const LENGTH = 6;

type Props = {
  value: string;
  onChange: (code: string) => void;
  /** Called once all six digits are in (typed, pasted or autofilled). */
  onComplete?: (code: string) => void;
  error?: string | null;
  autoFocus?: boolean;
  label?: string;
};

/**
 * Six-box one-time-code field. One real (invisible) input sits over the boxes, so typing,
 * paste and SMS / email autofill all work, and a tap anywhere on the boxes opens the keyboard.
 */
export const CodeInput = forwardRef<TextInputRef, Props>(function CodeInput({ value, onChange, onComplete, error, autoFocus, label = 'Verification code' }, ref) {
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, LENGTH - 1);

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {Array.from({ length: LENGTH }, (_, i) => {
          const digit = value[i] ?? '';
          const isActive = focused && i === active;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: 58,
                borderRadius: 16,
                borderWidth: 1.5,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.card,
                boxShadow: shadow.soft,
                borderColor: error ? colors.danger : isActive ? colors.brand : digit ? colors.peri : colors.edge,
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 22, color: colors.ink, fontVariant: ['tabular-nums'] }}>{digit}</Text>
              {isActive && !digit ? <View style={{ position: 'absolute', width: 2, height: 22, borderRadius: 1, backgroundColor: colors.brand }} /> : null}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => {
          const code = t.replace(/\D/g, '').slice(0, LENGTH);
          onChange(code);
          if (code.length === LENGTH && code !== value) onComplete?.(code);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        inputMode="numeric"
        autoFocus={autoFocus}
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        textContentType="oneTimeCode"
        caretHidden
        contextMenuHidden={false}
        // The real input stays tappable but invisible: the boxes above show the digits.
        selectionColor="transparent"
        cursorColor="transparent"
        underlineColorAndroid="transparent"
        accessibilityLabel={label}
        accessibilityHint={error ?? `${LENGTH} digits`}
        style={[{ position: 'absolute', left: 0, top: 0, right: 0, height: 58, opacity: 0.01, color: 'transparent', fontSize: 1 }, { outlineStyle: 'none' } as object]}
      />
      {error ? (
        <Text className="mt-2 px-1 font-jk-medium text-[12px]" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
