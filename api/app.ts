/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import aiRoutes from './routes/ai.js'
import { createAgentRunsRouter } from './routes/agent-runs.js'
import { AgentRuntime } from './services/agent-runtime/runtime.js'
import { GatewayExecutorAdapter, GatewayPlannerAdapter } from './services/agent-runtime/model-adapters.js'
import { FileAuditStore } from './services/audit/file-audit-store.js'

// load env
dotenv.config()

const app: express.Application = express()
const agentRuntime = new AgentRuntime({
  planner: new GatewayPlannerAdapter(),
  executor: new GatewayExecutorAdapter(),
  auditStore: new FileAuditStore(path.resolve(process.cwd(), '.local/vectorai/runs')),
})

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/agent/runs', createAgentRunsRouter(agentRuntime))

/**
 * health
 */
app.use(
  '/api/health',
  (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[API Error]', req.method, req.originalUrl, error)
  void next
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
