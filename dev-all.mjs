import { spawn } from "node:child_process";
import { devConfig } from "./dev.config.mjs";

const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";
const url = `http://${devConfig.host}:${devConfig.port}`;

const processes = [];

function run(command, args, name) {
    const child = spawn(command, args, {
        stdio: "inherit",
        shell: process.platform === "win32" && command.endsWith(".cmd"),
        env: { ...process.env },
    });

    processes.push(child);

    child.on("error", (error) => {
        console.error(`[${name}] 启动失败：`, error);
        stopAll(1);
    });

    child.on("exit", (code) => {
        if (code !== 0 && code !== null) {
            console.error(`[${name}] 退出，代码：${code}`);
            stopAll(code);
        }
    });

    return child;
}

function stopAll(code = 0) {
    for (const child of processes) {
        if (child.exitCode === null && !child.killed) {
            child.kill();
        }
    }

    process.exitCode = code;
}

// 启动渲染进程
run(
    npm,
    ["run", "dev", "-w", "render", "--", "--force"],
    "RENDER",
);

// 等待 Vite 就绪，再启动 Electron 工作区
run(
    process.execPath,
    [
        "-e",
        `
        const { spawn } = require("node:child_process");
        const url = ${JSON.stringify(url)};
        const isWindows = process.platform === "win32";
        const npm = isWindows ? "npm.cmd" : "npm";

        const waiter = spawn(
          "npx",
          ["wait-on", url],
          { stdio: "inherit", shell: isWindows }
        );

        waiter.on("exit", (code) => {
          if (code !== 0) process.exit(code ?? 1);
          else {
            const child = spawn(
              npm,
              ["run", "start", "-w", "server"],
              { stdio: "inherit", shell: isWindows }
            );
            child.on("exit", (c) => process.exit(c ?? 0));
          }
        });
        `,
    ],
    "SERVER",
);