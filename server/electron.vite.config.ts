import {defineConfig} from 'electron-vite'
import {resolve} from 'path'
import {loadEnv} from "vite";

const alias = {
    '@': resolve(__dirname, 'src'),
}

const outDir = resolve(__dirname, 'dist-electron')

export default defineConfig(({mode}) => {
    Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
    return {
        main: {
            electron: {
                path: 'desktop/node_modules/electron'
            },
            build: {
                externalizeDeps: true,
                outDir,
                emptyOutDir: true,
                sourcemap: true,
                rolldownOptions: {
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
                externalizeDeps: false,
                outDir,
                emptyOutDir: false,
                rolldownOptions: {
                    input: resolve(__dirname, 'src/preload.ts'),
                    output: {
                        format: 'cjs',
                        entryFileNames: 'preload.js'
                    },
                },
            },
            resolve: {alias}
        },
    }
})