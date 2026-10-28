
import fs from 'node:fs'
import path from 'node:path'


export function rpcControllerTypes(
    options = {},
) {
    const clientDirOption =
        options.clientDir ?? 'src/rpc/controllers/client'

    const serverDirOption =
        options.serverDir ?? 'src/rpc/controllers/server'

    const outputOption =
        options.output ?? 'src/rpc/rpc-controller-types.d.ts'

    let config
    let clientDir = ''
    let serverDir = ''
    let outputPath = ''
    let generation
    function getControllerFiles(directory) {
        if (!fs.existsSync(directory)) {
            return []
        }

        return fs.readdirSync(directory, { withFileTypes: true })
            .filter(
                entry =>
                    entry.isFile() &&
                    /^.+Controller\.ts$/.test(entry.name),
            )
            .map(entry => entry.name)
            .sort()
    }

    function getImportPath(filePath) {
        let relative = path.relative(
            path.dirname(outputPath),
            filePath,
        )

        relative = relative
            .split(path.sep)
            .join('/')
            .replace(/\.ts$/, '')

        if (!relative.startsWith('.')) {
            relative = `./${relative}`
        }

        return relative
    }

    function createModuleInterface(
        interfaceName,
        side,
        directory,
    ) {
        const lines = [
            `export interface ${interfaceName} {`,
        ]

        for (const file of getControllerFiles(directory)) {
            const absoluteFile = path.join(directory, file)

            // 必须与 RpcClientFactory.ts 中的 glob 路径完全一致。
            const globKey =
                `../controllers/${side}/${file}`

            // import() 路径以生成的 d.ts 文件所在目录为基准。
            const importPath = getImportPath(absoluteFile)

            lines.push(
                `    '${globKey}': typeof import('${importPath}').default;`,
            )
        }

        lines.push('}')

        return lines
    }

    async function generateTypes(){
        console.log('[rpc-types] generateTypes 开始')
        console.log('[rpc-types] client files:', getControllerFiles(clientDir))
        console.log('[rpc-types] server files:', getControllerFiles(serverDir))
        if (generation) {
            await generation
            return
        }

        generation = (async () => {
            const lines = [
                '// 自动生成的 RPC 控制器类型，请勿手动修改。',
                '',
                ...createModuleInterface(
                    'ClientControllerModules',
                    'client',
                    clientDir,
                ),
                '',
                ...createModuleInterface(
                    'ServerControllerModules',
                    'server',
                    serverDir,
                ),
                '',
            ]

            const content = lines.join('\n')

            fs.mkdirSync(path.dirname(outputPath), {
                recursive: true,
            })

            if (
                !fs.existsSync(outputPath) ||
                fs.readFileSync(outputPath, 'utf8') !== content
            ) {
                fs.writeFileSync(outputPath, content, 'utf8')
                console.log('[rpc-controller-types] 类型声明已更新')
            }
        })()

        try {
            await generation
        } finally {
            generation = undefined
        }
    }

    function isControllerFile(filePath) {
        const absolutePath = path.resolve(filePath)

        const inClient =
            absolutePath.startsWith(clientDir + path.sep)

        const inServer =
            absolutePath.startsWith(serverDir + path.sep)

        return (
            (inClient || inServer) &&
            /^.+Controller\.ts$/.test(path.basename(absolutePath))
        )
    }

    function watchControllers(server) {
        server.watcher.add([clientDir, serverDir])

        const handleFileChange = (filePath) => {
            if (isControllerFile(filePath)) {
                void generateTypes().catch(error => {
                    console.error(
                        '[rpc-controller-types] 生成类型失败',
                        error,
                    )
                })
            }
        }

        server.watcher.on('add', handleFileChange)
        server.watcher.on('unlink', handleFileChange)
    }

    return {
        name: 'rpc-controller-types',

        configResolved(resolvedConfig) {
            config = resolvedConfig

            clientDir = path.resolve(
                config.root,
                clientDirOption,
            )

            serverDir = path.resolve(
                config.root,
                serverDirOption,
            )

            outputPath = path.resolve(
                config.root,
                outputOption,
            )
            console.log('[rpc-types] root:', config.root)
            console.log('[rpc-types] clientDir:', clientDir)
            console.log('[rpc-types] serverDir:', serverDir)
            console.log('[rpc-types] outputPath:', outputPath)
        },

        async buildStart() {
            console.log('[rpc-types] buildStart')
            await generateTypes()
        },

        configureServer(server) {
            console.log('[rpc-types] configureServer')
            watchControllers(server)

            void generateTypes().catch(error => {
                console.error(
                    '[rpc-controller-types] 初始化生成失败',
                    error,
                )
            })
        },
    }
}
