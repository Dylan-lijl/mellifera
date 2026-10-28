export const RpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  Unauthorized: -32001,
  Timeout: -32002,
  ConnectionClosed: -32003,
} as const

export class RpcError extends Error {
  public readonly code: number
  public readonly data?: unknown
  constructor(
    code: number,
    message: string,
    data?: unknown,
  ) {
    super(message)
    this.name = 'RpcError'
    this.code = code
    this.data = data
  }

  toJSON() {
    return { code: this.code, message: this.message, ...(this.data === undefined ? {} : { data: this.data }) }
  }
}
