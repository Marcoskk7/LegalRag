export interface UploadResponse {
  success: boolean;
  data: {
    uuid: string;
    [key: string]: any;
  };
  message?: string;
}

