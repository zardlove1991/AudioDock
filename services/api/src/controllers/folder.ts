import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { TrackType } from '@soundx/db';
import { FolderService } from '../services/folder';

@Controller('folders')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Get('roots')
  async getRoots(@Query('type') type: TrackType) {
    const roots = await this.folderService.getRoots(type || TrackType.MUSIC);
    return { code: 200, message: 'success', data: roots };
  }

  @Get(':id/contents')
  async getFolderContents(@Param('id') id: string) {
    const contents = await this.folderService.getFolderContents(Number(id));
    if (!contents) {
      return { code: 404, message: 'Folder not found' };
    }
    const path = await this.folderService.getPath(Number(id));
    return {
      code: 200,
      message: 'success',
      data: { ...contents, breadcrumbs: path },
    };
  }

  @Get(':id/stats')
  async getFolderStats(@Param('id') id: string) {
    const stats = await this.folderService.getFolderStats(Number(id));
    if (!stats) {
      return { code: 404, message: 'Folder not found' };
    }
    return { code: 200, message: 'success', data: stats };
  }

  @Delete(':id')
  async deleteFolder(@Param('id') id: string) {
    await this.folderService.deleteFolder(Number(id));
    return { code: 200, message: 'success' };
  }

  @Post('batch-delete')
  async batchDelete(@Body() body: { folderIds: number[]; trackIds: number[] }) {
    await this.folderService.batchDelete(
      body.folderIds || [],
      body.trackIds || [],
    );
    return { code: 200, message: 'success' };
  }
}
