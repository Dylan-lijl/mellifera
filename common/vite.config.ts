import {defineConfig} from "vite";
import {resolve} from "node:path";

const src = resolve(import.meta.dirname, "src");

export default defineConfig({
    build: {
        outDir: "dist",
        emptyOutDir: true,
        lib: {
            entry: {
                index: resolve(src, "index.ts"),
                constant: resolve(src, "constant.ts"),
                types: resolve(src, "types.ts"),
                Result: resolve(src, "Result.ts"),
                ResultCode: resolve(src, "ResultCode.ts"),
                CustomException: resolve(src, "CustomException.ts"),
                factory: resolve(src, "factory.ts"),
                stateSync: resolve(src, "stateSync.ts"),
                util: resolve(src, "util.ts"),
                "api/index": resolve(src, "api/index.ts"),
                "api/definition": resolve(src, "api/definition.ts"),
                "entity/index": resolve(src, "entity/index.ts"),
            },
            formats: ["es"],
            fileName: (_format, entryName) => `${entryName}.js`,
        },
    },
});
