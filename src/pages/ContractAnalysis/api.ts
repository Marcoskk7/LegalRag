import { request } from '@umijs/max';
import {
  ApiAnalyzeResponse,
  ApiDocumentContentResponse,
  ApiRisk,
  ApiRisksResponse,
  ApiStatusResponse,
} from './typing';

const API_BASE_URL = 'http://api.legalrag.studio';
const UPLOAD_URL = `${API_BASE_URL}/api/v1/upload`;

export const fetchStatus = async (
  fileId: string,
): Promise<ApiStatusResponse | null> => {
  try {
    return await request<ApiStatusResponse>(
      `${API_BASE_URL}/api/v1/documents/${fileId}/risks/status`,
      { method: 'GET' },
    );
  } catch (error) {
    console.error('Fetch status error:', error);
    return null;
  }
};

export const fetchDocumentContent = async (
  fileId: string,
): Promise<ApiDocumentContentResponse | null> => {
  try {
    const res = await request<ApiDocumentContentResponse>(
      `${API_BASE_URL}/api/v1/documents/${fileId}/content`,
      { method: 'GET' },
    );
    return res;
  } catch (error) {
    console.error('Fetch document content error:', error);
    return null;
  }
};

export const fetchRisks = async (
  fileId: string,
): Promise<ApiRisksResponse | null> => {
  try {
    return await request<ApiRisksResponse>(
      `${API_BASE_URL}/api/v1/documents/${fileId}/risks`,
      { method: 'GET' },
    );
  } catch (error) {
    console.error('Fetch risks error:', error);
    return null;
  }
};

export const fetchRiskDetail = async (
  fileId: string,
  identifier: string,
): Promise<ApiRisk | null> => {
  if (!fileId) return null;
  try {
    const res = await request<ApiRisk>(
      `${API_BASE_URL}/api/v1/documents/${fileId}/risks/${identifier}`,
      { method: 'GET' },
    );
    return res;
  } catch (error) {
    console.error('Fetch risk detail error:', error);
    return null;
  }
};

export const triggerAnalysis = async (
  fileId: string,
): Promise<ApiAnalyzeResponse | null> => {
  try {
    return await request<ApiAnalyzeResponse>(
      `${API_BASE_URL}/api/v1/documents/${fileId}/risks/analyze`,
      {
        method: 'POST',
        data: { top_k: 1 },
      },
    );
  } catch (error) {
    console.error('Trigger analysis error:', error);
    return null;
  }
};

export const uploadEditedFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const resp = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

  return (await resp.json()) as any;
};

