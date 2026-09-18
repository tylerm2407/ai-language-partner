/**
 * Raise Android's AsyncStorage ceiling.
 *
 * On Android all of AsyncStorage is one SQLite database, capped at 6 MB by
 * default (see node_modules/@react-native-async-storage/async-storage/android/
 * config.gradle). The read cache (lib/read-cache.ts) and offline packs
 * (lib/offline-packs.ts) both live there, and 6 MB is a few units and a couple
 * of books — after which every write fails silently and the learner's
 * downloads simply stop persisting.
 *
 * android/gradle.properties is checked in, so the property is also written
 * there; this plugin exists so `expo prebuild --clean`, which regenerates that
 * file from the template, cannot drop it again without anyone noticing.
 *
 * Payloads at or above READ_CACHE_OVERFLOW_BYTES are stored as files instead,
 * so what this database has to hold is many small entries, not book text. 64 MB
 * is headroom for those, not a target.
 */
const { withGradleProperties } = require('expo/config-plugins');

const PROPERTY = 'AsyncStorage_db_size_in_MB';
const SIZE_MB = '64';

module.exports = function withAsyncStorageDbSize(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key === PROPERTY),
    );
    cfg.modResults.push({
      type: 'comment',
      value: 'AsyncStorage database ceiling (default 6 MB). See plugins/withAsyncStorageDbSize.js.',
    });
    cfg.modResults.push({ type: 'property', key: PROPERTY, value: SIZE_MB });
    return cfg;
  });
};
