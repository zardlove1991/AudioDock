import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { LogMethod } from '../common/log-method.decorator';
import { Public } from '../common/public.decorator';
import { CloudImportService } from '../services/cloud-import';
import { JSpaceConfig } from '../services/cloud-import';

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
  path: string;
  size: number;
  type: 'file' | 'folder';
  mimeType?: string;
  downloadUrl?: string;
  modifiedTime?: string;
  children?: CloudFile[];
}

export interface CloudImportRequest {
  provider: string;
  files: string[];
  accessToken?: string;
  refreshToken?: string;
  downloadPath?: string;
}

export interface CloudAuthCallback {
  provider: string;
  code: string;
  state?: string;
}

@Controller('cloud-import')
export class CloudImportController {
  private readonly logger = new Logger(CloudImportController.name);

  constructor(private readonly cloudImportService: CloudImportService) {}

  @Public()
  @Get('providers')
  @LogMethod()
  async getProviders(): Promise<{
    code: number;
    message: string;
    data: CloudProvider[];
  }> {
    const providers = await this.cloudImportService.getAvailableProviders();
    return { code: 200, message: 'success', data: providers };
  }

  @Public()
  @Get('auth/:provider')
  @LogMethod()
  async getAuthUrl(
    @Param('provider') provider: string,
  ): Promise<{ code: number; message: string; data?: { url: string } }> {
    const authUrl = await this.cloudImportService.getAuthUrl(provider);
    if (!authUrl) {
      return { code: 404, message: 'Provider not found' };
    }
    return { code: 200, message: 'success', data: { url: authUrl } };
  }

  @Public()
  @Post('auth/callback')
  @LogMethod()
  async handleAuthCallback(
    @Body() callback: CloudAuthCallback,
  ): Promise<{ code: number; message: string; data?: any }> {
    try {
      const tokens = await this.cloudImportService.handleAuthCallback(
        callback.provider,
        callback.code,
        callback.state,
      );
      return { code: 200, message: 'success', data: tokens };
    } catch (error) {
      return {
        code: 400,
        message: error instanceof Error ? error.message : 'Auth failed',
      };
    }
  }

  @Public()
  @Post('config/jspace')
  @LogMethod()
  async configureJSpace(
    @Body() config: JSpaceConfig,
  ): Promise<{ code: number; message: string }> {
    try {
      await this.cloudImportService.configureJSpace(config);
      return { code: 200, message: '极空间配置成功' };
    } catch (error) {
      return {
        code: 400,
        message: error instanceof Error ? error.message : '极空间配置失败',
      };
    }
  }

  @Public()
  @Get('files/:provider')
  @LogMethod()
  async listFiles(
    @Param('provider') provider: string,
    @Query('path') path?: string,
    @Query('accessToken') accessToken?: string,
    @Query('maxDepth') maxDepth?: string,
  ): Promise<{ code: number; message: string; data?: CloudFile[] }> {
    try {
      const files = await this.cloudImportService.listFiles(
        provider,
        path || '/',
        accessToken,
        maxDepth ? parseInt(maxDepth, 10) : undefined,
      );
      return { code: 200, message: 'success', data: files };
    } catch (error) {
      return {
        code: 400,
        message:
          error instanceof Error ? error.message : 'Failed to list files',
      };
    }
  }

  @Public()
  @Post('import')
  @LogMethod()
  async createImportTask(
    @Body() request: CloudImportRequest,
  ): Promise<{ code: number; message: string; data?: { taskId: string } }> {
    try {
      const taskId = await this.cloudImportService.createImportTask(request);
      return { code: 200, message: 'success', data: { taskId } };
    } catch (error) {
      return {
        code: 400,
        message:
          error instanceof Error
            ? error.message
            : 'Import task creation failed',
      };
    }
  }

  @Public()
  @Get('task/:id')
  @LogMethod()
  async getImportTask(
    @Param('id') id: string,
  ): Promise<{ code: number; message: string; data?: any }> {
    const task = await this.cloudImportService.getTask(id);
    if (!task) {
      return { code: 404, message: 'Task not found' };
    }
    return { code: 200, message: 'success', data: task };
  }

  @Public()
  @Get('task/:id/download-url')
  @LogMethod()
  async getDownloadUrl(
    @Param('id') id: string,
    @Query('fileId') fileId: string,
  ): Promise<{ code: number; message: string; data?: { url: string } }> {
    try {
      const downloadUrl = await this.cloudImportService.getDownloadUrl(
        id,
        fileId,
      );
      if (!downloadUrl) {
        return { code: 404, message: 'Download URL not found' };
      }
      return { code: 200, message: 'success', data: { url: downloadUrl } };
    } catch (error) {
      return {
        code: 400,
        message:
          error instanceof Error ? error.message : 'Failed to get download URL',
      };
    }
  }
}
