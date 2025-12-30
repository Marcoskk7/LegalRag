import { request } from '@umijs/max';
import { ApiHistoryListResponse, ApiHistoryDetailResponse, HistoryListParams } from './typing';

const API_BASE_URL = 'http://127.0.0.1:8080';

/**
 * 获取历史记录列表
 * GET /api/v1/history/list?page=1&page_size=20&search=合同
 */
export const fetchHistoryList = async (
  params: HistoryListParams = {},
): Promise<ApiHistoryListResponse> => {
  const { page = 1, page_size = 20, search } = params;
  return request<ApiHistoryListResponse>(`${API_BASE_URL}/api/v1/history/list`, {
    method: 'GET',
    params: {
      page,
      page_size,
      ...(search ? { search } : {}),
    },
  });
};

/**
 * 获取单条历史详情（聚合：上传信息+内容+风险）
 * GET /api/v1/history/{uuid}
 */
export const fetchHistoryDetail = async (uuid: string): Promise<ApiHistoryDetailResponse> => {
  return request<ApiHistoryDetailResponse>(`${API_BASE_URL}/api/v1/history/${uuid}`, {
    method: 'GET',
  });
};
