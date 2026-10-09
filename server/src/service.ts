//接口实现
import system from "@/modules/system";
import {deleteData, getAll, getData, saveData} from "@/utils/Store";
import enhancer from "@/enhancer";
import {defineApiHandler, ApiDefinition,type ApiHandler} from '@mellifera/common/api'
import {isApiMethod, type ApiMethodNode, type WrapperName, type AnyMethod,} from "@mellifera/common/api/definition";

/**
 * 增强方法,根据定义的wrappers数组来包装目标方法
 *
 * @param definition
 * @param handlers
 */
function transformHandlers<T>(
    definition: T,
    handlers: ApiHandler<T>,
): ApiHandler<T> {
    if (isApiMethod(definition)) {
        // 此分支在递归遍历时处理叶子方法
        return enhanceHandler(
            handlers as unknown as AnyMethod,
            definition,
        ) as unknown as ApiHandler<T>;
    }
    if (
        typeof definition !== "object" ||
        definition === null
    ) {
        return handlers;
    }

    const result: Record<string, unknown> = {};
    const source = definition as Record<string, unknown>;
    const implementations = handlers as Record<string, unknown>;

    for (const key of Object.keys(source)) {
        result[key] = transformHandlers(
            source[key],
            implementations?.[key] as never,
        );
    }

    return result as ApiHandler<T>;
}
function enhanceHandler(
    handler: AnyMethod,
    api: ApiMethodNode,
): AnyMethod {
    let target = handler;
    const names: readonly WrapperName[] = api.wrappers ?? [];
    for (const name of names) {
        const wrapper = enhancer[name];
        if (wrapper) {
            target = wrapper(target);
        }
    }
    return target;
}
export default transformHandlers(ApiDefinition,
    defineApiHandler(ApiDefinition, {
        system,
        store: {
            saveData,
            getAll,
            getData,
            deleteData,
        },
        service: {}
    }));