export type RpcId = string

export interface RpcRequest {
  jsonrpc: '2.0'
  id: RpcId
  method: string
  params?: unknown
}

export interface RpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

export interface RpcSuccessResponse {
  jsonrpc: '2.0'
  id: RpcId
  result: unknown
}

export interface RpcFailureResponse {
  jsonrpc: '2.0'
  id: RpcId | null
  error: {
    code: number
    message: string
    data?: unknown
  }
}

export type RpcResponse = RpcSuccessResponse | RpcFailureResponse
export type RpcMessage = RpcRequest | RpcNotification | RpcResponse

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isRpcMessage(value: unknown): value is RpcMessage {
  if (!isRecord(value) || value.jsonrpc !== '2.0') return false

  if ('method' in value) {
    return typeof value.method === 'string'
      && (!('id' in value) || typeof value.id === 'string')
  }

  if ('id' in value && ('result' in value || 'error' in value)) {
    return typeof value.id === 'string'
      || value.id === null
  }

  return false
}
