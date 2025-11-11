import React from 'react';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { message, Upload } from 'antd';

const { Dragger } = Upload;

const props: UploadProps = {
  name: 'file',
  multiple: false,
  action: 'https://api.legalrag.studio:8080/api/v1/upload',
  // ✅ 标准的 accept 写法
  accept: '.pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',

  onChange(info) {
    const { status } = info.file;
    if (status !== 'uploading') {
      console.log(info.file, info.fileList);
    }
    if (status === 'done') {
      const response = info.file.response;
      if (response?.success) {
        message.success(`${info.file.name} 上传成功！文件ID: ${response.data.id}`);
        console.log('上传文件信息:', response.data);
      } else {
        message.error(response?.message || `${info.file.name} 上传失败`);
      }
    } else if (status === 'error') {
      message.error(`${info.file.name} 上传失败，请重试`);
    }
  },

  onDrop(e) {
    console.log('拖拽的文件', e.dataTransfer.files);
  },

  // ✅ 修正验证逻辑
  beforeUpload(file) {
    const allowedTypes = [
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'text/plain' // .txt
    ];

    const isAllowedType = allowedTypes.includes(file.type);

    if (!isAllowedType) {
      message.error('只支持上传 PDF、Word 或 TXT 文件！');
      return false;
    }

    const isLt50M = file.size / 1024 / 1024 < 50;
    if (!isLt50M) {
      message.error('文件大小不能超过 50MB！');
      return false;
    }

    return true;
  },
};

const App: React.FC = () => (
  <Dragger {...props}>
    <p className="ant-upload-drag-icon">
      <InboxOutlined />
    </p>
    <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
    <p className="ant-upload-hint">
      支持 PDF、Word (doc/docx) 和 TXT 格式，单个文件不超过 50MB
    </p>
  </Dragger>
);

export default App;
