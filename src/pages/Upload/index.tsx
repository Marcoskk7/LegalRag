import { InboxOutlined, SettingOutlined, HistoryOutlined, UserOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import type { UploadFile, UploadProps } from 'antd';
import { Button, Input, Modal, Upload, message, Space, InputNumber, Tooltip } from 'antd';
import React, { useState, useEffect } from 'react';
import { uploadFile } from './api';
import './index.less';
import UploadBackground from '@/components/UploadBackground';

const { Dragger } = Upload;

interface UploadHistoryItem {
  id: string;
  name: string;
  time: number;
  topK: number;
}

const ContractUpload: React.FC = () => {
  const [fileId, setFileId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [txtEditOpen, setTxtEditOpen] = useState(false);
  const [txtEditValue, setTxtEditValue] = useState('');
  const [pendingTxtFileName, setPendingTxtFileName] = useState<string>('');
  const [topK, setTopK] = useState<number>(1);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    showUploadList: true,
    maxCount: 1,
    fileList,
    accept: '.pdf,.doc,.docx,.txt',
    onChange(info) {
      setFileList(info.fileList.slice(-1));
    },
    onRemove() {
      setFileId('');
      setTxtEditOpen(false);
      setTxtEditValue('');
      setPendingTxtFileName('');
      return true;
    },
    beforeUpload: async (file) => {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ];

      if (!allowedTypes.includes(file.type)) {
        message.error('只支持上传 PDF、Word 或 TXT 文件！');
        return false;
      }

      if (file.size / 1024 / 1024 > 50) {
        message.error('文件大小不能超过 50MB！');
        return false;
      }

      if (file.type === 'text/plain') {
        try {
          const text = await file.text();
          setTxtEditValue(text);
          setPendingTxtFileName(file.name);
          setTxtEditOpen(true);
          // 阻止自动上传，等待用户确认编辑内容后再上传
          return false;
        } catch {
          message.error('读取 TXT 文件失败，请重试');
          return false;
        }
      }

      return true;
    },
    customRequest: async (options) => {
      const { file, onError, onSuccess } = options;

      try {
        setUploading(true);
        const res = await uploadFile(file as File);
        setUploading(false);

        if (res?.success) {
          message.success(`${(file as File).name} 上传成功！`);
          setFileId(res.data.uuid);
          onSuccess?.(res, file as any);
        } else {
          message.error(res?.message || '上传失败');
          onError?.(new Error(res?.message || 'upload failed'));
        }
      } catch (e: any) {
        setUploading(false);
        message.error(`${(file as File).name} 上传失败`);
        onError?.(e);
      }
    },
  };

  const handleUploadEditedTxt = async () => {
    if (!pendingTxtFileName) {
      message.warning('未检测到待编辑的 TXT 文件');
      return;
    }

    try {
      setUploading(true);

      const editedFile = new File([txtEditValue], pendingTxtFileName, {
        type: 'text/plain',
      });

      const res = await uploadFile(editedFile);
      setUploading(false);

      if (res?.success) {
        message.success(`${pendingTxtFileName} 上传成功！`);
        setFileId(res.data.uuid);
        setTxtEditOpen(false);

        setFileList([
          {
            uid: `${Date.now()}`,
            name: pendingTxtFileName,
            status: 'done',
            percent: 100,
            response: res,
          },
        ]);
      } else {
        message.error(res?.message || '上传失败');
      }
    } catch (e) {
      setUploading(false);
      message.error('上传失败，请重试');
    }
  };

  // 跳转到分析页
  const handleStartAnalysis = () => {
    if (!fileId) {
      message.warning('请先上传文件');
      return;
    }

    history.push(`/contract-analysis?fileId=${fileId}&topK=${topK}`);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1, background: '#020617', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <UploadBackground />
      
      <div style={{ position: 'relative', zIndex: 1, padding: '24px', width: '100%', maxWidth: '800px' }}>
        <div className="sexy-card overflow-hidden">
          {/* 顶部说明条 */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.3em] text-[#C5A059] uppercase font-mono opacity-90">
                  Quantum.System
                </p>
                <p className="text-sm text-brand-100 font-medium opacity-60">Contract Analysis Interface</p>
              </div>
              <div className="h-8 w-[1px] bg-white/10" />
              <div className="flex items-center gap-2 text-white/40">
                <UserOutlined className="text-[#C5A059]" />
                <span className="text-xs font-mono uppercase tracking-widest">Guest_User_01</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                ghost 
                icon={<HistoryOutlined />} 
                onClick={() => history.push('/history')}
                className="!border-white/10 !text-white/60 hover:!text-[#C5A059] hover:!border-[#C5A059]/50 !rounded-full !bg-white/5"
              >
                历史记录
              </Button>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-brand-50 backdrop-blur-md font-mono tracking-widest uppercase opacity-70">
                Active
              </span>
            </div>
          </div>

          {/* 主体内容 */}
          <div className="px-8 py-10">
            <div className="mb-10 text-left space-y-3">
               <span className="font-mono text-[#C5A059] text-xs font-medium tracking-[0.5em] block uppercase mb-2">
                 Luminescent Trajectories
               </span>
              <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tighter leading-[0.9] bg-gradient-to-r from-white via-slate-400 to-[#C5A059] bg-clip-text text-transparent">
                Legal<br/>Rag
              </h1>
              <p className="text-slate-400 max-w-lg text-lg font-light leading-relaxed mt-4">
                Upload your document to initiate <span className="text-white">stochastic risk analysis</span>. High-fidelity processing active.
              </p>
            </div>

            <div className="space-y-8">
              <div className="shimmer-loading rounded-xl">
                <Dragger
                  {...uploadProps}
                  className="!bg-white/5 !border-2 !border-dashed !border-white/10 hover:!border-brand-500/50 !rounded-xl transition-all duration-300"
                >
                  <p className="ant-upload-drag-icon !text-brand-400 !mb-4">
                    <InboxOutlined style={{ fontSize: 48 }} />
                  </p>
                  <p className="ant-upload-text !text-slate-200 !text-lg !font-medium">
                    点击或拖拽文件到此区域上传
                  </p>
                  <p className="ant-upload-hint !text-slate-500 !mt-2">
                    支持 PDF、Word (doc/docx) 和 TXT 格式，不超过 50MB
                  </p>
                </Dragger>
              </div>

              {/* 召回条数设置 */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 text-slate-300">
                  <SettingOutlined className="text-[#C5A059]" />
                  <span className="text-sm font-medium">分析配置</span>
                </div>
                <div className="h-4 w-[1px] bg-white/10 mx-2" />
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 uppercase tracking-wider">Recall Count</span>
                  <Tooltip title="选择召回的法律条数，条数越多分析越全面但耗时更长">
                    <InputNumber
                      min={1}
                      max={10}
                      value={topK}
                      onChange={(val) => setTopK(val || 1)}
                      className="!bg-black/40 !border-white/10 !text-white !rounded-lg !w-20"
                    />
                  </Tooltip>
                </div>
              </div>

              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between pt-4 border-t border-white/5">
                <div className="flex-1">
                   <div className="flex gap-8 font-mono text-[10px] tracking-widest uppercase opacity-60">
                      <div className="flex flex-col gap-1">
                          <span className="opacity-40">Latency</span>
                          <span className="text-[#C5A059]">0.02ms</span>
                      </div>
                      <div className="flex flex-col gap-1">
                          <span className="opacity-40">Entropy</span>
                          <span className="text-[#C5A059]">84.2%</span>
                      </div>
                   </div>
                </div>
                <Button
                  type="primary"
                  size="large"
                  disabled={!fileId || uploading}
                  loading={uploading}
                  className={`!h-12 !px-8 !rounded-full !text-xs !tracking-widest !uppercase !font-bold transition-all ${
                    fileId 
                      ? '!bg-[#C5A059] !text-black hover:!bg-white hover:!scale-105' 
                      : '!bg-white/5 !text-white/40 !border border-white/10'
                  }`}
                  onClick={handleStartAnalysis}
                >
                  Initiate Flux
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal styling needs to handle dark theme content or remain light for contrast */}
        <Modal
          title={<span className="font-semibold">编辑 TXT 内容</span>}
          open={txtEditOpen}
          okText="保存并上传"
          cancelText="取消"
          confirmLoading={uploading}
          onOk={handleUploadEditedTxt}
          onCancel={() => {
            setTxtEditOpen(false);
            setTxtEditValue('');
            setPendingTxtFileName('');
            setFileList([]);
            setFileId('');
          }}
          width={900}
          destroyOnClose
          className="dark-modal"
        >
          <div className="space-y-4 py-2">
            <div className="text-sm text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 bg-brand-500 rounded-full animate-pulse"></span>
              仅对 TXT 文件支持在线修改；PDF/Word 请直接上传。
            </div>
            <Input.TextArea
              value={txtEditValue}
              onChange={(e) => setTxtEditValue(e.target.value)}
              autoSize={{ minRows: 16, maxRows: 28 }}
              className="!bg-black/20 !border-white/10 !rounded-lg !p-4 !text-base !leading-relaxed !text-slate-200 placeholder:!text-slate-600"
            />
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default ContractUpload;
