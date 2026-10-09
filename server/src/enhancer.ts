import {isPromise} from "node:util/types";
import util from "node:util";
import {type Result} from "@mellifera/common/Result"
import {type WrapperName} from "@mellifera/common/api/definition"
import {SYSTEM_ERROR, SUCCESS} from "@mellifera/common/ResultCode"
import {ResultApiException} from "@mellifera/common/CustomException"
import {logger} from "@/utils";

type Handler<T = any> = (...args: any[]) => T | Promise<T>;

/**
 * 包装成Result方法
 *
 * 将结果包装成Result
 * @param handler
 */
export function wrapperResultMethod<T>(handler: Handler<T>): Handler<Result<T>> {
    /**
     * 成功回调
     * @param value
     */
    const success = (value: any): Result<any> => {
        if (value && typeof value === "object" && typeof value.code === "number" && typeof value.message === "string") {
            return value as Result<T>;
        } else {
            return {...SUCCESS, data: value} as Result<T>;
        }
    };
    /**
     * 失败回调
     * @param e
     */
    const error = (e: any): Result<any> => {
        if (e instanceof ResultApiException) {
            return {...e.code};
        }
        if (e instanceof Error) {
            logger.warn(e);
            return {
                ...SYSTEM_ERROR,
                other: e.message
            };
        }
        return {...SYSTEM_ERROR};
    }
    return (_event, ...args) => {
        try {
            let result = handler(...args);
            if (isPromise(result)) {
                return result.then(success).catch(error);
            }
            return success(result);
        } catch (e) {
            return error(e);
        }
    };
}

/**
 * 日志
 * 根据级别和前后打印对应内容
 */
export function logMethod() {
    return <T>(handler: Handler<T>): Handler<T> => {
        return (...args) => {
            const start = Date.now();
            const now = new Date();
            const info = {
                time:
                    `${now.getFullYear()}-` +
                    `${String(now.getMonth() + 1).padStart(2, "0")}-` +
                    `${String(now.getDate()).padStart(2, "0")} ` +
                    `${String(now.getHours()).padStart(2, "0")}:` +
                    `${String(now.getMinutes()).padStart(2, "0")}:` +
                    `${String(now.getSeconds()).padStart(2, "0")}`,
                duration: 0,
                request: null as any,
                response: null as any,
                error: null as any,
            };
            info.request = args.length === 1 ? args[0] : args
            const finish = () => {
                info.duration = Date.now() - start;
                logger.log(
                    util.inspect(info, {
                        depth: null,
                        compact: true,
                        breakLength: Infinity,
                        colors: true,
                    })
                );
            };
            try {
                const result = handler(...args);
                if (isPromise(result)) {
                    return result
                        .then(res => {
                            info.response = res;
                            return res;
                        })
                        .catch(err => {
                            info.error = err;
                            throw err;
                        })
                        .finally(finish);
                }
                info.response = result;
                finish();
                return result;

            } catch (err) {
                info.error = err;
                finish();
                throw err;
            }
        };
    };
}

export default {
    resultWrapper: wrapperResultMethod,
    logWrapper: logMethod,
} satisfies Partial<Record<WrapperName, Handler>>