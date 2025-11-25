import React, { useState } from 'react';
import { InboxOutlined } from '@ant-design/icons';
import { message, Upload, Button } from 'antd';
import { history } from '@umijs/max';
import type { UploadProps } from 'antd';
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
    <div className="contract-upload-page">
      <div className="upload-container">
        <div className="upload-header">
          <h1>合同智能审查系统</h1>
          <p>上传合同文件，AI 为您进行风险识别和法律审查</p>
        </div>

        <div className="upload-content">
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持 PDF、Word (doc/docx) 和 TXT 格式，单个文件不超过 50MB
            </p>
          </Dragger>

          {fileId && (
            <Button
              type="primary"
              size="large"
              block
              onClick={handleStartAnalysis}
              style={{ marginTop: 24 }}
            >
              开始分析
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractUpload;
