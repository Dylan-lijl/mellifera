import type { Channel } from './Channel'

export abstract class ChannelInitializer<
    T extends Channel<unknown> = Channel<unknown>,
> {
    abstract initChannel(channel: T): Promise<void> | void
}