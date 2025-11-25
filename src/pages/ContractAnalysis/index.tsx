import React, { useState, useRef, useEffect } from 'react';
import {
  message,
  Button,
  Row,
  Col,
  Card,
  List,
  Tag,
  Modal,
  Rate,
  Spin,
} from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import { request, history, useSearchParams } from '@umijs/max';
import type { AnalysisResult, Risk, Suggestion, LegalBasis, HighlightType } from './typing';
import './index.less';

const ContractAnalysis: React.FC = () => {
  // 【修复 2】：使用 standard hook 获取 URL 参数
  const [searchParams] = useSearchParams();
  const fileId = searchParams.get('fileId');

  const [loading, setLoading] = useState(true);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState<any>(null);
  const [modalType, setModalType] = useState<'risk' | 'suggestion' | 'legal'>('risk');

  const contractTextRef = useRef<HTMLDivElement>(null);

  // 页面加载时自动分析
  useEffect(() => {
    if (!fileId) {
      message.error('缺少文件ID，请重新上传');
      history.push('/');
      return;
    }

    handleAnalyze();
  }, [fileId]);

  // 执行分析
  const handleAnalyze = async () => {
    if (!fileId) return;

    setLoading(true);
    try {
      const result = await request<{ success: boolean; data: AnalysisResult }>(
        '/api/v1/analyze',
        {
          method: 'POST',
          data: { fileId }
        }
      );

      if (result.success) {
        setAnalysisResult(result.data);
        message.success('分析完成！');
      }
    } catch (error) {
      message.error('分析失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 返回上传页
  const handleBack = () => {
    history.push('/');
  };

  // 渲染高亮文本
  const renderHighlightedText = () => {
    if (!analysisResult) return null;

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
      if (risk) showRiskModal(risk);
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
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <Spin size="large" tip="正在分析合同..." />
      </div>
    );
  }

  return (
    <div className="contract-analysis">
      <PageContainer
        header={{
          title: '合同分析结果',
          onBack: handleBack,
          extra: [
            <Button key="reanalyze" onClick={handleAnalyze}>
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

              {/* 右侧：分析结果 */}
              <Col span={12}>
                <div className="analysis-panel">
                  {/* 风险提示 */}
                  <div className="panel-section">
                    <div className="section-title">🚨 风险提示</div>
                    <List
                      dataSource={analysisResult.risks}
                      renderItem={(risk) => (
                        <List.Item
                          className="risk-item"
                          onClick={() => {
                            handleItemClick(risk.id);
                            showRiskModal(risk);
                          }}
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
  );
};

export default ContractAnalysis;