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
import { ModelLedDrawingAgentRuntime } from './services/drawing-agent/model-loop-runtime.js'
import { ModelLoopActionAdapter } from './services/drawing-agent/model-loop-adapter.js'
import { DrawingPreviewVerificationAdapter } from './services/drawing-agent/preview-verifier.js'
import { GatewayDrawingPartitionModel } from './services/drawing-partition/partition-model.js'
import { isDrawingImageEditConfigured } from './services/ai-gateway.js'
import { FileDrawingAgentAuditStore } from './services/drawing-agent/file-audit-store.js'
import { createDrawingsRouter } from './routes/drawings.js'
import { FileSourceArtifactStore } from './services/source-artifacts/file-source-artifact-store.js'
import { FileCvEvidenceStore } from './services/drawing-cv/evidence-store.js'
import { OpenCvWorkerProvider } from './services/drawing-cv/opencv-provider.js'
import { StoredSourceCvGateway } from './services/drawing-cv/source-gateway.js'
import { DrawingCvToolRegistry } from './services/drawing-cv/tool-registry.js'
import { FileCvCropStore } from './services/drawing-cv/crop-store.js'
import { MemoryObservationRegionStore } from './services/drawing-feedback/region-store.js'
import { PythonVectorizationProvider } from './services/drawing-vectorization/python-provider.js'
import { CleanLineVectorizationService } from './services/drawing-vectorization/service.js'
import { GatewayDrawingRegionImageEditProvider } from './services/drawing-generation/gateway-provider.js'
import { DrawingRegionRedrawService } from './services/drawing-generation/redraw-service.js'
import { createModelDrawingToolGateway } from './services/drawing-tools/index.js'
import { FileHumanInteractionStore } from './services/human-interaction/file-store.js'
import { FileDxfManifestStore } from './services/drawing-dxf/manifest-store.js'
import { DxfImportCoordinator } from './services/drawing-dxf/coordinator.js'

// load env
dotenv.config()

const app: express.Application = express()
const drawingRepository = new FileDrawingRepository({
  rootDirectory: path.resolve(process.cwd(), '.local/vectorai/drawings'),
})
const drawingApplication = new DrawingApplication({ repository: drawingRepository })
const primaryModel = process.env.COMPANY_AI_PRIMARY_MODEL || 'doubao-seed-2.0-lite'
const spatialModel = process.env.COMPANY_AI_SPATIAL_MODEL
  || 'doubao-seed-2.1-turbo'
const reviewModel = process.env.COMPANY_AI_REVIEW_MODEL || spatialModel
const agentModelDefaults = Object.freeze({
  planner: spatialModel,
  decision: spatialModel,
  repair: spatialModel,
  reviewer: reviewModel,
})
const auditStore = new FileDrawingAgentAuditStore({
  rootDirectory: path.resolve(process.cwd(), '.local/vectorai/runs'),
})
const sourceArtifacts = new FileSourceArtifactStore({
  rootDirectory: path.resolve(process.cwd(), '.local/vectorai/sources'),
})
const dxfImports = new DxfImportCoordinator({
  application: drawingApplication,
  sources: sourceArtifacts,
  manifests: new FileDxfManifestStore({
    rootDirectory: path.resolve(process.cwd(), '.local/vectorai/dxf-manifests'),
  }),
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
const regionRedraw = cleanLineVectorization && isDrawingImageEditConfigured()
  ? new DrawingRegionRedrawService({
      provider: new GatewayDrawingRegionImageEditProvider({
        modelName: process.env.COMPANY_AI_IMAGE_EDIT_MODEL || primaryModel,
      }),
      sourceArtifacts,
      vectorization: cleanLineVectorization,
    })
  : undefined
const cvCropStore = new FileCvCropStore({
  rootDirectory: path.resolve(process.cwd(), '.local/vectorai/crops'),
})
const observationRegions = new MemoryObservationRegionStore({
  resolveSourceSize: (sourceId) => sourceCvGateway.cachedSize(sourceId),
})
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
const drawingGateway = createModelDrawingToolGateway({
  application: drawingApplication,
  ...(regionRedraw ? { redraw: regionRedraw } : {}),
  ...(cleanLineVectorization ? { vectorization: cleanLineVectorization } : {}),
  cvTools,
})
const agentRuntime = new ModelLedDrawingAgentRuntime({
  application: drawingApplication,
  registry: drawingGateway.registry,
  drawingTools: drawingGateway.drawingTools,
  generationTools: drawingGateway.generationTools,
  runResources: drawingGateway,
  model: new ModelLoopActionAdapter(),
  previewVerifier: new DrawingPreviewVerificationAdapter(),
  partitionModel: new GatewayDrawingPartitionModel({
    modelName: process.env.COMPANY_AI_PARTITION_MODEL || spatialModel || primaryModel,
  }),
  interactions: new FileHumanInteractionStore({
    rootDirectory: path.resolve(process.cwd(), '.local/vectorai/runs'),
  }),
  auditStore,
  sourceImages: sourceCvGateway,
  sourceCrops: cvCropStore,
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
app.use('/api/drawings', createDrawingsRouter(drawingApplication, {
  stopActiveRuns: (drawingId) => agentRuntime.stopActiveRunsForDrawing(drawingId),
}, dxfImports))

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
