export type WorkflowStatus =
  | 'idle'
  | 'running-ocr'
  | 'running-translation'
  | 'completed'
  | 'failed'

export type PerformanceMetrics = {
  ocrDurationMs: number | null
  translationDurationMs: number | null
}
