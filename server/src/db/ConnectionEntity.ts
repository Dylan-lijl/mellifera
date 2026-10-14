
import {
    DataTypes,
    Model,
    type Sequelize,
    type ModelAttributes, type Attributes, type InferAttributes,
    type InferCreationAttributes, type CreationOptional,
} from 'sequelize'

import type {ConnectionModel} from '@mellifera/common/entity'
export class ConnectionEntity extends Model<
    InferAttributes<ConnectionEntity>,
    InferCreationAttributes<ConnectionEntity>
> {
    declare id: CreationOptional<ConnectionModel['id']>
    declare name: ConnectionModel['name']
    declare host: ConnectionModel['host']
    declare port: ConnectionModel['port']
    declare token: ConnectionModel['token']
    declare enabled: ConnectionModel['enabled']
    declare description: ConnectionModel['description']
    declare createdAt: CreationOptional<ConnectionModel['createdAt']>
    declare updatedAt: CreationOptional<ConnectionModel['updatedAt']>
}
export type ConnectionField = keyof Attributes<ConnectionEntity>
export function initDB(sequelize: Sequelize) {
    ConnectionEntity.init(
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
            host: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            port: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            token: {
                type: DataTypes.STRING,
                allowNull: true,
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
        } as ModelAttributes<ConnectionEntity, ConnectionModel>,
        {
            sequelize,
            tableName: 'connections',
            timestamps: true,
        },
    )
}
