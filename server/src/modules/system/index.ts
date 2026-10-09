import {defineApiHandler, SystemApiDefinition} from '@mellifera/common/api'
import {clearCacheAndForcefullyReload, hardReload, listenKeys, storeKeys, type ReloadType} from '@mellifera/common/constant'
import appContext, {sendListener, appInfo} from "@/appContext";
import store from "@/utils/Store";
import {dialog, shell} from "electron";
import fs from "fs";


const service = defineApiHandler(SystemApiDefinition, {
    selectFile: async (options) => {
        const result = await dialog.showOpenDialog(options)
        if (result.canceled) return
        return result.filePaths[0];
    },
    openBrowserUrl: async (path) => {
        let success = false;
        try {
            await shell.openExternal(path);
            success = true;
        } catch (e) {
        }
        return success
    },
    openDevTools: () => {
        appContext.getMainWindow()?.webContents.openDevTools({mode: 'detach'});
    },
    setAlwaysOnTop: (value) => {
        const win = appContext.getMainWindow();
        win?.setAlwaysOnTop(value, "pop-up-menu")
        sendListener(win, {
            key: listenKeys.alwaysOnTop, value: win?.isAlwaysOnTop()
        });
    },
    getAppInfo: () => {
        return appInfo;
    },
    openFileDir: async (path) => {
        let success = false;
        try {
            if (path && fs.existsSync(path)) {
                const stat = fs.statSync(path);
                if (stat.isDirectory()) {
                    await shell.openPath(path);
                    success = true;
                } else if (stat.isFile()) {
                    shell.showItemInFolder(path)
                    success = true;
                } else {
                    success = false;
                }
            }
        } catch (e) {
            success = false;
        }
        return success
    },
    close: async () => {
        if (!store.getData(storeKeys.hideTray)) {
            await appContext.getQuit()?.();
            return;
        }
        appContext.getMainWindow()?.hide();
    },
    minimize: () => {
        appContext.getMainWindow()?.minimize();
    },
    maximize: () => {
        const w = appContext.getMainWindow();
        if (w?.isMaximized()) {
            w?.unmaximize();
        } else {
            w?.maximize();
        }
    },
    refresh: async (type: ReloadType) => {
        const contents = appContext.getMainWindow()?.webContents;
        if (!contents) {
            return;
        }
        switch (type) {
            case hardReload.value:
                contents.reloadIgnoringCache();
                break;
            case clearCacheAndForcefullyReload.value:
                await contents.session.clearCache();
                await contents.session.clearStorageData({
                    storages: [
                        "cookies",
                        "filesystem",
                        "indexdb",
                        "localstorage",
                        "shadercache",
                        "websql",
                        "serviceworkers",
                        "cachestorage",
                    ],
                });
                contents.reloadIgnoringCache();
                break;
            default:
                contents.reload();
        }
    },
    goBack: () => {
        const w = appContext.getMainWindow();
        if (!w) {
            return;
        }
        if (w.webContents.navigationHistory.canGoBack()) {
            w.webContents.navigationHistory.goBack();
        }
    },
    goForward: () => {
        const w = appContext.getMainWindow();
        if (!w) {
            return;
        }
        if (w.webContents.navigationHistory.canGoForward()) {
            w.webContents.navigationHistory.goForward();
        }
    },
    saveRoute: (name) => {
        store.saveData("route", name);
    },
    getRoute: () => {
        return store.getData("route");
    },
    statusList: () => {
    },
});

export default service;