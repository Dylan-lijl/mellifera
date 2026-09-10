import {defineConfig} from 'electron-vite'
import {resolve} from 'path'

const alias = {
    '@app/common': resolve(__dirname, '../common/src'),
    '@': resolve(__dirname, 'src'),
}

const outDir = resolve(__dirname, 'dist-electron')

export default defineConfig((_config) => {
    return {
        main: {
            electron: {
                path: 'desktop/node_modules/electron'
            },
            build: {
                externalizeDeps: true,
                outDir,
                emptyOutDir: true,
                rollupOptions: {
                    input: resolve(__dirname, 'src/main.ts'),
                    output: {
                        entryFileNames: 'main.js',
                    }
                }
            },
            resolve: {alias}
        },
        preload: {
            build: {
                externalizeDeps: true,
                outDir,
                emptyOutDir: false,
                rollupOptions: {
                    input: resolve(__dirname, 'src/preload.ts'),
                    output: {
                        format: 'cjs',
                        entryFileNames: 'preload.js'
                    }
                }
            },
            resolve: {alias}
        },
    }
})