import { Injectable } from '@nestjs/common';
import { Album, PrismaClient, TrackType } from '@soundx/db';

@Injectable()
export class AlbumService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || "file:./dev.db"
        }
      }
    });
  }

  async getAlbumList(): Promise<Album[]> {
    return await this.prisma.album.findMany();
  }

  async findByName(name: string, artist?: string, type?: any): Promise<Album | null> {
    const where: any = { name };
    if (artist) where.artist = artist;
    if (type) where.type = type;
    return await this.prisma.album.findFirst({ where });
  }

  async getAlbumsByArtist(artist: string): Promise<Album[]> {
    return await this.prisma.album.findMany({
      where: { artist },
    });
  }

  async getCollaborativeAlbumsByArtist(artistName: string): Promise<Album[]> {
    const albums = await this.prisma.album.findMany({
      where: {
        artist: artistName,
        type: 'MUSIC',
      },
    });
    return albums;
  }

  async getAlbumById(id: number, userId?: number): Promise<Album | null> {
    const album = await this.prisma.album.findUnique({
      where: { id },
    });
    return album;
  }

  async getAlbumTableList(pageSize: number, current: number): Promise<Album[]> {
    const skip = (current - 1) * pageSize;
    return await this.prisma.album.findMany({
      skip,
      take: pageSize,
    });
  }

  async loadMoreAlbum(pageSize: number, loadCount: number, type: TrackType, userId: number): Promise<Album[]> {
    const skip = loadCount;
    const albums = await this.prisma.album.findMany({
      where: type ? { type } : undefined,
      skip,
      take: pageSize,
    });
    return albums;
  }

  async albumCount(type?: TrackType): Promise<number> {
    return await this.prisma.album.count({
      where: type ? { type } : undefined,
    });
  }

  async createAlbum(album: Omit<Album, 'id'>): Promise<Album> {
    return await this.prisma.album.create({
      data: album,
    });
  }

  async updateAlbum(id: number, album: Partial<Album>): Promise<Album> {
    return await this.prisma.album.update({
      where: { id },
      data: album,
    });
  }

  async deleteAlbum(id: number): Promise<boolean> {
    await this.prisma.album.delete({
      where: { id },
    });
    return true;
  }

  async createAlbums(albums: Omit<Album, 'id'>[]): Promise<boolean> {
    await this.prisma.album.createMany({
      data: albums,
    });
    return true;
  }

  async deleteAlbums(ids: number[]): Promise<boolean> {
    await this.prisma.album.deleteMany({
      where: { id: { in: ids } },
    });
    return true;
  }

  // 新增：最近专辑（按id倒序）
  async getLatestAlbums(limit = 8, type: TrackType, userId: number): Promise<Album[]> {
    const albums = await this.prisma.album.findMany({
      where: type ? { type } : undefined,
      orderBy: { id: 'desc' },
      take: limit,
    });

    if (type === 'AUDIOBOOK') {
      return await this.attachProgressToAlbums(albums, userId);
    }
    return albums;
  }

  // 新增：获取随机专辑
  async getRandomAlbums(limit = 8, type: TrackType, userId: number): Promise<Album[]> {
    const count = await this.prisma.album.count({
      where: type ? { type } : undefined,
    });
    const skip = Math.max(0, Math.floor(Math.random() * (count - limit)));
    const result = await this.prisma.album.findMany({
      where: type ? { type } : undefined,
      skip,
      take: limit,
    });

    if (type === 'AUDIOBOOK') {
      return await this.attachProgressToAlbums(result, userId);
    }
    return result;
  }

  // 随机推荐：用户未听过的专辑
  async getRandomUnlistenedAlbums(userId: number, limit = 8, type?: TrackType): Promise<Album[]> {
    const albums = await this.prisma.album.findMany({
      where: type ? { type } : undefined,
      take: 100, // 从中随机选择
    });

    // TODO: Filter by user listening history
    const shuffled = albums.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, limit);
  }

  async searchAlbums(keyword: string, type: any, limit: number = 10, userId: number): Promise<Album[]> {
    const where: any = {
      OR: [
        { name: { contains: keyword } },
        { artist: { contains: keyword } },
      ],
    };

    if (type) {
      where.type = type;
    }

    const candidates = await this.prisma.album.findMany({
      where,
      take: 100,
    });

    const normalizedKeyword = keyword.toLowerCase();

    const sortedAlbums = candidates
      .sort((a, b) => {
        const getScore = (name: string, artist: string) => {
          const nName = name.toLowerCase();
          const nArtist = (artist || '').toLowerCase();
          let score = 0;

          if (nName === normalizedKeyword) score = Math.max(score, 100);
          else if (nName.startsWith(normalizedKeyword)) score = Math.max(score, 90);
          else if (nName.includes(normalizedKeyword)) score = Math.max(score, 70);

          if (nArtist === normalizedKeyword) score = Math.max(score, 80);
          else if (nArtist.startsWith(normalizedKeyword)) score = Math.max(score, 60);
          else if (nArtist.includes(normalizedKeyword)) score = Math.max(score, 50);

          return score;
        };

        const scoreA = getScore(a.name, a.artist);
        const scoreB = getScore(b.name, b.artist);

        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.name.length - b.name.length;
      })
      .slice(0, limit);

    if (type === 'AUDIOBOOK') {
      return await this.attachProgressToAlbums(sortedAlbums, userId);
    }
    return sortedAlbums;
  }

  // Helper: Attach progress to audiobook albums - Simplified version
  private async attachProgressToAlbums(albums: Album[], userId: number): Promise<Album[]> {
    // For now, just return albums without progress
    return albums;
  }
}