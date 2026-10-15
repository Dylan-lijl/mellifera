export interface ResultCode {
    code: number;
    message: string;
}

export const SUCCESS: ResultCode = {code: 200, message: "成功"} as const;
export const PARAMETER_ERROR: ResultCode = {code: 400, message: "参数错误!"} as const;
export const SYSTEM_ERROR: ResultCode = {code: 500, message: "系统错误"} as const;
export const DATA_EMPTY_EXCEPTION: ResultCode = {code: 600, message: "数据为空!"} as const;
export const DATA_ALREADY_EXISTS_EXCEPTION: ResultCode = {code: 601, message: "数据已存在!"} as const;
export const ID_NOT_EXIST_EXCEPTION: ResultCode = {code: 602, message: "ID对应的数据不存在!"} as const;
export const DATA_NOT_FOUND_EXCEPTION: ResultCode = {code: 603, message: "数据不存在!"} as const;
export const ADD_DATA_EXCEPTION: ResultCode = {code: 604, message: "添加失败!"} as const;
export const UPDATE_DATA_EXCEPTION: ResultCode = {code: 605, message: "更新失败!"} as const;
export const DIRECTORY_NOT_EXIST: ResultCode = {code: 606, message: "文件夹不存在!"} as const;
export const EXCEPTION: ResultCode = {code: 800, message: "业务异常!"} as const;
export const FAILED_TO_START: ResultCode = {code: 801, message: "启动服务失败!"} as const;
export const FAILED_TO_STOP: ResultCode = {code: 802, message: "停止服务失败!"} as const;
export const INVALID_PORT: ResultCode = {code: 803, message: "无效端口!"} as const;

export function isSuccess(code: undefined | null | number) {
    if (!code) {
        return false;
    }
    return code <= SUCCESS.code && code < 300;
}