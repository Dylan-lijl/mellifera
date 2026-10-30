import type {
    MappingListener,
    MappingListenerConfig,
    MappingListenerStartResult,
} from '@/types'
import transportListeners from "./listeners";
import {runState, type RunStateType} from "@mellifera/common/constant";


/**
 * 映射监听信息。
 */
export interface MappingListenerInfo {
    id: MappingListenerConfig['id']
    clientId: MappingListenerConfig['clientId']
    state: RunStateType
    actualPort: number | null
}

/**
 * 管理器内部记录。
 */
interface MappingListenerEntry {
    config: MappingListenerConfig
    listener: MappingListener
    state: RunStateType
    actualPort: number | null
    startPromise: Promise<MappingListenerStartResult>
    stopPromise?: Promise<void>
}

/**
 * 映射监听生命周期管理器。
 *
 * 职责：
 * 1. 创建和启动监听器。
 * 2. 防止同一映射重复启动。
 * 3. 停止监听器并清理资源。
 * 4. 管理动态端口。
 * 5. 处理启动和停止过程中的异常。
 *
 * 不负责：
 * 1. 客户端身份认证。
 * 2. 数据库查询。
 * 3. TCP/UDP 数据转发的具体实现。
 */
export class MappingListenerManager {
    /**
     * 以映射 ID 为键管理监听实例。
     */
    private readonly listeners = new Map<number, MappingListenerEntry>()

    /**
     * 启动一个映射监听。
     *
     * 同一 mappingId 重复调用时，不会重复创建监听器。
     */
    async start(
        config: MappingListenerConfig,
    ): Promise<MappingListenerInfo> {
        this.validateConfig(config)

        const existing = this.listeners.get(config.id)

        if (existing) {
            // 正在停止的监听器不能直接复用。
            if (existing.state === runState.stopping.value) {
                await existing.stopPromise
                return this.start(config)
            }

            // 如果正在启动，则等待首次启动完成。
            await existing.startPromise

            // 启动期间可能被其他调用停止。
            if (this.listeners.get(config.id) !== existing) {
                return this.start(config)
            }

            // 已经启动，不重复绑定端口。
            return this.toInfo(existing)
        }

        const listener = transportListeners[config.protocol]
        if (!listener) {
            throw new Error("No listener listener found for config");
        }
        const entry: MappingListenerEntry = {
            config: {...config},
            listener: new listener(config),
            state: runState.starting.value,
            actualPort: null,
            // 先占据 mappingId，再异步启动，避免并发重复启动。
            startPromise: Promise.resolve({listenPort: config.listenPort}),
        }

        this.listeners.set(config.id, entry)

        entry.startPromise = this.startEntry(entry)

        try {
            await entry.startPromise
            return this.toInfo(entry)
        } catch (error) {
            // 失败时只清理当前实例，避免误删后来创建的实例。
            if (this.listeners.get(config.id) === entry) {
                this.listeners.delete(config.id)
            }

            throw error
        }
    }

    /**
     * 启动指定监听器。
     */
    private async startEntry(
        entry: MappingListenerEntry,
    ): Promise<MappingListenerStartResult> {
        try {
            const result = await entry.listener.start()
            this.validateActualPort(result.listenPort)
            entry.actualPort = result.listenPort
            entry.state = runState.running.value
            return result
        } catch (error) {
            // start 失败时，尝试释放监听器可能已经创建的资源。
            entry.state = runState.stopping.value;
            try {
                await entry.listener.stop()
            } catch (cleanupError) {
                console.error(
                    `[MappingListenerManager] 清理启动失败的监听器时发生异常，mappingId=${entry.config.id}`,
                    cleanupError,
                )
            }
            entry.state = runState.idle.value;
            throw error
        }
    }

    /**
     * 停止指定映射。
     *
     * 如果映射正在启动，则先等待启动过程结束，再执行停止。
     */
    async stop(mappingId: number): Promise<boolean> {
        const entry = this.listeners.get(mappingId)

        if (!entry) {
            return false
        }

        if (entry.stopPromise) {
            await entry.stopPromise
            return true
        }

        entry.state = runState.stopping.value

        entry.stopPromise = (async () => {
            try {
                // 即使启动失败，也要继续执行清理逻辑。
                try {
                    await entry.startPromise
                } catch {
                    // 启动失败已经由 start() 处理。
                }
                await entry.listener.stop()
            } finally {
                // 只删除当前实例，避免误删同 ID 的新实例。
                if (this.listeners.get(mappingId) === entry) {
                    this.listeners.delete(mappingId)
                }
                entry.state = runState.idle.value
            }
        })()

        await entry.stopPromise

        return true
    }

    /**
     * 停止全部监听器。
     *
     * 单个监听器停止失败，不影响其他监听器的停止操作。
     */
    async stopAll(): Promise<void> {
        const results = await Promise.allSettled(
            [...this.listeners.keys()].map(mappingId => this.stop(mappingId)),
        )

        const errors = results
            .filter(
                (result): result is PromiseRejectedResult =>
                    result.status === 'rejected',
            )
            .map(result => result.reason)

        if (errors.length > 0) {
            throw new AggregateError(
                errors,
                '停止部分映射监听器失败',
            )
        }
    }

    /**
     * 查询指定映射的监听状态。
     */
    get(mappingId: number): MappingListenerInfo | undefined {
        const entry = this.listeners.get(mappingId)

        return entry ? this.toInfo(entry) : undefined
    }

    /**
     * 查询全部监听状态。
     */
    list(): MappingListenerInfo[] {
        return [...this.listeners.values()].map(entry => this.toInfo(entry))
    }

    /**
     * 判断映射是否正在管理中。
     */
    has(mappingId: number): boolean {
        return this.listeners.has(mappingId)
    }

    /**
     * 获取正在管理的监听器数量。
     */
    get size(): number {
        return this.listeners.size
    }

    private toInfo(entry: MappingListenerEntry): MappingListenerInfo {
        return {
            id: entry.config.id,
            clientId: entry.config.id,
            state: entry.state,
            actualPort: entry.actualPort,
        }
    }

    private validateConfig(config: MappingListenerConfig): void {
        if (!Number.isSafeInteger(config.id) || config.id <= 0) {
            throw new Error('mappingId 必须是正整数')
        }

        if (
            !Number.isInteger(config.listenPort)
            || config.listenPort < 0
            || config.listenPort > 65535
        ) {
            throw new Error('listenPort 必须在 0–65535 之间')
        }

        if (
            !Number.isInteger(config.targetPort)
            || config.targetPort < 1
            || config.targetPort > 65535
        ) {
            throw new Error('targetPort 必须在 1–65535 之间')
        }

        if (!config.targetHost.trim()) {
            throw new Error('targetHost 不能为空')
        }
    }

    private validateActualPort(port: number): void {
        if (
            !Number.isInteger(port)
            || port < 1
            || port > 65535
        ) {
            throw new Error(`监听器返回了无效的实际端口：${port}`)
        }
    }
}