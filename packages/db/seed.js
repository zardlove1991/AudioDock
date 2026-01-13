const { PrismaClient } = require('./generated');

const prisma = new PrismaClient();

async function main() {
  console.log('开始添加测试数据...');

  // 清空现有数据
  await prisma.track.deleteMany();
  await prisma.album.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.user.deleteMany();

  // 创建艺术家
  const artist1 = await prisma.artist.create({
    data: { name: '测试艺术家1', type: 'MUSIC' }
  });
  
  const artist2 = await prisma.artist.create({
    data: { name: '测试艺术家2', type: 'MUSIC' }
  });

  // 创建专辑
  const album1 = await prisma.album.create({
    data: { 
      name: '测试专辑1', 
      artist: '测试艺术家1', 
      type: 'MUSIC',
      year: '2024'
    }
  });
  
  const album2 = await prisma.album.create({
    data: { 
      name: '测试专辑2', 
      artist: '测试艺术家2', 
      type: 'MUSIC',
      year: '2024'
    }
  });

  // 创建音乐
  await prisma.track.createMany({
    data: [
      {
        name: '测试歌曲1',
        path: './music/music/test-song-1.mp3',
        artist: '测试艺术家1',
        album: '测试专辑1',
        type: 'MUSIC',
        duration: 180,
        artistId: artist1.id,
        albumId: album1.id
      },
      {
        name: '测试歌曲2',
        path: './music/music/test-song-2.mp3',
        artist: '测试艺术家2',
        album: '测试专辑2',
        type: 'MUSIC',
        duration: 210,
        artistId: artist2.id,
        albumId: album2.id
      }
    ]
  });

  // 创建用户
  await prisma.user.create({
    data: {
      username: 'testuser',
      password: 'password123' // 实际使用中应该加密
    }
  });

  console.log('测试数据添加完成！');
  
  // 显示添加的数据
  const tracks = await prisma.track.findMany({
    include: {
      artistEntity: true,
      albumEntity: true
    }
  });
  
  console.log('音乐列表:');
  tracks.forEach(track => {
    console.log(`- ${track.name} - ${track.artist} (${track.album})`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });