import { defineConfig, loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';

import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const hmrHost = env.VITE_HMR_HOST;
  const hmrPort = Number(env.VITE_HMR_PORT || 443);

  return {
    server: {
      host: '0.0.0.0',
      port: 3000,
      ...(hmrHost
        ? {
            allowedHosts: [hmrHost],
            hmr: {
              host: hmrHost,
              protocol: 'wss',
              clientPort: hmrPort,
              port: hmrPort,
            },
          }
        : {}),
    },
    plugins: [tsconfigPaths({ projects: ['./tsconfig.json'] }), tailwindcss(), tanstackStart(), viteReact()],
  };
});

export default config;
