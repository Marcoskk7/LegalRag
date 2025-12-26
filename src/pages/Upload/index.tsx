import { InboxOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import type { UploadFile, UploadProps } from 'antd';
import { Button, Input, message, Modal, Upload } from 'antd';
import React, { useState } from 'react';
import './index.less';

const { Dragger } = Upload;

const ContractUpload: React.FC = () => {
  const [fileId, setFileId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [txtEditOpen, setTxtEditOpen] = useState(false);
  const [txtEditValue, setTxtEditValue] = useState('');
  const [pendingTxtFileName, setPendingTxtFileName] = useState<string>('');

  const apiBaseUrl = 'http://api.legalrag.studio';
  const uploadUrl = `${apiBaseUrl}/api/v1/upload`;

  const doUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const resp = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    return (await resp.json()) as any;
  };

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
        const res = await doUpload(file as File);
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

      const res = await doUpload(editedFile);
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

    // 跳转并传递 fileId
    //   history.push({
    //     pathname: '/contract-analysis',
    //     query: { fileId }
    //   });
    history.push(`/contract-analysis?fileId=${fileId}`);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-slate-50 to-white px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-3xl rounded-2xl bg-white border border-slate-100 shadow-xl overflow-hidden">
        {/* 顶部渐变说明条 */}
        <div className="bg-gradient-to-r from-brand-600 to-blue-500 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-50/80 uppercase">
              LegalRag
            </p>
            <p className="text-sm text-brand-50">合同智能审查系统</p>
          </div>
          <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs text-brand-50">
            上传 · 分析 · 风险评估
          </span>
        </div>

        {/* 浅色卡片主体 */}
        <div className="px-6 py-8">
          <div className="mb-8 text-center space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900">
              合同智能审查系统
            </h1>
            <p className="text-sm text-slate-500">
              上传合同文件，AI 为您进行风险识别和法律审查
            </p>
          </div>

          <div className="space-y-6">
            <Dragger
              {...uploadProps}
              className="bg-slate-50 border-2 border-dashed border-slate-200 hover:border-brand-500 rounded-xl transition-colors"
            >
              <p className="ant-upload-drag-icon text-brand-500 text-4xl">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text text-slate-800 font-medium">
                点击或拖拽文件到此区域上传
              </p>
              <p className="ant-upload-hint text-slate-500 text-xs md:text-sm">
                支持 PDF、Word (doc/docx) 和 TXT 格式，单个文件不超过 50MB
              </p>
            </Dragger>

            <Modal
              title="编辑 TXT 内容"
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
            >
              <div className="space-y-3">
                <div className="text-xs text-slate-500">
                  仅对 TXT 文件支持在线修改；PDF/Word 请直接上传。
                </div>
                <Input.TextArea
                  value={txtEditValue}
                  onChange={(e) => setTxtEditValue(e.target.value)}
                  autoSize={{ minRows: 16, maxRows: 28 }}
                />
              </div>
            </Modal>

            <div className="flex flex-col gap-3 text-xs md:text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
              <span>
                上传完成后，我们会自动为您生成风险列表、修改建议和适用法律条款。
              </span>
              <Button
                type="primary"
                size="large"
                disabled={!fileId || uploading}
                loading={uploading}
                className="md:w-40 w-full !h-11 !rounded-xl bg-brand-600 hover:bg-brand-700"
                onClick={handleStartAnalysis}
              >
                开始智能分析
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractUpload;
