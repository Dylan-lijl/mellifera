export default class AgentController {
  async getStatus() {
    return { online: true, uptime: process.uptime() }
  }

  async restart(params: { force?: boolean } = {}) {
    // Replace with the real restart operation.
    return { accepted: true, force: Boolean(params.force) }
  }
}
