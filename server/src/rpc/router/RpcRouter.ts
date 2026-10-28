
export type RpcHandler<TContext = unknown> = (
    params: unknown,
    context: TContext,
) => unknown | Promise<unknown>

export class RpcRouter<TContext = unknown> {
    private readonly routes = new Map<
        string,
        RpcHandler<TContext>
    >()

    register(method: string, handler: RpcHandler<TContext>) {
        if (!method.trim()) throw new Error('RPC method cannot be empty')
        if (this.routes.has(method)) throw new Error(`Duplicate RPC method: ${method}`)
        this.routes.set(method, handler)
    }

    has(method: string) {
        return this.routes.has(method)
    }

    listMethods() {
        return [...this.routes.keys()]
    }

    async dispatch(method: string, params: unknown, context: TContext,): Promise<unknown> {
        const handler = this.routes.get(method)
        if (!handler) {
            throw new Error(`RPC method not found: ${method}`)
        }
        return handler(params, context)
    }
}
