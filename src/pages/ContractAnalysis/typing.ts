export interface HighlightRange {
  start: number;
  end: number;
}

export interface Risk {
  id: string;
  level: 'high' | 'medium' | 'low';
  title: string;
  content: string;
  suggestion?: string;
  highlightRange: HighlightRange;
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
  contractText: string;
  risks: Risk[];
  suggestions: Suggestion[];
  legalBasis: LegalBasis[];
}

export type HighlightType = 'risk' | 'suggestion' | 'legal';
