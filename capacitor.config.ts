import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.pharmaverify.app',
  appName: 'PharmaVerify',
  webDir: 'out',
  server: {
    // Replace this with your actual Vercel URL!
    url: 'https://your-app-name.vercel.app',
    cleartext: true
  }
};

export default config;
