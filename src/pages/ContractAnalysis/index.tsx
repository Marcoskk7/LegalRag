/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-promise-executor-return */

import UploadBackground from '@/components/UploadBackground';
import { history, useSearchParams } from '@umijs/max';
import {
  Button,
  Card,
  Checkbox,
  Divider,
  Input,
  Modal,
  Rate,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  fetchDocumentContent,
  fetchHistoryDetail,
  fetchRiskDetail,
  fetchRisks,
  fetchStatus,
  triggerAnalysis,
  uploadEditedFile,
} from './api';
import './index.less';
import {
  AnalysisResult,
  ApiRisk,
  AppliedEdit,
  BaseToEditedSegment,
  ExportSection,
  HighlightType,
  LegalBasis,
  Risk,
  Suggestion,
  SuggestionDecision,
} from './typing';
import {
  applyAcceptedSuggestions,
  buildHighlightedHtml,
  escapeHtml,
  formatDateTime,
  transformApiResponse,
} from './utils';

const ContractAnalysis: React.FC = () => {
  const [searchParams] = useSearchParams();
  const fileId = searchParams.get('fileId');
  const topKParam = searchParams.get('topK');
  const fromHistory = searchParams.get('fromHistory') === 'true';
  const topK = topKParam ? parseInt(topKParam, 10) : 1;

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

  // 加载最终结果
  const loadResults = async () => {
    if (!fileId) return;

    // 并行获取原文内容 + 风险分析结果
    const [contentRes, risksRes] = await Promise.all([
      fetchDocumentContent(fileId),
      fetchRisks(fileId),
    ]);

    if (contentRes?.raw_content) {
      setDocumentContent(contentRes.raw_content);
    }

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
        const detail = await fetchRiskDetail(fileId, defaultRisk.identifier);
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
    if (!fileId) return;

    pollTimerRef.current = setTimeout(async () => {
      const statusRes = await fetchStatus(fileId);
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
    if (!fileId) return;
    setAnalysisStatus('analyzing');
    // 同样，触发分析也可能因为数据库延迟而404，给予一次重试机会
    let analyzeRes = await triggerAnalysis(fileId, topK);

    if (!analyzeRes) {
      console.log('First analysis trigger failed, retrying in 1s...');
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1000);
      });
      analyzeRes = await triggerAnalysis(fileId, topK);
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

    if (fromHistory && fileId) {
      const historyRes = await fetchHistoryDetail(fileId);
      if (historyRes && historyRes.status === 'success') {
        setAnalysisStatus('success');
        
        let content = historyRes.raw_content || '';
        if (!content) {
          const contentRes = await fetchDocumentContent(fileId);
          if (contentRes?.raw_content) {
            content = contentRes.raw_content;
          }
        }
        
        setDocumentContent(content);
        const transformed = transformApiResponse(historyRes, content);
        setAnalysisResult(transformed);
        setLoading(false);
        return;
      }
    }

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
    if (!fileId) return;
    if (type === 'risk') {
      const risk = analysisResult?.risks.find((r) => r.id === id);
      if (risk) {
        setActiveHighlight(id);
        // 点击正文高亮时，同步加载右侧风险详情
        fetchRiskDetail(fileId, risk.identifier).then((detail) => {
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
                fetchRiskDetail(fileId || '', risk.identifier).then((detail) => {
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

      const file = new File([text], `edited-${fileId || 'contract'}.txt`, {
        type: 'text/plain',
      });

      const json = await uploadEditedFile(file);

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
      // 延迟一点确保渲染完成
      setTimeout(() => {
        try {
          if (!iframe.contentWindow) return;
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.error('Print error:', e);
          message.error('打印失败，请重试');
        } finally {
          // 打印对话框关闭后（无论成功还是取消）移除 iframe
          // 增加一点延迟确保打印任务已提交
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1000);
        }
      }, 300);
    };
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
        <div className="detail-modal dark-modal">
          <div className="modal-section">
            <div className="section-label !text-brand-300">风险等级</div>
            <Tag
              className="!border-none !px-4 !py-1 !rounded-full"
              color={
                risk.level === 'high'
                  ? '#f5222d'
                  : risk.level === 'medium'
                  ? '#fa8c16'
                  : '#52c41a'
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
            <div className="section-label !text-brand-300">风险描述</div>
            <div className="section-content !bg-white/5 !text-slate-200 !border-white/10 !rounded-xl !p-4">{risk.content}</div>
          </div>
          {risk.suggestion && (
            <div className="modal-section">
              <div className="section-label !text-brand-300">建议措施</div>
              <div className="section-content !bg-brand-500/10 !text-brand-100 !border-brand-500/20 !rounded-xl !p-4">{risk.suggestion}</div>
            </div>
          )}

          {revisionSuggestion ? (
            <div className="modal-section">
              <div className="section-label !text-brand-300">具体修改方案</div>
              <div className="diff-display" style={{ marginBottom: 16 }}>
                <div className="diff-row">
                  <div className="diff-label !text-slate-400">原文</div>
                  <div className="diff-content original !bg-red-500/10 !text-red-200 !border-red-500/20 !rounded-lg">
                    {revisionSuggestion.original}
                  </div>
                </div>
                <div className="diff-row">
                  <div className="diff-label !text-slate-400">修改为</div>
                  <div className="diff-content revised !bg-green-500/10 !text-green-200 !border-green-500/20 !rounded-lg">
                    {revisionSuggestion.revised}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <Space wrap>
                  <Button
                    size="middle"
                    className={
                      decision === 'accepted'
                        ? '!h-10 !px-6 !rounded-xl !bg-brand-600 !text-white !border-none shadow-lg shadow-brand-600/20'
                        : '!h-10 !px-6 !rounded-xl !bg-white/5 !text-slate-300 !border-white/10 hover:!bg-white/10 hover:!border-brand-500/50'
                    }
                    onClick={() => {
                      updateDecision(
                        revisionSuggestion.id,
                        decision === 'accepted' ? 'undecided' : 'accepted',
                      );
                    }}
                  >
                    采纳建议
                  </Button>

                  <Button
                    size="middle"
                    className={
                      decision === 'rejected'
                        ? '!h-10 !px-6 !rounded-xl !bg-slate-700 !text-white !border-none'
                        : '!h-10 !px-6 !rounded-xl !bg-white/5 !text-slate-300 !border-white/10 hover:!bg-white/10 hover:!border-red-500/50'
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
                    ghost
                    className="!h-10 !px-6 !rounded-xl !text-slate-500 !border-white/5 hover:!text-slate-300"
                    onClick={() => {
                      updateDecision(revisionSuggestion.id, 'undecided');
                    }}
                  >
                    清除选择
                  </Button>
                </Space>
              </div>
            </div>
          ) : null}
          {hasLegalBasis && (
            <div className="modal-section">
              <div className="section-label !text-brand-300">相关法律依据</div>
              <div className="section-content space-y-3 !bg-transparent !p-0">
                {legalBasisList.map((lb) => (
                  <div key={lb.id} className="!bg-white/5 !border !border-white/10 !rounded-xl !p-4">
                    <div className="text-slate-200 font-semibold mb-2">
                      {lb.lawName} {lb.article}
                    </div>
                    <div className="text-slate-400 text-sm leading-relaxed mb-3">
                      {lb.content}
                    </div>
                    <div className="legal-score flex items-center">
                      <Rate
                        disabled
                        allowHalf
                        value={lb.score * 5}
                        style={{ fontSize: 12, color: '#fadb14' }}
                      />
                      <span className="ml-3 text-xs text-slate-500">
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
        <div className="detail-modal dark-modal">
          <div className="diff-display">
            <div className="diff-row">
              <div className="diff-label !text-slate-400">原文</div>
              <div className="diff-content original !bg-red-500/10 !text-red-200 !border-red-500/20 !rounded-lg">
                {suggestion.original}
              </div>
            </div>
            <div className="diff-row">
              <div className="diff-label !text-slate-400">修改为</div>
              <div className="diff-content revised !bg-green-500/10 !text-green-200 !border-green-500/20 !rounded-lg">
                {suggestion.revised}
              </div>
            </div>
          </div>
          {suggestion.reason && (
            <div className="modal-section mt-4">
              <div className="section-label !text-brand-300">修改理由</div>
              <div className="section-content !bg-white/5 !text-slate-200 !border-white/10 !rounded-xl !p-4">{suggestion.reason}</div>
            </div>
          )}
        </div>
      );
    }

    if (modalType === 'legal') {
      const legal = modalContent as LegalBasis;
      return (
        <div className="detail-modal dark-modal">
          <div className="modal-section">
            <div className="section-label !text-brand-300">法律名称</div>
            <div className="section-content !bg-white/5 !text-slate-200 !border-white/10 !rounded-xl !p-4">{legal.lawName}</div>
          </div>
          <div className="modal-section">
            <div className="section-label !text-brand-300">条款</div>
            <div className="section-content !bg-white/5 !text-slate-200 !border-white/10 !rounded-xl !p-4">{legal.article}</div>
          </div>
          <div className="modal-section">
            <div className="section-label !text-brand-300">法条内容</div>
            <div className="section-content !bg-white/5 !text-slate-200 !border-white/10 !rounded-xl !p-4">{legal.content}</div>
          </div>
          <div className="modal-section">
            <div className="section-label !text-brand-300">相关度评分</div>
            <div className="legal-score flex items-center p-2">
              <Rate disabled allowHalf value={legal.score * 5} style={{ color: '#fadb14' }} />
              <span className="ml-4 text-slate-400">
                {(legal.score * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          {legal.explanation && (
            <div className="modal-section">
              <div className="section-label !text-brand-300">适用说明</div>
              <div className="section-content !bg-brand-500/10 !text-brand-100 !border-brand-500/20 !rounded-xl !p-4">{legal.explanation}</div>
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
      <div className="min-h-screen bg-[#020617] flex items-center justify-center px-4" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10 }}>
        <UploadBackground />
        <div className="relative z-10 w-full max-w-md rounded-2xl bg-white/5 border border-white/10 shadow-2xl px-8 py-10 text-center space-y-4 backdrop-blur-xl">
          <div className="bg-brand-600/20 border border-brand-500/30 inline-flex items-center justify-center rounded-full px-4 py-1 text-xs font-medium text-brand-300">
            {analysisStatus === 'analyzing'
              ? 'Quantum Flux Processing...'
              : 'Initializing System...'}
          </div>
          <p className="text-sm text-slate-400">
            我们正在为您解析合同条款并生成风险提示、修改意见与法律依据，请稍候。
          </p>
          <div className="flex justify-center pt-2">
            <Spin
              size="large"
              tip={
                <span className="text-slate-400 mt-2 block">
                  {analysisStatus === 'analyzing'
                    ? '正在分析合同...'
                    : '正在加载...'}
                </span>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#020617', overflow: 'hidden', zIndex: 1 }}>
      <UploadBackground />
      
      <div style={{ position: 'relative', zIndex: 1, padding: '24px 24px 48px', height: '100%', overflowX: 'hidden', overflowY: 'auto' }}>
        <div className="mx-auto max-w-7xl">
          {/* 顶部渐变说明条 - 改为更通透的设计 */}
          <div className="sexy-card mb-6 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-brand-200/80 uppercase">
                LegalRag
              </p>
              <p className="text-xl font-bold text-white tracking-tight">合同分析结果</p>
            </div>
             <Space>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-brand-100 backdrop-blur-md">
                  风险提示 · 修改意见 · 法律依据
                </span>
                <Button 
                  ghost 
                  size="small" 
                  onClick={() => history.push('/history')}
                  style={{ color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.3)' }}
                >
                  历史
                </Button>
                <Button 
                  ghost 
                  size="small" 
                  onClick={handleBack}
                  style={{ color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.3)' }}
                >
                  返回
                </Button>
            </Space>
          </div>

          {/* 主体内容 */}
          <div className="contract-analysis">
            <div className="analysis-content !p-0">
               {/* 移除 PageContainer 的默认 header，使用自定义的 header */}
               <div className="flex justify-end mb-4 gap-3">
                  <Button
                    className="sexy-card !border-white/20 !text-white hover:!bg-white/10 hover:!border-white/40 !h-9 !px-4 !bg-transparent"
                    onClick={() => setExportModalOpen(true)}
                  >
                    导出 PDF
                  </Button>
                  <Button 
                    type="primary"
                    className="!bg-brand-600 hover:!bg-brand-500 !border-none !h-9 !px-4 !rounded-lg"
                    onClick={handleReanalyze}
                  >
                    重新分析
                  </Button>
               </div>

              {analysisResult && (
                <div className="analysis-content-inner">
                  <div
                    className="split-grid"
                    ref={splitContainerRef}
                    style={{
                      ['--left-pane' as any]: `${leftPanePercent}%`,
                    }}
                  >
                    {/* 左侧：合同文本/编辑区 */}
                    <div className="split-left">
                      <div className="sexy-card h-full flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <span className="text-white font-semibold">合同文本</span>
                            <Space>
                              {!isEditingContract ? (
                                <>
                                  <Button size="small" ghost onClick={handleStartEdit} className="!text-white/80 !border-white/20 hover:!border-brand-400 hover:!text-brand-400">
                                    编辑
                                  </Button>
                                  {editedContractText ? (
                                    <Button
                                      size="small"
                                      danger
                                      ghost
                                      onClick={handleDiscardEdits}
                                      className="!border-red-500/30 hover:!bg-red-500/10"
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
                                    className="!bg-brand-600"
                                  >
                                    完成
                                  </Button>
                                  <Button size="small" ghost onClick={handleDiscardEdits} className="!text-white/80 !border-white/20">
                                    撤销
                                  </Button>
                                </>
                              )}
                              {editedContractText && !isEditingContract ? (
                                <Button
                                  size="small"
                                  type="primary"
                                  ghost
                                  onClick={uploadEditedAndAnalyze}
                                >
                                  用修改版重新分析
                                </Button>
                              ) : null}
                            </Space>
                        </div>
                        
                        <div
                          className="contract-text-panel flex-1"
                          ref={contractTextRef}
                        >
                          {isEditingContract ? (
                            <div className="space-y-2 h-full flex flex-col">
                              <div className="text-xs text-slate-400">
                                提示：编辑/应用建议后，本页高亮定位将不再准确。
                              </div>
                              <Input.TextArea
                                className="!bg-black/20 !text-slate-200 !border-white/10 placeholder:!text-slate-600 flex-1"
                                value={
                                  editedContractText ?? getPrintableContractText()
                                }
                                onChange={(e) =>
                                  setEditedContractText(e.target.value)
                                }
                                style={{ resize: 'none', height: '100%' }}
                              />
                            </div>
                          ) : editedContractText ? (
                            <div className="space-y-2">
                              <div className="text-xs text-slate-400">
                                已生成修改版正文（绿色高亮为已采纳的修改内容）。
                              </div>
                              {renderEditedTextWithAppliedHighlights()}
                            </div>
                          ) : (
                            renderHighlightedText()
                          )}
                        </div>
                      </div>
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
                      <div className="analysis-panel h-full">
                        {/* 风险详情 */}
                        <div className="sexy-card h-full flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-white/10 bg-white/5">
                                <span className="text-white font-semibold">风险详情</span>
                            </div>
                            <div className="p-5 flex-1 overflow-y-auto">
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
                                    <span className="text-white text-lg font-semibold">
                                      风险等级
                                    </span>
                                    <Tag
                                      className="!border-none"
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

                                  <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 overflow-hidden">
                                      <div className="px-3 py-2 bg-red-500/20 border-b border-red-500/20 text-red-300 text-sm font-semibold flex items-center gap-2">
                                          <span>🚨 风险描述</span>
                                      </div>
                                      <div className="p-3 text-slate-200 text-sm leading-relaxed">
                                          {selectedRiskDetail.detected_issue}
                                      </div>
                                  </div>

                                  {selectedRiskDetail.suggestions && (
                                    <div className="mb-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 overflow-hidden">
                                        <div className="px-3 py-2 bg-yellow-500/20 border-b border-yellow-500/20 text-yellow-300 text-sm font-semibold flex items-center gap-2">
                                            <span>💡 建议措施</span>
                                        </div>
                                        <div className="p-3 text-slate-200 text-sm leading-relaxed">
                                            {selectedRiskDetail.suggestions}
                                        </div>
                                    </div>
                                  )}

                                  {selectedRiskDetail.legal_basis &&
                                    selectedRiskDetail.legal_basis.length > 0 && (
                                      <div className="modal-section mt-6">
                                        <div
                                          className="section-title text-white mb-3 font-semibold"
                                        >
                                          ⚖️ 相关法律依据
                                        </div>
                                        <div className="section-content space-y-3">
                                          {selectedRiskDetail.legal_basis.map(
                                            (lb, idx) => (
                                              <div
                                                key={idx}
                                                className="rounded-lg bg-white/5 border border-white/10 p-3 hover:bg-white/10 transition-colors"
                                              >
                                                <div className="text-slate-200 font-medium mb-1">
                                                  {lb.law_name} {lb.order}
                                                </div>
                                                <div className="text-slate-400 text-sm mb-2 leading-relaxed">
                                                  {lb.content}
                                                </div>
                                                <div
                                                  className="legal-score flex items-center"
                                                >
                                                  <Rate
                                                    disabled
                                                    allowHalf
                                                    value={
                                                      (lb.relevance_score || 0) * 5
                                                    }
                                                    style={{ fontSize: 12, color: '#fadb14' }}
                                                  />
                                                  <span className="ml-2 text-xs text-slate-500">
                                                    相关度:{' '}
                                                    {(
                                                      (lb.relevance_score || 0) * 100
                                                    ).toFixed(0)}
                                                    %
                                                  </span>
                                                </div>
                                              </div>
                                            ),
                                          )}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              ) : (
                                <div className="text-slate-500 text-center py-12 flex flex-col items-center justify-center h-full">
                                  <div className="text-4xl mb-4 opacity-50">
                                    📋
                                  </div>
                                  <div className="text-lg">暂无风险详情</div>
                                  <div className="text-sm mt-2 opacity-60">
                                    点击左侧合同内容的标记处查看
                                  </div>
                                </div>
                              )}
                            </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 详情 Modal */}
          <Modal
            title={getModalTitle()}
            open={modalVisible}
            onCancel={() => setModalVisible(false)}
            footer={null}
            width={700}
            className="dark-modal"
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
            className="dark-modal"
            onOk={() => {
              setExportModalOpen(false);
              // 使用 iframe 打印，不会被浏览器拦截
              handleExportWithIframe();
            }}
          >
            <Typography.Paragraph
              style={{ marginBottom: 10, color: 'rgba(255,255,255,0.5)' }}
            >
              点击“开始导出”后将自动弹出打印对话框，在对话框中选择“保存为
              PDF”即可导出。
            </Typography.Paragraph>
            <Divider style={{ margin: '12px 0', borderColor: 'rgba(255,255,255,0.1)' }} />
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#fff' }}>导出内容</div>
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
                  <Checkbox value="contract" className="!text-slate-300">合同正文</Checkbox>
                  <Checkbox value="risks" className="!text-slate-300">风险摘要</Checkbox>
                  <Checkbox value="suggestions" className="!text-slate-300">修改建议</Checkbox>
                  <Checkbox value="legal" className="!text-slate-300">法律依据</Checkbox>
                </Space>
              </Checkbox.Group>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontWeight: 600, color: '#fff' }}>正文包含高亮</div>
              <Switch
                checked={editedContractText ? false : exportIncludeHighlights}
                disabled={Boolean(editedContractText)}
                onChange={setExportIncludeHighlights}
              />
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                {editedContractText
                  ? '已修改正文：高亮会因位置偏移而失效'
                  : '风险/建议/法条会以不同底色标记'}
              </span>
            </div>
          </Modal>
        </div>
      </div>
    </div>
  );
};

export default ContractAnalysis;
