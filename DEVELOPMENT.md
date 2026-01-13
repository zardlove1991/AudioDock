# AudioDock 开发环境搭建指南

## 🚨 重要说明

**为什么这个项目开发困难？**

AudioDock 是一个复杂的全栈 monorepo 项目，涉及多个技术栈和工具链：

- **Monorepo 架构**: 使用 pnpm workspace 管理多个子项目
- **多端应用**: 桌面端(Electron)、移动端(React Native)、Web端、小程序
- **复杂依赖**: Prisma ORM、NestJS、Vite、Father 等多种构建工具
- **环境问题**: Electron 二进制下载、Prisma 生成、并发服务等
- **工具链兼容性**: Windows PowerShell 与 Node.js 脚本兼容性问题

> **建议：耐心按照以下步骤操作，遇到问题及时查看错误信息**

## 📋 环境要求

- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0 (推荐最新版本)
- **Git**: 用于版本控制
- **数据库**: SQLite (开发环境) / PostgreSQL (生产环境)
- **操作系统**: Windows 10+ / macOS / Linux

## 🔧 安装步骤

### 1. 克隆项目

```bash
git clone https://github.com/mmdctjj/AudioDock.git
cd AudioDock
```

### 2. 安装 Node.js 和 pnpm

```bash
# 安装 Node.js (如果未安装)
# 访问 https://nodejs.org 下载最新 LTS 版本

# 安装 pnpm
npm install -g pnpm
```

### 3. 安装项目依赖

```bash
# 设置国内镜像源 (推荐)
pnpm config set registry https://registry.npmmirror.com

# 安装所有依赖
pnpm install
```

### 4. 设置 Electron 国内镜像 (重要!)

```bash
# Windows (PowerShell)
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"

# 或者永久设置环境变量
[System.Environment]::SetEnvironmentVariable("ELECTRON_MIRROR", "https://npmmirror.com/mirrors/electron/", "User")
```

### 5. 安装缺失的开发依赖

```bash
# 安装 concurrently (用于并发运行服务)
pnpm add -D concurrently -w

# 如果遇到 father 构建问题，确保相关包使用 npx
# (已在 package.json 中修复，无需手动操作)
```

## 🗄️ 数据库设置

### 1. 复制环境变量文件

```bash
# API 服务环境变量
cp services/api/.example.env services/api/.env

# 数据库包环境变量  
cp packages/db/.example.env packages/db/.env
```

### 2. 生成 Prisma Client

```bash
# 在 packages/db 目录下
cd packages/db
pnpm prisma generate
cd ../..
```

### 3. 运行数据库迁移 (可选)

```bash
cd services/api
pnpm prisma migrate dev
cd ../..
```

## 🚀 启动开发环境

### 完整启动 (推荐)

```bash
# 启动所有必要服务
pnpm dev
```

这个命令会：
1. 构建共享包 (@soundx/ws, @soundx/services, @soundx/utils)
2. 生成 Prisma Client
3. 并发启动 API 服务和桌面应用

### 单独启动各个服务

```bash
# 启动 API 服务
pnpm --filter api run start:dev

# 启动桌面应用
pnpm --filter sound-x run dev

# 启动 Web 应用
pnpm run dev:web

# 启动移动端 (需要 React Native 环境)
pnpm run dev:app
```

## 🛠️ 开发工具配置

### VS Code 推荐插件

- **ESLint**: 代码检查
- **Prettier**: 代码格式化
- **Prisma**: 数据库 ORM 支持
- **TypeScript Importer**: 自动导入
- **GitLens**: Git 增强工具

### 环境变量说明

#### API 服务 (services/api/.env)

```env
# JWT 密钥
JWT_SECRET=./.jwt_secret

# 数据库连接
DATABASE_URL="file:./dev.db"

# API 端口
PORT=3000
```

## 🔍 项目结构

```
AudioDock/
├── apps/                    # 应用层
│   ├── desktop/            # Electron 桌面应用
│   ├── mobile/             # React Native 移动应用
│   └── mini/               # 小程序应用
├── packages/               # 共享包
│   ├── db/                 # 数据库模型和 Prisma 配置
│   ├── services/           # 业务逻辑服务
│   ├── utils/              # 工具函数
│   ├── ws/                 # WebSocket 服务
│   └── ui/                 # UI 组件库
├── services/               # 后端服务
│   └── api/                # NestJS API 服务
└── scripts/                # 构建和部署脚本
```

## 🐛 常见问题解决

### 1. Electron 下载失败

**问题**: `Electron failed to install correctly`

**解决方案**:
```bash
# 设置国内镜像
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"

# 清理缓存重新安装
pnpm store prune
pnpm install --force
```

### 2. Father 构建失败

**问题**: `Cannot find module 'father.js'`

**解决方案**: (已在项目中修复)
```bash
# 使用 npx 调用 father
npx father build
```

### 3. Prisma 生成失败

**问题**: Prisma Client 生成卡住

**解决方案**:
```bash
cd packages/db
pnpm prisma generate --schema=./prisma/schema.prisma
```

### 4. PowerShell 兼容性问题

**问题**: `标记"&&"不是此版本中的有效的语句分隔符`

**解决方案**: 使用分步执行
```bash
# 错误方式 (Windows PowerShell)
pnpm run build && pnpm run start

# 正确方式
pnpm run build
pnpm run start
```

### 5. 依赖冲突

**问题**: workspace 依赖版本不一致

**解决方案**:
```bash
# 清理并重新安装
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

## 📝 开发规范

### 代码提交

```bash
# 提交前检查
pnpm lint
pnpm test  # 如果有测试

# 提交格式
git commit -m "feat: 添加新功能"
git commit -m "fix: 修复bug"
git commit -m "docs: 更新文档"
```

### 分支管理

- `main`: 主分支，生产环境代码
- `develop`: 开发分支
- `feature/*`: 功能分支
- `bugfix/*`: 修复分支

## 🚀 构建部署

### 构建桌面应用

```bash
cd apps/desktop
pnpm build
```

### 构建 Web 应用

```bash
pnpm run build:web
```

### 构建 API 服务

```bash
cd services/api
pnpm build
```

## 📚 相关文档

- [Prisma 文档](https://www.prisma.io/docs)
- [NestJS 文档](https://docs.nestjs.com)
- [Electron 文档](https://www.electronjs.org/docs)
- [pnpm 工作区文档](https://pnpm.io/workspaces)
- [Vite 文档](https://vitejs.dev)

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📞 获取帮助

- **GitHub Issues**: [项目 Issues 页面](https://github.com/mmdctjj/AudioDock/issues)
- **作者邮箱**: mmdctjj@gmail.com

---

**注意**: 开发环境搭建可能需要一些时间，请耐心按照步骤操作。如遇到其他问题，请查看项目 Issues 或联系作者。