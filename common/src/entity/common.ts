import z from "zod";
import {networkType, NetworkType, networkTypeOptions} from "../constant";

export const DeleteByIdDefinition = z.object({
    id: z.int().min(1),
}).describe("根据id删除");

export interface DeleteByIdRequest extends z.infer<typeof DeleteByIdDefinition> {
}

export const FindByIdDefinition = z.object({
    id: z.int().min(1),
}).describe("根据id查询");

export interface FindByIdRequest extends z.infer<typeof FindByIdDefinition> {
}
export const TokenDefinition = z.object({
    token: z.string().min(1),
}).describe("token");

export interface TokenRequest extends z.infer<typeof TokenDefinition> {
}
export const EnabledDefinition = z.object({
    id: z.int().min(1),
    enabled: z.boolean(),
}).describe("启用");

export interface EnabledRequest extends z.infer<typeof EnabledDefinition> {
}

export const SearchDefinition = z.object({
    keyword: z.string().nullish().describe("关键词"),
    id: z.int().nullish().describe("主键")
}).describe("搜索");

export interface SearchRequest extends z.infer<typeof SearchDefinition> {
}

export const PageDefinition = z.object({
    pageSize: z.int().min(1).describe("分页条数"),
    pageNum: z.int().min(1).describe("分页页数"),
}).describe("分页");

export interface PageRequest extends z.infer<typeof PageDefinition> {
}

export const SearchAndPageDefinition = SearchDefinition
    .extend(PageDefinition.shape)
    .describe("搜索并分页");

export interface SearchAndPageRequest extends z.infer<typeof SearchAndPageDefinition> {
}
export const ServerConfig = z.object({
    mode: z.union(
        networkTypeOptions.map(item => z.literal(item.value)) as [
            z.ZodLiteral<NetworkType>,
            z.ZodLiteral<NetworkType>,
            ...z.ZodLiteral<NetworkType>[]
        ]
    ),
    hosts: z.array(z.string().trim().min(1))
        .optional()
        .nullable(),
    port: z.number().int().min(1).max(65535),
}).superRefine((data, ctx) => {
    if (data.mode === networkType.selected.value && !data.hosts?.length) {
        ctx.addIssue({
            code: 'custom',
            path: ['host'],
            message: '指定网卡模式下至少需要选择一个监听地址',
        });
    }
});

export type ServerConfig = z.infer<typeof ServerConfig>;