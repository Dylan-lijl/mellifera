import {spawn} from "node:child_process";
import {devConfig} from "./dev.config.mjs";

const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";
const npx = isWindows ? "npx.cmd" : "npx";
const url = `http://${devConfig.host}:${devConfig.port}`;
const processes = new Set();
let stopping = false;
let exitCode = 0;

function run(command, args, name, options = {}) {
    if (stopping) return null;

    const child = spawn(command, args, {
        stdio: "inherit",
        env: {...process.env},
        shell: isWindows && /\.(cmd|bat)$/i.test(command),
        ...options,
    });

    processes.add(child);

    child.once("error", (error) => {
        console.error(`[${name}] 启动失败：`, error);
        stopAll(1);
    });

    child.once("exit", (code, signal) => {
        processes.delete(child);

        console.log(
            `[${name}] 已退出，code=${code}, signal=${signal}`,
        );
    });

    return child;
}

/**
 * 结束子进程及其所有后代进程。
 */
function killTree(child) {
    if (!child.pid || child.exitCode !== null) return;

    if (isWindows) {
        const killer = spawn(
            "taskkill",
            ["/pid", String(child.pid), "/T", "/F"],
            {
                stdio: "ignore",
                windowsHide: true,
            },
        );

        killer.on("error", (error) => {
            console.error("[CLEANUP] taskkill 失败：", error);
        });

        return;
    }

    // POSIX 平台通过进程组结束整棵进程树。
    try {
        process.kill(-child.pid, "SIGTERM");
    } catch {
        try {
            child.kill("SIGTERM");
        } catch {
            // 进程可能已经退出。
        }
    }
}

function stopAll(code = 0) {
    if (stopping) return;
    stopping = true;
    exitCode = code;
    for (const child of processes) {
        killTree(child);
    }
    // 清理完成后由所有子进程的退出事件自然结束。
    // 这里不立即 process.exit()，避免清理过程被截断。
    if (processes.size === 0) {
        process.exitCode = exitCode;
    }
}

function watchCriticalProcess(child, name) {
    if (!child) return;
    child.once("exit", (code, signal) => {
        if (stopping) return;
        // 关键进程无论正常退出还是异常退出，
        // 都代表整个开发任务需要结束。
        const resultCode = code ?? (signal ? 1 : 0);
        stopAll(resultCode);
    });
}

process.on("SIGINT", () => stopAll(130));
process.on("SIGTERM", () => stopAll(143));
// 1. 启动渲染进程
const render = run(
    npm,
    ["run", "dev", "-w", "render", "--", "--force"],
    "RENDER",
);
watchCriticalProcess(render, "RENDER");
// 2. 等待 Vite 就绪
const waiter = run(
    npx,
    ["wait-on", url],
    "WAIT-ON",
);

if (waiter) {
    waiter.once("exit", (code) => {
        if (stopping) return;
        if (code !== 0) {
            console.error(`[WAIT-ON] 退出，代码：${code}`);
            stopAll(code ?? 1);
            return;
        }
        // 3. 启动 Electron 工作区
        const server = run(
            npm,
            ["run", "start", "-w", "server"],
            "SERVER",
        );
        watchCriticalProcess(server, "SERVER");
    });
}
