import type { ConfigContext, ExpoConfig } from 'expo/config';

/** app.json, plus settings that come from the environment (.env.local or the build's env). */
export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  return {
    ...(config as ExpoConfig),
    plugins: [
      ...(config.plugins ?? []),
      // iOS returns from Google's sign-in through the reversed iOS client ID. Android needs no plugin.
      ...(iosClientId ? [['@react-native-google-signin/google-signin', { iosUrlScheme: reversedClientId(iosClientId) }] as [string, object]] : []),
    ],
  };
};

/** "1234-abc.apps.googleusercontent.com" → "com.googleusercontent.apps.1234-abc". */
function reversedClientId(clientId: string) {
  return clientId.split('.').reverse().join('.');
}
