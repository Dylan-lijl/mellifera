import type {Plugin} from 'vite';
import fs from 'fs';
import path from 'path';
import {createJiti} from 'jiti';
import * as os from "node:os";

const jiti = createJiti(import.meta.url);

export default function vitePluginComponentName(): Plugin {
    return {
        name: 'vite-plugin-component-name',
        enforce: 'pre',
        async transform(code, id) {
            // 仅处理 views 目录下的 index.vue
            if (id.endsWith('index.vue') && id.includes('src/views')) {
                const dir = path.dirname(id);
                const parentDirName = path.basename(dir);
                const metadataPath = path.join(dir, 'metadata.ts');

                let componentName = parentDirName;

                if (fs.existsSync(metadataPath)) {
                    let tempFile: string | undefined;

                    try {
                        let source = fs.readFileSync(metadataPath, "utf8");
                        source = source.replace(
                            /^\s*import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm,
                            ""
                        ).replace(
                            /icon\s*:\s*[A-Za-z_$][\w$]*/g,
                            "icon: undefined"
                        );;
                        tempFile = path.join(
                            os.tmpdir(),
                            `metadata-${Date.now()}-${Math.random()}.ts`
                        );
                        fs.writeFileSync(tempFile, source);

                        const metadata = await jiti.import(tempFile) as any;

                        const config = metadata.default?.config ?? metadata.config;

                        if (config?.name) {
                            componentName =
                                typeof config.name === "function"
                                    ? config.name()
                                    : config.name;
                        }
                    } catch (e) {
                        console.error(`[VitePlugin] 无法解析元数据: ${metadataPath}`, e);
                    } finally {
                        if (tempFile && fs.existsSync(tempFile)) {
                            fs.unlinkSync(tempFile);
                        }
                    }
                }

                // 注入 script 块
                // 注意：这里必须显式 export，Vue 会在编译时将其与 <script setup> 合并
                const injectCode = `
<script lang="ts">
  export default {
    name: '${componentName}'
  };
</script>
`;
                return {
                    code: injectCode + code,
                    map: null
                };
            }
        }
    };
}