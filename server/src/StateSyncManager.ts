import {
    reactive,
    toRaw,
    watch,
} from '@vue/reactivity'

import type {
    StateData,
    StatePatch,
    StateChangeMessage,
    StateSnapshot,
} from '@mellifera/common/stateSync'

import { deepToRaw, logger } from '@/utils'
import appContext from '@/appContext'
import { createSyncState } from '@mellifera/common/factory'
import { syncChange } from '@mellifera/common/constant'

type StatePath = Array<string | number>

interface StateTriggerEvent {
    target: object
    type: string
    key?: unknown
    newValue?: unknown
    oldValue?: unknown
    oldTarget?: Map<unknown, unknown> | Set<unknown>
}

export class StateSyncManager {
    private revision = 0

    private readonly rawState: StateData

    private readonly state: StateData

    private readonly pending = new Map<string, StatePatch>()

    private flushPending = false

    private destroyed = false

    private readonly stopWatch: () => void

    constructor(initialState: StateData) {
        this.rawState = initialState
        this.state = reactive(initialState)

        this.stopWatch = watch(
            this.state,
            () => {},
            {
                deep: true,

                onTrigger: event => {
                    this.collectChange(
                        event as StateTriggerEvent,
                    )
                },
            },
        )
    }

    /**
     * 获取响应式状态。
     */
    getState(): StateData {
        return this.state
    }

    /**
     * 获取原始状态。
     */
    getRawState(): StateData {
        return this.rawState
    }

    /**
     * 获取完整状态快照。
     */
    getSnapshot(): StateSnapshot<StateData> {
        return {
            revision: this.revision,
            data: this.clone(this.state),
        }
    }

    /**
     * 销毁状态同步管理器。
     */
    destroy(): void {
        if (this.destroyed) {
            return
        }

        this.destroyed = true

        this.stopWatch()
        this.pending.clear()
    }

    /**
     * 收集状态变化。
     */
    private collectChange(event: StateTriggerEvent): void {
        if (this.destroyed) {
            return
        }

        const target = toRaw(event.target)

        const path = this.findPath(target)

        if (!path) {
            return
        }

        /*
         * Map 和 Set 的修改统一生成集合快照。
         *
         * Map:
         *   set / add / delete / clear
         *
         * Set:
         *   add / delete / clear
         *
         * 不再使用 target[key] 获取集合元素。
         */
        if (
            target instanceof Map ||
            target instanceof Set
        ) {
            this.collectCollectionChange(
                target,
                path,
            )

            return
        }

        /*
         * 普通对象和数组。
         */
        if (
            typeof event.key !== 'string' &&
            typeof event.key !== 'number'
        ) {
            return
        }

        const key = event.key

        const patchPath: StatePath = [
            ...path,
            key,
        ]

        let patch: StatePatch

        if (event.type === 'delete') {
            patch = {
                op: 'delete',
                path: patchPath,
            }
        } else {
            /*
             * 不直接依赖 event.newValue。
             *
             * Vue 的调试事件中，newValue 对不同操作的含义
             * 可能不同；从目标对象读取当前值更适合构造
             * 表示最终状态的补丁。
             */
            const currentTarget = target as Record<
                string | number,
                unknown
            >

            patch = {
                op: 'set',
                path: patchPath,
                value: this.clone(currentTarget[key]),
            }
        }

        this.addPending(patch)
    }

    /**
     * 收集 Map / Set 变化。
     *
     * 直接发送集合整体快照，避免集合内部操作
     * 被错误地解释成普通对象属性访问。
     */
    private collectCollectionChange(
        target: Map<unknown, unknown> | Set<unknown>,
        path: StatePath,
    ): void {
        const patch: StatePatch = {
            op: 'set',
            path,
            value: this.clone(target),
        }

        this.addPending(patch)
    }

    /**
     * 添加待发送补丁。
     *
     * 合并同一路径的变化，并处理父子路径冲突。
     */
    private addPending(patch: StatePatch): void {
        const key = this.stringifyPath(patch.path)

        /*
         * 同一路径只保留最终状态。
         */
        this.pending.set(key, patch)

        /*
         * 如果父路径被整体替换，则删除已收集的子路径补丁。
         *
         * 例如：
         *   set   ["connection"]
         *   set   ["connection", "host"]
         *
         * 父对象整体替换后，之前的子路径补丁已无意义。
         */
        if (patch.op === 'set') {
            for (const [pendingKey, pendingPatch] of this.pending) {
                if (
                    pendingKey !== key &&
                    this.isParentPath(
                        patch.path,
                        pendingPatch.path,
                    )
                ) {
                    this.pending.delete(pendingKey)
                }
            }
        }

        /*
         * 如果先替换父对象，再产生子属性变化，
         * 子属性补丁应该保留。
         *
         * Map / Set 的快照补丁也使用 set，
         * 所以这里不能简单地删除所有父路径补丁。
         */
        this.scheduleFlush()
    }

    /**
     * 判断 parent 是否为 child 的严格父路径。
     */
    private isParentPath(
        parent: StatePath,
        child: StatePath,
    ): boolean {
        if (parent.length >= child.length) {
            return false
        }

        return parent.every(
            (segment, index) => segment === child[index],
        )
    }

    /**
     * 通过状态树找到目标对象的路径。
     *
     * 支持：
     * - 普通对象
     * - 数组
     * - Map 的 value
     *
     * Set 中的元素没有稳定的路径标识，因此不遍历 Set
     * 内部元素。Set 自身的增删改仍通过集合快照同步。
     */
    private findPath(target: object): Array<string | number> | null {
        const rawTarget = toRaw(target);
        const visited = new WeakSet<object>();

        const search = (
            current: object,
            path: Array<string | number>
        ): Array<string | number> | null => {
            const raw = toRaw(current);

            if (raw === rawTarget) {
                return path;
            }

            if (visited.has(raw)) {
                return null;
            }

            visited.add(raw);

            // 遍历 Map 的值，路径中记录对应的 Map key
            if (raw instanceof Map) {
                for (const [key, value] of raw.entries()) {
                    if (
                        (typeof key !== 'string' && typeof key !== 'number') ||
                        value === null ||
                        typeof value !== 'object'
                    ) {
                        continue;
                    }

                    const result = search(value, [...path, key]);

                    if (result) {
                        return result;
                    }
                }

                return null;
            }

            // 普通对象和数组
            for (const key of Object.keys(raw)) {
                const value = (raw as Record<string, unknown>)[key];

                if (value !== null && typeof value === 'object') {
                    const result = search(value, [...path, key]);

                    if (result) {
                        return result;
                    }
                }
            }

            return null;
        };

        return search(this.state, []);
    }

    /**
     * 将路径转换为待发送补丁的索引键。
     */
    private stringifyPath(path: StatePath): string {
        return JSON.stringify(path)
    }

    /**
     * 安排异步批量发送。
     */
    private scheduleFlush(): void {
        if (
            this.destroyed ||
            this.flushPending
        ) {
            return
        }

        this.flushPending = true

        queueMicrotask(() => {
            this.flushPending = false

            if (this.destroyed) {
                return
            }

            this.flush()
        })
    }

    /**
     * 批量发送状态补丁。
     */
    private flush(): void {
        if (
            this.destroyed ||
            this.pending.size === 0
        ) {
            return
        }

        const window = appContext.getMainWindow()

        if (!window || window.isDestroyed()) {
            /*
             * 保留 pending，等待后续变化触发下一次 flush。
             *
             * 如果窗口关闭后不再发生状态变化，需要在窗口
             * 恢复可用时主动调用 scheduleFlush()。
             */
            return
        }

        const patches = [...this.pending.values()]

        const message: StateChangeMessage = {
            revision: this.revision + 1,
            patches,
        }

        try {
            window.webContents.send(
                syncChange,
                deepToRaw(message),
            )

            /*
             * 只有发送成功后才清理待发送补丁。
             */
            this.revision++
            this.removeSentPatches(patches)
        } catch (error) {
            logger.error(
                '[StateSyncManager] 广播失败',
                error,
            )
        }
    }

    /**
     * 只移除本次成功发送的补丁。
     *
     * 如果发送期间同一路径出现了新补丁，
     * 不应误删更新后的补丁。
     */
    private removeSentPatches(
        patches: StatePatch[],
    ): void {
        for (const patch of patches) {
            const key = this.stringifyPath(patch.path)

            if (this.pending.get(key) === patch) {
                this.pending.delete(key)
            }
        }
    }

    /**
     * 深拷贝状态数据。
     */
    private clone<T>(value: T): T {
        return structuredClone(
            deepToRaw(value),
        )
    }
}

export default new StateSyncManager(
    createSyncState(),
)