import { PageContainer } from '@ant-design/pro-components';
import { history, request, useSearchParams } from '@umijs/max';
import {
  Button,
  Card,
  Col,
  List,
  message,
  Modal,
  Rate,
  Row,
  Spin,
  Tag,
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
const API_BASE_URL = 'http://127.0.0.1:8080';

/**
 * 将后端 API 响应转换为前端数据结构
 */
const transformApiResponse = (
  apiData: ApiRisksResponse,
  fallbackContent?: string
): AnalysisResult => {
  const risks: Risk[] = [];
  const legalBasis: LegalBasis[] = [];
  const suggestions: Suggestion[] = [];
  const sourceContent = fallbackContent ?? apiData.raw_content ?? '';

  apiData.risks.forEach((apiRisk) => {
    // 转换风险项
    const riskId = `risk-${apiRisk.identifier}`;
    
    // 从 detected_issue 生成标题（取前20个字符或到第一个标点）
    const issueText = apiRisk.detected_issue;
    const titleMatch = issueText.match(/^(.{0,25})/);
    const title = titleMatch ? titleMatch[1] + (issueText.length > 25 ? '...' : '') : '风险提示';

    // 转换关联的法律依据
    const riskLegalBasis: LegalBasis[] = apiRisk.legal_basis.map((legal, legalIndex) => ({
      id: `legal-${apiRisk.identifier}-${legalIndex}`,
      lawName: legal.law_name,
      article: legal.order,
      content: legal.content,
      score: legal.relevance_score,
      explanation: undefined,
      relatedRange: apiRisk.highlight_range,
    }));

    // 添加到全局法律依据列表（去重）
    riskLegalBasis.forEach(lb => {
      if (!legalBasis.find(existing => existing.lawName === lb.lawName && existing.article === lb.article)) {
        legalBasis.push(lb);
      }
    });

    const risk: Risk = {
      id: riskId,
      identifier: apiRisk.identifier,
      level: apiRisk.level,
      title,
      content: apiRisk.detected_issue,
      suggestion: apiRisk.suggestions,
      highlightRange: apiRisk.highlight_range,
      legalBasis: riskLegalBasis,
    };

    risks.push(risk);

    // 如果有修改建议，也创建一个 Suggestion 项
    if (apiRisk.suggestions) {
      // 尝试从原文中截取相关文本作为"原文"
      let originalText = '';
      if (sourceContent && apiRisk.highlight_range) {
        const { start, end } = apiRisk.highlight_range;
        if (start >= 0 && end <= sourceContent.length) {
          originalText = sourceContent.substring(start, end);
        }
      }
      
      // 如果无法获取原文（或者太长），截取一部分或使用 detected_issue 作为 fallback
      if (!originalText) {
        originalText = issueText.substring(0, 50) + (issueText.length > 50 ? '...' : '');
      } else if (originalText.length > 100) {
        originalText = originalText.substring(0, 100) + '...';
      }

      suggestions.push({
        id: `sug-${apiRisk.identifier}`,
        original: originalText,
        revised: apiRisk.suggestions,
        reason: `针对风险：${title}`,
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

const ContractAnalysis: React.FC = () => {
  const [searchParams] = useSearchParams();
  const fileId = searchParams.get('fileId');

  const [loading, setLoading] = useState(true);
  const [analysisStatus, setAnalysisStatus] = useState<'init' | 'analyzing' | 'success' | 'failed'>('init');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [documentContent, setDocumentContent] = useState<string>('');
  const [activeHighlight, setActiveHighlight] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState<any>(null);
  const [modalType, setModalType] = useState<'risk' | 'suggestion' | 'legal'>('risk');
  // 右侧风险详情（从新接口按 identifier 精确获取）
  const [selectedRiskDetail, setSelectedRiskDetail] = useState<ApiRisk | null>(null);

  const contractTextRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 页面加载时自动开始流程
  useEffect(() => {
    if (!fileId) {
      message.error('缺少文件ID，请重新上传');
      history.push('/');
      return;
    }

    startProcess();

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [fileId]);

  // API 3: 获取分析状态
  const fetchStatus = async (): Promise<ApiStatusResponse | null> => {
    try {
      return await request<ApiStatusResponse>(
        `${API_BASE_URL}/api/v1/documents/${fileId}/risks/status`,
        { method: 'GET' }
      );
    } catch (error) {
      console.error('Fetch status error:', error);
      return null;
    }
  };

  // 新增：获取文档原文内容
  const fetchDocumentContent = async (): Promise<ApiDocumentContentResponse | null> => {
    try {
      const res = await request<ApiDocumentContentResponse>(
        `${API_BASE_URL}/api/v1/documents/${fileId}/content`,
        { method: 'GET' }
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
        { method: 'GET' }
      );
    } catch (error) {
      console.error('Fetch risks error:', error);
      return null;
    }
  };

  // 新增：按 identifier 获取单条风险详情
  const fetchRiskDetail = async (identifier: string): Promise<ApiRisk | null> => {
    if (!fileId) return null;
    try {
      const res = await request<ApiRisk>(
        `${API_BASE_URL}/api/v1/documents/${fileId}/risks/${identifier}`,
        { method: 'GET' }
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
        }
      );
    } catch (error) {
      console.error('Trigger analysis error:', error);
      return null;
    }
  };

  // 启动流程：直接触发分析 -> 轮询状态
  const startProcess = async () => {
    setLoading(true);
    
    // 直接触发分析（对于新上传的文档，避免先GET状态导致404）
    await handleTriggerAnalysis();
  };

  const handleTriggerAnalysis = async () => {
    setAnalysisStatus('analyzing');
    // 同样，触发分析也可能因为数据库延迟而404，给予一次重试机会
    let analyzeRes = await triggerAnalysis();
    
    if (!analyzeRes) {
       console.log('First analysis trigger failed, retrying in 1s...');
       await new Promise(resolve => setTimeout(resolve, 1000));
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
        contentRes?.raw_content ?? documentContent
      );
      setAnalysisResult(transformed);

      // 默认展示 identifier 为 "0" 的风险详情（如果存在），否则展示第一条
      if (risksRes.risks && risksRes.risks.length > 0) {
        const defaultRisk =
          risksRes.risks.find(r => r.identifier === '0') ?? risksRes.risks[0];
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

  // 渲染高亮文本
  const renderHighlightedText = () => {
    // 优先使用分析后的结构化结果，如果还没有则降级展示原文全文
    if (!analysisResult || !analysisResult.contractText) {
      if (documentContent) {
        return <pre className="whitespace-pre-wrap">{documentContent}</pre>;
      }
      return (
        <div className="text-gray-400 text-center py-10">
          暂无合同文本内容
        </div>
      );
    }

    const { contractText, risks, suggestions, legalBasis } = analysisResult;
    const highlights: Array<{
      range: { start: number; end: number };
      type: HighlightType;
      id: string;
    }> = [];

    risks.forEach(risk => {
      highlights.push({
        range: risk.highlightRange,
        type: 'risk',
        id: risk.id
      });
    });

    suggestions.forEach(sug => {
      highlights.push({
        range: sug.highlightRange,
        type: 'suggestion',
        id: sug.id
      });
    });

    legalBasis.forEach(legal => {
      highlights.push({
        range: legal.relatedRange,
        type: 'legal',
        id: legal.id
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
          </span>
        );
      }

      result.push(
        <mark
          key={`highlight-${highlight.id}`}
          className={`highlight ${highlight.type} ${activeHighlight === highlight.id ? 'active' : ''}`}
          id={highlight.id}
          onClick={() => handleHighlightClick(highlight.type, highlight.id)}
        >
          {contractText.substring(highlight.range.start, highlight.range.end)}
        </mark>
      );

      lastIndex = highlight.range.end;
    });

    if (lastIndex < contractText.length) {
      result.push(
        <span key="text-end">{contractText.substring(lastIndex)}</span>
      );
    }

    return result;
  };

  // 处理高亮点击
  const handleHighlightClick = (type: HighlightType, id: string) => {
    setActiveHighlight(id);

    if (type === 'risk') {
      const risk = analysisResult?.risks.find(r => r.id === id);
      if (risk) {
        // 点击正文高亮时，同步加载右侧风险详情
        fetchRiskDetail(risk.identifier).then(detail => {
          if (detail) {
            setSelectedRiskDetail(detail);
          }
        });
        showRiskModal(risk);
      }
    } else if (type === 'suggestion') {
      const suggestion = analysisResult?.suggestions.find(s => s.id === id);
      if (suggestion) showSuggestionModal(suggestion);
    } else if (type === 'legal') {
      const legal = analysisResult?.legalBasis.find(l => l.id === id);
      if (legal) showLegalModal(legal);
    }
  };

  // 处理右侧列表项点击
  const handleItemClick = (id: string) => {
    setActiveHighlight(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // 处理风险列表点击：滚动到正文并加载右侧详情
  const handleRiskClick = (risk: Risk) => {
    handleItemClick(risk.id);
    fetchRiskDetail(risk.identifier).then(detail => {
      if (detail) {
        setSelectedRiskDetail(detail);
      }
    });
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

  // 渲染 Modal 内容
  const renderModalContent = () => {
    if (!modalContent) return null;

    if (modalType === 'risk') {
      const risk = modalContent as Risk;
      return (
        <div className="detail-modal">
          <div className="modal-section">
            <div className="section-label">风险等级</div>
            <Tag color={risk.level === 'high' ? 'red' : risk.level === 'medium' ? 'orange' : 'green'}>
              {risk.level === 'high' ? '高风险' : risk.level === 'medium' ? '中风险' : '低风险'}
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
              <span style={{ marginLeft: 8 }}>{(legal.score * 100).toFixed(0)}%</span>
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
            {analysisStatus === 'analyzing' ? '合同智能分析进行中…' : '正在准备分析...'}
          </div>
          <p className="text-sm text-slate-500">
            我们正在为您解析合同条款并生成风险提示、修改意见与法律依据，请稍候。
          </p>
          <div className="flex justify-center pt-2">
            <Spin size="large" tip={analysisStatus === 'analyzing' ? "正在分析合同..." : "正在加载..."} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-6">
      <div className="mx-auto max-w-6xl rounded-2xl bg-white border border-slate-100 shadow-xl overflow-hidden">
        {/* 顶部渐变说明条 */}
        <div className="bg-gradient-to-r from-brand-600 to-blue-500 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-50/80 uppercase">LegalRag</p>
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
                <Button key="reanalyze" onClick={handleReanalyze}>
                  重新分析
                </Button>,
              ],
            }}
          >
            {analysisResult && (
              <div className="analysis-content">
                <Row gutter={24}>
                  {/* 左侧：合同文本 */}
                  <Col span={12}>
                    <Card title="合同文本" bordered={false}>
                      <div className="contract-text-panel" ref={contractTextRef}>
                        {renderHighlightedText()}
                      </div>
                    </Card>
                  </Col>

                  {/* 右侧：分析结果 + 风险详情 */}
                  <Col span={12}>
                    <div className="analysis-panel">
                      {/* 风险详情（调用按 identifier 查询单条风险接口） */}
                      <Card title="风险详情" bordered={false} style={{ marginBottom: 16 }}>
                        {selectedRiskDetail ? (
                          <div className="detail-modal">
                            <div className="modal-section">
                              <div className="section-label">风险标识符</div>
                              <div className="section-content">{selectedRiskDetail.identifier}</div>
                            </div>
                            <div className="modal-section">
                              <div className="section-label">风险等级</div>
                              <Tag color={selectedRiskDetail.level === 'high' ? 'red' : selectedRiskDetail.level === 'medium' ? 'orange' : 'green'}>
                                {selectedRiskDetail.level === 'high'
                                  ? '高风险'
                                  : selectedRiskDetail.level === 'medium'
                                  ? '中风险'
                                  : '低风险'}
                              </Tag>
                            </div>
                            <div className="modal-section">
                              <div className="section-label">风险描述</div>
                              <div className="section-content">
                                {selectedRiskDetail.detected_issue}
                              </div>
                            </div>
                            {selectedRiskDetail.suggestions && (
                              <div className="modal-section">
                                <div className="section-label">建议措施</div>
                                <div className="section-content">
                                  {selectedRiskDetail.suggestions}
                                </div>
                              </div>
                            )}
                            {selectedRiskDetail.legal_basis && selectedRiskDetail.legal_basis.length > 0 && (
                              <div className="modal-section">
                                <div className="section-label">相关法律依据</div>
                                <div className="section-content">
                                  {selectedRiskDetail.legal_basis.map((lb, idx) => (
                                    <div key={idx} style={{ marginBottom: 8 }}>
                                      <div style={{ fontWeight: 600 }}>
                                        {lb.law_name} {lb.order}
                                      </div>
                                      <div style={{ fontSize: 12, color: '#666' }}>
                                        {lb.content}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-400 text-center py-6">
                            暂无风险详情
                          </div>
                        )}
                      </Card>

                      {/* 风险提示列表 */}
                      <div className="panel-section">
                        <div className="section-title">🚨 风险提示</div>
                        <List
                          dataSource={analysisResult.risks}
                          renderItem={(risk) => (
                            <List.Item
                              className="risk-item"
                              onClick={() => handleRiskClick(risk)}
                            >
                              <Card size="small" hoverable style={{ width: '100%' }}>
                                <div>
                                  <Tag className={`risk-level ${risk.level}`}>
                                    {risk.level === 'high' ? '高' : risk.level === 'medium' ? '中' : '低'}
                                  </Tag>
                                  <span style={{ fontWeight: 600, marginLeft: 8 }}>
                                    {risk.title}
                                  </span>
                                </div>
                                <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
                                  {risk.content}
                                </div>
                              </Card>
                            </List.Item>
                          )}
                        />
                      </div>

                      {/* 修改意见 */}
                      <div className="panel-section">
                        <div className="section-title">✏️ 修改意见</div>
                        <List
                          dataSource={analysisResult.suggestions}
                          renderItem={(suggestion) => (
                            <List.Item
                              className="suggestion-item"
                              onClick={() => {
                                handleItemClick(suggestion.id);
                                showSuggestionModal(suggestion);
                              }}
                            >
                              <Card size="small" hoverable style={{ width: '100%' }}>
                                <div className="diff-text">
                                  <div style={{ marginBottom: 8 }}>
                                    <span style={{ color: '#999', fontSize: 12 }}>原文：</span>
                                    <span className="original">{suggestion.original}</span>
                                  </div>
                                  <div>
                                    <span style={{ color: '#999', fontSize: 12 }}>改为：</span>
                                    <span className="revised">{suggestion.revised}</span>
                                  </div>
                                </div>
                              </Card>
                            </List.Item>
                          )}
                        />
                      </div>

                      {/* 法律依据 */}
                      <div className="panel-section">
                        <div className="section-title">⚖️ 法律依据</div>
                        <List
                          dataSource={analysisResult.legalBasis}
                          renderItem={(legal) => (
                            <List.Item
                              className="legal-item"
                              onClick={() => {
                                handleItemClick(legal.id);
                                showLegalModal(legal);
                              }}
                            >
                              <Card size="small" hoverable style={{ width: '100%' }}>
                                <div style={{ fontWeight: 600 }}>
                                  {legal.lawName} {legal.article}
                                </div>
                                <div style={{ margin: '8px 0', fontSize: 12, color: '#666' }}>
                                  {legal.content.substring(0, 50)}...
                                </div>
                                <div className="legal-score">
                                  <Rate disabled allowHalf value={legal.score * 5} style={{ fontSize: 12 }} />
                                  <span style={{ marginLeft: 8, fontSize: 12 }}>
                                    相关度: {(legal.score * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </Card>
                            </List.Item>
                          )}
                        />
                      </div>
                    </div>
                  </Col>
                </Row>
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
          </PageContainer>
        </div>
      </div>
    </div>
  );
};

export default ContractAnalysis;
