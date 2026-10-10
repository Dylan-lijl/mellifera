import {isReactive, isReadonly, toRaw} from "@vue/reactivity";

export function deepToRaw<T>(value: T): T {
    if (isReactive(value) || isReadonly(value)) {
        value = toRaw(value);
    }

    if (Array.isArray(value)) {
        return value.map(item => deepToRaw(item)) as T;
    }

    if (value instanceof Map) {
        const result = new Map();

        for (const [key, item] of value) {
            result.set(
                deepToRaw(key),
                deepToRaw(item)
            );
        }

        return result as T;
    }

    if (value instanceof Set) {
        const result = new Set();

        for (const item of value) {
            result.add(deepToRaw(item));
        }

        return result as T;
    }

    if (value !== null && typeof value === "object") {
        const result: Record<PropertyKey, unknown> = {};

        for (const key of Reflect.ownKeys(value)) {
            result[key] = deepToRaw(
                (value as Record<PropertyKey, unknown>)[key]
            );
        }

        return result as T;
    }

    return value;
}