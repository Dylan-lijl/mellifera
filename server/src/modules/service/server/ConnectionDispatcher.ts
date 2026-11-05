import {connectionType} from '@mellifera/common/constant';

import type {ConnectionHandler, ConnectionContext} from './ConnectionHandler';

export class ConnectionDispatcher {
    private readonly controlHandler: ConnectionHandler
    private readonly dataHandler: ConnectionHandler
    constructor(
        controlHandler: ConnectionHandler,
        dataHandler: ConnectionHandler,
    ) {
        this.controlHandler = controlHandler;
        this.dataHandler = dataHandler;
    }

    async dispatch(context: ConnectionContext): Promise<void> {
        switch (context.auth.type) {
            case connectionType.controller.value:
                await this.controlHandler.handle(context);
                return;

            case connectionType.data.value:
                await this.dataHandler.handle(context);
                return;

            default:
                throw new Error(
                    `Unsupported connection type: ${context.auth.type}`,
                );
        }
    }
}