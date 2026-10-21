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

import type { MappingModel } from '@mellifera/common/entity'

export class MappingEntity extends Model<
    InferAttributes<MappingEntity>,
    InferCreationAttributes<MappingEntity>
> {
    declare id: CreationOptional<MappingModel['id']>
    declare clientId: MappingModel['clientId']
    declare name: MappingModel['name']
    declare protocol: MappingModel['protocol']
    declare listenPort: MappingModel['listenPort']
    declare targetHost: MappingModel['targetHost']
    declare targetPort: MappingModel['targetPort']
    declare enabled: CreationOptional<MappingModel['enabled']>
    declare description: MappingModel['description']
    declare disabledPorts: MappingModel['disabledPorts']
    declare other: CreationOptional<MappingModel['other']>
    declare createdAt: CreationOptional<MappingModel['createdAt']>
    declare updatedAt: CreationOptional<MappingModel['updatedAt']>
}

export type MappingField = keyof Attributes<MappingEntity>

export function initDB(sequelize: Sequelize) {
    MappingEntity.init(
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            clientId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            name: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            protocol: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            listenPort: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            targetHost: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            targetPort: {
                type: DataTypes.INTEGER,
                allowNull: false,
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
            disabledPorts: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            other: {
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
        } as ModelAttributes<MappingEntity, MappingModel>,
        {
            sequelize,
            tableName: 'mappings',
            timestamps: true,
        },
    )
}