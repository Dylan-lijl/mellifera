import {defineConfig, loadEnv} from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import CustomComponentName from './vite-plugin-component-name.js';
import svgLoader from 'vite-svg-loader'
import {devConfig} from "../dev.config.mjs";
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import {NaiveUiResolver} from 'unplugin-vue-components/resolvers'
// 💡 动态扫描 Element Plus 所有的样式组件入口
// https://vite.dev/config/
export default defineConfig(({mode}) => {
    const env = loadEnv(mode, process.cwd());
    return {
        base: './',
        plugins: [
            CustomComponentName(),
            vue(),
            svgLoader(),
            AutoImport({
                imports: ['vue', 'vue-router', 'pinia'],
                dts: 'src/types/auto-imports.d.ts',
            }),
            Components({
                resolvers: [NaiveUiResolver()],
                dts: 'src/types/components.d.ts',
            }),
        ],
        resolve: {
            extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
            alias: {
                '@': path.resolve(import.meta.dirname, "src"),
            }
        },
        server: {
            host: devConfig.host || 'localhost',
            port: devConfig.port || 5173,
            strictPort: true,
        },
        build: {
            emptyOutDir: false,
            sourcemap: true,
        },
        optimizeDeps: {
            entries: [
                'src/**/*.{ts,tsx,vue}'
            ],
        }
    };
})
