import { Sequelize } from 'sequelize'
import {sequelize} from "@/appContext";

type InitDB = (sequelize: Sequelize) => void | Promise<void>

export async function initDatabase(): Promise<void> {
  // Vite 编译时扫描当前目录及子目录
  const modules = import.meta.glob('./*Entity.{ts,js}', {
    eager: false,
  })

  const initializers: Array<{
    path: string
    initDB: InitDB
  }> = []

  for (const [path, loadModule] of Object.entries(modules)) {
    const module = await loadModule() as Record<string, unknown>
    if (typeof module.initDB === 'function') {
      initializers.push({
        path,
        initDB: module.initDB as InitDB,
      })
    }
  }
  // 按路径排序，保证执行顺序稳定
  initializers.sort((a, b) => a.path.localeCompare(b.path))
  for (const initializer of initializers) {
    console.log(`[Database] 初始化: ${initializer.path}`)
    await initializer.initDB(sequelize)
  }
  await sequelize.authenticate()
  await sequelize.sync({alter:true})
  const tables = await sequelize.getQueryInterface().showAllTables()
  console.log('[Database] 实际存在的表：', tables)
}