import {app, BrowserWindow, type IpcMainInvokeEvent, Menu, nativeImage, screen, session, Tray} from "electron";
import {storeKeys} from "@mellifera/common/constant"
import {logger} from "@/utils";
import lifeCycle from "@/LifeCycle";
import path from "path";
import {getData, saveData} from "@/utils/Store";
import appContext, {appInfo} from "@/appContext";
import { devConfig } from "../../dev.config.mjs";
export default async function (){
    let win: BrowserWindow;
    let tray: Tray | null = null;
    /**
     * 就绪回调
     */
    async function whenReady() {
        //切换语言
        app.commandLine.appendSwitch('lang', 'zh-CN')
        //开发环境时安装vue工具依赖
        if (!app.isPackaged) {
            try {
                const {installExtension, VUEJS_DEVTOOLS,} = await import("electron-devtools-installer");
                logger.log("installExtension type:", typeof installExtension);
                await installExtension(VUEJS_DEVTOOLS);
                logger.log("Vue DevTools installed");
            } catch (e) {
                logger.warn("DevTools install failed", e);
            }
        }
        //生命周期初始化
        await lifeCycle.init();
        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"]
                }
            });
        });
        createWindow();
        app.on('window-all-closed', windowAllClosed);
        createTray();
    }

    function windowChange(win: BrowserWindow) {
        //缩放
        win.on('resize', () => {
            const [width, height] = win.getSize();
            saveData(storeKeys.windowBounds, {width, height});
        });
        //移动
        win.on('move', () => {
            const [x, y] = win.getPosition();
            saveData(storeKeys.position, {x, y});
        });
        //路由切换
        win.webContents.on('did-navigate', () => {
            updateNavState(win);
        });

        win.webContents.on('did-navigate-in-page', () => {
            updateNavState(win);
        });
    }

    function createWindow() {
        //去除默认头部菜单栏
        Menu.setApplicationMenu(null);
        //读取窗口大小和位置信息
        const windowBounds = getData(storeKeys.windowBounds) || {width: 1200, height: 800};
        const position: { x?: number, y?: number } = getData(storeKeys.position) || {x: undefined, y: undefined};
        if (position.x || position.y) {
            const isVisible = screen.getAllDisplays().some(display => {
                if (!position.x || !position.y) {
                    return false;
                }
                return (
                    position.x >= display.bounds.x &&
                    position.y >= display.bounds.y
                );
            });
            if (!isVisible) {
                position.x = undefined;
                position.y = undefined;
            }
        }
        //创建窗口
        win = new BrowserWindow({
            ...windowBounds,
            ...position,
            frame: false,
            transparent: true,
            backgroundColor: '#00000000',
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true, // 开启隔离
                nodeIntegration: false, // 禁用 Node 直接注入，提高安全性
                sandbox: true
            },
        });
        appContext.setMainWindow(win);
        // 判断开发环境还是生产环境
        const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
        win.webContents.on('before-input-event', (_, input) => {
            if (input.key === 'F12' && input.type === 'keyDown') {
                if (win.webContents.isDevToolsOpened()) {
                    win.webContents.closeDevTools()
                } else {
                    win.webContents.openDevTools({mode: 'detach'})
                }
            }
        })
        if (isDev) {
            win.loadURL(`http://${devConfig.host}:${devConfig.port}`).then(); // 确保端口与 vite 配置一致
        } else {
            // 生产环境才加载 dist
            win.loadFile(path.join(__dirname, '../dist/index.html')).then();
        }
        windowChange(win);
    }

    function updateNavState(win: BrowserWindow) {
        win
    }

    function createTray() {
        try {
            const logoPath = path.join(app.getAppPath(), app.isPackaged ? "../logo" : "logo", "favicon.ico");
            logger.log(logoPath);
            tray = new Tray(nativeImage.createFromPath(logoPath));
        } catch (err) {
            logger.error(err);
            return
        }
        // 2. 配置托盘右键菜单
        const contextMenu = Menu.buildFromTemplate([
            {
                label: '显示',
                click: () => {
                    win?.show(); // 👈 点击显示，重新呼出窗口
                }
            },
            {
                label: '退出程序',
                click: () => {
                    quit().then();
                }
            }
        ]);
        tray.setToolTip(appInfo.name);
        tray.setContextMenu(contextMenu);
        // 3. 监听托盘的双击/单击事件（实现点击托盘图标直接恢复窗口）
        tray.on('double-click', () => {
            win?.show();
        });
    }

    async function quit(event?: IpcMainInvokeEvent) {
        if (event) {
            BrowserWindow.fromWebContents(event.sender)?.close();
        }
        tray?.destroy();
        await lifeCycle.exit();
        app.quit();
    }

    async function cleanUpAndExit() {
        await quit();
        process.exit(0);
    }

    async function windowAllClosed() {
        await cleanUpAndExit();
    }
    //前置设置
    if (app.isPackaged) {
        app.setName("mellifera");
    }else{
        process.on('SIGINT', cleanUpAndExit);
        process.on('SIGTERM', cleanUpAndExit);
    }
    //回调
    app.whenReady().then(whenReady);
    appContext.setQuit(quit);
}