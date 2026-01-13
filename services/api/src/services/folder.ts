import { Injectable } from '@nestjs/common';
import { Folder, PrismaClient, TrackType } from '@soundx/db';
import * as fs from 'fs';
import { TrackService } from './track';

@Injectable()
export class FolderService {
  private prisma: PrismaClient;

  constructor(private readonly trackService: TrackService) {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || "file:./dev.db"
        }
      }
    });
  }

  async getRoots(type: TrackType): Promise<Folder[]> {
    return await this.prisma.folder.findMany({
      where: {
        parentId: null,
        type: type,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getFolderContents(id: number) {
    const folder = await this.prisma.folder.findUnique({
      where: { id },
      include: {
        children: {
          orderBy: { name: 'asc' },
        },
        tracks: {
          orderBy: { name: 'asc' },
          include: {
            artistEntity: true,
            albumEntity: true,
          },
        },
      },
    });

    return folder;
  }

  async getPath(id: number): Promise<Folder[]> {
    const path: Folder[] = [];
    let currentId: number | null = id;

    while (currentId !== null) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: currentId },
      });
      if (folder) {
        path.unshift(folder);
        currentId = folder.parentId;
      } else {
        currentId = null;
      }
    }

    return path;
  }

  async getFolderStats(id: number) {
    const folder = await this.prisma.folder.findUnique({
      where: { id },
      include: {
        children: true,
        tracks: true,
      },
    });

    if (!folder) return null;

    let trackCount = folder.tracks.length;
    let folderCount = folder.children.length;

    for (const child of folder.children) {
      const childStats = await this.getFolderStats(child.id);
      if (childStats) {
        trackCount += childStats.trackCount;
        folderCount += childStats.folderCount;
      }
    }

    return {
      path: folder.path,
      trackCount,
      folderCount,
    };
  }

  async deleteFolder(id: number) {
    const folder = await this.prisma.folder.findUnique({
      where: { id },
      include: {
        children: true,
        tracks: true,
      },
    });

    if (!folder) return;

    // 1. Delete all tracks in this folder
    for (const track of folder.tracks) {
      await this.trackService.deleteTrack(track.id);
    }

    // 2. Recursively delete subfolders
    for (const child of folder.children) {
      await this.deleteFolder(child.id);
    }

    // 3. Delete physical directory if empty (optional, but requested "delete original file")
    // Wait, the user said "删除原文�?, for folder this might mean the directory itself.
    // However, if there are non-audio files, we might want to be careful.
    // Let's at least try to delete the directory if it's empty.
    if (fs.existsSync(folder.path)) {
      try {
        const files = fs.readdirSync(folder.path);
        if (files.length === 0) {
          fs.rmdirSync(folder.path);
        } else {
          // If not empty, maybe delete everything? The user said "删除文件夹会删除原文�?
          // This usually implies a recursive delete of the directory.
          fs.rmSync(folder.path, { recursive: true, force: true });
        }
      } catch (e) {
        console.warn(`Failed to delete physical folder ${folder.path}:`, e);
      }
    }

    // 4. Delete folder record from DB
    await this.prisma.folder.delete({
      where: { id },
    });
  }

  async batchDelete(folderIds: number[], trackIds: number[]) {
    // 1. Delete all requested tracks
    for (const trackId of trackIds) {
      await this.trackService.deleteTrack(trackId);
    }

    // 2. Delete all requested folders
    for (const folderId of folderIds) {
      await this.deleteFolder(folderId);
    }
  }
}

