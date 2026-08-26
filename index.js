/**
 * App entry point.
 *
 * This file exists only so react-native-track-player's playback service can be
 * registered BEFORE the React tree starts. RNTP requires the registration to
 * happen at module scope in the app's entry — it is what Android's foreground
 * media service and the iOS lock-screen remote controls dispatch into, and
 * both can fire while no component is mounted (the app backgrounded, or killed
 * and relaunched by a lock-screen button). Registering it inside a component
 * would mean the controls do nothing in exactly the situations they exist for.
 *
 * Everything else still comes from expo-router; `package.json` main points here
 * instead of `expo-router/entry`, and this file hands straight back to it.
 */
import TrackPlayer from 'react-native-track-player';

import { PlaybackService } from './lib/news-playback-service';

TrackPlayer.registerPlaybackService(() => PlaybackService);

// `require`, not `import`: ES imports are HOISTED, so an `import` here would
// evaluate expo-router's entry — and start the app — before the registration
// above ever ran. The service must be registered first, so this one has to be
// a runtime call rather than a static import.
require('expo-router/entry');
