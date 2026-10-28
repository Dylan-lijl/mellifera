import {
    DataTypes,
    Model,
    type Sequelize,
    type ModelAttributes,
    type Attributes,
    type InferAttributes,
    type InferCreationAttributes,
    type CreationOptional,
} from 'sequelize';

import type { ConnectionMappingModel } from '@mellifera/common/entity';

export class ConnectionMappingEntity extends Model<
    InferAttributes<ConnectionMappingEntity>,
    InferCreationAttributes<ConnectionMappingEntity>
> {
    declare id: CreationOptional<ConnectionMappingModel['id']>;
    declare remoteId: ConnectionMappingModel['remoteId'];
    declare connectionId: ConnectionMappingModel['connectionId'];
    declare appliedConfig: ConnectionMappingModel['appliedConfig'];
    declare remoteConfig: ConnectionMappingModel['remoteConfig'];
    declare enabled: CreationOptional<ConnectionMappingModel['enabled']>;
    declare autoUpdate: CreationOptional<ConnectionMappingModel['autoUpdate']>;
    declare remoteRemove: CreationOptional<ConnectionMappingModel['remoteRemove']>;
    declare createdAt: CreationOptional<ConnectionMappingModel['createdAt']>;
    declare updatedAt: CreationOptional<ConnectionMappingModel['updatedAt']>;
}

export type ConnectionMappingField = keyof Attributes<ConnectionMappingEntity>;

export function initDB(sequelize: Sequelize) {
    ConnectionMappingEntity.init(
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            remoteId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            connectionId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            appliedConfig: {
                type: DataTypes.TEXT,
                allowNull: true,
                get() {
                    const value = this.getDataValue('appliedConfig');
                    return value == null ? null : JSON.parse(value as unknown as string);
                },
                set(value) {
                    this.setDataValue(
                        'appliedConfig',
                        value == null ? null : JSON.stringify(value) as never,
                    );
                },
            },
            remoteConfig: {
                type: DataTypes.TEXT,
                allowNull: true,
                get() {
                    const value = this.getDataValue('remoteConfig');
                    return value == null ? null : JSON.parse(value as unknown as string);
                },
                set(value) {
                    this.setDataValue(
                        'remoteConfig',
                        value == null ? null : JSON.stringify(value) as never,
                    );
                },
            },
            enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            autoUpdate: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            remoteRemove: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
            },
        } as ModelAttributes<ConnectionMappingEntity, ConnectionMappingModel>,
        {
            sequelize,
            tableName: 'connection_mappings',
            timestamps: true,
            indexes: [
                {
                    unique: true,
                    fields: ['connectionId', 'remoteId'],
                },
            ],
        },
    );
}