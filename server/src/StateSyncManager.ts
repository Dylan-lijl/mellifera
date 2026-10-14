import {
    reactive,
    toRaw,
    watch
} from '@vue/reactivity';

import type {
    StateData,
    StatePatch,
    StateChangeMessage,
    StateSnapshot
} from '@mellifera/common/stateSync';
import {deepToRaw, logger} from "@/utils";
import appContext from "@/appContext";
import {createSyncState} from "@mellifera/common/factory";
import {syncChange} from "@mellifera/common/constant";

export class StateSyncManager {
    private revision = 0;

    private readonly rawState: StateData;
    private readonly state: StateData;

    private readonly pending = new Map<string, StatePatch>();

    private flushPending = false;

    private readonly stopWatch: () => void;

    constructor(initialState: StateData) {
        this.rawState = initialState;
        this.state = reactive(initialState);

        this.stopWatch = watch(
            this.state,
            () => {
            },
            {
                deep: true,
                onTrigger: (event) => {
                    this.collectChange(event);
                }
            }
        );
    }

    getState(): StateData {
        return this.state;
    }

    getRawState(): StateData {
        return this.rawState;
    }

    getSnapshot(): StateSnapshot<StateData> {
        return {
            revision: this.revision,
            data: this.clone(this.state)
        };
    }

    destroy(): void {
        this.stopWatch();
        this.pending.clear();
    }

    private collectChange(event: {
        target: object;
        type: string;
        key: unknown;
        newValue?: unknown;
    }): void {
        const path = this.findPath(event.target);

        if (!path || event.key === undefined) {
            return;
        }

        const key = event.key;

        if (typeof key !== 'string' && typeof key !== 'number') {
            return;
        }

        const patchPath = [...path, key];

        let patch: StatePatch;

        if (event.type === 'delete') {
            patch = {
                op: 'delete',
                path: patchPath
            };
        } else {
            const target = event.target as Record<
                string | number,
                unknown
            >;

            patch = {
                op: 'set',
                path: patchPath,
                value: this.clone(target[key])
            };
        }

        this.pending.set(JSON.stringify(patch.path), patch);
        this.scheduleFlush();
    }

    /**
     * 通过当前状态树找到被修改对象的路径。
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

            for (const key of Object.keys(raw)) {
                const value = (raw as Record<string, unknown>)[key];

                if (
                    value !== null &&
                    typeof value === 'object'
                ) {
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

    private scheduleFlush(): void {
        if (this.flushPending) {
            return;
        }

        this.flushPending = true;

        queueMicrotask(() => {
            this.flushPending = false;
            this.flush();
        });
    }

    private flush(): void {
        if (this.pending.size === 0 || !appContext.getMainWindow()) {
            return;
        }

        const patches = [...this.pending.values()];
        this.pending.clear();

        const message: StateChangeMessage = {
            revision: ++this.revision,
            patches
        };


        try {
            appContext.getMainWindow().webContents.send(syncChange, deepToRaw(message));
        } catch (error) {
            logger.error(
                '[StateSyncManager] 广播失败',
                error
            );
        }
    }

    private clone<T>(value: T): T {
        return structuredClone(deepToRaw(value));
    }

}

export default new StateSyncManager(createSyncState());