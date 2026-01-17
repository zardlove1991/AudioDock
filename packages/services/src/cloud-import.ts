import type { ISuccessResponse } from "./models";
import request from "./request";

export interface CloudProvider {
  id: string;
  name: string;
  displayName: string;
  oauthUrl?: string;
  enabled: boolean;
  requiresConfig?: boolean;
}

export interface CloudFile {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  modifiedTime?: string;
  path?: string;
  mimeType?: string;
  children?: CloudFile[];
}

export interface CloudImportTask {
  id: string;
  status: CloudTaskStatus;
  message?: string;
  total?: number;
  current?: number;
}

export enum CloudTaskStatus {
  INITIALIZING = 'INITIALIZING',
  PARSING = 'PARSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface JSpaceConfig {
  url: string;
  username: string;
  password: string;
}

// 获取可用的云盘提供商
export const getCloudProviders = (serverAddress?: string) => {
  return request.get<any, ISuccessResponse<CloudProvider[]>>(
    "/cloud-import/providers",
    serverAddress ? { baseURL: serverAddress } : undefined
  );
};

// 处理OAuth认证
export const authWithProvider = (providerId: string, serverAddress?: string) => {
  return request.post<any, ISuccessResponse<{ authUrl?: string }>>(
    `/cloud-import/auth/${providerId}`,
    {},
    serverAddress ? { baseURL: serverAddress } : undefined
  );
};

export const handleAuthCallback = (providerId: string, code: string, serverAddress?: string) => {
  return request.post<any, ISuccessResponse<{ accessToken: string }>>(
    `/cloud-import/auth/${providerId}/callback`,
    { code },
    serverAddress ? { baseURL: serverAddress } : undefined
  );
};

// 获取云盘文件列表
export const getCloudFiles = (
  providerId: string, 
  accessToken?: string, 
  options?: {
    serverAddress?: string;
    path?: string;
    maxDepth?: number;
  }
) => {
  const params: any = {};
  if (accessToken) params.accessToken = accessToken;
  if (options?.path) params.path = options.path;
  if (options?.maxDepth !== undefined) params.maxDepth = options.maxDepth;
  
  return request.get<any, ISuccessResponse<CloudFile[]>>(
    `/cloud-import/files/${providerId}`,
    {
      params,
      ...(options?.serverAddress ? { baseURL: options.serverAddress } : {})
    }
  );
};

// 开始导入云盘文件
export const importCloudFiles = (
  providerId: string, 
  filePaths: string[], 
  accessToken?: string, 
  serverAddress?: string
) => {
  return request.post<any, ISuccessResponse<{ taskId: string }>>(
    "/cloud-import/import",
    { provider: providerId, files: filePaths, accessToken },
    serverAddress ? { baseURL: serverAddress } : undefined
  );
};

// 查询导入任务状态
export const getImportTaskStatus = (taskId: string, serverAddress?: string) => {
  return request.get<any, ISuccessResponse<CloudImportTask>>(
    `/cloud-import/task/${taskId}`,
    serverAddress ? { baseURL: serverAddress } : undefined
  );
};

// 配置极空间
export const configureJSpace = (config: JSpaceConfig, serverAddress?: string) => {
  return request.post<any, ISuccessResponse<{ success: boolean }>>(
    "/cloud-import/config/jspace",
    config,
    serverAddress ? { baseURL: serverAddress } : undefined
  );
};