import { z } from 'zod'

export const ClientDefinition = z.object({
    id: z.number().int().positive(),
    name: z.string().trim().min(1).max(100),
    token: z.string().trim().min(1),
    enabled: z.boolean().default(true),
    description: z.string().max(1000).nullable().default(null),
    createdAt: z.date(),
    updatedAt: z.date(),
})

export type ClientModel = z.infer<typeof ClientDefinition>
/** 创建 */
export const CreateClientDefinition =
    ClientDefinition.omit({
        id: true,
        createdAt: true,
        updatedAt: true,
    }).extend({
        enabled: ClientDefinition.shape.enabled.default(true),
        description: ClientDefinition.shape.description.optional(),
    })

export interface CreateClientRequest extends z.input<typeof CreateClientDefinition>{}

/** 更新 */
export const UpdateClientDefinition =
    CreateClientDefinition.partial().extend({
        id: ClientDefinition.shape.id,
    })

export interface UpdateClientRequest extends z.input<typeof UpdateClientDefinition>{}

export const InfoClientDefinition = ClientDefinition;
export interface InfoClientResponse extends z.input<typeof InfoClientDefinition>{}
export const ListClientDefinition = ClientDefinition;
export interface ListClientResponse extends z.input<typeof ListClientDefinition>{}