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
import { FileDrawingRepository } from './services/drawing-application/file-drawing-repository.js'
import { DrawingApplication } from './services/drawing-application/application.js'
import { DrawingAgentRuntime } from './services/drawing-agent/runtime.js'
import { DrawingDecisionAdapter, DrawingPlannerAdapter } from './services/drawing-agent/model-adapters.js'
import { DrawingToolRegistry } from './services/drawing-agent/tool-registry.js'
import { FileDrawingAgentAuditStore } from './services/drawing-agent/file-audit-store.js'
import { createDrawingsRouter } from './routes/drawings.js'

// load env
dotenv.config()

const app: express.Application = express()
const drawingRepository = new FileDrawingRepository({
  rootDirectory: path.resolve(process.cwd(), '.local/vectorai/drawings'),
})
const drawingApplication = new DrawingApplication({ repository: drawingRepository })
const auditStore = new FileDrawingAgentAuditStore({
  rootDirectory: path.resolve(process.cwd(), '.local/vectorai/runs'),
})
const drawingTools = new DrawingToolRegistry({ application: drawingApplication })
const agentRuntime = new DrawingAgentRuntime({
  application: drawingApplication,
  tools: drawingTools,
  planner: new DrawingPlannerAdapter(),
  decision: new DrawingDecisionAdapter(),
  auditStore,
})
const primaryModel = process.env.COMPANY_AI_PRIMARY_MODEL || 'doubao-seed-2.0-lite'
const agentModelDefaults = Object.freeze({
  planner: process.env.COMPANY_AI_PLANNER_MODEL || primaryModel,
  decision: process.env.COMPANY_AI_DECISION_MODEL || primaryModel,
  repair: process.env.COMPANY_AI_REPAIR_MODEL || 'doubao-seed-2.1-turbo',
})

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/agent/runs', createAgentRunsRouter(
  agentRuntime,
  drawingApplication,
  agentModelDefaults,
))
app.use('/api/drawings', createDrawingsRouter(drawingApplication))

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
