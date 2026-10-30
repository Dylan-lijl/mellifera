import type {TransportListenerMetadata} from '@/types'
import type {TransportProtocolType} from "@mellifera/common/constant";

const modules = import.meta.glob<TransportListenerMetadata>(
    './**/*Listener.ts',
    {
        eager: true,
        import: 'default',
    },
)

const metadataMap = new Map<
    TransportProtocolType,
    TransportListenerMetadata
>()

for (const metadata of Object.values(modules)) {
    if (metadata.disabled) {
        continue
    }
    const current = metadataMap.get(metadata.protocol)
    if (!current || metadata.order < current.order) {
        metadataMap.set(metadata.protocol, metadata)
    }
}

/**
 * 协议 -> 优先级最高的监听器构造函数
 */
export const transportListeners = Object.fromEntries(
    [...metadataMap].map(([protocol, metadata]) => [
        protocol,
        metadata.clazz,
    ]),
) as Partial<
    Record<
        TransportProtocolType,
        TransportListenerMetadata['clazz']
    >
>
export default transportListeners;