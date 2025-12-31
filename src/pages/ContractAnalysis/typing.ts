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
  legalBasis?: LegalBasis[]; // 关联的法律依据
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
  contractText?: string; // 合同原文
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
  order: string; // 条款编号，如 "第511条"
  content: string;
  reference_link: string | null;
  relevance_score: number;
}

/** 后端返回的单个风险项 */
export interface ApiRisk {
  identifier: string;
  level: 'high' | 'medium' | 'low';
  highlight_range: ApiHighlightRange;
  suggestions: string; // 修改建议文本（通常是“建议措施”）
  legal_basis: ApiLegalBasis[];
  detected_issue?: string | null; // 检测到的问题描述（后端可选）

  /**
   * 兼容后端新增：具体修改方案（字段名可能因版本不同而变化）
   * - suggested_revision / revised_text: 建议替换后的文本
   * - original_text: 建议替换前的原文片段（可选）
   * - suggestion_reason: 修改理由（可选）
   */
  suggested_revision?: string;
  revised_text?: string;
  original_text?: string;
  suggestion_reason?: string;
  revision_rationale?: string;
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

/** API: GET /api/v1/history/{uuid} 响应 */
export interface ApiHistoryDetailResponse {
  success: boolean;
  message?: string;
  data: {
    raw_content: string;
    content_created_at: string;
    risks: ApiRisk[];
    risk_status: 'success' | 'failed' | 'analyzing' | 'init';
    risks_generated_at?: string;
    risk_error?: string | null;
  };
}

// ============ 本地 UI 状态类型 ============

export type ExportSection = 'risks' | 'suggestions' | 'legal' | 'contract';

export type SuggestionDecision = 'accepted' | 'rejected' | 'undecided';

export type AppliedEdit = {
  suggestionId: string;
  range: { start: number; end: number };
};

export type BaseToEditedSegment =
  | {
      kind: 'copy';
      baseStart: number;
      baseEnd: number;
      outStart: number;
      outEnd: number;
    }
  | {
      kind: 'replace';
      suggestionId: string;
      baseStart: number;
      baseEnd: number;
      outStart: number;
      outEnd: number;
    };

// ============ Chat 相关类型 ============

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  // AI 回复可能包含的额外信息
  isLoading?: boolean;
  groundingMetadata?: GroundingMetadata;
}

export interface GroundingMetadata {
  web_search_queries?: string[];
  grounding_chunks?: Array<{
    web: {
      uri: string;
      title?: string;
    };
  }>;
  grounding_supports?: Array<{
    segment: {
      start_index: number;
      end_index: number;
      text: string;
    };
    grounding_chunk_indices: number[];
  }>;
  search_entry_point?: {
    rendered_content: string;
  };
  urls?: string[];
}

export interface ChatRequest {
  message?: string;
  messages?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
}
