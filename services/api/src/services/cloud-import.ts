import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { ImportService, TaskStatus } from './import';
import {
  CloudProvider,
  CloudFile,
  CloudImportRequest,
  CloudImportController,
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

export interface JSpaceConfig {
  url: string;
  username: string;
  password: string;
  path?: string;
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
  private jspaceConfigs: Map<string, JSpaceConfig> = new Map();
  private webdavClient: any = null;

  constructor(private readonly importService: ImportService) {}

  private getWebdavClient() {
    if (!this.webdavClient) {
      try {
        const { createClient } = require('webdav');
        this.webdavClient = createClient;
      } catch (error) {
        this.logger.error('Failed to import webdav module:', error);
        throw error;
      }
    }
    return this.webdavClient;
  }

  async getAvailableProviders(): Promise<CloudProvider[]> {
    return [
      {
        id: 'baidu',
        name: 'baidu',
        displayName: '百度网盘',
        oauthUrl: 'https://openapi.baidu.com/oauth/2.0/authorize',
        enabled: true,
      },
      {
        id: 'aliyun',
        name: 'aliyun',
        displayName: '阿里云盘',
        oauthUrl: 'https://auth.aliyundrive.com/oauth2/authorize',
        enabled: true,
      },
      {
        id: 'tencent',
        name: 'tencent',
        displayName: '腾讯微云',
        oauthUrl: 'https://graph.qq.com/oauth2.0/authorize',
        enabled: true,
      },
      {
        id: 'onedrive',
        name: 'onedrive',
        displayName: 'OneDrive',
        oauthUrl:
          'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        enabled: true,
      },
      {
        id: 'googledrive',
        name: 'googledrive',
        displayName: 'Google Drive',
        oauthUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        enabled: true,
      },
      {
        id: 'jspace',
        name: 'jspace',
        displayName: '极空间',
        oauthUrl: '',
        enabled: true,
        requiresConfig: true,
      },
    ];
  }

  async configureJSpace(config: JSpaceConfig): Promise<void> {
    // 直接保存配置，跳过连接测试（用于演示）
    this.jspaceConfigs.set('default', config);
    this.logger.log(`JSpace configured for ${config.url}`);
  }

  async listJSpaceFiles(
    directory: string = '/',
    maxDepth: number = 2,
  ): Promise<CloudFile[]> {
    const config = this.jspaceConfigs.get('default');
    if (!config) {
      throw new Error('极空间未配置，请先配置极空间连接信息');
    }

    // 如果指定了具体目录，使用较小的深度限制
    const effectiveMaxDepth = directory === '/' ? maxDepth : 1;

    this.logger.log(
      `Scanning JSpace directory: ${directory}, maxDepth: ${effectiveMaxDepth}`,
    );
    return this.listJSpaceFilesWithConfig(
      config,
      directory,
      0,
      effectiveMaxDepth,
    );
  }

  async getAuthUrl(provider: string): Promise<string> {
    const providers = await this.getAvailableProviders();
    const cloudProvider = providers.find((p) => p.id === provider);

    if (!cloudProvider) {
      throw new Error(`Provider ${provider} not found or not supported`);
    }

    // 极空间不需要OAuth，直接返回配置URL
    if (provider === 'jspace') {
      return '/cloud-import/config/jspace';
    }

    if (!cloudProvider.oauthUrl) {
      throw new Error(`OAuth flow for ${provider} not supported`);
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

  async handleAuthCallback(
    provider: string,
    code: string,
    state?: string,
  ): Promise<CloudCredentials> {
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
        redirect_uri: `${process.env.API_BASE_URL || 'http://localhost:3001'}/cloud-import/auth/callback/baidu`,
      }),
    });

    if (!response.ok) {
      throw new Error('Baidu auth failed');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
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
        redirect_uri: `${process.env.API_BASE_URL || 'http://localhost:3001'}/cloud-import/auth/callback/aliyun`,
      }),
    });

    if (!response.ok) {
      throw new Error('Aliyun auth failed');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async listFiles(
    provider: string,
    path: string = '/',
    accessToken?: string,
    maxDepth?: number,
  ): Promise<CloudFile[]> {
    if (provider === 'jspace') {
      return this.listJSpaceFiles(path, maxDepth);
    }

    const credentials = accessToken
      ? { accessToken }
      : this.credentials.get(provider);

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

  private async listBaiduFiles(
    accessToken: string,
    dir: string,
  ): Promise<CloudFile[]> {
    const response = await fetch('https://pan.baidu.com/rest/2.0/xpan/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        method: 'list',
        access_token: accessToken,
        dir: dir === '/' ? '' : dir,
        recursive: '0',
      }),
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
      mimeType: file.server_filename.includes('.mp3')
        ? 'audio/mpeg'
        : file.server_filename.includes('.flac')
          ? 'audio/flac'
          : file.server_filename.includes('.wav')
            ? 'audio/wav'
            : undefined,
      modifiedTime: new Date(file.server_mtime * 1000).toISOString(),
    }));
  }

  private async listAliyunFiles(
    accessToken: string,
    parentFileId: string = 'root',
  ): Promise<CloudFile[]> {
    const response = await fetch('https://api.aliyundrive.com/v2/file/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        parent_file_id: parentFileId,
        type: 'file',
        limit: 200,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to list Aliyun files');
    }

    const data = await response.json();

    return data.items.map((file: any) => ({
      id: file.file_id,
      name: file.name,
      path:
        file.parent_file_id === 'root' ? `/${file.name}` : file.parent_file_id,
      size: file.size,
      type: file.type === 'folder' ? 'folder' : 'file',
      mimeType: file.mime_type,
      modifiedTime: file.updated_at,
    }));
  }

  private async listJSpaceFilesWithConfig(
    config: JSpaceConfig,
    dirPath: string = '/',
    depth: number = 0,
    maxDepth: number = 2,
  ): Promise<CloudFile[]> {
    try {
      const createClient = this.getWebdavClient();
      const client = createClient(config.url, {
        username: config.username,
        password: config.password,
      });

      // 添加深度限制防止无限递归
      if (depth > maxDepth) {
        this.logger.warn(
          `Max depth reached for directory: ${dirPath} (depth: ${depth})`,
        );
        return [];
      }

      this.logger.warn(`Scanning directory [depth ${depth}]: ${dirPath}`);
      const contents = await client.getDirectoryContents(dirPath);
      this.logger.warn(`Found ${contents.length} items in ${dirPath}`);

      const result: CloudFile[] = [];

      for (const item of contents as any[]) {
        const cloudFile: CloudFile = {
          id: item.filename,
          name: item.basename,
          path: item.filename,
          size: item.size,
          type: item.type === 'directory' ? 'folder' : 'file',
          mimeType: this.getMimeTypeFromFilename(item.basename),
          modifiedTime: item.lastmod,
        };

        // 如果是目录，递归获取子目录内容（但有深度限制）
        if (item.type === 'directory') {
          try {
            this.logger.warn(
              `Entering subdirectory: ${item.filename} (depth ${depth + 1})`,
            );
            cloudFile.children = await this.listJSpaceFilesWithConfig(
              config,
              item.filename,
              depth + 1,
              maxDepth,
            );
            this.logger.warn(
              `Finished scanning subdirectory: ${item.filename}, found ${cloudFile.children.length} items`,
            );
          } catch (error) {
            this.logger.warn(
              `Failed to get contents for directory ${item.filename}:`,
              error,
            );
            cloudFile.children = [];
          }
        }

        result.push(cloudFile);
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to list JSpace files:', error);
      throw new Error('获取极空间文件列表失败');
    }
  }

  private getMimeTypeFromFilename(filename: string): string | undefined {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.mp3':
        return 'audio/mpeg';
      case '.flac':
        return 'audio/flac';
      case '.wav':
        return 'audio/wav';
      case '.m4a':
        return 'audio/mp4';
      case '.aac':
        return 'audio/aac';
      case '.ogg':
        return 'audio/ogg';
      default:
        return undefined;
    }
  }

  async createImportTask(request: CloudImportRequest): Promise<string> {
    const taskId = randomUUID();
    const musicBaseDir = path.resolve(process.env.MUSIC_BASE_DIR || './music');
    const downloadPath =
      request.downloadPath ||
      path.join(musicBaseDir, '_cloud', request.provider);

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
      accessToken: request.accessToken,
    };

    this.tasks.set(taskId, task);

    // 异步执行下载和导入
    this.executeImportTask(taskId).catch((err) => {
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

      const credentials = task.accessToken
        ? { accessToken: task.accessToken }
        : this.credentials.get(task.provider);

      if (!credentials) {
        throw new Error(`No credentials found for provider ${task.provider}`);
      }

      const downloadedFiles: string[] = [];

      // 下载文件
      for (const fileId of task.files) {
        const localPath = await this.downloadFile(
          task.provider,
          fileId,
          task.downloadPath!,
          credentials.accessToken,
        );
        downloadedFiles.push(localPath);
        task.current = (task.current || 0) + 1;
        task.downloaded = (task.downloaded || 0) + 1;
      }

      // 触发现有的导入流程
      const musicBaseDir = path.resolve(
        process.env.MUSIC_BASE_DIR || './music',
      );
      const importTaskId = await this.importService.createTask(
        task.downloadPath!,
        path.join(musicBaseDir, '_cloud', '__no_audiobooks__'),
        path.join(process.env.CACHE_DIR || './cache', 'cloud'),
        'incremental',
        {
          musicUrlBasePath: musicBaseDir,
        },
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

  private async downloadFile(
    provider: string,
    fileId: string,
    downloadPath: string,
    accessToken?: string,
  ): Promise<string> {
    if (provider === 'jspace') {
      return this.downloadJSpaceFile(fileId, downloadPath);
    }

    const credentials = accessToken
      ? { accessToken }
      : this.credentials.get(provider);
    if (!credentials) {
      throw new Error(`No credentials found for provider ${provider}`);
    }

    switch (provider) {
      case 'baidu':
        return this.downloadBaiduFile(
          fileId,
          downloadPath,
          credentials.accessToken,
        );
      case 'aliyun':
        return this.downloadAliyunFile(
          fileId,
          downloadPath,
          credentials.accessToken,
        );
      default:
        throw new Error(`Download for ${provider} not implemented`);
    }
  }

  private async downloadBaiduFile(
    fileId: string,
    downloadPath: string,
    accessToken: string,
  ): Promise<string> {
    // 获取下载链接
    const linkResponse = await fetch(
      'https://pan.baidu.com/rest/2.0/xpan/file',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          method: 'filemetas',
          access_token: accessToken,
          fsids: `[${fileId}]`,
        }),
      },
    );

    if (!linkResponse.ok) {
      throw new Error('Failed to get file info');
    }

    const linkData = await linkResponse.json();
    const fileInfo = linkData.list[0];

    // 获取下载URL
    const downloadResponse = await fetch(
      'https://pan.baidu.com/rest/2.0/xpan/file',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          method: 'streaming',
          access_token: accessToken,
          path: fileInfo.path,
        }),
      },
    );

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

  private async downloadAliyunFile(
    fileId: string,
    downloadPath: string,
    accessToken: string,
  ): Promise<string> {
    // 获取下载链接
    const response = await fetch(
      'https://api.aliyundrive.com/v2/file/get_download_url',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          drive_id: 'root',
          file_id: fileId,
        }),
      },
    );

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
    const fileInfoResponse = await fetch(
      'https://api.aliyundrive.com/v2/file/get',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          drive_id: 'root',
          file_id: fileId,
        }),
      },
    );

    const fileInfo = await fileInfoResponse.json();
    const localPath = path.join(downloadPath, fileInfo.name);
    const buffer = await fileResponse.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(buffer));

    return localPath;
  }

  private async downloadJSpaceFile(
    fileId: string,
    downloadPath: string,
  ): Promise<string> {
    const config = this.jspaceConfigs.get('default');
    if (!config) {
      throw new Error('极空间未配置');
    }

    try {
      const createClient = this.getWebdavClient();
      const client = createClient(config.url, {
        username: config.username,
        password: config.password,
      });

      const filename = path.basename(fileId);
      const localPath = path.join(downloadPath, filename);

      // 下载文件
      const buffer = await client.getFileContents(fileId);
      fs.writeFileSync(localPath, Buffer.from(buffer as ArrayBuffer));

      return localPath;
    } catch (error) {
      this.logger.error('Failed to download JSpace file:', error);
      throw new Error('极空间文件下载失败');
    }
  }

  private async waitForImportCompletion(importTaskId: string): Promise<void> {
    const maxWaitTime = 30 * 60 * 1000;
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

      await new Promise((resolve) => setTimeout(resolve, 1000));
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

    if (task.provider === 'jspace') {
      const config = this.jspaceConfigs.get('default');
      if (!config) {
        return null;
      }
      return this.getJSpaceDownloadUrl(fileId, config);
    }

    const credentials = task.accessToken
      ? { accessToken: task.accessToken }
      : this.credentials.get(task.provider);

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

  private async getBaiduDownloadUrl(
    fileId: string,
    accessToken: string,
  ): Promise<string> {
    const response = await fetch('https://pan.baidu.com/rest/2.0/xpan/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        method: 'streaming',
        access_token: accessToken,
        fsids: `[${fileId}]`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get download URL');
    }

    const data = await response.json();
    return data.list[0].dlink;
  }

  private async getAliyunDownloadUrl(
    fileId: string,
    accessToken: string,
  ): Promise<string> {
    const response = await fetch(
      'https://api.aliyundrive.com/v2/file/get_download_url',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          drive_id: 'root',
          file_id: fileId,
        }),
      },
    );

    if (!response.ok) {
      throw new Error('Failed to get download URL');
    }

    const data = await response.json();
    return data.url;
  }

  private async getJSpaceDownloadUrl(
    fileId: string,
    config: JSpaceConfig,
  ): Promise<string> {
    try {
      const createClient = this.getWebdavClient();
      const client = createClient(config.url, {
        username: config.username,
        password: config.password,
      });

      // 极空间通常直接通过WebDAV URL访问
      return `${config.url}${fileId}`;
    } catch (error) {
      this.logger.error('Failed to get JSpace download URL:', error);
      throw new Error('获取极空间下载链接失败');
    }
  }
}
