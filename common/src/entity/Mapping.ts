import {z} from 'zod'
import {SearchAndPageDefinition} from "./common";
import {transportProtocolOptions, TransportProtocolType} from "../constant";

export const MappingDefinition = z.object({
    id: z.number().int().positive().describe("主键"),
    clientId: z.number().int().positive().describe("客户配置id"),
    name: z.string().trim().min(1).max(100).describe("映射名称"),
    protocol: z.union(
        transportProtocolOptions.map(item => z.literal(item.value)) as [
            z.ZodLiteral<TransportProtocolType>,
            z.ZodLiteral<TransportProtocolType>,
            ...z.ZodLiteral<TransportProtocolType>[]
        ]
    ).describe("传输协议"),
    listenPort: z.number().int().min(0).max(65535).describe("映射端口,0代表服务端动态分配"),
    targetHost: z.string().describe("目标主机"),
    targetPort: z.number().int().min(1).max(65535).describe("目标端口"),
    enabled: z.boolean().default(true).describe("是否启用"),
    description: z.string().nullable().default(null).describe("描述"),
    disabledPorts: z.string().nullable().describe("这部分端口不能作为动态分配时端口"),
    other: z.string().nullable().default(null).describe("其他配置JSON"),
    createdAt: z.date().describe("创建时间"),
    updatedAt: z.date().describe("修改时间"),
})

export type MappingModel = z.infer<typeof MappingDefinition>
/** 创建 */
export const CreateMappingDefinition =
    MappingDefinition.omit({
        id: true,
        createdAt: true,
        updatedAt: true,
    }).extend({
        enabled: MappingDefinition.shape.enabled.default(true),
        description: MappingDefinition.shape.description.optional(),
        disabledPorts: MappingDefinition.shape.disabledPorts.optional(),
        other: MappingDefinition.shape.other.optional(),
    })

export interface CreateMappingRequest extends z.input<typeof CreateMappingDefinition> {
}

/** 更新 */
export const UpdateMappingDefinition =
    CreateMappingDefinition
        .omit({clientId: true}).partial().extend({
        id: MappingDefinition.shape.id,
    })

export interface UpdateMappingRequest extends z.input<typeof UpdateMappingDefinition> {
}

export const InfoMappingDefinition = MappingDefinition;

export interface InfoMappingResponse extends z.input<typeof InfoMappingDefinition> {
}

export const ListMappingDefinition = MappingDefinition.extend({
    clientName: z.string().nullable().describe('客户端名称'),
})

export interface ListMappingResponse extends z.input<typeof ListMappingDefinition> {
}

export const ListMappingRequestDefinition = SearchAndPageDefinition.extend({
    enabled: z.boolean().nullish(),
    clientId: z.boolean().nullish(),
}).describe("查询")

export interface ListMappingRequest extends z.input<typeof ListMappingRequestDefinition> {
}