const { withAndroidManifest } = require('expo/config-plugins');

/** Resolve Expo Notifications / RNFirebase's duplicate default channel metadata. */
module.exports = function withFirebaseDefaultNotificationChannel(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';

    const application = manifest.application?.[0];
    if (!application) return config;

    application['meta-data'] = application['meta-data'] || [];
    let channelMetadata = application['meta-data'].find(
      (item) => item.$?.['android:name'] === 'com.google.firebase.messaging.default_notification_channel_id'
    );
    if (!channelMetadata) {
      channelMetadata = { $: { 'android:name': 'com.google.firebase.messaging.default_notification_channel_id' } };
      application['meta-data'].push(channelMetadata);
    }
    channelMetadata.$['android:value'] = 'default';
    channelMetadata.$['tools:replace'] = 'android:value';

    return config;
  });
};
