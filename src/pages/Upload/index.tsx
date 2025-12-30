import { InboxOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import type { UploadFile, UploadProps } from 'antd';
import { Button, Input, Modal, Upload, message, Space } from 'antd';
import React, { useState } from 'react';
import { uploadFile } from './api';
import './index.less';
import DottedGlowBackground from '@/components/DottedGlowBackground';

const { Dragger } = Upload;

const ContractUpload: React.FC = () => {
  const [fileId, setFileId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [txtEditOpen, setTxtEditOpen] = useState(false);
  const [txtEditValue, setTxtEditValue] = useState('');
  const [pendingTxtFileName, setPendingTxtFileName] = useState<string>('');

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

    history.push(`/contract-analysis?fileId=${fileId}`);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', minHeight: '100vh', background: '#09090b', overflowX: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <DottedGlowBackground />
      
      <div style={{ position: 'relative', zIndex: 1, padding: '24px', width: '100%', maxWidth: '800px' }}>
        <div className="sexy-card overflow-hidden">
          {/* 顶部说明条 */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-white/10 bg-white/5">
            <div>
              <p className="text-xs font-semibold tracking-wide text-brand-200/80 uppercase">
                LegalRag
              </p>
              <p className="text-sm text-brand-100 font-medium">合同智能审查系统</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-brand-50 backdrop-blur-md">
              上传 · 分析 · 风险评估
            </span>
          </div>

          {/* 主体内容 */}
          <div className="px-8 py-10">
            <div className="mb-10 text-center space-y-3">
              <h1 className="text-3xl font-bold text-white tracking-tight">
                上传您的合同
              </h1>
              <p className="text-slate-400 max-w-md mx-auto">
                支持多种文档格式，AI 将自动为您识别潜在法律风险并提供专业修改建议。
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

              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between pt-4 border-t border-white/5">
                <div className="flex-1">
                  <p className="text-sm text-slate-400 leading-relaxed">
                    上传完成后，点击下方按钮开始智能分析。
                  </p>
                </div>
                <Button
                  type="primary"
                  size="large"
                  disabled={!fileId || uploading}
                  loading={uploading}
                  className={`!h-12 !px-8 !rounded-xl !text-lg !font-semibold transition-all ${
                    fileId 
                      ? '!bg-brand-600 hover:!bg-brand-500 hover:!scale-105 shadow-lg shadow-brand-600/20' 
                      : '!bg-slate-800 !text-slate-500 !border-none'
                  }`}
                  onClick={handleStartAnalysis}
                >
                  开始智能分析
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
