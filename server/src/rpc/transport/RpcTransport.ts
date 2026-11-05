export interface RpcTransport {
  readonly isOpen: boolean

  onMessage(callback: (data: string) => void): () => void

  onClose(callback: (reason?: Error) => void): () => void

  onError(callback: (error: Error) => void): () => void

  send(data: string): Promise<void>

  close(): void
}

export interface RpcConnectableTransport extends RpcTransport {
  connect(): Promise<void>
}