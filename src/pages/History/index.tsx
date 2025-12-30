import { HistoryOutlined, FileTextOutlined, ArrowLeftOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import { Button, List, Tag, message, Popconfirm, Empty, Spin, Input, Pagination } from 'antd';
import React, { useState, useEffect, useCallback } from 'react';
import './index.less';
import UploadBackground from '@/components/UploadBackground';
import { fetchHistoryList } from './api';
import { ApiHistoryItem } from './typing';

const PAGE_SIZE = 20;

const HistoryPage: React.FC = () => {
  const [uploadHistory, setUploadHistory] = useState<ApiHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const loadHistory = useCallback(async (p: number, s: string) => {
    try {
      setLoading(true);
      const res = await fetchHistoryList({ page: p, page_size: PAGE_SIZE, search: s || undefined });
      if (res.success) {
        setUploadHistory(res.data || []);
        setTotal(res.total || 0);
      } else {
        message.error(res.message || '获取历史记录失败');
      }
    } catch (e) {
      console.error('Failed to fetch history', e);
      message.error('获取历史记录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(page, search);
  }, [page, search, loadHistory]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
  };

  const clearHistory = () => {
    message.info('该功能目前需通过后端接口实现');
  };

  const deleteItem = (e: React.MouseEvent, uuid: string) => {
    e.stopPropagation();
    message.info('删除功能需配合后端接口实现');
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 100, background: '#020617', overflow: 'hidden' }}>
      <UploadBackground />
      
      <div style={{ position: 'relative', zIndex: 1, padding: '40px 24px', height: '100%', overflowY: 'auto' }}>
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button 
                shape="circle" 
                icon={<ArrowLeftOutlined />} 
                onClick={() => history.push('/upload')}
                className="!bg-white/5 !border-white/10 !text-white/60 hover:!text-white hover:!border-white/30"
              />
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                  <HistoryOutlined className="text-[#C5A059]" />
                  历史记录
                </h1>
                <p className="text-slate-500 text-sm mt-1">查看和管理您过往上传的合同分析任务</p>
              </div>
            </div>
            {uploadHistory.length > 0 && (
              <Popconfirm
                title="确定要清空所有历史记录吗？"
                onConfirm={clearHistory}
                okText="确定"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button 
                  danger 
                  ghost 
                  icon={<DeleteOutlined />}
                  className="!border-red-500/30 hover:!bg-red-500/10"
                >
                  清空历史
                </Button>
              </Popconfirm>
            )}
          </div>

          {/* Search */}
          <div className="mb-6 flex gap-3">
            <Input
              placeholder="搜索合同名称..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined className="text-slate-500" />}
              className="!bg-white/5 !border-white/10 !text-white placeholder:!text-slate-500 !rounded-lg"
              style={{ maxWidth: 400 }}
            />
            <Button
              type="primary"
              onClick={handleSearch}
              className="!bg-[#C5A059] !text-black !border-none !rounded-lg"
            >
              搜索
            </Button>
          </div>

          <div className="sexy-card overflow-hidden">
            <Spin spinning={loading}>
              <List
                dataSource={uploadHistory}
                className="history-list"
                renderItem={(item) => (
                  <List.Item
                    className="!border-white/5 !px-8 !py-6 hover:!bg-white/5 transition-all cursor-pointer group relative"
                    onClick={() => {
                      history.push(`/contract-analysis?fileId=${item.uuid}&topK=${item.top_k}&fromHistory=true`);
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-[#C5A059]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#C5A059]/20 transition-colors">
                          <FileTextOutlined className="text-[#C5A059] text-xl" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-lg font-medium text-slate-200 truncate group-hover:text-white transition-colors">
                              {item.filename}
                            </span>
                            <Tag className="!bg-[#C5A059]/10 !text-[#C5A059] !border-[#C5A059]/20 !m-0 !text-[10px] !px-2 !py-0 !rounded-md">
                              Top-K: {item.top_k}
                            </Tag>
                          </div>
                          <div className="text-slate-500 text-xs font-mono uppercase tracking-wider">
                            Uploaded on {new Date(item.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-[#C5A059] opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 font-mono text-xs uppercase tracking-widest">
                          View Analysis →
                        </div>
                        <Popconfirm
                          title="确定删除这条记录吗？"
                          onConfirm={(e) => deleteItem(e as any, item.uuid)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Button 
                            type="text" 
                            icon={<DeleteOutlined />} 
                            className="!text-slate-600 hover:!text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Popconfirm>
                      </div>
                    </div>
                  </List.Item>
                )}
                locale={{
                  emptyText: !loading && (
                    <div className="py-20 flex flex-col items-center">
                      <Empty description={false} />
                      <span className="text-slate-600 font-mono text-xs mt-4 tracking-widest uppercase">No history found</span>
                      <Button 
                        type="primary" 
                        className="mt-6 !bg-[#C5A059] !text-black border-none !h-10 !px-8 !rounded-full !font-bold !text-xs !uppercase !tracking-widest"
                        onClick={() => history.push('/upload')}
                      >
                        Go to Upload
                      </Button>
                    </div>
                  )
                }}
              />
            </Spin>
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="mt-6 flex justify-center">
              <Pagination
                current={page}
                total={total}
                pageSize={PAGE_SIZE}
                onChange={handlePageChange}
                showSizeChanger={false}
                className="dark-pagination"
              />
            </div>
          )}

          <div className="mt-8 px-4 flex justify-between items-center text-[10px] text-slate-600 font-mono uppercase tracking-widest">
            <span>* Records are stored on server</span>
            <span>Quantum.History.System v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
