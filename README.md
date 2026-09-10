# Mellifera

Mellifera 是一个基于 **Electron + Vue 3 + Node.js + TypeScript** 开发的网络转发与隧道工具。

支持 **TCP / UDP** 转发，并提供图形化界面和命令行运行方式。

## 项目结构

```text
mellifera/
├── server/     # Node.js 服务端，同时作为 Electron Main
├── render/     # Vue 3 前端界面
├── common/     # 公共类型、常量等
└── README.md
```

## 技术栈

* Electron
* Vue 3
* Vite
* Node.js
* TypeScript

## 开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

启动 Server：

```bash
npm run server
```

## License

待定。
