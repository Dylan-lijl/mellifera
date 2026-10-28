export interface RpcTransport {
  send(data: string): void
  onMessage(listener: (data: string) => void): () => void
  onClose(listener: (reason?: Error) => void): () => void
  onError(listener: (error: Error) => void): () => void
  close(code?: number, reason?: string): void
  readonly isOpen: boolean
  connect():Promise<void>
}
