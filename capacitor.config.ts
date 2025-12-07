import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aicamera.app',
  appName: 'AI Camera App',
  webDir: 'www',
  server: {
    androidScheme: "http"
  },
};

export default config;
