import { z } from 'zod'

/**
 * ConnectionEntity 唯一的数据属性声明
 *
 * 字段名、业务类型及基础校验规则以这里为准。
 */
export const ConnectionDefinition = z.object({
    id: z.int(),
    name: z.string().trim().min(1).max(100).describe("名称"),
    host: z.string().trim().min(1).max(255).describe("域名或IP"),
    port: z.number().int().min(1).max(65535).describe("端口"),
    token: z.string().describe("认证信息"),
    autoUpdate:z.boolean().describe("自动更新").nullable(),
    enabled: z.boolean().describe("启用"),
    description: z.string().max(1000).nullable().describe("描述"),
    createdAt: z.date().describe("创建时间"),
    updatedAt: z.date().describe("修改时间"),
})

/** 完整的数据属性类型 */
export interface ConnectionModel extends z.infer<typeof ConnectionDefinition>{}
/** 创建 */
export const CreateConnectionDefinition =
    ConnectionDefinition.omit({
        id: true,
        createdAt: true,
        updatedAt: true,
    }).extend({
        enabled: ConnectionDefinition.shape.enabled.default(true),
        description: ConnectionDefinition.shape.description.optional(),
    })

export interface CreateConnectionRequest extends z.input<typeof CreateConnectionDefinition>{}

/** 更新 */
export const UpdateConnectionDefinition =
    CreateConnectionDefinition.partial().extend({
        id: ConnectionDefinition.shape.id,
    })

export interface UpdateConnectionRequest extends z.input<typeof UpdateConnectionDefinition>{}

export const InfoConnectionDefinition = ConnectionDefinition;
export interface InfoConnectionResponse extends z.input<typeof InfoConnectionDefinition>{}
export const ListConnectionDefinition = ConnectionDefinition;
export interface ListConnectionResponse extends z.input<typeof ListConnectionDefinition>{}
