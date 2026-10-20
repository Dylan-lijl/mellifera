import {isReactive, isReadonly, toRaw} from "@vue/reactivity";
import type {MessageApiInjection} from "naive-ui/es/message/src/MessageProvider";

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

interface JoinStringConfig {
    separator?: string
}

export function joinString(
    args: (string | null | undefined)[],
    config: JoinStringConfig = {},
): string {
    return args
        .filter((item): item is string => typeof item === 'string' && item !== '')
        .join(config.separator ?? '')
}
/**
 * 将时间转换为 yyyy-MM-dd HH:mm:ss 格式
 *
 * @param value ISO 时间字符串、时间戳或 Date 对象
 * @returns 格式化后的本地时间；无效值返回空字符串
 */
export function formatDateTime(
    value: string | number | Date | null | undefined,
): string {
    if (value == null || value === '') return ''

    const date = value instanceof Date
        ? value
        : new Date(value)

    if (Number.isNaN(date.getTime())) return ''

    const pad = (n: number) => String(n).padStart(2, '0')

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
export function showError(message: MessageApiInjection, error: any) {
    if (!error) return false
    const text = error?.code
        ? joinString([error?.message, error?.other], {separator: ":"})
        : String(error)
    message.error(text)
    return false;
}