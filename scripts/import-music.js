const { execSync } = require('child_process');

async function importMusic(mode = 'incremental') {
  try {
    console.log('🎵 开始导入音乐文件...');
    
    // 创建导入任务
    const response = execSync(`powershell -Command "Invoke-WebRequest -Uri http://localhost:3001/import/task -Method POST -ContentType 'application/json' -Body '{\\\"mode\\\":\\\"${mode}\\\"}' -UseBasicParsing | Select-Object -ExpandProperty Content"`, { encoding: 'utf8' });
    const data = JSON.parse(response);
    
    if (data.code === 200) {
      const taskId = data.data.id;
      console.log(`✅ 导入任务创建成功，任务ID: ${taskId}`);
      
      // 等待任务完成
      console.log('⏳ 正在导入，请稍候...');
      await new Promise(resolve => setTimeout(resolve, mode === 'full' ? 3000 : 2000));
      
      // 检查任务状态
      const statusResponse = execSync(`powershell -Command "Invoke-WebRequest -Uri 'http://localhost:3001/import/task/${taskId}' -UseBasicParsing | Select-Object -ExpandProperty Content"`, { encoding: 'utf8' });
      const statusData = JSON.parse(statusResponse);
      
      if (statusData.data.status === 'SUCCESS') {
        console.log(`🎉 导入完成！总共处理了 ${statusData.data.total} 个文件`);
      } else if (statusData.data.status === 'RUNNING') {
        console.log(`⏳ 导入正在进行中，当前处理了 ${statusData.data.current}/${statusData.data.total} 个文件`);
      } else {
        console.log(`❌ 导入失败，状态: ${statusData.data.status}`);
      }
    } else {
      console.log(`❌ 创建导入任务失败，状态码: ${data.code}`);
      console.log(response);
    }
  } catch (error) {
    console.log('❌ 错误:', error.message);
    console.log('请确保API服务正在运行在 http://localhost:3001');
  }
}

// 从命令行参数获取模式
const mode = process.argv[2] || 'incremental';
importMusic(mode);