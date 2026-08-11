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
import { DrawingAcceptanceAdapter, DrawingDecisionAdapter, DrawingPlannerAdapter } from './services/drawing-agent/model-adapters.js'
import { DrawingToolRegistry } from './services/drawing-agent/tool-registry.js'
import { FileDrawingAgentAuditStore } from './services/drawing-agent/file-audit-store.js'
import { createDrawingsRouter } from './routes/drawings.js'
import { DrawingPerceptionPipeline } from './services/drawing-perception/pipeline.js'
import { FileDrawingObservationStore } from './services/drawing-perception/observation-store.js'
import { FileSourceArtifactStore } from './services/source-artifacts/file-source-artifact-store.js'
import { FileCvEvidenceStore } from './services/drawing-cv/evidence-store.js'
import { OpenCvWorkerProvider } from './services/drawing-cv/opencv-provider.js'
import { StoredSourceCvGateway } from './services/drawing-cv/source-gateway.js'
import { DrawingCvToolRegistry } from './services/drawing-cv/tool-registry.js'
import { FileCvCropStore } from './services/drawing-cv/crop-store.js'
import { FileDrawingFeedbackCheckpointStore } from './services/drawing-feedback/checkpoint-store.js'
import { DrawingFeedbackLoop } from './services/drawing-feedback/loop-controller.js'
import { DrawingFeedbackModelAdapter } from './services/drawing-feedback/model-adapter.js'
import { MemoryObservationRegionStore } from './services/drawing-feedback/region-store.js'
import { MemoryObservationSlotStore } from './services/drawing-feedback/slot-store.js'
import { SourceRasterFeedbackComparator } from './services/drawing-feedback/source-comparator.js'
import { PythonVectorizationProvider } from './services/drawing-vectorization/python-provider.js'
import { CleanLineVectorizationService } from './services/drawing-vectorization/service.js'

// load env
dotenv.config()

const app: express.Application = express()
const drawingRepository = new FileDrawingRepository({
  rootDirectory: path.resolve(process.cwd(), '.local/vectorai/drawings'),
})
const drawingApplication = new DrawingApplication({ repository: drawingRepository })
const primaryModel = process.env.COMPANY_AI_PRIMARY_MODEL || 'doubao-seed-2.0-lite'
const agentModelDefaults = Object.freeze({
  planner: process.env.COMPANY_AI_PLANNER_MODEL || primaryModel,
  decision: process.env.COMPANY_AI_DECISION_MODEL || primaryModel,
  repair: process.env.COMPANY_AI_REPAIR_MODEL || 'doubao-seed-2.1-turbo',
})
const auditStore = new FileDrawingAgentAuditStore({
  rootDirectory: path.resolve(process.cwd(), '.local/vectorai/runs'),
})
const sourceArtifacts = new FileSourceArtifactStore({
  rootDirectory: path.resolve(process.cwd(), '.local/vectorai/sources'),
})
const sourceCvGateway = new StoredSourceCvGateway({ sourceArtifacts })
const cvProvider = await OpenCvWorkerProvider.create({ workerCount: 1 })
const cvEvidenceStore = new FileCvEvidenceStore({
  rootDirectory: path.resolve(process.cwd(), '.local/vectorai/evidence'),
  resolveSourceSize: (sourceId) => sourceCvGateway.size(sourceId),
})
const vectorizationProvider = await PythonVectorizationProvider.create().catch((error: unknown) => {
  console.warn(
    '[Vectorization] Python worker unavailable; source feedback will use the model loop only.',
    error instanceof Error ? error.message : String(error),
  )
  return null
})
const cleanLineVectorization = vectorizationProvider
  ? new CleanLineVectorizationService({
      provider: vectorizationProvider,
      sources: sourceCvGateway,
      evidence: cvEvidenceStore,
    })
  : undefined
const cvCropStore = new FileCvCropStore({
  rootDirectory: path.resolve(process.cwd(), '.local/vectorai/crops'),
})
const observationRegions = new MemoryObservationRegionStore({
  resolveSourceSize: (sourceId) => sourceCvGateway.cachedSize(sourceId),
})
const observationSlots = new MemoryObservationSlotStore()
const cvTools = new DrawingCvToolRegistry({
  provider: cvProvider,
  evidenceStore: cvEvidenceStore,
  sources: sourceCvGateway,
  regions: {
    create: async (region) => observationRegions.create(region),
    read: async (regionId) => observationRegions.read(regionId),
  },
  crops: cvCropStore,
})
const sourceComparator = new SourceRasterFeedbackComparator({ sources: sourceCvGateway })
const drawingPerception = new DrawingPerceptionPipeline({
  observationStore: new FileDrawingObservationStore(
    path.resolve(process.cwd(), '.local/vectorai/runs'),
  ),
})
const drawingTools = new DrawingToolRegistry({ application: drawingApplication })
const drawingFeedback = new DrawingFeedbackLoop({
  application: drawingApplication,
  drawingTools,
  cvTools,
  model: new DrawingFeedbackModelAdapter(undefined, undefined, {
    readCrop: (mediaHandle) => cvCropStore.read(mediaHandle),
  }),
  regions: observationRegions,
  slots: observationSlots,
  compare: sourceComparator.compare.bind(sourceComparator),
  ...(cleanLineVectorization ? { vectorization: cleanLineVectorization } : {}),
  maxIterations: 160,
})
const agentRuntime = new DrawingAgentRuntime({
  application: drawingApplication,
  tools: drawingTools,
  planner: new DrawingPlannerAdapter(),
  decision: new DrawingDecisionAdapter(),
  acceptance: new DrawingAcceptanceAdapter(),
  auditStore,
  sourceArtifacts,
  perception: drawingPerception,
  visionModelName: primaryModel,
  visionRepairModelName: agentModelDefaults.repair,
  feedbackLoop: drawingFeedback,
  feedbackCheckpointStore: new FileDrawingFeedbackCheckpointStore({
    rootDirectory: path.resolve(process.cwd(), '.local/vectorai/runs'),
  }),
})

app.use(cors())
app.use(express.json({ limit: '30mb' }))
app.use(express.urlencoded({ extended: true, limit: '30mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/agent/runs', createAgentRunsRouter(
  agentRuntime,
  drawingApplication,
  agentModelDefaults,
  sourceArtifacts,
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

export async function closeAppServices(): Promise<void> {
  await Promise.all([
    cvProvider.close(),
    vectorizationProvider?.close(),
  ])
}
