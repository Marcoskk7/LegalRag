export interface HighlightRange {
  start: number;
  end: number;
}

export interface Risk {
  id: string;
  /** 后端返回的 identifier，用于精确查询单条风险 */
  identifier: string;
  level: 'high' | 'medium' | 'low';
  title: string;
  content: string;
  suggestion?: string;
  highlightRange: HighlightRange;
  legalBasis?: LegalBasis[];  // 关联的法律依据
}

export interface Suggestion {
  id: string;
  original: string;
  revised: string;
  reason?: string;
  highlightRange: HighlightRange;
}

export interface LegalBasis {
  id: string;
  lawName: string;
  article: string;
  content: string;
  score: number;
  explanation?: string;
  relatedRange: HighlightRange;
}

export interface AnalysisResult {
  contractText?: string;  // 合同原文
  risks: Risk[];
  suggestions: Suggestion[];
  legalBasis: LegalBasis[];
}

export type HighlightType = 'risk' | 'suggestion' | 'legal';

// ============ 后端 API 响应类型 ============

/** 后端返回的高亮范围 */
export interface ApiHighlightRange {
  start: number;
  end: number;
}

/** 后端返回的法律依据 */
export interface ApiLegalBasis {
  law_name: string;
  order: string;  // 条款编号，如 "第511条"
  content: string;
  reference_link: string | null;
  relevance_score: number;
}

/** 后端返回的单个风险项 */
export interface ApiRisk {
  identifier: string;
  level: 'high' | 'medium' | 'low';
  highlight_range: ApiHighlightRange;
  suggestions: string;  // 修改建议文本
  legal_basis: ApiLegalBasis[];
  detected_issue: string;  // 检测到的问题描述
}

/** API 1: GET /api/v1/documents/{uuid}/risks 响应 */
export interface ApiRisksResponse {
  uuid: string;
  raw_content?: string; // 合同原文
  risks: ApiRisk[];
  generated_at: string;
  analyzer_version: string;
  data_inconsistent: boolean;
  status: 'success' | 'failed' | 'analyzing' | 'init';
  error?: string;
}

/** API 新增：GET /api/v1/documents/{uuid}/content 响应 */
export interface ApiDocumentContentResponse {
  uuid: string;
  raw_content: string;
}

/** API 2: POST /api/v1/documents/{uuid}/risks/analyze 请求体 */
export interface ApiAnalyzeRequest {
  top_k?: number;
}

/** API 2: POST /api/v1/documents/{uuid}/risks/analyze 响应 */
export interface ApiAnalyzeResponse {
  uuid: string;
  status: 'analyzing';
  top_k: number;
}

/** API 3: GET /api/v1/documents/{uuid}/risks/status 响应 */
export interface ApiStatusResponse {
  uuid: string;
  status: 'init' | 'analyzing' | 'success' | 'failed';
  generated_at?: string | null;
  analyzer_version?: string;
  error?: string | null;
}
