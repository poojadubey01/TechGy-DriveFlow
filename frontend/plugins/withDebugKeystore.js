const fs = require('node:fs');
const path = require('node:path');

const { withDangerousMod } = require('expo/config-plugins');

/**
 * Signs Android debug builds with DriveFlow's own key (keystores/debug.keystore) instead of the
 * default React Native one. Google sign-in matches the app by package name + SHA-1, and Google
 * lets each pair live in one Cloud project only, so the app needs a key of its own.
 * The key has the default debug passwords ("android" / alias "androiddebugkey"), so the
 * generated build.gradle uses it as is. It only signs debug builds; store builds use EAS's key.
 */
module.exports = function withDebugKeystore(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const from = path.join(cfg.modRequest.projectRoot, 'keystores', 'debug.keystore');
      const to = path.join(cfg.modRequest.platformProjectRoot, 'app', 'debug.keystore');
      fs.copyFileSync(from, to);
      return cfg;
    },
  ]);
};
