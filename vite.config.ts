import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {VitePWA} from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
    server: {
        proxy: {
            '/api/huggingface': {
                target: 'https://router.huggingface.co',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/huggingface/, ''),
            },
        },
    },
    plugins: [react(), VitePWA({
        registerType: 'autoUpdate', manifest: {
            name: 'Vera, your personal stylist',
            short_name: 'Vera',
            start_url: '.',
            display: 'standalone',
            background_color: '#ffffff',
            theme_color: '#111827',
            icons: [{
                src: '/icon-192.png', sizes: '192x192', type: 'image/png'
            }, {
                src: '/icon-512.png', sizes: '512x512', type: 'image/png'
            }]
        }
    })]
})
