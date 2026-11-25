# Mellifera Network

独立网络层模块，所有源码、配置和测试均位于 `network/` 目录。适用于 Node.js 24.21.0 + TypeScript。该包不依赖 Electron、Vue 或 Mellifera 业务层。

## 模块

- `protocol/`：JSON-RPC 2.0 控制消息、二进制数据帧（TCP 长度帧）。
- `rpc/`、`controller/`：RPC Dispatcher、显式方法白名单、请求/响应/超时管理。
- `transport/`：TCP、UDP 传输；QUIC 使用适配器接口。
- `processor/`、`session/`、`scheduler/`：数据处理器、数据会话和轮询调度。
- `proxy/`：本地 TCP/UDP 端口转发示例。
- `registry/`、`flow/`、`recovery/`：运行时注册、UDP Flow、网络恢复代际管理。
- `security/`、`capability/`、`resolver/`、`resource/`、`metrics/`、`lifecycle/`：认证、能力协商、DNS、资源限制、指标和关闭流程。

## 安装与构建

在本目录执行 `npm install`，然后 `npm run build`、`npm test`。

## 重要边界

1. JSON-RPC 只承载控制消息，代理业务数据使用二进制帧；UDP 数据报不应套用 TCP 粘包拆包机制。
2. `TcpProxyServer` / `UdpProxyServer` 是可独立运行的本地端口转发器示例，不等于完整的 Mellifera 客户端-服务端远程映射业务编排。
3. QUIC API 在 Node.js 中具有版本/运行时差异。本包不直接导入未经验证的 `node:quic` API，而提供 `QuicAdapter` 接口。需在目标 Node.js 24.21.0 环境按实际可用类型声明实现并集成连接迁移、Stream、Datagram。
4. TCP 代理连接无法在普通 TCP 重连后无损迁移；恢复管理器只管理网络代际与恢复状态，不伪称恢复了已中断的字节流。
5. TokenAuthenticator 使用恒定时间比较摘要，但 Token 的存储、传输 TLS、轮换和吊销策略仍由宿主应用提供。
6. `UdpProxyServer` 当前按源地址记录回包目的地，适用于单目标 UDP 转发；生产场景需结合 flowId、映射隔离、DNS/IP 访问策略和流量限制。

## 示例

```ts
import { TcpProxyServer } from './dist/index.js';
const proxy = new TcpProxyServer({
  listen: { host: '0.0.0.0', port: 9000 },
  target: { host: '127.0.0.1', port: 3000 },
});
const port = await proxy.listen();
console.log(`listening on ${port}`);
```
