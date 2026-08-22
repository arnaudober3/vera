import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {VitePWA} from "vite-plugin-pwa";

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
        },
    },
    plugins: [react(), VitePWA({
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