import type {QuicSession} from 'node:quic'

import {DatagramChannel} from "../core/MessageChannel";

// @ts-ignore
export class QuicDatagramChannel extends DatagramChannel {
    private readonly previousOnDatagram: typeof this.session.ondatagram

    private readonly previousOnDatagramStatus:
        typeof this.session.ondatagramstatus

    private readonly handleDatagram:
        NonNullable<typeof this.session.ondatagram>

    private readonly handleDatagramStatus:
        NonNullable<typeof this.session.ondatagramstatus>
    private readonly session: QuicSession

    constructor(
        session: QuicSession,
    ) {
        super()
        this.session = session;
        this.previousOnDatagram = session.ondatagram
        this.previousOnDatagramStatus = session.ondatagramstatus
        this.handleDatagram = (datagram, early) => {
            this.previousOnDatagram?.call(session, datagram, early)
            void this.receiveDatagram(datagram)
        }

        this.handleDatagramStatus = (...args) => {
            this.previousOnDatagramStatus?.apply(session, args)
        }

        session.ondatagram = this.handleDatagram
        session.ondatagramstatus = this.handleDatagramStatus
    }

    protected writeRaw(data: unknown): Promise<void> {
        if (!(data instanceof Uint8Array)) {
            return Promise.reject(
                new TypeError('Datagram payload must be Uint8Array'),
            )
        }

        try {
            this.session.sendDatagram(data)
            return Promise.resolve()
        } catch (error) {
            return Promise.reject(error)
        }
    }

    async sendDatagram(data: Uint8Array): Promise<void> {
        return this.write(data)
    }

    private async receiveDatagram(
        data: Uint8Array,
    ): Promise<void> {
        if (!this.active) return

        try {
            await this.pipeline.fireChannelRead(data)
        } catch (error) {
            await this.reportError(this.toError(error))
        }
    }

    protected async closeTransport(): Promise<void> {
        if (this.session.ondatagram === this.handleDatagram) {
            this.session.ondatagram = this.previousOnDatagram
        }

        if (
            this.session.ondatagramstatus ===
            this.handleDatagramStatus
        ) {
            this.session.ondatagramstatus =
                this.previousOnDatagramStatus
        }
    }

    private toError(error: unknown): Error {
        return error instanceof Error
            ? error
            : new Error(String(error))
    }
}