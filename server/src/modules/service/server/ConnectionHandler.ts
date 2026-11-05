import type {QuicSession, QuicStream} from 'node:quic';
import type {ConnectionTypeType} from '@mellifera/common/constant';

export interface AuthRequest {
    type: ConnectionTypeType;
    token: string;
}

export interface ConnectionContext {
    session: QuicSession;
    stream: QuicStream;
    auth: AuthRequest;
    initialData: Uint8Array;
}

export interface ConnectionHandler {
    handle(context: ConnectionContext): Promise<void> | void;
}