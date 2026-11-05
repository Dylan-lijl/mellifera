import {Channel} from "./Channel";

export interface MessageChannel<T = Uint8Array> {
    send(message: T): Promise<void>

    onMessage(
        callback: (message: T) => void,
    ): () => void
}
export abstract class DatagramChannel extends Channel {
    abstract sendDatagram(
        data: Uint8Array,
    ): Promise<void>
}