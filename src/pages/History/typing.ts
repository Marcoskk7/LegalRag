export interface ApiHistoryItem {
  uuid: string;
  filename: string;
  created_at: string;
  top_k: number;
}

export interface HistoryListParams {
  page?: number;
  page_size?: number;
  search?: string;
}

export interface ApiHistoryListResponse {
  success: boolean;
  data: ApiHistoryItem[];
  total?: number;
  page?: number;
  page_size?: number;
  message?: string;
}

export interface ApiHistoryDetailResponse {
  success: boolean;
  data: any; // 聚合：上传信息+内容+风险，结构与 ApiRisksResponse 类似
  message?: string;
}
