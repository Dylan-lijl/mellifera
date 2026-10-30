import {z} from 'zod';
import {SearchAndPageDefinition} from './common';
import {CreateMappingDefinition, MappingDefinition} from './Mapping';

/**
 * 实体
 */
export const ConnectionMappingDefinition = z.object({
    id: z.number().int().positive().describe('主键'),

    remoteId: z.number().int().positive().describe('远程映射主键'),

    connectionId: z.number().int().positive().describe('连接配置id'),

    appliedConfig: MappingDefinition.nullable()
        .describe('已应用的映射配置'),

    remoteConfig: MappingDefinition.nullable()
        .describe('远程最新的映射配置'),

    enabled: z.boolean()
        .describe('是否启用'),

    autoUpdate: z.boolean()
        .describe('是否自动更新'),
    remoteRemove: z.boolean().describe("远程是否删除"),
    createdAt: z.date().describe('创建时间'),
    updatedAt: z.date().describe('修改时间'),
});

export type ConnectionMappingModel =
    z.infer<typeof ConnectionMappingDefinition>;

/**
 * 创建
 */
export const CreateConnectionMappingDefinition =
    z.object({
        connectionId: ConnectionMappingDefinition.shape.connectionId,
        config: CreateMappingDefinition.omit({
            enabled: true,
            clientId: true,
        }),
        enabled: ConnectionMappingDefinition.shape.enabled,
        autoUpdate: ConnectionMappingDefinition.shape.autoUpdate.default(false),
    });

export interface CreateConnectionMappingRequest
    extends z.input<typeof CreateConnectionMappingDefinition> {
}

/**
 * 更新
 */
export const UpdateConnectionMappingDefinition =
    z.object({
        id: ConnectionMappingDefinition.shape.id,
        config: MappingDefinition.omit({
            enabled: true,
            clientId: true,
            createdAt: true,
            updatedAt: true,
        }).optional(),
        enabled: ConnectionMappingDefinition.shape.enabled.optional(),
        autoUpdate: ConnectionMappingDefinition.shape.autoUpdate.optional(),
    });

export interface UpdateConnectionMappingRequest
    extends z.input<typeof UpdateConnectionMappingDefinition> {
}

/**
 * 详情
 */
export const InfoConnectionMappingDefinition =
    ConnectionMappingDefinition;

export interface InfoConnectionMappingResponse
    extends z.infer<typeof InfoConnectionMappingDefinition> {
}

/**
 * 查询
 */
export const ListConnectionMappingRequestDefinition =
    SearchAndPageDefinition.extend({
        enabled: z.boolean().nullish(),
        connectionId: ConnectionMappingDefinition.shape.connectionId,
        id: ConnectionMappingDefinition.shape.id.nullish(),
    }).omit({
        pageNum: true,
        pageSize: true,
    }).describe('查询');

export interface ListConnectionMappingRequest extends z.input<typeof ListConnectionMappingRequestDefinition> {
}

export const ListConnectionMappingResponseDefinition = ConnectionMappingDefinition;

export interface ListConnectionMappingResponse extends z.input<typeof ListConnectionMappingResponseDefinition> {
}