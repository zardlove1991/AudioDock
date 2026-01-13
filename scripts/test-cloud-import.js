// Node.js 18+ has built-in fetch
// const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function testCloudImport() {
  console.log('🚀 开始测试网盘导入功能...\n');

  try {
    // 1. 测试获取网盘提供商
    console.log('1. 获取可用的网盘提供商...');
    const providersResponse = await fetch(`${API_BASE}/cloud-import/providers`);
    const providersData = await providersResponse.json();
    
    if (providersData.code === 200) {
      console.log('✅ 成功获取网盘提供商:');
      providersData.data.forEach(provider => {
        console.log(`   - ${provider.displayName} (${provider.id}) - ${provider.enabled ? '可用' : '不可用'}`);
      });
    } else {
      console.log('❌ 获取网盘提供商失败:', providersData.message);
      return;
    }

    // 2. 测试获取认证URL
    if (providersData.data.length > 0) {
      const firstProvider = providersData.data[0];
      console.log(`\n2. 获取 ${firstProvider.displayName} 的认证URL...`);
      
      const authResponse = await fetch(`${API_BASE}/cloud-import/auth/${firstProvider.id}`);
      const authData = await authResponse.json();
      
      if (authData.code === 200) {
        console.log('✅ 成功获取认证URL:');
        console.log(`   URL: ${authData.data.url.substring(0, 50)}...`);
      } else {
        console.log('❌ 获取认证URL失败:', authData.message);
      }
    }

    // 3. 测试文件列表（需要先认证，这里会失败）
    console.log('\n3. 测试文件列表获取（预期会失败，需要先认证）...');
    const filesResponse = await fetch(`${API_BASE}/cloud-import/files/baidu?accessToken=test`);
    const filesData = await filesResponse.json();
    
    if (filesData.code === 400) {
      console.log('✅ 预期的错误（未认证）:', filesData.message);
    } else {
      console.log('⚠️  意外的响应:', filesData);
    }

    console.log('\n🎉 API接口测试完成！');
    console.log('\n📝 下一步操作:');
    console.log('1. 启动API服务: cd services/api && npx nest start');
    console.log('2. 在桌面应用中点击"网盘导入"按钮');
    console.log('3. 选择网盘服务商并完成OAuth认证');
    console.log('4. 选择要导入的音乐文件');
    console.log('5. 开始导入并监控进度');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 检查API服务是否运行
async function checkApiService() {
  try {
    const response = await fetch(`${API_BASE}/cloud-import/providers`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function main() {
  const isApiRunning = await checkApiService();
  
  if (!isApiRunning) {
    console.log('❌ API服务未运行，请先启动API服务:');
    console.log('   cd services/api && npx nest start');
    process.exit(1);
  }

  await testCloudImport();
}

if (require.main === module) {
  main();
}

module.exports = { testCloudImport, checkApiService };