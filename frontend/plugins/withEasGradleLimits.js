const { withGradleProperties } = require('expo/config-plugins');

/**
 * EAS build machines (4 CPUs, 16 GB) run out of memory when Gradle compiles several native C++
 * libraries at once (Skia, Reanimated, expo-updates...): the build dies with "Gradle build daemon
 * disappeared unexpectedly". On EAS only, Gradle builds at most two modules at a time. Builds on
 * your own computer keep full speed.
 */
module.exports = function withEasGradleLimits(config) {
  if (process.env.EAS_BUILD !== 'true') return config;
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === 'org.gradle.workers.max'));
    props.push({ type: 'property', key: 'org.gradle.workers.max', value: '2' });
    cfg.modResults = props;
    return cfg;
  });
};
