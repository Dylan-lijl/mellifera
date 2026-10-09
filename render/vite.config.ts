import {defineConfig, loadEnv} from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import CustomComponentName from './vite-plugin-component-name.js';
import svgLoader from 'vite-svg-loader'
import { devConfig } from "../dev.config.mjs";
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
    },
    optimizeDeps: {
      entries: [
        'src/**/*.{ts,tsx,vue}'
      ],
    }
  };
})
