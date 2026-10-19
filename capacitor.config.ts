import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fashionhub.app',
  appName: 'FashionHub',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
