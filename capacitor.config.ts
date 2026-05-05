import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.budget.timebudget',
  appName: 'Time Budget',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    // Honor light/dark via system; the web app already handles both via prefers-color-scheme.
    preferredContentMode: 'mobile',
    // Splash background — set to match the web's --bg dark.
    backgroundColor: '#0f1115',
  },
  plugins: {
    LocalNotifications: {
      // Default notification visuals for any iOS notification we schedule.
      iconColor: '#4f46e5',
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 600,
      backgroundColor: '#0f1115',
      // No image yet — add app icon work later when we have brand assets.
    },
  },
  // Override server URL for local dev hot-reload via the Vite dev server.
  // Toggle this with CAPACITOR_HOT_RELOAD=1 npm run cap:sync.
  // (Left commented for production builds.)
  // server: { url: 'http://localhost:5173', cleartext: true },
};

export default config;
