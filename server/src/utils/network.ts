import type {ContextAware, NetworkContext} from "@/types/network";
import type {Constructor} from "@/network/client/TcpAndUdpBootstrap";


export interface RpcMethodDefinition {
    name: string
    methodName: string
    handler: (...args: any[]) => any,
    metadata: RpcMethodOptions
}

export const PROTOCOL = {
    MAGIC: 0x5a5a,
    HEADER_LENGTH: 16,
    PATH_LENGTH_SIZE: 2,
    MAX_PATH_LENGTH: 1024,
    MAX_PAYLOAD_LENGTH: 1024 * 1024,
    DEFAULT_VERSION: 0x01,
    FLAGS: {
        NEED_ACK: 0x01,
        COMPRESSED: 0x02,
        FRAGMENTED: 0x04,
    },
} as const

export function encodeFrame(frame: ProtocolFrame): Buffer {
    const payload = frame.payload ?? Buffer.alloc(0)
    const path = Buffer.from(frame.path ?? '', 'utf8')

    if (path.length > PROTOCOL.MAX_PATH_LENGTH) {
        throw new Error(`Path 长度超出上限: ${path.length}`)
    }

    if (payload.length > PROTOCOL.MAX_PAYLOAD_LENGTH) {
        throw new Error(`Payload 长度超出上限: ${payload.length}`)
    }

    const version = frame.version ?? PROTOCOL.DEFAULT_VERSION
    const flags = frame.flags ?? 0

    const totalLength =
        PROTOCOL.HEADER_LENGTH +
        PROTOCOL.PATH_LENGTH_SIZE +
        path.length +
        payload.length

    const buf = Buffer.allocUnsafe(totalLength)

    buf.writeUInt16BE(PROTOCOL.MAGIC, 0)
    buf.writeUInt8(version & 0xff, 2)
    buf.writeUInt8(flags & 0xff, 3)
    buf.writeUInt16BE(frame.cmd, 4)
    buf.writeUInt32BE(frame.seq >>> 0, 6)
    buf.writeUInt32BE(payload.length, 10)

    // Path 长度及内容
    buf.writeUInt16BE(path.length, 16)
    path.copy(buf, 18)

    // Payload
    payload.copy(buf, 18 + path.length)

    // 校验覆盖 version 到帧末尾
    const checksum = crc16Ccitt(buf,  totalLength)
    buf.writeUInt16BE(checksum, 14)

    return buf
}

/**
 * 解码单个 UDP 数据报；无效或损坏报文返回 null
 */
export function decodeUdpFrame(datagram: Buffer): ProtocolFrame | null {
    const minLength =
        PROTOCOL.HEADER_LENGTH + PROTOCOL.PATH_LENGTH_SIZE

    if (!Buffer.isBuffer(datagram) || datagram.length < minLength) {
        return null
    }

    if (datagram.readUInt16BE(0) !== PROTOCOL.MAGIC) {
        return null
    }

    const version = datagram.readUInt8(2)
    const flags = datagram.readUInt8(3)
    const cmd = datagram.readUInt16BE(4) as CMDType
    const seq = datagram.readUInt32BE(6)
    const payloadLength = datagram.readUInt32BE(10)

    const pathLength = datagram.readUInt16BE(16)

    if (pathLength > PROTOCOL.MAX_PATH_LENGTH) {
        return null
    }

    if (payloadLength > PROTOCOL.MAX_PAYLOAD_LENGTH) {
        return null
    }

    const pathStart = 18
    const payloadStart = pathStart + pathLength
    const totalLength = payloadStart + payloadLength

    if (datagram.length !== totalLength) {
        return null
    }

    const expectedChecksum = datagram.readUInt16BE(14)
    const actualChecksum = crc16Ccitt(datagram, totalLength)

    if (actualChecksum !== expectedChecksum) {
        return null
    }

    const path = datagram
        .subarray(pathStart, payloadStart)
        .toString('utf8')

    const payload = Buffer.from(
        datagram.subarray(payloadStart, totalLength)
    )

    return {
        version,
        flags,
        cmd,
        seq,
        path,
        payload,
    }
}

export class TcpFrameDecoder {
    private buffer: Buffer = Buffer.alloc(0)

    public push(chunk: Buffer): ProtocolFrame[] {
        if (!chunk || chunk.length === 0) {
            return []
        }
        this.buffer = this.buffer.length > 0 ? Buffer.concat([this.buffer, chunk]) : Buffer.from(chunk)
        const frames: ProtocolFrame[] = []
        while (this.buffer.length >= PROTOCOL.HEADER_LENGTH + PROTOCOL.PATH_LENGTH_SIZE) {
            if (this.buffer.readUInt16BE(0) !== PROTOCOL.MAGIC) {
                this.buffer = this.buffer.subarray(1)
                continue
            }
            const payloadLength = this.buffer.readUInt32BE(10)
            const pathLength = this.buffer.readUInt16BE(16)
            if (payloadLength > PROTOCOL.MAX_PAYLOAD_LENGTH || pathLength > PROTOCOL.MAX_PATH_LENGTH) {
                this.buffer = this.buffer.subarray(1)
                continue
            }
            const totalLength = PROTOCOL.HEADER_LENGTH + PROTOCOL.PATH_LENGTH_SIZE + pathLength + payloadLength
            if (this.buffer.length < totalLength) {
                break
            }
            const frameBuf = this.buffer.subarray(0, totalLength)
            const expectedChecksum = frameBuf.readUInt16BE(14)
            const actualChecksum = crc16Ccitt(frameBuf, totalLength)
            if (expectedChecksum !== actualChecksum) {
                this.buffer = this.buffer.subarray(1)
                continue
            }
            const pathStart = 18
            const payloadStart = pathStart + pathLength
            frames.push({
                version: frameBuf.readUInt8(2),
                flags: frameBuf.readUInt8(3),
                cmd: frameBuf.readUInt16BE(4) as CMDType,
                seq: frameBuf.readUInt32BE(6),

                path: frameBuf
                    .subarray(pathStart, payloadStart)
                    .toString('utf8'),

                payload: Buffer.from(
                    frameBuf.subarray(payloadStart, totalLength)
                ),
            })

            this.buffer = this.buffer.subarray(totalLength)
        }

        return frames
    }

    public reset(): void {
        this.buffer = Buffer.alloc(0)
    }
}

export const CMD = {
    request: 1,
    response: 2
} as const
type CMDType = typeof CMD[(keyof typeof CMD)]

export interface ProtocolFrame {
    version?: number
    flags?: number
    cmd: CMDType
    seq: number
    path: string
    payload: Buffer
}

/**
 * CRC16-CCITT 校验（多项式 0x1021，初始值 0xFFFF）
 */
export function crc16Ccitt(buf: Buffer, end = buf.length): number {
    let crc = 0xffff;
    for (let i = 2; i < end; i++) {
        // 跳过 checksum 字段（偏移 14、15）
        if (i === 14 || i === 15) {
            continue;
        }
        crc ^= buf[i] << 8;
        for (let bit = 0; bit < 8; bit++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ 0x1021) & 0xffff;
            } else {
                crc = (crc << 1) & 0xffff;
            }
        }
    }
    return crc;
}

export type ControllerClass<
    T extends Constructor,
    N extends PropertyKey = string
> = T & {
    __rpcControllerName: N;
};

export function defineController<
    const N extends string,
    T extends Constructor
>(
    name: N,
    target: T
): ControllerClass<T, N> {
    controllerMetadata.set(target, name);
    return target as ControllerClass<T, N>;
}

/**
 * 控制器元数据
 *
 * Constructor -> Controller Name
 */
export const controllerMetadata = new WeakMap<Constructor, string>();

export interface RpcMethodOptions {
    name?: string;
    /** 是否需要返回 RPC 响应，默认 true */
    ack?: boolean

    /** 是否对外暴露，默认 true */
    expose?: boolean

    /** 是否禁用，默认 false */
    disabled?: boolean

    /** 方法别名 */
    alias?: string | string[]
}

export interface RpcMethodMetadata {
    name: string;
    ack: boolean;
    expose: boolean;
    disabled: boolean;
    alias?: string | string[];
}

const rpcMetadata = new WeakMap<
    object,
    Map<string, RpcMethodMetadata>
>()
let passed = false;
/**
 * RpcMethod 装饰器
 *
 * @RpcMethod({ ack: false })
 */
export function RpcMethod(options: RpcMethodOptions = {}) {
    return function <This, Args extends any[], Return>(
        _value: (this: This, ...args: Args) => Return,
        context: ClassMethodDecoratorContext<
            This,
            (this: This, ...args: Args) => Return
        >
    ): void {
        if (typeof context.name !== 'string') {
            throw new Error('RPC method name must be a string');
        }

        if (context.static) {
            throw new Error('RPC methods cannot be static');
        }

        if (context.private) {
            throw new Error('RPC methods cannot be private');
        }

        const metadata: RpcMethodMetadata = {
            name: options.name ?? context.name,
            ack: options.ack ?? true,
            expose: options.expose ?? true,
            disabled: options.disabled ?? false,
            alias: options.alias
        };

        context.addInitializer(function () {
            const prototype = Object.getPrototypeOf(this);

            let methods = rpcMetadata.get(prototype);

            if (!methods) {
                methods = new Map<string, RpcMethodMetadata>();
                rpcMetadata.set(prototype, methods);
            }

            if (!passed&&methods.has(context.name as string)) {
                throw new Error(
                    `Duplicate RPC metadata: ${String(context.name)}`
                );
            }
            methods.set(context.name as string, metadata);
            passed = true;
        });
    };
}

/**
 * 标记为对外暴露的 RPC 方法，例如 @RpcMethod({ ack: true })
 */
export function parseControllers<T extends NetworkContext, C extends readonly Constructor[]>(controllers: C, context: T, map = new Map<string, RpcMethodDefinition>()): Map<string, RpcMethodDefinition> {
    for (const Controller of controllers) {
        const controllerName = controllerMetadata.get(Controller);
        // 未通过 defineController 注册的类直接跳过
        if (controllerName === undefined) {
            continue;
        }
        const instance = new Controller();
        if ('setContext' in instance && typeof (instance as ContextAware<T>).setContext === 'function') {
            (instance as ContextAware<T>).setContext(context)
        }
        const definitions = parseController(controllerName, instance);
        for (const [name, definition] of definitions) {
            if (map.has(name)) {
                throw new Error(`Duplicate RPC method: ${name}`);
            }
            map.set(name, definition);
        }
    }
    return map;
}

export function parseController(
    controllerName: string,
    instance: object,
    separator = "."
): Map<string, RpcMethodDefinition> {
    const result = new Map<string, RpcMethodDefinition>();

    const prototype = Object.getPrototypeOf(instance);
    const metadata = rpcMetadata.get(prototype);

    if (!metadata || metadata.size === 0) {
        return result;
    }

    for (const [methodName, options] of metadata.entries()) {
        // 禁用的方法不注册
        if (options.disabled) {
            continue;
        }

        // 不对外暴露的方法不注册
        if (!options.expose) {
            continue;
        }

        const handler = (instance as Record<string, unknown>)[methodName];

        if (typeof handler !== "function") {
            continue;
        }

        // 主 RPC 路径使用自定义名称或原始方法名称
        const names = [
            `${controllerName}${separator}${options.name}`
        ];

        // 注册别名
        if (options.alias) {
            const aliases = Array.isArray(options.alias)
                ? options.alias
                : [options.alias];

            for (const alias of aliases) {
                names.push(`${controllerName}${separator}${alias}`);
            }
        }

        for (const name of names) {
            if (result.has(name)) {
                throw new Error(`Duplicate RPC method: ${name}`);
            }

            result.set(name, {
                name,
                methodName,
                handler: handler.bind(instance),
                metadata: options
            });
        }
    }

    return result;
}

export const PayloadType = {
    NULL: 0,
    NUMBER: 1,
    STRING: 2,
    BUFFER: 3,
    BOOLEAN: 4,
    OBJECT: 5,
    ARRAY: 6,
} as const;
type PayloadValueType = (typeof PayloadType)[keyof typeof PayloadType];

function encodeNode(type: PayloadValueType, data: Buffer): Buffer {
    const header = Buffer.allocUnsafe(5)
    header.writeUInt8(type, 0)
    header.writeUInt32BE(data.length, 1)

    return Buffer.concat([header, data])
}

export function encodePayload(obj: unknown): Buffer {
    if (obj === null || obj === undefined) {
        return encodeNode(PayloadType.NULL, Buffer.alloc(0))
    }

    if (typeof obj === 'number') {
        const data = Buffer.allocUnsafe(8)
        data.writeDoubleBE(obj)
        return encodeNode(PayloadType.NUMBER, data)
    }

    if (typeof obj === 'string') {
        return encodeNode(PayloadType.STRING, Buffer.from(obj))
    }

    if (Buffer.isBuffer(obj)) {
        return encodeNode(PayloadType.BUFFER, obj)
    }

    if (typeof obj === 'boolean') {
        return encodeNode(
            PayloadType.BOOLEAN,
            Buffer.from([obj ? 1 : 0])
        )
    }

    if (Array.isArray(obj)) {
        const chunks: Buffer[] = []

        for (const item of obj) {
            chunks.push(encodePayload(item))
        }

        return encodeNode(
            PayloadType.ARRAY,
            Buffer.concat(chunks)
        )
    }

    if (typeof obj === 'object') {
        const entries = Object.entries(obj)
        const chunks: Buffer[] = []

        const count = Buffer.allocUnsafe(4)
        count.writeUInt32BE(entries.length)
        chunks.push(count)

        for (const [key, value] of entries) {
            const keyBuffer = Buffer.from(key, 'utf8')

            const keyLength = Buffer.allocUnsafe(4)
            keyLength.writeUInt32BE(keyBuffer.length)

            chunks.push(
                keyLength,
                keyBuffer,
                encodePayload(value)
            )
        }

        return encodeNode(
            PayloadType.OBJECT,
            Buffer.concat(chunks)
        )
    }

    throw new TypeError(`Unsupported type: ${typeof obj}`)
}

const HEADER_SIZE = 5;

export function decodePayload(buffer: Buffer): unknown {
    const result = decodeNode(buffer, 0)

    if (result.offset !== buffer.length) {
        throw new Error('Unexpected trailing data')
    }

    return result.value
}

function decodeNode(
    buffer: Buffer,
    offset: number
): { value: unknown; offset: number } {
    if (offset + HEADER_SIZE > buffer.length) {
        throw new Error('Invalid payload header')
    }

    const type = buffer.readUInt8(offset)
    const length = buffer.readUInt32BE(offset + 1)

    const start = offset + HEADER_SIZE
    const end = start + length

    if (end > buffer.length) {
        throw new Error('Invalid payload length')
    }

    const data = buffer.subarray(start, end)

    let value: unknown

    switch (type) {
        case PayloadType.NULL:
            if (length !== 0) throw new Error('Invalid NULL payload')
            value = null
            break

        case PayloadType.NUMBER:
            if (length !== 8) throw new Error('Invalid NUMBER payload')
            value = data.readDoubleBE(0)
            break

        case PayloadType.STRING:
            value = data.toString('utf8')
            break

        case PayloadType.BUFFER:
            value = Buffer.from(data)
            break

        case PayloadType.BOOLEAN:
            if (length !== 1 || data[0] > 1) {
                throw new Error('Invalid BOOLEAN payload')
            }
            value = data[0] === 1
            break

        case PayloadType.ARRAY: {
            const array: unknown[] = []
            let cursor = 0

            while (cursor < data.length) {
                const result = decodeNode(data, cursor)
                array.push(result.value)
                cursor = result.offset
            }

            value = array
            break
        }

        case PayloadType.OBJECT: {
            if (length < 4) {
                throw new Error('Invalid OBJECT payload')
            }

            const count = data.readUInt32BE(0)
            const object: Record<string, unknown> = {}

            let cursor = 4

            for (let i = 0; i < count; i++) {
                if (cursor + 4 > data.length) {
                    throw new Error('Invalid OBJECT key length')
                }

                const keyLength = data.readUInt32BE(cursor)
                cursor += 4

                if (cursor + keyLength > data.length) {
                    throw new Error('Invalid OBJECT key')
                }

                const key = data
                    .subarray(cursor, cursor + keyLength)
                    .toString('utf8')

                cursor += keyLength

                const result = decodeNode(data, cursor)

                if (Object.hasOwn(object, key)) {
                    throw new Error(`Duplicate object key: ${key}`)
                }

                Object.defineProperty(object, key, {
                    value: result.value,
                    enumerable: true,
                    writable: true,
                    configurable: true
                })

                cursor = result.offset
            }

            if (cursor !== data.length) {
                throw new Error('Unexpected OBJECT trailing data')
            }

            value = object
            break
        }

        default:
            throw new Error(`Unknown payload type: ${type}`)
    }

    return {
        value,
        offset: end
    }
}

