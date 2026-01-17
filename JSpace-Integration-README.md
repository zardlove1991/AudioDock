# 极空间（JSpace）集成使用说明

## 概述

极空间（JSpace）现已集成到AudioDock的云导入功能中，通过WebDAV协议支持。

## 配置步骤

### 1. 环境准备

确保您的极空间设备已启用WebDAV服务，并且知道以下信息：
- WebDAV服务器地址（URL）
- 用户名
- 密码

### 2. API配置

使用以下API端点配置极空间：

```http
POST /cloud-import/config/jspace
Content-Type: application/json

{
  "url": "http://your-jspace-ip:port/webdav",
  "username": "your-username",
  "password": "your-password",
  "path": "/music"  // 可选，指定音乐文件路径
}
```

### 3. 获取可用提供商

```http
GET /cloud-import/providers
```

返回结果中会包含极空间：
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "baidu",
      "name": "baidu",
      "displayName": "百度网盘",
      "oauthUrl": "...",
      "enabled": true
    },
    {
      "id": "aliyun",
      "name": "aliyun", 
      "displayName": "阿里云盘",
      "oauthUrl": "...",
      "enabled": true
    },
    {
      "id": "jspace",
      "name": "jspace",
      "displayName": "极空间",
      "oauthUrl": "",
      "enabled": true,
      "requiresConfig": true
    }
  ]
}
```

### 4. 浏览文件

配置完成后，可以浏览极空间中的文件：

```http
GET /cloud-import/files/jspace?path=/music
```

### 5. 创建导入任务

选择要导入的文件，创建导入任务：

```http
POST /cloud-import/import
Content-Type: application/json

{
  "provider": "jspace",
  "files": [
    "/music/song1.mp3",
    "/music/song2.flac"
  ],
  "downloadPath": "/path/to/download"
}
```

## 支持的文件格式

系统会自动识别以下音频文件格式：
- MP3 (.mp3)
- FLAC (.flac)
- WAV (.wav)
- M4A (.m4a)
- AAC (.aac)
- OGG (.ogg)

## 常见问题

### 1. 连接失败
- 检查极空间的WebDAV服务是否已启用
- 确认网络连接正常
- 验证用户名和密码是否正确

### 2. 文件列表为空
- 确认指定的路径存在
- 检查权限设置
- 验证路径格式是否正确（使用正斜杠 `/`）

### 3. 下载失败
- 确保文件存在且可访问
- 检查本地存储空间是否充足
- 验证文件权限

## 技术实现

极空间集成使用了以下技术栈：
- **WebDAV协议**: 通过 `webdav` npm包实现
- **NestJS框架**: 后端API服务
- **TypeScript**: 类型安全的开发体验

### 主要修改的文件

1. `services/api/src/services/cloud-import.ts`: 核心服务实现
2. `services/api/src/controllers/cloud-import.ts`: API控制器
3. `services/api/package.json`: 添加webdav依赖

## 安全注意事项

- WebDAV凭据仅用于一次会话，不会长期存储
- 建议使用专门的应用程序密码而非主密码
- 确保极空间设备在安全的网络环境中运行

## 后续开发计划

- [ ] 支持多个极空间账户配置
- [ ] 添加文件夹递归导入功能
- [ ] 实现增量同步功能
- [ ] 添加导入进度实时更新