import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { ImportService, TaskStatus } from './import';
import { 
  CloudProvider, 
  CloudFile, 
  CloudImportRequest,
  CloudImportController 
} from '../controllers/cloud-import';

export interface CloudImportTask {
  id: string;
  status: TaskStatus;
  provider: string;
  files: string[];
  total?: number;
  current?: number;
  downloaded?: number;
  message?: string;
  downloadPath?: string;
  accessToken?: string;
}

export interface CloudCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

@Injectable()
export class CloudImportService {
  private readonly logger = new Logger(CloudImportService.name);
  private tasks: Map<string, CloudImportTask> = new Map();
  private credentials: Map<string, CloudCredentials> = new Map();

  constructor(private readonly importService: ImportService) {}

  async getAvailableProviders(): Promise<CloudProvider[]> {
    return [
      {
        id: 'baidu',
        name: 'baidu',
        displayName: '百度网盘',
        oauthUrl: 'https://openapi.baidu.com/oauth/2.0/authorize',
        enabled: true
      },
      {
        id: 'aliyun',
        name: 'aliyun',
        displayName: '阿里云盘',
        oauthUrl: 'https://auth.aliyundrive.com/oauth2/authorize',
        enabled: true
      },
      {
        id: 'tencent',
        name: 'tencent',
        displayName: '腾讯微云',
        oauthUrl: 'https://graph.qq.com/oauth2.0/authorize',
        enabled: true
      },
      {
        id: 'onedrive',
        name: 'onedrive',
        displayName: 'OneDrive',
        oauthUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        enabled: true
      },
      {
        id: 'googledrive',
        name: 'googledrive',
        displayName: 'Google Drive',
        oauthUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        enabled: true
      }
    ];
  }

  async getAuthUrl(provider: string): Promise<string> {
    const providers = await this.getAvailableProviders();
    const cloudProvider = providers.find(p => p.id === provider);
    
    if (!cloudProvider || !cloudProvider.oauthUrl) {
      throw new Error(`Provider ${provider} not found or not supported`);
    }

    const redirectUri = `${process.env.API_BASE_URL || 'http://localhost:3001'}/cloud-import/auth/callback/${provider}`;
    const state = randomUUID();
    
    // 这里简化处理，实际每个平台的OAuth参数都不同
    switch (provider) {
      case 'baidu':
        return `${cloudProvider.oauthUrl}?client_id=${process.env.BAIDU_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&state=${state}&scope=basic netdisk`;
      
      case 'aliyun':
        return `${cloudProvider.oauthUrl}?client_id=${process.env.ALIYUN_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&state=${state}&scope=user:base,user:drive`;
      
      default:
        throw new Error(`OAuth flow for ${provider} not implemented`);
    }
  }

  async handleAuthCallback(provider: string, code: string, state?: string): Promise<CloudCredentials> {
    try {
      let credentials: CloudCredentials;
      
      switch (provider) {
        case 'baidu':
          credentials = await this.handleBaiduAuth(code);
          break;
        case 'aliyun':
          credentials = await this.handleAliyunAuth(code);
          break;
        default:
          throw new Error(`Auth handling for ${provider} not implemented`);
      }
      
      // 存储凭证
      this.credentials.set(provider, credentials);
      return credentials;
    } catch (error) {
      this.logger.error(`Auth callback failed for ${provider}:`, error);
      throw error;
    }
  }

  private async handleBaiduAuth(code: string): Promise<CloudCredentials> {
    const response = await fetch('https://openapi.baidu.com/oauth/2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.BAIDU_CLIENT_ID!,
        client_secret: process.env.BAIDU_CLIENT_SECRET!,
        redirect_uri: `${process.env.API_BASE_URL || 'http://localhost:3001'}/cloud-import/auth/callback/baidu`
      })
    });

    if (!response.ok) {
      throw new Error('Baidu auth failed');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000)
    };
  }

  private async handleAliyunAuth(code: string): Promise<CloudCredentials> {
    const response = await fetch('https://auth.aliyundrive.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.ALIYUN_CLIENT_ID!,
        client_secret: process.env.ALIYUN_CLIENT_SECRET!,
        redirect_uri: `${process.env.API_BASE_URL || 'http://localhost:3001'}/cloud-import/auth/callback/aliyun`
      })
    });

    if (!response.ok) {
      throw new Error('Aliyun auth failed');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000)
    };
  }

  async listFiles(provider: string, path: string = '/', accessToken?: string): Promise<CloudFile[]> {
    const credentials = accessToken ? { accessToken } : this.credentials.get(provider);
    
    if (!credentials) {
      throw new Error(`No credentials found for provider ${provider}`);
    }

    switch (provider) {
      case 'baidu':
        return this.listBaiduFiles(credentials.accessToken, path);
      case 'aliyun':
        return this.listAliyunFiles(credentials.accessToken, path);
      default:
        throw new Error(`File listing for ${provider} not implemented`);
    }
  }

  private async listBaiduFiles(accessToken: string, dir: string): Promise<CloudFile[]> {
    const response = await fetch('https://pan.baidu.com/rest/2.0/xpan/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        method: 'list',
        access_token: accessToken,
        dir: dir === '/' ? '' : dir,
        recursive: '0'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to list Baidu files');
    }

    const data = await response.json();
    
    if (data.errno !== 0) {
      throw new Error(`Baidu API error: ${data.errmsg}`);
    }

    return data.list.map((file: any) => ({
      id: file.fs_id,
      name: file.server_filename,
      path: file.path,
      size: file.size,
      type: file.isdir === 1 ? 'folder' : 'file',
      mimeType: file.server_filename.includes('.mp3') ? 'audio/mpeg' : 
               file.server_filename.includes('.flac') ? 'audio/flac' :
               file.server_filename.includes('.wav') ? 'audio/wav' : undefined,
      modifiedTime: new Date(file.server_mtime * 1000).toISOString()
    }));
  }

  private async listAliyunFiles(accessToken: string, parentFileId: string = 'root'): Promise<CloudFile[]> {
    const response = await fetch('https://api.aliyundrive.com/v2/file/list', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        parent_file_id: parentFileId,
        type: 'file',
        limit: 200
      })
    });

    if (!response.ok) {
      throw new Error('Failed to list Aliyun files');
    }

    const data = await response.json();
    
    return data.items.map((file: any) => ({
      id: file.file_id,
      name: file.name,
      path: file.parent_file_id === 'root' ? `/${file.name}` : file.parent_file_id,
      size: file.size,
      type: file.type === 'folder' ? 'folder' : 'file',
      mimeType: file.mime_type,
      modifiedTime: file.updated_at
    }));
  }

  async createImportTask(request: CloudImportRequest): Promise<string> {
    const taskId = randomUUID();
    const downloadPath = request.downloadPath || path.join(process.env.MUSIC_BASE_DIR || './downloads', request.provider);
    
    // 确保下载目录存在
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }

    const task: CloudImportTask = {
      id: taskId,
      status: TaskStatus.INITIALIZING,
      provider: request.provider,
      files: request.files,
      downloadPath,
      accessToken: request.accessToken
    };

    this.tasks.set(taskId, task);

    // 异步执行下载和导入
    this.executeImportTask(taskId).catch(err => {
      this.logger.error(`Import task ${taskId} failed:`, err);
    });

    return taskId;
  }

  private async executeImportTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    try {
      task.status = TaskStatus.PARSING;
      task.total = task.files.length;
      task.current = 0;
      task.downloaded = 0;

      const credentials = task.accessToken ? 
        { accessToken: task.accessToken } : 
        this.credentials.get(task.provider);

      if (!credentials) {
        throw new Error(`No credentials found for provider ${task.provider}`);
      }

      const downloadedFiles: string[] = [];

      // 下载文件
      for (const fileId of task.files) {
        const localPath = await this.downloadFile(task.provider, fileId, task.downloadPath!, credentials.accessToken);
        downloadedFiles.push(localPath);
        task.current = (task.current || 0) + 1;
        task.downloaded = (task.downloaded || 0) + 1;
      }

      // 触发现有的导入流程
      const importTaskId = await this.importService.createTask(
        task.downloadPath!,
        '', // audiobook path
        path.join(process.env.CACHE_DIR || './cache', 'cloud'),
        'incremental'
      );

      // 监听导入任务状态
      await this.waitForImportCompletion(importTaskId);

      task.status = TaskStatus.SUCCESS;
      task.message = `Successfully imported ${downloadedFiles.length} files`;
    } catch (error) {
      task.status = TaskStatus.FAILED;
      task.message = error instanceof Error ? error.message : String(error);
    }
  }

  private async downloadFile(provider: string, fileId: string, downloadPath: string, accessToken: string): Promise<string> {
    switch (provider) {
      case 'baidu':
        return this.downloadBaiduFile(fileId, downloadPath, accessToken);
      case 'aliyun':
        return this.downloadAliyunFile(fileId, downloadPath, accessToken);
      default:
        throw new Error(`Download for ${provider} not implemented`);
    }
  }

  private async downloadBaiduFile(fileId: string, downloadPath: string, accessToken: string): Promise<string> {
    // 获取下载链接
    const linkResponse = await fetch('https://pan.baidu.com/rest/2.0/xpan/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        method: 'filemetas',
        access_token: accessToken,
        fsids: `[${fileId}]`
      })
    });

    if (!linkResponse.ok) {
      throw new Error('Failed to get file info');
    }

    const linkData = await linkResponse.json();
    const fileInfo = linkData.list[0];

    // 获取下载URL
    const downloadResponse = await fetch('https://pan.baidu.com/rest/2.0/xpan/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        method: 'streaming',
        access_token: accessToken,
        path: fileInfo.path
      })
    });

    if (!downloadResponse.ok) {
      throw new Error('Failed to get download URL');
    }

    const downloadData = await downloadResponse.json();
    const downloadUrl = downloadData.list[0].dlink;

    // 下载文件
    const fileResponse = await fetch(downloadUrl);
    if (!fileResponse.ok) {
      throw new Error('Failed to download file');
    }

    const localPath = path.join(downloadPath, fileInfo.server_filename);
    const buffer = await fileResponse.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(buffer));

    return localPath;
  }

  private async downloadAliyunFile(fileId: string, downloadPath: string, accessToken: string): Promise<string> {
    // 获取下载链接
    const response = await fetch('https://api.aliyundrive.com/v2/file/get_download_url', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        drive_id: 'root',
        file_id: fileId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get download URL');
    }

    const data = await response.json();
    
    // 下载文件
    const fileResponse = await fetch(data.url);
    if (!fileResponse.ok) {
      throw new Error('Failed to download file');
    }

    // 需要先获取文件信息来获取文件名
    const fileInfoResponse = await fetch('https://api.aliyundrive.com/v2/file/get', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        drive_id: 'root',
        file_id: fileId
      })
    });

    const fileInfo = await fileInfoResponse.json();
    const localPath = path.join(downloadPath, fileInfo.name);
    const buffer = await fileResponse.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(buffer));

    return localPath;
  }

  private async waitForImportCompletion(importTaskId: string): Promise<void> {
    const maxWaitTime = 60000; // 60秒超时
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const task = this.importService.getTask(importTaskId);
      if (!task) {
        throw new Error('Import task not found');
      }

      if (task.status === TaskStatus.SUCCESS) {
        return;
      }

      if (task.status === TaskStatus.FAILED) {
        throw new Error(task.message || 'Import failed');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Import task timeout');
  }

  async getTask(id: string): Promise<CloudImportTask | undefined> {
    return this.tasks.get(id);
  }

  async getDownloadUrl(taskId: string, fileId: string): Promise<string | null> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }

    const credentials = task.accessToken ? 
      { accessToken: task.accessToken } : 
      this.credentials.get(task.provider);

    if (!credentials) {
      return null;
    }

    try {
      switch (task.provider) {
        case 'baidu':
          return this.getBaiduDownloadUrl(fileId, credentials.accessToken);
        case 'aliyun':
          return this.getAliyunDownloadUrl(fileId, credentials.accessToken);
        default:
          return null;
      }
    } catch (error) {
      this.logger.error(`Failed to get download URL:`, error);
      return null;
    }
  }

  private async getBaiduDownloadUrl(fileId: string, accessToken: string): Promise<string> {
    const response = await fetch('https://pan.baidu.com/rest/2.0/xpan/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        method: 'streaming',
        access_token: accessToken,
        fsids: `[${fileId}]`
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get download URL');
    }

    const data = await response.json();
    return data.list[0].dlink;
  }

  private async getAliyunDownloadUrl(fileId: string, accessToken: string): Promise<string> {
    const response = await fetch('https://api.aliyundrive.com/v2/file/get_download_url', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        drive_id: 'root',
        file_id: fileId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get download URL');
    }

    const data = await response.json();
    return data.url;
  }
}