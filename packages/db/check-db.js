const { PrismaClient } = require('./generated/client');

async function checkDatabase() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: "file:./dev.db"
      }
    }
  });
  
  try {
    console.log('正在连接数据库...');
    
    // 检查用户表
    const users = await prisma.user.findMany();
    console.log('用户表数据:', users);
    
    // 如果没有用户，创建一个默认用户
    if (users.length === 0) {
      console.log('没有用户，创建默认用户...');
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const newUser = await prisma.user.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          is_admin: true
        }
      });
      
      console.log('创建的用户:', newUser);
    }
    
  } catch (error) {
    console.error('数据库错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();