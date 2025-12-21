/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-promise-executor-return */

import { PageContainer } from '@ant-design/pro-components';
import { history, request, useSearchParams } from '@umijs/max';
import {
  Button,
  Card,
  Checkbox,
  Divider,
  Input,
  message,
  Modal,
  Rate,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import './index.less';
import type {
  AnalysisResult,
  ApiAnalyzeResponse,
  ApiDocumentContentResponse,
  ApiRisk,
  ApiRisksResponse,
  ApiStatusResponse,
  HighlightType,
  LegalBasis,
  Risk,
  Suggestion,
} from './typing';

// 后端 API 基础地址
// - 开发环境推荐使用 Umi proxy（见 .umirc.ts），此时这里保持空字符串即可走同源 /api。
// - 如需直连某个后端（例如局域网 IP），可在运行前设置环境变量 UMI_APP_API_BASE_URL。
const API_BASE_URL = (process.env.UMI_APP_API_BASE_URL as string) || '';
const UPLOAD_URL = `${API_BASE_URL}/api/v1/upload`;

type ExportSection = 'risks' | 'suggestions' | 'legal' | 'contract';

const escapeHtml = (input: string) =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatDateTime = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

const buildHighlightedHtml = (
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
const transformApiResponse = (
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

type SuggestionDecision = 'accepted' | 'rejected' | 'undecided';

type AppliedEdit = {
  suggestionId: string;
  range: { start: number; end: number };
};

type BaseToEditedSegment =
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

/**
 * 基于“原文 + 已采纳建议集合”，生成修改版正文。
 * 说明：
 * - 统一从 baseText 重新计算，避免多次替换导致 range 漂移。
 * - 只对非重叠、合法 range 进行应用；重叠项将被跳过。
 */
const applyAcceptedSuggestions = (
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

const ContractAnalysis: React.FC = () => {
  const [searchParams] = useSearchParams();
  const fileId = searchParams.get('fileId');

  const [loading, setLoading] = useState(true);
  const [analysisStatus, setAnalysisStatus] = useState<
    'init' | 'analyzing' | 'success' | 'failed'
  >('init');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [documentContent, setDocumentContent] = useState<string>('');
  const [activeHighlight, setActiveHighlight] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState<any>(null);
  const [modalType, setModalType] = useState<'risk' | 'suggestion' | 'legal'>(
    'risk',
  );
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportSections, setExportSections] = useState<ExportSection[]>([
    'risks',
    'suggestions',
    'contract',
  ]);
  const [exportIncludeHighlights, setExportIncludeHighlights] = useState(true);
  // 右侧风险详情（从新接口按 identifier 精确获取）
  const [selectedRiskDetail, setSelectedRiskDetail] = useState<ApiRisk | null>(
    null,
  );

  // 合同文本编辑（仅前端本地生效；如需重新分析，可上传为新文档）
  const [editedContractText, setEditedContractText] = useState<string | null>(
    null,
  );
  const [isEditingContract, setIsEditingContract] = useState(false);

  // 逐条采纳/拒绝建议
  const [suggestionDecisions, setSuggestionDecisions] = useState<
    Record<string, SuggestionDecision>
  >({});
  const [appliedEdits, setAppliedEdits] = useState<AppliedEdit[]>([]);
  const [baseToEditedSegments, setBaseToEditedSegments] = useState<
    BaseToEditedSegment[]
  >([]);

  // 可拖拽调整左右区域宽度（持久化到 localStorage）
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const splitStorageKey = 'contractAnalysis:leftPanePercent';
  const clampNumber = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, v));
  const [leftPanePercent, setLeftPanePercent] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(splitStorageKey);
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n)) return clampNumber(n, 25, 75);
    } catch {
      // ignore
    }
    return 50;
  });
  const dragRef = useRef<{ dragging: boolean } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(splitStorageKey, String(leftPanePercent));
    } catch {
      // ignore
    }
  }, [leftPanePercent]);

  const contractTextRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleResizerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // 仅处理鼠标左键拖拽（触摸/触控笔不区分 button）
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    dragRef.current = { dragging: true };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleResizerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current?.dragging) return;
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (!rect.width) return;
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    setLeftPanePercent(clampNumber(percent, 25, 75));
  };

  const stopResizerDrag = () => {
    if (!dragRef.current?.dragging) return;
    dragRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  // API 3: 获取分析状态
  const fetchStatus = async (): Promise<ApiStatusResponse | null> => {
    try {
      return await request<ApiStatusResponse>(
        `${API_BASE_URL}/api/v1/documents/${fileId}/risks/status`,
        { method: 'GET' },
      );
    } catch (error) {
      console.error('Fetch status error:', error);
      return null;
    }
  };

  // 新增：获取文档原文内容
  const fetchDocumentContent =
    async (): Promise<ApiDocumentContentResponse | null> => {
      try {
        const res = await request<ApiDocumentContentResponse>(
          `${API_BASE_URL}/api/v1/documents/${fileId}/content`,
          { method: 'GET' },
        );
        if (res?.raw_content) {
          setDocumentContent(res.raw_content);
        }
        return res;
      } catch (error) {
        console.error('Fetch document content error:', error);
        return null;
      }
    };

  // API 1: 获取完整结果
  const fetchRisks = async (): Promise<ApiRisksResponse | null> => {
    try {
      return await request<ApiRisksResponse>(
        `${API_BASE_URL}/api/v1/documents/${fileId}/risks`,
        { method: 'GET' },
      );
    } catch (error) {
      console.error('Fetch risks error:', error);
      return null;
    }
  };

  // 新增：按 identifier 获取单条风险详情
  const fetchRiskDetail = async (
    identifier: string,
  ): Promise<ApiRisk | null> => {
    if (!fileId) return null;
    try {
      const res = await request<ApiRisk>(
        `${API_BASE_URL}/api/v1/documents/${fileId}/risks/${identifier}`,
        { method: 'GET' },
      );
      return res;
    } catch (error) {
      console.error('Fetch risk detail error:', error);
      message.error('获取风险详情失败');
      return null;
    }
  };

  // API 2: 触发分析
  const triggerAnalysis = async (): Promise<ApiAnalyzeResponse | null> => {
    try {
      return await request<ApiAnalyzeResponse>(
        `${API_BASE_URL}/api/v1/documents/${fileId}/risks/analyze`,
        {
          method: 'POST',
          data: { top_k: 1 },
        },
      );
    } catch (error) {
      console.error('Trigger analysis error:', error);
      return null;
    }
  };

  // 加载最终结果
  const loadResults = async () => {
    // 并行获取原文内容 + 风险分析结果
    const [contentRes, risksRes] = await Promise.all([
      fetchDocumentContent(),
      fetchRisks(),
    ]);

    if (risksRes && risksRes.status === 'success') {
      const transformed = transformApiResponse(
        risksRes,
        contentRes?.raw_content ?? documentContent,
      );
      setAnalysisResult(transformed);

      // 默认展示 identifier 为 "0" 的风险详情（如果存在），否则展示第一条
      if (risksRes.risks && risksRes.risks.length > 0) {
        const defaultRisk =
          risksRes.risks.find((r) => r.identifier === '0') ?? risksRes.risks[0];
        const detail = await fetchRiskDetail(defaultRisk.identifier);
        if (detail) {
          setSelectedRiskDetail(detail);
          // 同步高亮对应的风险段落
          const defaultHighlightId = `risk-${defaultRisk.identifier}`;
          setActiveHighlight(defaultHighlightId);
          const element = document.getElementById(defaultHighlightId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    } else {
      message.error('获取分析结果失败');
    }
    setLoading(false);
  };

  // 轮询状态
  const pollStatus = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

    pollTimerRef.current = setTimeout(async () => {
      const statusRes = await fetchStatus();
      if (!statusRes) {
        // 网络错误等，暂停轮询或继续重试？这里选择继续重试
        pollStatus();
        return;
      }

      if (statusRes.status === 'success') {
        setAnalysisStatus('success');
        message.success('分析完成！');
        await loadResults();
      } else if (statusRes.status === 'failed') {
        setAnalysisStatus('failed');
        setLoading(false);
        message.error(statusRes.error || '分析失败');
      } else {
        // init 或 analyzing，继续轮询
        pollStatus();
      }
    }, 2000); // 2秒轮询一次
  };

  const handleTriggerAnalysis = async () => {
    setAnalysisStatus('analyzing');
    // 同样，触发分析也可能因为数据库延迟而404，给予一次重试机会
    let analyzeRes = await triggerAnalysis();

    if (!analyzeRes) {
      console.log('First analysis trigger failed, retrying in 1s...');
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1000);
      });
      analyzeRes = await triggerAnalysis();
    }

    if (analyzeRes && analyzeRes.status === 'analyzing') {
      message.info('开始智能分析...');
      pollStatus();
    } else {
      setAnalysisStatus('failed');
      setLoading(false);
      // 如果是因为文档不存在导致的失败，给特定的提示
      message.error('触发分析失败，可能是文档尚未准备好，请稍后重试');
    }
  };

  // 启动流程：直接触发分析 -> 轮询状态
  const startProcess = async () => {
    setLoading(true);

    // 直接触发分析（对于新上传的文档，避免先GET状态导致404）
    await handleTriggerAnalysis();
  };

  // 页面加载时自动开始流程
  useEffect(() => {
    if (!fileId) {
      message.error('缺少文件ID，请重新上传');
      history.push('/');
      return;
    }

    // fileId 变化时，清空本地编辑状态
    setEditedContractText(null);
    setIsEditingContract(false);
    setSuggestionDecisions({});
    setAppliedEdits([]);

    startProcess();

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [fileId]);

  // 强制重新分析
  const handleReanalyze = async () => {
    if (!fileId) return;
    setLoading(true);
    await handleTriggerAnalysis();
  };

  // 返回上传页
  const handleBack = () => {
    history.push('/');
  };

  // 显示风险详情
  const showRiskModal = (risk: Risk) => {
    setModalType('risk');
    setModalContent(risk);
    setModalVisible(true);
  };

  // 显示修改建议详情
  const showSuggestionModal = (suggestion: Suggestion) => {
    setModalType('suggestion');
    setModalContent(suggestion);
    setModalVisible(true);
  };

  // 显示法律依据详情
  const showLegalModal = (legal: LegalBasis) => {
    setModalType('legal');
    setModalContent(legal);
    setModalVisible(true);
  };

  // 处理高亮点击
  const handleHighlightClick = (type: HighlightType, id: string) => {
    if (type === 'risk') {
      const risk = analysisResult?.risks.find((r) => r.id === id);
      if (risk) {
        setActiveHighlight(id);
        // 点击正文高亮时，同步加载右侧风险详情
        fetchRiskDetail(risk.identifier).then((detail) => {
          if (detail) {
            setSelectedRiskDetail(detail);
          }
        });
        showRiskModal(risk);
      }
    } else if (type === 'suggestion') {
      setActiveHighlight(id);
      const suggestion = analysisResult?.suggestions.find((s) => s.id === id);
      if (suggestion) showSuggestionModal(suggestion);
    } else if (type === 'legal') {
      setActiveHighlight(id);
      const legal = analysisResult?.legalBasis.find((l) => l.id === id);
      if (legal) showLegalModal(legal);
    }
  };

  // 渲染高亮文本
  const renderHighlightedText = () => {
    // 优先使用分析后的结构化结果，如果还没有则降级展示原文全文
    if (!analysisResult || !analysisResult.contractText) {
      if (documentContent) {
        return <pre className="whitespace-pre-wrap">{documentContent}</pre>;
      }
      return (
        <div className="text-gray-400 text-center py-10">暂无合同文本内容</div>
      );
    }

    const { contractText, risks, legalBasis } = analysisResult;
    const highlights: Array<{
      range: { start: number; end: number };
      type: HighlightType;
      id: string;
      riskLevel?: Risk['level'];
    }> = [];

    risks.forEach((risk) => {
      highlights.push({
        range: risk.highlightRange,
        type: 'risk',
        id: risk.id,
        riskLevel: risk.level,
      });
    });

    // 不额外渲染“修改建议”高亮：避免页面信息过载。
    // 具体修改方案在用户点击风险高亮后的弹窗中选择采纳/不采纳。

    legalBasis.forEach((legal) => {
      highlights.push({
        range: legal.relatedRange,
        type: 'legal',
        id: legal.id,
      });
    });

    highlights.sort((a, b) => a.range.start - b.range.start);

    let result: React.ReactNode[] = [];
    let lastIndex = 0;

    highlights.forEach((highlight, index) => {
      // 简单的越界检查
      if (highlight.range.start < lastIndex) return; // 忽略重叠或乱序导致的错误范围
      if (highlight.range.end > contractText.length) return;

      if (highlight.range.start > lastIndex) {
        result.push(
          <span key={`text-${index}`}>
            {contractText.substring(lastIndex, highlight.range.start)}
          </span>,
        );
      }

      result.push(
        <mark
          key={`highlight-${highlight.id}`}
          className={`highlight ${highlight.type} ${
            highlight.type === 'risk' && highlight.riskLevel
              ? `risk-${highlight.riskLevel}`
              : ''
          } ${activeHighlight === highlight.id ? 'active' : ''}`}
          id={highlight.id}
          onClick={() => handleHighlightClick(highlight.type, highlight.id)}
        >
          {contractText.substring(highlight.range.start, highlight.range.end)}
        </mark>,
      );

      lastIndex = highlight.range.end;
    });

    if (lastIndex < contractText.length) {
      result.push(
        <span key="text-end">{contractText.substring(lastIndex)}</span>,
      );
    }

    return result;
  };

  const getPrintableContractText = () => {
    // 优先使用本地编辑后的正文；否则使用结构化原文；再降级用 documentContent
    return (
      editedContractText ??
      (analysisResult?.contractText || documentContent || '')
    );
  };

  const getBaseContractText = () =>
    analysisResult?.contractText || documentContent || '';

  const handleStartEdit = () => {
    const base = getPrintableContractText();
    if (!base) {
      message.warning('暂无可编辑的合同文本');
      return;
    }
    setEditedContractText(base);
    setIsEditingContract(true);
  };

  const handleFinishEdit = () => {
    setIsEditingContract(false);
    message.success('已在页面中保存修改（未上传至服务器）');
  };

  const handleDiscardEdits = () => {
    setEditedContractText(null);
    setIsEditingContract(false);
    setAppliedEdits([]);
    setSuggestionDecisions({});
    message.info('已撤销修改');
  };

  const getDecision = (id: string): SuggestionDecision =>
    suggestionDecisions[id] ?? 'undecided';

  const recomputeEditedFromDecisions = (
    nextDecisions: Record<string, SuggestionDecision>,
  ) => {
    const base = getBaseContractText();
    if (!analysisResult || !base) return;

    const {
      text,
      appliedEdits: edits,
      skippedIds,
      segments,
    } = applyAcceptedSuggestions(
      base,
      analysisResult.suggestions,
      nextDecisions,
    );

    setEditedContractText(text);
    setIsEditingContract(false);
    setAppliedEdits(edits);
    setBaseToEditedSegments(segments);

    if (skippedIds.length) {
      message.warning(`有 ${skippedIds.length} 条建议因范围重叠/异常未能应用`);
    }
  };

  const updateDecision = (id: string, decision: SuggestionDecision) => {
    if (!analysisResult) return;
    if (isEditingContract) {
      message.warning('请先点击“完成/撤销”退出手动编辑，再进行建议采纳');
      return;
    }

    const next = { ...suggestionDecisions, [id]: decision };
    setSuggestionDecisions(next);

    // 只要存在至少一条“已采纳”，就生成修改版；否则回到原文展示
    const hasAccepted = Object.values(next).some((v) => v === 'accepted');
    if (!hasAccepted) {
      setBaseToEditedSegments([]);
      setEditedContractText(null);
      setAppliedEdits([]);
      return;
    }

    recomputeEditedFromDecisions(next);
  };

  const renderEditedTextWithAppliedHighlights = () => {
    if (!editedContractText) return null;
    // 没有结构化的“已采纳建议”范围时（例如手动编辑），做一个兜底高亮：从首次差异到末次差异
    if (!appliedEdits.length) {
      const base = getBaseContractText();
      if (!base || base === editedContractText) {
        return <pre className="whitespace-pre-wrap">{editedContractText}</pre>;
      }

      const minLen = Math.min(base.length, editedContractText.length);
      let prefix = 0;
      while (prefix < minLen && base[prefix] === editedContractText[prefix]) {
        prefix += 1;
      }

      let suffix = 0;
      while (
        suffix < minLen - prefix &&
        base[base.length - 1 - suffix] ===
          editedContractText[editedContractText.length - 1 - suffix]
      ) {
        suffix += 1;
      }

      const start = prefix;
      const end = editedContractText.length - suffix;
      if (end <= start) {
        return <pre className="whitespace-pre-wrap">{editedContractText}</pre>;
      }

      return (
        <div className="whitespace-pre-wrap">
          <span>{editedContractText.slice(0, start)}</span>
          <mark className="highlight edit">
            {editedContractText.slice(start, end)}
          </mark>
          <span>{editedContractText.slice(end)}</span>
        </div>
      );
    }

    const mapBaseIndexToEdited = (idx: number): number | null => {
      for (const seg of baseToEditedSegments) {
        if (idx < seg.baseStart || idx > seg.baseEnd) continue;
        if (seg.kind !== 'copy') return null;
        const offset = idx - seg.baseStart;
        const mapped = seg.outStart + offset;
        if (mapped < seg.outStart || mapped > seg.outEnd) return null;
        return mapped;
      }
      return null;
    };

    const mapBaseRangeToEdited = (r: {
      start: number;
      end: number;
    }): { start: number; end: number } | null => {
      const start = mapBaseIndexToEdited(r.start);
      const end = mapBaseIndexToEdited(r.end);
      if (start === null || end === null) return null;
      if (end <= start) return null;
      return { start, end };
    };

    const overlap = (
      a: { start: number; end: number },
      b: { start: number; end: number },
    ) => a.start < b.end && b.start < a.end;

    const subtractRanges = (
      baseRange: { start: number; end: number },
      cuts: Array<{ start: number; end: number }>,
    ): Array<{ start: number; end: number }> => {
      const out: Array<{ start: number; end: number }> = [];
      let cursor = baseRange.start;

      for (const cut of cuts) {
        if (cut.end <= cursor) continue;
        if (cut.start >= baseRange.end) break;
        if (!overlap({ start: cursor, end: baseRange.end }, cut)) continue;

        const segEnd = Math.min(cut.start, baseRange.end);
        if (segEnd > cursor) {
          out.push({ start: cursor, end: segEnd });
        }
        cursor = Math.max(cursor, cut.end);
        if (cursor >= baseRange.end) break;
      }

      if (cursor < baseRange.end) {
        out.push({ start: cursor, end: baseRange.end });
      }

      return out.filter((r) => r.end > r.start);
    };

    const editRanges = [...appliedEdits]
      .map((e) => e.range)
      .filter((r) => r.end > r.start)
      .sort((a, b) => a.start - b.start);

    const highlights: Array<{
      key: string;
      range: { start: number; end: number };
      type: HighlightType | 'edit';
      id: string;
      riskLevel?: Risk['level'];
      suggestionId?: string;
    }> = [];

    // 绿色：已采纳建议
    appliedEdits.forEach((e) => {
      if (e.range.end <= e.range.start) return;
      highlights.push({
        key: `edit-${e.suggestionId}`,
        range: e.range,
        type: 'edit',
        id: `edit-${e.suggestionId}`,
        suggestionId: e.suggestionId,
      });
    });

    // 红色风险 / 紫色法条：尽量映射到修改版正文里（不与已采纳区间重叠才显示，避免错位）
    const risks = analysisResult?.risks ?? [];
    const legalBasis = analysisResult?.legalBasis ?? [];

    risks.forEach((risk) => {
      const mapped = mapBaseRangeToEdited(risk.highlightRange);
      if (!mapped) return;
      const pieces = subtractRanges(mapped, editRanges);
      pieces.forEach((piece, idx) => {
        highlights.push({
          key: `${risk.id}__${idx}`,
          range: piece,
          type: 'risk',
          id: risk.id,
          riskLevel: risk.level,
        });
      });
    });

    legalBasis.forEach((legal) => {
      const mapped = mapBaseRangeToEdited(legal.relatedRange);
      if (!mapped) return;
      const pieces = subtractRanges(mapped, editRanges);
      pieces.forEach((piece, idx) => {
        highlights.push({
          key: `${legal.id}__${idx}`,
          range: piece,
          type: 'legal',
          id: legal.id,
        });
      });
    });

    highlights.sort((a, b) => {
      if (a.range.start !== b.range.start) return a.range.start - b.range.start;
      // 同起点时：优先渲染 edit
      if (a.type === 'edit' && b.type !== 'edit') return -1;
      if (b.type === 'edit' && a.type !== 'edit') return 1;
      return a.range.end - b.range.end;
    });

    const nodes: React.ReactNode[] = [];
    let last = 0;

    for (let i = 0; i < highlights.length; i += 1) {
      const h = highlights[i];
      if (h.range.start < last) continue;
      if (h.range.end > editedContractText.length) continue;

      if (h.range.start > last) {
        nodes.push(
          <span key={`mix-text-${i}`}>
            {editedContractText.slice(last, h.range.start)}
          </span>,
        );
      }

      if (h.type === 'edit') {
        const suggestionId = h.suggestionId as string;
        nodes.push(
          <mark
            key={`mix-edit-${suggestionId}`}
            id={`edit-${suggestionId}`}
            className={`highlight edit ${
              activeHighlight === `edit-${suggestionId}` ? 'active' : ''
            }`}
            onClick={() => {
              setActiveHighlight(`edit-${suggestionId}`);
              const identifier = suggestionId.replace(/^sug-/, '');
              const risk = analysisResult?.risks.find(
                (r) => r.identifier === identifier,
              );
              if (risk) {
                // 复用风险弹窗，允许在弹窗里单独取消/恢复该条修改
                fetchRiskDetail(risk.identifier).then((detail) => {
                  if (detail) setSelectedRiskDetail(detail);
                });
                showRiskModal(risk);
              }
            }}
          >
            {editedContractText.slice(h.range.start, h.range.end)}
          </mark>,
        );
      } else {
        nodes.push(
          <mark
            key={h.key}
            className={`highlight ${h.type} ${
              h.type === 'risk' && h.riskLevel ? `risk-${h.riskLevel}` : ''
            } ${activeHighlight === h.id ? 'active' : ''}`}
            id={h.id}
            onClick={() => handleHighlightClick(h.type as HighlightType, h.id)}
          >
            {editedContractText.slice(h.range.start, h.range.end)}
          </mark>,
        );
      }

      last = h.range.end;
    }

    if (last < editedContractText.length) {
      nodes.push(
        <span key="mix-text-end">{editedContractText.slice(last)}</span>,
      );
    }

    return <div className="whitespace-pre-wrap">{nodes}</div>;
  };

  const uploadEditedAndAnalyze = async () => {
    const text = editedContractText;
    if (!text) {
      message.warning('请先编辑或应用建议');
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      const file = new File([text], `edited-${fileId || 'contract'}.txt`, {
        type: 'text/plain',
      });
      formData.append('file', file);

      const resp = await fetch(UPLOAD_URL, {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const json = (await resp.json()) as any;
      if (json?.success && json?.data?.uuid) {
        message.success('已上传修改版，开始重新分析');
        history.push(`/contract-analysis?fileId=${json.data.uuid}`);
        return;
      }

      setLoading(false);
      message.error(json?.message || '上传失败');
    } catch (e) {
      console.error(e);
      setLoading(false);
      message.error('上传失败，请重试');
    }
  };

  const collectHighlightsForExport = () => {
    if (!analysisResult) return [];
    const { risks, suggestions, legalBasis } = analysisResult;
    const highlights: Array<{
      range: { start: number; end: number };
      type: HighlightType;
      id: string;
    }> = [];

    // 导出时：高亮主要用于“定位风险/建议/法条”，和页面一致
    risks.forEach((risk) => {
      highlights.push({
        range: risk.highlightRange,
        type: 'risk',
        id: risk.id,
      });
    });
    suggestions.forEach((sug) => {
      highlights.push({
        range: sug.highlightRange,
        type: 'suggestion',
        id: sug.id,
      });
    });
    legalBasis.forEach((legal) => {
      highlights.push({
        range: legal.relatedRange,
        type: 'legal',
        id: legal.id,
      });
    });
    highlights.sort((a, b) => a.range.start - b.range.start);
    return highlights;
  };

  const buildPrintHtml = () => {
    const now = new Date();
    const printableText = getPrintableContractText();
    const canIncludeHighlights = exportIncludeHighlights && !editedContractText;
    const sections = new Set(exportSections);
    const includeContract = sections.has('contract');
    const includeRisks = sections.has('risks');
    const includeSuggestions = sections.has('suggestions');
    const includeLegal = sections.has('legal');

    const title = '合同分析结果（导出）';
    const subtitle = `导出时间：${formatDateTime(now)}${
      fileId ? ` · 文件ID：${escapeHtml(fileId)}` : ''
    }`;

    const risksHtml = includeRisks
      ? (analysisResult?.risks ?? [])
          .map((r) => {
            const levelText =
              r.level === 'high'
                ? '高风险'
                : r.level === 'medium'
                ? '中风险'
                : '低风险';
            return `
              <div class="item">
                <div class="item-title">
                  <span class="badge ${escapeHtml(r.level)}">${levelText}</span>
                  <span class="item-head">${escapeHtml(r.title)}</span>
                </div>
                <div class="item-body">${escapeHtml(r.content)}</div>
                ${
                  r.suggestion
                    ? `<div class="item-sub"><span class="muted">建议：</span>${escapeHtml(
                        r.suggestion,
                      )}</div>`
                    : ''
                }
              </div>
            `;
          })
          .join('')
      : '';

    const suggestionsHtml = includeSuggestions
      ? (analysisResult?.suggestions ?? [])
          .map((s) => {
            return `
              <div class="item">
                <div class="item-title">
                  <span class="badge info">修改建议</span>
                  <span class="item-head">${escapeHtml(
                    s.reason || '建议',
                  )}</span>
                </div>
                <div class="diff">
                  <div class="diff-row">
                    <div class="diff-label">原文</div>
                    <div class="diff-content original">${escapeHtml(
                      s.original,
                    )}</div>
                  </div>
                  <div class="diff-row">
                    <div class="diff-label">修改为</div>
                    <div class="diff-content revised">${escapeHtml(
                      s.revised,
                    )}</div>
                  </div>
                </div>
              </div>
            `;
          })
          .join('')
      : '';

    const legalHtml = includeLegal
      ? (analysisResult?.legalBasis ?? [])
          .map((l) => {
            return `
              <div class="item">
                <div class="item-title">
                  <span class="badge legal">法律依据</span>
                  <span class="item-head">${escapeHtml(l.lawName)} ${escapeHtml(
              l.article,
            )}</span>
                </div>
                <div class="item-body">${escapeHtml(l.content)}</div>
                <div class="item-sub"><span class="muted">相关度：</span>${(
                  l.score * 100
                ).toFixed(0)}%</div>
              </div>
            `;
          })
          .join('')
      : '';

    const contractHtml = includeContract
      ? canIncludeHighlights && analysisResult
        ? `<div class="contract-text"><div class="contract-pre">${buildHighlightedHtml(
            printableText,
            collectHighlightsForExport(),
          ).replace(/\n/g, '<br/>')}</div></div>`
        : `<div class="contract-text"><div class="contract-pre">${escapeHtml(
            printableText,
          ).replace(/\n/g, '<br/>')}</div></div>`
      : '';

    return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { margin: 16mm 14mm; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
        color: #111827;
        line-height: 1.55;
      }
      .header { margin-bottom: 14px; }
      .title { font-size: 18px; font-weight: 700; margin: 0 0 4px 0; }
      .subtitle { font-size: 12px; color: #6b7280; margin: 0; }
      .section { margin-top: 14px; }
      .section-title { font-size: 13px; font-weight: 700; margin: 0 0 8px 0; }
      .divider { height: 1px; background: #e5e7eb; margin: 10px 0; }
      .item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; margin: 10px 0; break-inside: avoid; }
      .item-title { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
      .item-head { font-weight: 700; }
      .item-body { font-size: 12px; color: #111827; }
      .item-sub { font-size: 12px; color: #374151; margin-top: 6px; }
      .muted { color: #6b7280; }
      .badge { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid #e5e7eb; background: #f9fafb; color: #111827; }
      .badge.high { background: #fff1f2; border-color: #fecdd3; color: #9f1239; }
      .badge.medium { background: #fff7ed; border-color: #fed7aa; color: #9a3412; }
      .badge.low { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
      .badge.info { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
      .badge.legal { background: #f5f3ff; border-color: #ddd6fe; color: #5b21b6; }
      .diff { margin-top: 6px; }
      .diff-row { display: flex; gap: 10px; margin-top: 6px; }
      .diff-label { width: 52px; font-size: 12px; color: #6b7280; flex: 0 0 auto; }
      .diff-content { font-size: 12px; padding: 8px 10px; border-radius: 6px; border: 1px solid #e5e7eb; width: 100%; }
      .diff-content.original { background: #fff1f2; border-color: #fecdd3; }
      .diff-content.revised { background: #f0fdf4; border-color: #bbf7d0; }
      .contract-text { margin-top: 8px; }
      .contract-pre { font-size: 12px; white-space: normal; word-break: break-word; }
      mark.hl { padding: 0 2px; border-radius: 3px; }
      mark.hl.risk { background: #ffe4e6; }
      mark.hl.suggestion { background: #dbeafe; }
      mark.hl.legal { background: #ede9fe; }
      .print-hint { font-size: 12px; color: #6b7280; margin-top: 10px; }
      .footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 10px; color: #9ca3af; }
      .footer-inner { display: flex; justify-content: space-between; }
      @media print {
        .no-print { display: none !important; }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="title">${escapeHtml(title)}</div>
      <p class="subtitle">${subtitle}</p>
      <div class="print-hint no-print">提示：在打印对话框中选择“保存为 PDF”即可导出。</div>
      <div class="divider"></div>
    </div>

    ${
      includeRisks
        ? `<div class="section"><div class="section-title">风险摘要</div>${
            risksHtml || '<div class="muted">暂无风险</div>'
          }</div>`
        : ''
    }
    ${
      includeSuggestions
        ? `<div class="section"><div class="section-title">修改建议</div>${
            suggestionsHtml || '<div class="muted">暂无修改建议</div>'
          }</div>`
        : ''
    }
    ${
      includeLegal
        ? `<div class="section"><div class="section-title">法律依据</div>${
            legalHtml || '<div class="muted">暂无法律依据</div>'
          }</div>`
        : ''
    }
    ${
      includeContract
        ? `<div class="section"><div class="section-title">合同正文</div>${
            contractHtml || '<div class="muted">暂无正文</div>'
          }</div>`
        : ''
    }

    <div class="footer">
      <div class="footer-inner">
        <span>LegalRag</span>
        <span>${formatDateTime(now)}</span>
      </div>
    </div>
    <script>
      // 尽量自动触发打印（用户仍可取消）
      window.addEventListener('load', () => {
        setTimeout(() => window.print(), 250);
      });
    </script>
  </body>
</html>
    `.trim();
  };

  // 使用隐藏 iframe 打印，完全避免弹窗拦截问题
  const handleExportWithIframe = () => {
    const printableText = getPrintableContractText();
    if (!printableText) {
      message.error('暂无可导出的合同文本');
      return;
    }

    const html = buildPrintHtml();

    // 创建隐藏的 iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      message.error('无法创建打印文档');
      document.body.removeChild(iframe);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // 等待内容加载完成后打印
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Print error:', e);
          message.error('打印失败，请重试');
        }
        // 打印对话框关闭后移除 iframe
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 100);
    };

    // 兜底：如果 onload 没触发，也尝试打印
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          // ignore
        }
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }
    }, 500);
  };

  // 渲染 Modal 内容
  const renderModalContent = () => {
    if (!modalContent) return null;

    if (modalType === 'risk') {
      const risk = modalContent as Risk;
      const legalBasisList = risk.legalBasis ?? [];
      const hasLegalBasis = legalBasisList.length > 0;

      // 约定：每条风险（identifier）对应一条具体修改方案 sug-{identifier}
      const suggestionId = `sug-${risk.identifier}`;
      const fromList = analysisResult?.suggestions?.find(
        (s) => s.id === suggestionId,
      );

      // 兜底：如果后端仅在 /risks/{identifier} 返回 suggested_revision，而 /risks 列表没有返回
      const fromDetail =
        selectedRiskDetail?.identifier === risk.identifier &&
        (selectedRiskDetail as any)?.suggested_revision
          ? {
              id: suggestionId,
              original: (() => {
                const base = getBaseContractText();
                const { start, end } = risk.highlightRange || {
                  start: 0,
                  end: 0,
                };
                if (!base) return '';
                if (start >= 0 && end > start && end <= base.length) {
                  return base.slice(start, end);
                }
                return '';
              })(),
              revised: (selectedRiskDetail as any).suggested_revision as string,
              reason: `针对风险：${risk.title}`,
              highlightRange: risk.highlightRange,
            }
          : null;

      const revisionSuggestion = fromDetail ?? fromList;
      const decision = revisionSuggestion
        ? getDecision(revisionSuggestion.id)
        : 'undecided';

      return (
        <div className="detail-modal">
          <div className="modal-section">
            <div className="section-label">风险等级</div>
            <Tag
              color={
                risk.level === 'high'
                  ? 'red'
                  : risk.level === 'medium'
                  ? 'orange'
                  : 'green'
              }
            >
              {risk.level === 'high'
                ? '高风险'
                : risk.level === 'medium'
                ? '中风险'
                : '低风险'}
            </Tag>
          </div>
          <div className="modal-section">
            <div className="section-label">风险描述</div>
            <div className="section-content">{risk.content}</div>
          </div>
          {risk.suggestion && (
            <div className="modal-section">
              <div className="section-label">建议措施</div>
              <div className="section-content">{risk.suggestion}</div>
            </div>
          )}

          {revisionSuggestion ? (
            <div className="modal-section">
              <div className="section-label">具体修改方案</div>
              <div className="diff-display" style={{ marginBottom: 10 }}>
                <div className="diff-row">
                  <div className="diff-label">原文</div>
                  <div className="diff-content original">
                    {revisionSuggestion.original}
                  </div>
                </div>
                <div className="diff-row">
                  <div className="diff-label">修改为</div>
                  <div className="diff-content revised">
                    {revisionSuggestion.revised}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button
                    size="middle"
                    className={
                      decision === 'accepted'
                        ? '!h-9 !rounded-lg !bg-brand-600 hover:!bg-brand-700 !text-white !border-brand-600'
                        : '!h-9 !rounded-lg !bg-white hover:!bg-slate-50 !text-slate-700 !border-slate-200'
                    }
                    onClick={() => {
                      updateDecision(
                        revisionSuggestion.id,
                        decision === 'accepted' ? 'undecided' : 'accepted',
                      );
                    }}
                  >
                    采纳
                  </Button>

                  <Button
                    size="middle"
                    className={
                      decision === 'rejected'
                        ? '!h-9 !rounded-lg !bg-slate-800 hover:!bg-slate-900 !text-white !border-slate-800'
                        : '!h-9 !rounded-lg !bg-white hover:!bg-slate-50 !text-slate-700 !border-slate-200'
                    }
                    onClick={() => {
                      updateDecision(
                        revisionSuggestion.id,
                        decision === 'rejected' ? 'undecided' : 'rejected',
                      );
                    }}
                  >
                    不采纳
                  </Button>

                  <Button
                    size="middle"
                    className="!h-9 !rounded-lg"
                    onClick={() => {
                      updateDecision(revisionSuggestion.id, 'undecided');
                    }}
                  >
                    清除选择
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          {hasLegalBasis && (
            <div className="modal-section">
              <div className="section-label">相关法律依据</div>
              <div className="section-content">
                {legalBasisList.map((lb) => (
                  <div key={lb.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 600 }}>
                      {lb.lawName} {lb.article}
                    </div>
                    <div
                      style={{ margin: '6px 0', fontSize: 12, color: '#666' }}
                    >
                      {lb.content}
                    </div>
                    <div className="legal-score">
                      <Rate
                        disabled
                        allowHalf
                        value={lb.score * 5}
                        style={{ fontSize: 12 }}
                      />
                      <span style={{ marginLeft: 8, fontSize: 12 }}>
                        相关度: {(lb.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (modalType === 'suggestion') {
      const suggestion = modalContent as Suggestion;
      return (
        <div className="detail-modal">
          <div className="diff-display">
            <div className="diff-row">
              <div className="diff-label">原文</div>
              <div className="diff-content original">{suggestion.original}</div>
            </div>
            <div className="diff-row">
              <div className="diff-label">修改为</div>
              <div className="diff-content revised">{suggestion.revised}</div>
            </div>
          </div>
          {suggestion.reason && (
            <div className="modal-section">
              <div className="section-label">修改理由</div>
              <div className="section-content">{suggestion.reason}</div>
            </div>
          )}
        </div>
      );
    }

    if (modalType === 'legal') {
      const legal = modalContent as LegalBasis;
      return (
        <div className="detail-modal">
          <div className="modal-section">
            <div className="section-label">法律名称</div>
            <div className="section-content">{legal.lawName}</div>
          </div>
          <div className="modal-section">
            <div className="section-label">条款</div>
            <div className="section-content">{legal.article}</div>
          </div>
          <div className="modal-section">
            <div className="section-label">法条内容</div>
            <div className="section-content">{legal.content}</div>
          </div>
          <div className="modal-section">
            <div className="section-label">相关度评分</div>
            <div className="legal-score">
              <Rate disabled allowHalf value={legal.score * 5} />
              <span style={{ marginLeft: 8 }}>
                {(legal.score * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          {legal.explanation && (
            <div className="modal-section">
              <div className="section-label">适用说明</div>
              <div className="section-content">{legal.explanation}</div>
            </div>
          )}
        </div>
      );
    }
  };

  const getModalTitle = () => {
    if (modalType === 'risk') return '风险详情';
    if (modalType === 'suggestion') return '修改建议详情';
    return '法律依据详情';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-white border border-slate-100 shadow-xl px-8 py-10 text-center space-y-4">
          <div className="bg-gradient-to-r from-brand-600 to-blue-500 inline-flex items-center justify-center rounded-full px-4 py-1 text-xs font-medium text-white">
            {analysisStatus === 'analyzing'
              ? '合同智能分析进行中…'
              : '正在准备分析...'}
          </div>
          <p className="text-sm text-slate-500">
            我们正在为您解析合同条款并生成风险提示、修改意见与法律依据，请稍候。
          </p>
          <div className="flex justify-center pt-2">
            <Spin
              size="large"
              tip={
                analysisStatus === 'analyzing'
                  ? '正在分析合同...'
                  : '正在加载...'
              }
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-6">
      <div className="mx-auto max-w-7xl rounded-2xl bg-white border border-slate-100 shadow-xl overflow-hidden">
        {/* 顶部渐变说明条 */}
        <div className="bg-gradient-to-r from-brand-600 to-blue-500 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-50/80 uppercase">
              LegalRag
            </p>
            <p className="text-sm text-brand-50">合同分析结果</p>
          </div>
          <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs text-brand-50">
            风险提示 · 修改意见 · 法律依据
          </span>
        </div>

        {/* 浅色卡片主体 */}
        <div className="contract-analysis px-4 pb-4 pt-2">
          <PageContainer
            header={{
              title: '合同分析结果',
              onBack: handleBack,
              extra: [
                <Button
                  key="exportPdf"
                  type="default"
                  style={{
                    background: '#ffffff',
                    borderColor: '#d9d9d9',
                    color: '#1677ff',
                    fontWeight: 600,
                  }}
                  onClick={() => setExportModalOpen(true)}
                >
                  导出 PDF
                </Button>,
                <Button key="reanalyze" onClick={handleReanalyze}>
                  重新分析
                </Button>,
              ],
            }}
          >
            {analysisResult && (
              <div className="analysis-content">
                <div
                  className="split-grid"
                  ref={splitContainerRef}
                  style={{
                    ['--left-pane' as any]: `${leftPanePercent}%`,
                  }}
                >
                  {/* 左侧：合同文本/编辑区 */}
                  <div className="split-left">
                    <Card
                      title="合同文本"
                      bordered={false}
                      extra={
                        <Space>
                          {!isEditingContract ? (
                            <>
                              <Button size="small" onClick={handleStartEdit}>
                                编辑
                              </Button>
                              {editedContractText ? (
                                <Button
                                  size="small"
                                  onClick={handleDiscardEdits}
                                >
                                  撤销修改版
                                </Button>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <Button
                                size="small"
                                type="primary"
                                onClick={handleFinishEdit}
                              >
                                完成
                              </Button>
                              <Button size="small" onClick={handleDiscardEdits}>
                                撤销
                              </Button>
                            </>
                          )}
                          {editedContractText && !isEditingContract ? (
                            <Button
                              size="small"
                              onClick={uploadEditedAndAnalyze}
                            >
                              用修改版重新分析
                            </Button>
                          ) : null}
                        </Space>
                      }
                    >
                      <div
                        className="contract-text-panel"
                        ref={contractTextRef}
                      >
                        {isEditingContract ? (
                          <div className="space-y-2">
                            <div className="text-xs text-slate-500">
                              提示：编辑/应用建议后，本页高亮定位将不再准确。
                            </div>
                            <Input.TextArea
                              value={
                                editedContractText ?? getPrintableContractText()
                              }
                              onChange={(e) =>
                                setEditedContractText(e.target.value)
                              }
                              autoSize={{ minRows: 18, maxRows: 28 }}
                            />
                          </div>
                        ) : editedContractText ? (
                          <div className="space-y-2">
                            <div className="text-xs text-slate-500">
                              已生成修改版正文（绿色高亮为已采纳的修改内容）。
                            </div>
                            {renderEditedTextWithAppliedHighlights()}
                          </div>
                        ) : (
                          renderHighlightedText()
                        )}
                      </div>
                    </Card>
                  </div>

                  {/* 拖拽分隔条 */}
                  <div
                    className="split-resizer"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="调整合同文本区域宽度"
                    onPointerDown={handleResizerPointerDown}
                    onPointerMove={handleResizerPointerMove}
                    onPointerUp={stopResizerDrag}
                    onPointerCancel={stopResizerDrag}
                  />

                  {/* 右侧：分析结果 + 风险详情 */}
                  <div className="split-right">
                    <div className="analysis-panel">
                      {/* 风险详情（调用按 identifier 查询单条风险接口） */}
                      <Card
                        title="风险详情"
                        bordered={false}
                        style={{ marginBottom: 16 }}
                        bodyStyle={{ padding: '20px' }}
                      >
                        {selectedRiskDetail ? (
                          <div className="detail-container">
                            <div
                              className="modal-section"
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 20,
                              }}
                            >
                              <span style={{ fontSize: 16, fontWeight: 600 }}>
                                风险等级
                              </span>
                              <Tag
                                color={
                                  selectedRiskDetail.level === 'high'
                                    ? '#f5222d'
                                    : selectedRiskDetail.level === 'medium'
                                    ? '#fa8c16'
                                    : '#52c41a'
                                }
                                style={{
                                  padding: '4px 16px',
                                  fontSize: 14,
                                  borderRadius: 12,
                                  marginRight: 0,
                                }}
                              >
                                {selectedRiskDetail.level === 'high'
                                  ? '高风险'
                                  : selectedRiskDetail.level === 'medium'
                                  ? '中风险'
                                  : '低风险'}
                              </Tag>
                            </div>

                            <Card
                              type="inner"
                              title={
                                <span style={{ color: '#cf1322' }}>
                                  🚨 风险描述
                                </span>
                              }
                              size="small"
                              style={{
                                marginBottom: 16,
                                backgroundColor: '#fff1f0',
                                borderColor: '#ffa39e',
                              }}
                            >
                              <div style={{ lineHeight: '1.6', color: '#333' }}>
                                {selectedRiskDetail.detected_issue}
                              </div>
                            </Card>

                            {selectedRiskDetail.suggestions && (
                              <Card
                                type="inner"
                                title={
                                  <span style={{ color: '#d48806' }}>
                                    💡 建议措施
                                  </span>
                                }
                                size="small"
                                style={{
                                  marginBottom: 16,
                                  backgroundColor: '#feffe6',
                                  borderColor: '#fffb8f',
                                }}
                              >
                                <div
                                  style={{ lineHeight: '1.6', color: '#333' }}
                                >
                                  {selectedRiskDetail.suggestions}
                                </div>
                              </Card>
                            )}

                            {selectedRiskDetail.legal_basis &&
                              selectedRiskDetail.legal_basis.length > 0 && (
                                <div className="modal-section">
                                  <div
                                    className="section-title"
                                    style={{
                                      fontSize: 15,
                                      fontWeight: 600,
                                      marginBottom: 12,
                                      marginTop: 24,
                                    }}
                                  >
                                    ⚖️ 相关法律依据
                                  </div>
                                  <div className="section-content">
                                    {selectedRiskDetail.legal_basis.map(
                                      (lb, idx) => (
                                        <Card
                                          key={idx}
                                          size="small"
                                          hoverable
                                          className="legal-card"
                                          style={{
                                            marginBottom: 12,
                                            borderRadius: 6,
                                            borderLeft: '4px solid #1890ff',
                                          }}
                                        >
                                          <div
                                            style={{
                                              fontWeight: 600,
                                              color: '#262626',
                                              marginBottom: 4,
                                            }}
                                          >
                                            {lb.law_name} {lb.order}
                                          </div>
                                          <div
                                            style={{
                                              fontSize: 13,
                                              color: '#666',
                                              marginBottom: 8,
                                              lineHeight: '1.5',
                                            }}
                                          >
                                            {lb.content}
                                          </div>
                                          <div
                                            className="legal-score"
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                            }}
                                          >
                                            <Rate
                                              disabled
                                              allowHalf
                                              value={
                                                (lb.relevance_score || 0) * 5
                                              }
                                              style={{ fontSize: 12 }}
                                            />
                                            <span
                                              style={{
                                                marginLeft: 8,
                                                fontSize: 12,
                                                color: '#8c8c8c',
                                              }}
                                            >
                                              相关度:{' '}
                                              {(
                                                (lb.relevance_score || 0) * 100
                                              ).toFixed(0)}
                                              %
                                            </span>
                                          </div>
                                        </Card>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}
                          </div>
                        ) : (
                          <div className="text-gray-400 text-center py-12">
                            <div style={{ fontSize: 40, marginBottom: 16 }}>
                              📋
                            </div>
                            <div>暂无风险详情</div>
                            <div style={{ fontSize: 12, marginTop: 8 }}>
                              点击左侧合同内容的标记处查看
                            </div>
                          </div>
                        )}
                      </Card>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 详情 Modal */}
            <Modal
              title={getModalTitle()}
              open={modalVisible}
              onCancel={() => setModalVisible(false)}
              footer={null}
              width={700}
            >
              {renderModalContent()}
            </Modal>

            {/* 导出 PDF 设置 */}
            <Modal
              title="导出 PDF"
              open={exportModalOpen}
              onCancel={() => setExportModalOpen(false)}
              okText="开始导出"
              cancelText="取消"
              okButtonProps={{
                style: {
                  backgroundColor: '#fff',
                  color: '#1677ff',
                  border: '1px solid #d9d9d9',
                },
              }}
              onOk={() => {
                setExportModalOpen(false);
                // 使用 iframe 打印，不会被浏览器拦截
                handleExportWithIframe();
              }}
            >
              <Typography.Paragraph
                style={{ marginBottom: 10, color: '#6b7280' }}
              >
                点击“开始导出”后将自动弹出打印对话框，在对话框中选择“保存为
                PDF”即可导出。
              </Typography.Paragraph>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>导出内容</div>
                <Checkbox.Group
                  value={exportSections}
                  onChange={(vals) => {
                    const v = vals as ExportSection[];
                    // 正文默认强制包含（防止用户误操作导致“空导出”）
                    if (!v.includes('contract')) v.push('contract');
                    setExportSections(Array.from(new Set(v)));
                  }}
                >
                  <Space wrap>
                    <Checkbox value="contract">合同正文</Checkbox>
                    <Checkbox value="risks">风险摘要</Checkbox>
                    <Checkbox value="suggestions">修改建议</Checkbox>
                    <Checkbox value="legal">法律依据</Checkbox>
                  </Space>
                </Checkbox.Group>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontWeight: 600 }}>正文包含高亮</div>
                <Switch
                  checked={editedContractText ? false : exportIncludeHighlights}
                  disabled={Boolean(editedContractText)}
                  onChange={setExportIncludeHighlights}
                />
                <span style={{ color: '#6b7280', fontSize: 12 }}>
                  {editedContractText
                    ? '已修改正文：高亮会因位置偏移而失效'
                    : '风险/建议/法条会以不同底色标记'}
                </span>
              </div>
            </Modal>
          </PageContainer>
        </div>
      </div>
    </div>
  );
};

export default ContractAnalysis;
