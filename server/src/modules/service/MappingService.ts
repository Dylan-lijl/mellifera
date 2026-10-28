import {
    type FindByIdRequest,
    type EnabledRequest,
    type InfoMappingResponse,
    type ListMappingResponse,
    type CreateMappingRequest,
    CreateMappingDefinition,
    type UpdateMappingRequest,
    UpdateMappingDefinition,
    EnabledDefinition,
    type DeleteByIdRequest,
    type ListMappingRequest, type ListAllMappingRequest, ListAllMappingRequestDefinition
} from '@mellifera/common/entity'

import {MappingEntity} from '@/db/MappingEntity'
import {ResultApiException} from '@mellifera/common/CustomException'
import {
    ID_NOT_EXIST_EXCEPTION,
    UPDATE_DATA_EXCEPTION,
} from '@mellifera/common/ResultCode'

import {QueryTypes, type WhereOptions} from 'sequelize'
import type {PageData} from '@mellifera/common/Result'
import {sequelize} from "@/appContext";
import {escapeLike} from "@mellifera/common/util";

export class MappingService {
    list = async (request: ListAllMappingRequest) => {
        const {id, clientId, enabled} =
            ListAllMappingRequestDefinition.parse(request);
        const where: WhereOptions<MappingEntity> = {};
        if (id) {
            where.id = id;
        }
        if (clientId) {
            where.clientId = clientId;
        }
        if (enabled !== undefined && enabled !== null) {
            where.enabled = enabled;
        }
        return MappingEntity.findAll({where});
    }
    /**
     * 查询映射列表。
     */
    searchAndPage = async (params: ListMappingRequest) => {
        const {
            pageNum = 1,
            pageSize = 10,
            keyword,
            clientId,
            enabled,
        } = params

        const where: string[] = ['1 = 1']
        const replacements: Record<string, unknown> = {}

        if (clientId != null) {
            where.push('m.clientId = :clientId')
            replacements.clientId = clientId
        }

        if (enabled != null) {
            where.push('m.enabled = :enabled')
            replacements.enabled = enabled ? 1 : 0
        }

        if (keyword?.trim()) {
            where.push(`(
        m.name LIKE :keyword ESCAPE '\\'
        OR m.targetHost LIKE :keyword ESCAPE '\\'
        OR m.description LIKE :keyword ESCAPE '\\'
        OR c.name LIKE :keyword ESCAPE '\\'
    )`)

            replacements.keyword = `%${escapeLike(keyword.trim())}%`
        }

        const whereSql = where.join(' AND ')

        const countSql = `
            SELECT COUNT(*) AS total
            FROM mappings AS m
                     LEFT JOIN clients AS c ON c.id = m.clientId
            WHERE ${whereSql}
        `

        const listSql = `
            SELECT m.*,
                   c.name AS clientName
            FROM mappings AS m
                     LEFT JOIN clients AS c ON c.id = m.clientId
            WHERE ${whereSql}
            ORDER BY m.updatedAt DESC LIMIT :limit
            OFFSET :offset
        `

        const [countResult, rows] = await Promise.all([
            sequelize.query<{ total: number }>(countSql, {
                replacements,
                type: QueryTypes.SELECT,
            }),
            sequelize.query<ListMappingResponse>(listSql, {
                replacements: {
                    ...replacements,
                    limit: pageSize,
                    offset: (pageNum - 1) * pageSize,
                },
                type: QueryTypes.SELECT,
            }),
        ])
        rows.forEach(row => {
            row.enabled = !!row.enabled
        })
        return {
            list: rows,
            total: Number(countResult[0]?.total ?? 0),
            pageSize,
            pageNum,
            totalPage: Math.ceil(Number(countResult[0]?.total ?? 0) / pageSize),
        } as PageData<ListMappingResponse>
    }

    /**
     * 查询单个映射。
     */
    getById = async (request: FindByIdRequest) => {
        const entity = await MappingEntity.findByPk(request.id)

        if (!entity) {
            throw new ResultApiException(ID_NOT_EXIST_EXCEPTION)
        }

        return entity.get({plain: true}) as InfoMappingResponse
    }

    /**
     * 创建映射。
     *
     * 创建配置不会自动启动映射。
     */
    create = async (input: CreateMappingRequest) => {
        const data = CreateMappingDefinition.parse(input)

        const entity = await MappingEntity.create({
            ...data,
        })

        return entity.id as number
    }

    /**
     * 更新映射。
     *
     * 这里只更新数据库配置，不自动重启映射。
     * 如果映射正在运行，应由上层业务处理运行状态和配置变更。
     */
    update = async (input: UpdateMappingRequest) => {
        const data = UpdateMappingDefinition.parse(input)
        const {id, ...values} = data

        const [affectedCount] = await MappingEntity.update(values, {
            where: {id},
        })

        if (affectedCount === 0) {
            throw new ResultApiException(UPDATE_DATA_EXCEPTION)
        }
    }

    /**
     * 删除映射。
     *
     * 如果映射仍在运行，应先停止映射，再删除配置。
     */
    delete = async (request: DeleteByIdRequest) => {
        const entity = await MappingEntity.findByPk(request.id)

        if (!entity) {
            throw new ResultApiException(ID_NOT_EXIST_EXCEPTION)
        }

        // TODO: 检查并停止正在运行的映射

        await entity.destroy()
    }

    /**
     * 启用或禁用映射。
     *
     * 启用配置不会自动启动映射。
     * 禁用前应先停止正在运行的映射。
     */
    enable = async (request: EnabledRequest) => {
        const {id, enabled} = EnabledDefinition.parse(request)
        const entity = await MappingEntity.findByPk(id)

        if (!entity) {
            throw new ResultApiException(ID_NOT_EXIST_EXCEPTION)
        }

        if (entity.enabled === enabled) {
            return
        }

        if (!enabled) {
            // TODO: 停止正在运行的映射
        }

        await entity.update({enabled})
    }

}

export default new MappingService()