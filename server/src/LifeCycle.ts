import StateSyncManager from "@/StateSyncManager";

export async function init() {
}

export async function exit() {
    StateSyncManager.getState().system.closing = true;
}

export default {
    init,
    exit,
}