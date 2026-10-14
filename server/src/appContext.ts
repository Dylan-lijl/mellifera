import {app, type BrowserWindow} from "electron";
import type {AppInfo} from "@mellifera/common/types";

let map: { win?: BrowserWindow, quit?: () => any } = {};

export default {
    setMainWindow(win: BrowserWindow) {
        map.win = win;
    },
    getMainWindow(): BrowserWindow {
        return map.win!
    },
    setQuit(quit: () => any) {
        map.quit = quit;
    },
    getQuit() {
        return map.quit;
    }
}
app.setName(process.env.PRODUCT_NAME!);
export const appInfo: AppInfo = {
    name: app.getName(),
    version: app.getVersion(),
    env: app.isPackaged ? "正式版" : "开发版",
    icon: "",
    platform: {
        name: process.platform,
        version: process.arch
    },
    path: {
        appData: app.getPath('userData'),
        assets: app.getPath("assets"),
        sessionData: app.getPath("sessionData"),
        temp: app.getPath('temp'),
        exe: app.getPath('exe'),
        module: app.getPath('module'),
        logs: app.getPath('logs'),
        crashDumps: app.getPath("crashDumps"),
        appPath: app.getAppPath(),
    }
}