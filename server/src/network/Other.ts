import StateSyncManager from "@/StateSyncManager";
import {runState} from "@mellifera/common/constant";
import {ResultApiException} from "@mellifera/common/CustomException";
import {TcpAndUdpBootstrap} from "@/network/client/TcpAndUdpBootstrap";

export class Other {
    connected = new Map<number, { bootstrap: TcpAndUdpBootstrap, token: string,id:number }>()

    async disconnectConnection(id: number): Promise<void> {
        const runData = StateSyncManager.getState().connection.details.get(id);
        if (!runData) {
            return;
        }
        runData.running = runState.stopping.value;
        runData.error.message = null;
        const context = this.connected.get(id);
        this.connected.delete(id);

        try {
            await context?.bootstrap.close()
        } catch (e: any) {
            runData.error.message =
                e instanceof ResultApiException
                    ? e.code.message
                    : e.message ?? String(e);
        } finally {
            runData.running = runState.idle.value;
        }
    }
}

export const other = new Other();
export default other;