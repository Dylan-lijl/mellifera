import {
    type FindByIdRequest,
    type EnabledRequest,
    type InfoConnectionResponse,
    type ListConnectionResponse,
    type CreateConnectionRequest,
    CreateConnectionDefinition,
    type UpdateConnectionRequest, UpdateConnectionDefinition, EnabledDefinition,
    SearchAndPageDefinition, type SearchAndPageRequest, type DeleteByIdRequest, FindByIdDefinition,
    type CreateConnectionMappingRequest,
    type UpdateConnectionMappingRequest, DeleteByIdDefinition, type ConnectionMappingModel,
    CreateConnectionMappingDefinition,
    UpdateConnectionMappingDefinition, type ListConnectionMappingResponse
} from "@mellifera/common/entity"
import {ConnectionEntity, type ConnectionField} from '@/db/ConnectionEntity'
import {ResultApiException} from "@mellifera/common/CustomException";
import {ADD_DATA_EXCEPTION, ID_NOT_EXIST_EXCEPTION, UPDATE_DATA_EXCEPTION} from "@mellifera/common/ResultCode";
import {Op, type WhereOptions,} from "sequelize";
import type {PageData} from "@mellifera/common/Result";
import StateSyncManager from "@/StateSyncManager";
import {runState} from "@mellifera/common/constant";
import {mapGetOrCreate} from "@mellifera/common/util";
import {SELECTION_DISABELD} from "@mellifera/common/ResultCode";
import {RpcPeer} from "@/rpc/peer/RpcPeer";
import type {RpcClientContext} from "@/rpc/type";
import {WebSocketTransport} from "@/rpc/transport/WebSocketTransport";
import {RpcRouter} from "@/rpc/router/RpcRouter";
import {WebSocket} from "ws";
import {
    createRemoteControllerProxy,
    registerLocalControllers,
    type RpcProxyFor
} from "@/rpc/client/RpcClientFactory";
import {NOT_CONNECTED} from "@mellifera/common/ResultCode";
import type {MappingEntity} from "@/db/MappingEntity";
import {ConnectionMappingEntity} from "@/db/ConnectionMappingEntity";

type Context = {
    client?: RpcPeer<RpcClientContext>,
    connecting?: Promise<RpcClientContext>,
    rpcClient?: RpcProxyFor<'client'>,
};
type ConnectedContext = {
    client: NonNullable<Context['client']>;
    rpcClient: NonNullable<Context['rpcClient']>;
} & Omit<Context, 'client' | 'rpcClient'>;

export class ConnectionService {

    /**
     * 查询全部连接配置。
     */
    searchAndPage = async (
        request: SearchAndPageRequest,
    ) => {
        const {keyword, pageSize, pageNum, id} =
            SearchAndPageDefinition.parse(request)
        const where: WhereOptions<ConnectionEntity> = {
            ...(id != null ? {id} : {}),
            ...(keyword
                ? {
                    [Op.or]: [
                        {name: {[Op.like]: `%${keyword}%`}},
                        {host: {[Op.like]: `%${keyword}%`}},
                        {description: {[Op.like]: `%${keyword}%`}},
                    ],
                }
                : {}),
        }
        const order: [[ConnectionField, 'ASC' | 'DESC']] = [
            ['updatedAt', 'DESC'],
        ]

        const {rows, count} = await ConnectionEntity.findAndCountAll({
            where,
            order,
            limit: pageSize,
            offset: (pageNum - 1) * pageSize,
        })

        return {
            list: rows.map(
                row => row.get({plain: true}) as ListConnectionResponse,
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
    getById = async (request: FindByIdRequest) => {
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
    create = async (input: CreateConnectionRequest) => {
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
    update = async (input: UpdateConnectionRequest) => {
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
    delete = async (request: DeleteByIdRequest) => {
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
    enable = async (request: EnabledRequest) => {
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
    connected = new Map<number, Context>()

    connect = async (request: FindByIdRequest) => {
        const {id} = FindByIdDefinition.parse(request)
        const connection = await ConnectionEntity.findByPk(id)
        if (!connection) {
            throw new ResultApiException(ID_NOT_EXIST_EXCEPTION)
        }
        if (!connection.enabled) {
            throw new ResultApiException(SELECTION_DISABELD)
        }
        const context = mapGetOrCreate(
            this.connected,
            id,
            () => ({client: undefined, connecting: undefined, rpcClient: undefined}),
        )
        const details = StateSyncManager.getState().connection.details
        const runData = mapGetOrCreate(details, id, id => ({
            id,
            running: runState.idle.value,
            error: {message: null},
            connected: new Map()
        }))
        // 已经建立 RPC 客户端，直接复用
        if (context.client?.getTransPort()?.isOpen) {
            return
        }
        // 正在创建 RPC 客户端，等待同一个任务
        if (context.connecting) {
            await context.connecting
            return
        }
        runData.running = runState.starting.value
        runData.error.message = null
        const transport = new WebSocketTransport(
            new WebSocket(`ws://${connection.host}:${connection.port}`, {
                headers: {
                    authorization: "Bearer " + connection.token!
                }
            })
        )
        const rpcContext: RpcClientContext = {id: id, token: connection.token};
        const router = new RpcRouter<RpcClientContext>()
        registerLocalControllers("client", router)
        const client = new RpcPeer(transport, router, {context: rpcContext})
        try {
            await client.getTransPort().connect()
            const rpc = createRemoteControllerProxy("client", client);
            client.getTransPort().onClose(() => {
                if (context.client === client) {
                    context.client = undefined
                    runData.running = runState.idle.value
                }
            })
            client.getTransPort().onError(error => {
                runData.error.message = error.message
            })
            context.client = client
            runData.running = runState.running.value
            context.rpcClient = rpc;
        } catch (error: any) {
            transport.close()
            runData.error.message = error instanceof ResultApiException ? error.code.message : error.message ?? error + '';
            throw error
        }
    }

    disconnect = async (request: FindByIdRequest) => {
        const {id} = FindByIdDefinition.parse(request);
        const runData = StateSyncManager.getState().connection.details.get(id);
        if (!runData) {
            return
        }
        runData.running = runState.stopping.value;
        runData.error.message = null
        const context = this.connected.get(id);
        this.connected.delete(id);
        if (!context?.client?.getContext()?.token) {
            return
        }
        try {
            //发送断开事件
            try {
                await context?.rpcClient?.common?.disconnect({token: context.client.getContext().token})
            } finally {
                context?.client?.close()
            }
        } catch (e: any) {
            runData.error.message = e instanceof ResultApiException ? e.code.message : e.message ?? e + ''
        } finally {
            runData.running = runState.idle.value;
        }
    }

    getConnectedContext(id: number, throwEx?: true): ConnectedContext;
    getConnectedContext(id: number, throwEx: false): Context | undefined;
    getConnectedContext(id: number, throwEx = true): Context | undefined {
        const context = this.connected.get(id);

        const clientContext = context?.client?.getContext();

        if (
            !context ||
            !context.client?.getTransPort()?.isOpen ||
            !context.rpcClient ||
            !clientContext?.token
        ) {
            if (throwEx) {
                throw new ResultApiException(NOT_CONNECTED);
            }

            return context;
        }

        return context as ConnectedContext;
    }

    /**
     * 操作映射
     */
    mapping = {
        load: async (request: FindByIdRequest) => {
            const {id} = FindByIdDefinition.parse(request);
            // 1. 先查询本地数据
            const loadLocal =async () => (await ConnectionMappingEntity.findAll({
                where: {connectionId: id},
                order: [['updatedAt', 'DESC']],
            })).map(item=>item.toJSON<ConnectionMappingEntity>());
            const localEntities = await loadLocal();
            // 2. 检查连接状态
            const context = this.getConnectedContext(id, false);
            if (
                !context ||
                !context.client?.getTransPort()?.isOpen ||
                !context.rpcClient ||
                !context.client.getContext()?.token
            ) {
                // 未连接时，直接返回本地数据
                return localEntities as ListConnectionMappingResponse[];
            }
            const connectionEntity = await ConnectionEntity.findByPk(id);
            if (!connectionEntity) {
                throw new ResultApiException(NOT_CONNECTED);
            }
            // 3. 获取服务端最新映射
            const remoteEntities = await context.rpcClient.mapping.list({
                token: context.client.getContext().token,
            });
            // 4. 建立索引，方便比较
            const localMap = new Map(
                localEntities.map(entity => [entity.remoteId, entity]),
            );
            const remoteMap = new Map(
                remoteEntities.map(entity => [entity.id, entity]),
            );
            // 5. 对比增删改
            // 5.1 服务端有、本地没有：新增本地关联
            for (const remote of remoteEntities) {
                if (localMap.has(remote.id)) {
                    continue;
                }
                await this.mapping.doAdd({
                    connectionId: id,
                    remoteId: remote.id,
                    config: remote,
                    enabled: !!connectionEntity.autoUpdate,
                    autoUpdate: !!connectionEntity.autoUpdate,
                });
            }
            // 5.2 本地有、服务端没有：断开连接并删除本地关联
            for (const local of localEntities) {
                if (remoteMap.has(local.remoteId)) {
                    continue;
                }
                await this.mapping.disconnect({id: local.id});
                //将字段更新成已删除状态
                await ConnectionMappingEntity.update(
                    {remoteRemove: true},
                    {
                        where: {id: local.id},
                    },
                );
            }
            // 5.3 两端都有、配置不同：根据 autoUpdate 决定是否应用
            for (const remote of remoteEntities) {
                const local = localMap.get(remote.id);
                if (!local) {
                    continue;
                }
                const applied = local.appliedConfig!;
                // 判断是否影响实际映射连接
                const configChanged =
                    applied.protocol !== remote.protocol ||
                    applied.targetHost !== remote.targetHost ||
                    applied.targetPort !== remote.targetPort ||
                    applied.other !== remote.other;
                // 无论是否影响连接，都需要同步远程配置快照
                const values: Partial<ConnectionMappingModel> = {
                    remoteConfig: remote,
                };
                if (local.autoUpdate) {
                    // 自动更新：接受服务端最新配置
                    values.appliedConfig = remote;
                } else if (configChanged) {
                    // 手动更新：配置发生变化时禁用映射，等待用户确认
                    values.enabled = false;
                }
                if (configChanged) {
                    // 配置影响实际连接，先断开旧连接
                    await this.mapping.disconnect({id: local.id});
                }
                await ConnectionMappingEntity.update(values, {
                    where: {id: local.id},
                });
            }
            // 6. 返回同步后的本地数据
            const r = await loadLocal();
            return r as ListConnectionMappingResponse[];
        },
        add: async (request: CreateConnectionMappingRequest) => {
            const {config, connectionId, enabled, autoUpdate} = CreateConnectionMappingDefinition.parse(request);
            const context = this.getConnectedContext(connectionId);
            const id = await context.rpcClient.mapping.add({token: context.client.getContext().token, ...config});
            if (!id) {
                throw new ResultApiException(ADD_DATA_EXCEPTION)
            }
            const info = await context.rpcClient.mapping.list({token: context.client.getContext().token, id});
            if (!info || !info.length) {
                throw new ResultApiException(ADD_DATA_EXCEPTION);
            }
            return await this.mapping.doAdd({config: info[0], connectionId, enabled, autoUpdate, remoteId: id});
        },
        doAdd: async (data: {
            config: MappingEntity,
            connectionId: number,
            enabled: boolean,
            autoUpdate: boolean,
            remoteId: number
        }) => {
            const {config, ...otherData} = data;
            const item = await ConnectionMappingEntity.create({
                ...otherData,
                appliedConfig: config,
                remoteConfig: config
            });
            return item.id as number;
        },
        update: async (request: UpdateConnectionMappingRequest) => {
            const {id, config, enabled, autoUpdate} =
                UpdateConnectionMappingDefinition.parse(request);
            const entity = await ConnectionMappingEntity.findByPk(id);
            if (!entity) {
                throw new ResultApiException(ID_NOT_EXIST_EXCEPTION);
            }
            // 服务端操作成功后，再修改本地数据
            const values: Partial<ConnectionMappingModel> = {};
            // 先修改服务端映射 todo
            if (config) {
                const context = this.getConnectedContext(entity.connectionId);
                await context.rpcClient.mapping.update({
                    token: context.client.getContext().token,
                    ...config,
                });
                const info = await context.rpcClient.mapping.list({
                    token: context.client.getContext().token,
                    id: entity.remoteId,
                });
                if (!info?.length) {
                    throw new ResultApiException(UPDATE_DATA_EXCEPTION);
                }
                values.appliedConfig = info[0];
                values.remoteConfig = info[0];
            }
            if (enabled !== undefined) {
                values.enabled = enabled;
            }

            if (autoUpdate !== undefined) {
                values.autoUpdate = autoUpdate;
            }

            await entity.update(values);
            if (enabled === false) {
                await this.mapping.disconnect({id: entity.id});
            }
            return entity.id as number;
        },
        disconnect: async (request: FindByIdRequest) => {
            const {id} = FindByIdDefinition.parse(request);
            //todo 如果连接存在则断开
            id
        },
        remove: async (request: DeleteByIdRequest) => {
            const {id} = DeleteByIdDefinition.parse(request);
            const entity = await ConnectionMappingEntity.findByPk(id);
            if (!entity) {
                throw new ResultApiException(ID_NOT_EXIST_EXCEPTION);
            }
            const context = this.getConnectedContext(entity.connectionId);
            // 先删除服务端映射
            await context.rpcClient.mapping.remove({
                token: context.client.getContext().token,
                id: entity.remoteId,
            });
            // 服务端删除成功后，再删除本地关联记录
            await entity.destroy();
            return true;
        },
    }
}

export default new ConnectionService();