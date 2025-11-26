import { InboxOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import type { UploadProps } from 'antd';
import { Button, message, Upload } from 'antd';
import React, { useState } from 'react';
import './index.less';

const { Dragger } = Upload;

const ContractUpload: React.FC = () => {
  const [fileId, setFileId] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    showUploadList: true,
    maxCount: 1,
    action:'http://localhost:8080/api/v1/upload',
    // action: 'https://api.legalrag.studio/api/v1/upload',
    accept: '.pdf,.doc,.docx,.txt',
    onChange(info) {
      const { status } = info.file;

      if (status === 'uploading') {
        setUploading(true);
      }

      if (status === 'done') {
        setUploading(false);
        const response = info.file.response;
        if (response?.success) {
          message.success(`${info.file.name} 上传成功！`);
          setFileId(response.data.uuid);
        } else {
          message.error(response?.message || '上传失败');
        }
      } else if (status === 'error') {
        setUploading(false);
        message.error(`${info.file.name} 上传失败`);
      }
    },
    beforeUpload(file) {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];

      if (!allowedTypes.includes(file.type)) {
        message.error('只支持上传 PDF、Word 或 TXT 文件！');
        return false;
      }

      if (file.size / 1024 / 1024 > 50) {
        message.error('文件大小不能超过 50MB！');
        return false;
      }

      return true;
    },
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
            <p className="text-xs font-semibold tracking-wide text-brand-50/80 uppercase">LegalRag</p>
            <p className="text-sm text-brand-50">合同智能审查系统</p>
          </div>
          <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs text-brand-50">
            上传 · 分析 · 风险评估
          </span>
        </div>

        {/* 浅色卡片主体 */}
        <div className="px-6 py-8">
          <div className="mb-8 text-center space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900">合同智能审查系统</h1>
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

            <div className="flex flex-col gap-3 text-xs md:text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
              <span>上传完成后，我们会自动为您生成风险列表、修改建议和适用法律条款。</span>
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
