import {
  AnalysisResult,
  ApiRisksResponse,
  AppliedEdit,
  BaseToEditedSegment,
  HighlightType,
  LegalBasis,
  Risk,
  Suggestion,
  SuggestionDecision,
} from './typing';

export const escapeHtml = (input: string) =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const formatDateTime = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

export const buildHighlightedHtml = (
  contractText: string,
  highlights: Array<{
    range: { start: number; end: number };
    type: HighlightType;
    id: string;
  }>,
) => {
  // highlights 必须按 start 排序
  const safeHighlights = [...highlights].sort(
    (a, b) => a.range.start - b.range.start,
  );

  let html = '';
  let lastIndex = 0;

  for (const h of safeHighlights) {
    if (h.range.start < lastIndex) continue;
    if (h.range.start < 0 || h.range.end > contractText.length) continue;
    if (h.range.end <= h.range.start) continue;

    html += escapeHtml(contractText.substring(lastIndex, h.range.start));
    html += `<mark class="hl ${h.type}">${escapeHtml(
      contractText.substring(h.range.start, h.range.end),
    )}</mark>`;
    lastIndex = h.range.end;
  }

  html += escapeHtml(contractText.substring(lastIndex));
  return html;
};

/**
 * 将后端 API 响应转换为前端数据结构
 */
export const transformApiResponse = (
  apiData: ApiRisksResponse,
  fallbackContent?: string,
): AnalysisResult => {
  const risks: Risk[] = [];
  const legalBasis: LegalBasis[] = [];
  const suggestions: Suggestion[] = [];
  const sourceContent = fallbackContent ?? apiData.raw_content ?? '';

  apiData.risks.forEach((apiRisk) => {
    // 转换风险项
    const riskId = `risk-${apiRisk.identifier}`;

    // 从 detected_issue 生成标题（取前25个字符）
    const issueText = apiRisk.detected_issue || '';
    const titleMatch = issueText.match(/^(.{0,25})/);
    const title = titleMatch
      ? titleMatch[1] + (issueText.length > 25 ? '...' : '')
      : '风险提示';

    // 转换关联的法律依据
    const riskLegalBasis: LegalBasis[] = apiRisk.legal_basis.map(
      (legal, legalIndex) => ({
        id: `legal-${apiRisk.identifier}-${legalIndex}`,
        lawName: legal.law_name,
        article: legal.order,
        content: legal.content,
        score: legal.relevance_score,
        explanation: undefined,
        relatedRange: apiRisk.highlight_range,
      }),
    );

    // 添加到全局法律依据列表（去重）
    riskLegalBasis.forEach((lb) => {
      if (
        !legalBasis.find(
          (existing) =>
            existing.lawName === lb.lawName && existing.article === lb.article,
        )
      ) {
        legalBasis.push(lb);
      }
    });

    const risk: Risk = {
      id: riskId,
      identifier: apiRisk.identifier,
      level: apiRisk.level,
      title,
      content: issueText,
      suggestion: apiRisk.suggestions,
      highlightRange: apiRisk.highlight_range,
      legalBasis: riskLegalBasis,
    };

    risks.push(risk);

    // 如果有修改建议，也创建一个 Suggestion 项
    // 兼容：后端可能把“建议措施”和“具体修改方案”拆为不同字段
    const apiRevisionText =
      (apiRisk as any)?.suggested_revision ?? (apiRisk as any)?.revised_text;
    const apiOriginalText = (apiRisk as any)?.original_text as
      | string
      | undefined;
    const apiReasonText =
      ((apiRisk as any)?.revision_rationale as string | undefined) ??
      ((apiRisk as any)?.suggestion_reason as string | undefined);

    // 只在有“具体修改方案”时生成 Suggestion，避免用 suggestions 兜底导致两者一致
    if (apiRevisionText) {
      // 尝试从原文中截取相关文本作为"原文"
      let originalText = '';
      if (sourceContent && apiRisk.highlight_range) {
        const { start, end } = apiRisk.highlight_range;
        if (start >= 0 && end <= sourceContent.length) {
          originalText = sourceContent.substring(start, end);
        }
      }

      if (apiOriginalText) {
        originalText = apiOriginalText;
      }

      // 如果无法获取原文（或者太长），截取一部分或使用 detected_issue 作为 fallback
      if (!originalText) {
        originalText =
          issueText.substring(0, 50) + (issueText.length > 50 ? '...' : '');
      } else if (originalText.length > 100) {
        originalText = originalText.substring(0, 100) + '...';
      }

      suggestions.push({
        id: `sug-${apiRisk.identifier}`,
        original: originalText,
        revised: apiRevisionText,
        reason: apiReasonText || `针对风险：${title}`,
        highlightRange: apiRisk.highlight_range,
      });
    }
  });

  return {
    contractText: sourceContent || undefined,
    risks,
    suggestions,
    legalBasis,
  };
};

/**
 * 基于“原文 + 已采纳建议集合”，生成修改版正文。
 * 说明：
 * - 统一从 baseText 重新计算，避免多次替换导致 range 漂移。
 * - 只对非重叠、合法 range 进行应用；重叠项将被跳过。
 */
export const applyAcceptedSuggestions = (
  baseText: string,
  suggestions: Suggestion[],
  decisions: Record<string, SuggestionDecision>,
): {
  text: string;
  appliedEdits: AppliedEdit[];
  skippedIds: string[];
  segments: BaseToEditedSegment[];
} => {
  const accepted = (suggestions ?? []).filter(
    (s) => decisions[s.id] === 'accepted',
  );

  const sorted = [...accepted]
    .filter(
      (s) =>
        s?.highlightRange &&
        Number.isFinite(s.highlightRange.start) &&
        Number.isFinite(s.highlightRange.end) &&
        s.highlightRange.end > s.highlightRange.start,
    )
    .sort((a, b) => a.highlightRange.start - b.highlightRange.start);

  let out = '';
  let lastIndex = 0;
  const appliedEdits: AppliedEdit[] = [];
  const skippedIds: string[] = [];
  const segments: BaseToEditedSegment[] = [];
  let lastAcceptedEnd = -1;

  for (const s of sorted) {
    const { start, end } = s.highlightRange;
    if (start < 0 || end > baseText.length || end <= start) {
      skippedIds.push(s.id);
      continue;
    }
    // 简单处理：跳过与已采纳区间重叠的建议
    if (start < lastAcceptedEnd) {
      skippedIds.push(s.id);
      continue;
    }

    if (start > lastIndex) {
      const outStart = out.length;
      out += baseText.slice(lastIndex, start);
      const outEnd = out.length;
      segments.push({
        kind: 'copy',
        baseStart: lastIndex,
        baseEnd: start,
        outStart,
        outEnd,
      });
    }
    const editStart = out.length;
    const replacement = s.revised ?? '';
    out += replacement;
    const editEnd = out.length;

    segments.push({
      kind: 'replace',
      suggestionId: s.id,
      baseStart: start,
      baseEnd: end,
      outStart: editStart,
      outEnd: editEnd,
    });

    appliedEdits.push({
      suggestionId: s.id,
      range: { start: editStart, end: editEnd },
    });
    lastIndex = end;
    lastAcceptedEnd = end;
  }

  if (lastIndex < baseText.length) {
    const outStart = out.length;
    out += baseText.slice(lastIndex);
    const outEnd = out.length;
    segments.push({
      kind: 'copy',
      baseStart: lastIndex,
      baseEnd: baseText.length,
      outStart,
      outEnd,
    });
  }

  return { text: out, appliedEdits, skippedIds, segments };
};

