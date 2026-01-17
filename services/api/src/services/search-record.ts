import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@soundx/db';

@Injectable()
export class SearchRecordService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'file:./dev.db',
        },
      },
    });
  }

  async addRecord(userId: number, keyword: string) {
    if (!keyword || keyword.trim() === '') return;

    return this.prisma.searchRecord.create({
      data: {
        userId,
        keyword: keyword.trim().toLowerCase(),
      },
    });
  }

  async getUserHistory(userId: number, limit = 10) {
    // Get unique keywords for the user, ordered by the latest search time
    const records = await this.prisma.searchRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100, // Look at recent 100 to find unique ones
    });

    const uniqueKeywords = Array.from(
      new Set(records.map((r) => r.keyword)),
    ).slice(0, limit);
    return uniqueKeywords;
  }

  async getHotSearches(limit = 10) {
    // Aggregate by keyword and count occurrences
    const stats = await this.prisma.searchRecord.groupBy({
      by: ['keyword'],
      _count: {
        keyword: true,
      },
      orderBy: [
        {
          _count: {
            keyword: 'desc',
          },
        },
        {
          keyword: 'asc',
        },
      ],
      take: limit,
    });

    return stats.map((s) => ({
      keyword: s.keyword,
      count: s._count.keyword,
    }));
  }

  async clearUserHistory(userId: number) {
    return this.prisma.searchRecord.deleteMany({
      where: { userId },
    });
  }
}
