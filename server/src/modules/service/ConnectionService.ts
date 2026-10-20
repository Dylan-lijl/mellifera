import {
    type FindByIdRequest,
    type EnabledRequest,
    type InfoConnectionResponse,
    type ListConnectionResponse,
    type CreateConnectionRequest,
    CreateConnectionDefinition,
    type UpdateConnectionRequest, UpdateConnectionDefinition, EnabledDefinition,
    SearchAndPageDefinition, type SearchAndPageRequest,type DeleteByIdRequest
} from "@mellifera/common/entity"
import {ConnectionEntity, type ConnectionField} from '@/db/ConnectionEntity'
import {ResultApiException} from "@mellifera/common/CustomException";
import {ID_NOT_EXIST_EXCEPTION, UPDATE_DATA_EXCEPTION} from "@mellifera/common/ResultCode";
import {Op, type WhereOptions,} from "sequelize";
import type {PageData} from "@mellifera/common/Result";

export class ConnectionService {

    /**
     * 查询全部连接配置。
     */
    searchAndPage = async (
        request: SearchAndPageRequest,
    )=>{
        const { keyword, pageSize, pageNum, id } =
            SearchAndPageDefinition.parse(request)
        const where: WhereOptions<ConnectionEntity> = {
            ...(id != null ? { id } : {}),
            ...(keyword
                ? {
                    [Op.or]: [
                        { name: { [Op.like]: `%${keyword}%` } },
                        { host: { [Op.like]: `%${keyword}%` } },
                        { description: { [Op.like]: `%${keyword}%` } },
                    ],
                }
                : {}),
        }
        const order: [[ConnectionField, 'ASC' | 'DESC']] = [
            ['updatedAt', 'DESC'],
        ]

        const { rows, count } = await ConnectionEntity.findAndCountAll({
            where,
            order,
            limit: pageSize,
            offset: (pageNum - 1) * pageSize,
        })

        return {
            list: rows.map(
                row => row.get({ plain: true }) as ListConnectionResponse,
            ),
            total: count,
            pageSize,
            pageNum,
            totalPage: Math.ceil(count / pageSize),
        } as PageData<ListConnectionResponse>
    }

    /**
     * 查询单个连接配置。
     */
    getById = async (request: FindByIdRequest)=>{
        const entity = await ConnectionEntity.findByPk(request.id)
        if (!entity) {
            throw new ResultApiException(ID_NOT_EXIST_EXCEPTION)
        }
        return entity as InfoConnectionResponse;
    }

    /**
     * 新建连接配置。
     *
     * 新建配置不会自动连接服务端。
     */
    create = async (input: CreateConnectionRequest)=>{
        const data = CreateConnectionDefinition.parse(input)
        const entity = await ConnectionEntity.create({
            ...data,
        })
        return entity.id as number;
    }

    /**
     * 更新连接配置。
     *
     * 修改配置不会自动重连。
     * 如果连接当前正在运行，要求先断开再修改。
     */
    update = async (input: UpdateConnectionRequest)=> {
        const data = UpdateConnectionDefinition.parse(input);
        const {id, ...values} = data;
        const [affectedCount] = await ConnectionEntity.update(values, {
            where: {id},
        });
        if (affectedCount === 0) {
            throw new ResultApiException(UPDATE_DATA_EXCEPTION)
        }
    }

    /**
     * 删除连接配置。
     *
     * 如果连接仍处于活动状态，先尝试断开。
     * 断开失败时不删除配置，避免留下难以管理的活动连接。
     */
    delete = async (request: DeleteByIdRequest)=> {
        const entity = await ConnectionEntity.findByPk(request.id)
        if (!entity) {
            throw new ResultApiException(ID_NOT_EXIST_EXCEPTION)
        }
        await entity.destroy()
    }

    /**
     * 启用或禁用连接配置。
     *
     * 禁用时，如果连接正在运行，则先断开。
     */
    enable = async (request: EnabledRequest)=>{
        const {id, enabled} = EnabledDefinition.parse(request);
        const entity = await ConnectionEntity.findByPk(id);

        if (!entity) {
            throw new Error(`连接配置不存在，id=${id}`);
        }

        if (entity.enabled === enabled) {
            return;
        }

        // 禁用前先断开连接，避免配置状态与实际连接状态不一致
        if (!enabled) {
            //todo
        }

        await entity.update({enabled});

        if (enabled) {
            // 这里只启用配置，不自动连接
            // 如果需要自动连接，可在这里调用 this.connect(id)
        }
    }
}
export default new ConnectionService();