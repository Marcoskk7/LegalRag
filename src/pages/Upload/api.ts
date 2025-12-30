import { UploadResponse } from './typing';

// const API_BASE_URL = 'http://api.legalrag.studio';
const API_BASE_URL = 'http://127.0.0.1:8080';
const UPLOAD_URL = `${API_BASE_URL}/api/v1/upload`;

export const uploadFile = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const resp = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

  return (await resp.json()) as UploadResponse;
};

