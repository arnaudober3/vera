import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {VitePWA} from "vite-plugin-pwa";
import {cloudflare} from "@cloudflare/vite-plugin";


// Minimal typing for the Node `process` global (config runs in Node), so we can
// read FUNCTIONS_TARGET without pulling in @types/node.
declare const process: { env: Record<string, string | undefined> }

// https://vite.dev/config/
export default defineConfig({
    server: {
        host: '0.0.0.0',
        // VirtioFS/gRPC-FUSE bind mounts on macOS Docker don't reliably forward
        // inotify events into the container, so file-watching needs polling.
        watch: {
            usePolling: true,
        },
        proxy: {
            '/api/huggingface': {
                target: 'https://router.huggingface.co',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/huggingface/, ''),
            },
            // Google Calendar OAuth backend runs as Cloudflare Pages Functions.
            // In dev they're served by `wrangler pages dev` on :8788; proxy the
            // /api/google/* routes there so the dev server keeps live-reload.
            // Target is configurable because the right host depends on where
            // Vite runs: on the host it's 127.0.0.1 (IPv4, not localhost — which
            // would resolve to IPv6 ::1 while wrangler binds IPv4 and 500 the
            // proxy); inside the Docker container 127.0.0.1 is the container, so
            // docker-compose sets FUNCTIONS_TARGET=http://host.docker.internal:8788
            // to reach wrangler running on the host.
            '/api/google': {
                target: process.env.FUNCTIONS_TARGET || 'http://127.0.0.1:8788',
                changeOrigin: true,
            },
        },
    },
    plugins: [cloudflare(), react(), VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectManifest: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        },
        manifest: {
            name: 'Vera, your personal stylist',
            short_name: 'Vera',
            start_url: '.',
            display: 'standalone',
            background_color: '#ffffff',
            theme_color: '#111827',
            icons: [{
                src: '/icon_192x192.png', sizes: '192x192', type: 'image/png'
            }, {
                src: '/icon_512x512.png', sizes: '512x512', type: 'image/png'
            }]
        }
    })]
})