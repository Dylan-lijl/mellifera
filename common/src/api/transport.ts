export interface ApiTransport {
    invoke<T>(
        path: string,
        args: readonly unknown[]
    ): Promise<T>
}