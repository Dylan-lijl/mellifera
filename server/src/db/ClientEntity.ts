import {
    DataTypes,
    Model,
    type Sequelize,
    type ModelAttributes,
    type Attributes,
    type InferAttributes,
    type InferCreationAttributes,
    type CreationOptional,
} from 'sequelize'

import type { ClientModel } from '@mellifera/common/entity'

export class ClientEntity extends Model<
    InferAttributes<ClientEntity>,
    InferCreationAttributes<ClientEntity>
> {
    declare id: CreationOptional<ClientModel['id']>
    declare name: ClientModel['name']
    declare token: ClientModel['token']
    declare enabled: ClientModel['enabled']
    declare description: ClientModel['description']
    declare createdAt: CreationOptional<ClientModel['createdAt']>
    declare updatedAt: CreationOptional<ClientModel['updatedAt']>
}

export type ClientField = keyof Attributes<ClientEntity>

export function initDB(sequelize: Sequelize) {
    ClientEntity.init(
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            name: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            token: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
            },
        } as ModelAttributes<ClientEntity, ClientModel>,
        {
            sequelize,
            tableName: 'clients',
            timestamps: true,
        },
    )
}