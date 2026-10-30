import {isReactive, isReadonly, toRaw} from "@vue/reactivity";
import {ResultApiException} from "@mellifera/common/CustomException";

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

export function extractErrorMessage(error: any): string | boolean {
    if (!error) return false
    if (error instanceof ResultApiException) {
        return joinString([error.code.message, error.code.other], {separator: ":"})
    }
    if (error instanceof Error) {
        return error.message
    }
    if (error?.code) {
        return joinString([error?.message, error?.other], {separator: ":"});
    }
    if (typeof error === 'string') {
        return error;
    } else if (typeof error === 'object') {
        return JSON.stringify(error)
    }
    return false;
}