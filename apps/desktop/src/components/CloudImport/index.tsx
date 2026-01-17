import {
  CloudDownloadOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  Modal,
  Progress,
  Radio,
  Select,
  Space,
  Spin,
  Tree,
  Typography,
} from 'antd';
import React, { useEffect, useState, useCallback } from 'react';
import { useMessage } from '../../context/MessageContext';
import {
  getCloudProviders,
  authWithProvider,
  handleAuthCallback,
  getCloudFiles,
  importCloudFiles,
  getImportTaskStatus,
  configureJSpace,
  CloudTaskStatus,
  type CloudProvider,
  type CloudFile,
  type CloudImportTask,
  type JSpaceConfig
} from '@soundx/services';
import styles from './index.module.less';

const { Title, Text } = Typography;
const { DirectoryTree } = Tree;
const { Option } = Select;

const CloudImport: React.FC = () => {
  const messageApi = useMessage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [providers, setProviders] = useState<CloudProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [importTask, setImportTask] = useState<CloudImportTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [jspaceModalVisible, setJspaceModalVisible] = useState(false);
  const [jspaceConfig, setJspaceConfig] = useState<JSpaceConfig>({ url: '', username: '', password: '' });
  
  // 新增：目录和深度控制状态
  const [selectedPath, setSelectedPath] = useState<string>('/');
  const [maxDepth, setMaxDepth] = useState<number>(2);
  const [customPath, setCustomPath] = useState<string>('');
  const [pathInputMode, setPathInputMode] = useState<'preset' | 'custom'>('preset');

  // 获取云盘提供商列表
  const fetchProviders = useCallback(async () => {
    try {
      const response = await getCloudProviders();
      if (response.code === 200) {
        setProviders(response.data);
      }
    } catch {
      messageApi.error('获取网盘提供商失败');
    }
  }, [messageApi]);

  // 处理OAuth认证
  const handleAuth = async (providerId: string) => {
    try {
      const response = await authWithProvider(providerId);
      
      if (response.code === 200 && response.data.authUrl) {
        // 打开OAuth授权页面
        const authWindow = window.open(response.data.authUrl, 'oauth', 'width=800,height=600,scrollbars=yes,resizable=yes');
        
        // 监听认证窗口关闭或回调
        const checkClosed = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkClosed);
          }
        }, 1000);

        // 监听来自认证窗口的消息
        const handleMessage = async (event: MessageEvent) => {
          if (event.data.type === 'cloud-auth-callback') {
            clearInterval(checkClosed);
            authWindow?.close();
            
            // 处理认证回调
            const callbackResponse = await handleAuthCallback(providerId, event.data.code);
            
            if (callbackResponse.code === 200) {
              setAccessToken(callbackResponse.data.accessToken);
              messageApi.success('认证成功');
              await fetchFiles(providerId, callbackResponse.data.accessToken);
            } else {
              messageApi.error('认证失败');
            }
            
            window.removeEventListener('message', handleMessage);
          }
        };
        
        window.addEventListener('message', handleMessage);
      } else {
        messageApi.error('获取授权链接失败');
      }
    } catch {
      messageApi.error('授权失败');
    }
  };

  // 获取文件列表
  const fetchFiles = async (providerId: string, token?: string) => {
    setLoadingFiles(true);
    try {
      // 对于极空间，使用特殊标识
      const useToken = providerId === 'jspace' ? 'jspace-configured' : (token || accessToken);
      
      // 构建查询参数
      const params: any = {};
      if (providerId === 'jspace') {
        // 极空间支持路径和深度参数
        const currentPath = pathInputMode === 'custom' ? customPath : selectedPath;
        if (currentPath !== '/') {
          params.path = currentPath;
        }
        if (maxDepth !== 2) {
          params.maxDepth = maxDepth;
        }
      }
      
      const response = await getCloudFiles(providerId, useToken, {
        ...params
      });
      
      if (response.code === 200) {
        setFiles(response.data);
      } else {
        messageApi.error('获取文件列表失败');
      }
    } catch {
      messageApi.error('获取文件列表失败');
    } finally {
      setLoadingFiles(false);
    }
  };

  // 转换文件数据为Tree组件格式
  const convertToTreeData = (fileList: CloudFile[]): any[] => {
    return fileList
      .filter(file => file.type === 'folder' || isAudioFile(file))
      .map(file => ({
        title: file.name,
        key: file.path || file.id,
        isLeaf: file.type === 'file',
        children: file.type === 'folder' && file.children
          ? convertToTreeData(file.children)
          : []
      }));
  };

  // 判断是否为音频文件
  const isAudioFile = (file: CloudFile): boolean => {
    const audioExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg'];
    return audioExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  };

  // 处理文件选择
  const handleFileSelect = (checkedKeys: any) => {
    setSelectedFiles(checkedKeys as string[]);
  };

  // 开始导入
  const startImport = async () => {
    if (selectedFiles.length === 0) {
      messageApi.warning('请选择要导入的文件');
      return;
    }

    setLoading(true);
    try {
      const response = await importCloudFiles(selectedProvider, selectedFiles, accessToken);
      
      if (response.code === 200) {
        setImportTask({ 
          id: response.data.taskId, 
          status: CloudTaskStatus.INITIALIZING 
        });
        messageApi.success('导入任务已创建');
        
        // 监听导入进度
        monitorImportTask(response.data.taskId);
      } else {
        messageApi.error(`创建导入任务失败: ${response.message || '未知错误'}`);
      }
    } catch (error: unknown) {
      console.error('Import failed:', error);
      if (error instanceof Error) {
        if ((error as any).code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          messageApi.error('请求超时，请检查网络连接后重试');
        } else if ((error as any).response) {
          messageApi.error(`服务器错误: ${(error as any).response.status} ${(error as any).response.statusText}`);
        } else {
          messageApi.error('导入失败，请检查网络连接后重试');
        }
      } else {
        messageApi.error('导入失败，请检查网络连接后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // 监听导入任务
  const monitorImportTask = async (taskId: string) => {
    const timeout = setTimeout(() => {
      clearInterval(interval);
      messageApi.error('导入任务超时，请稍后查看导入结果');
      setImportTask(null);
    }, 5 * 60 * 1000); // 5分钟超时

    const interval = setInterval(async () => {
      try {
        const response = await getImportTaskStatus(taskId);
        
        if (response.code === 200) {
          setImportTask(response.data);
          
          if (response.data.status === 'SUCCESS') {
            clearTimeout(timeout);
            clearInterval(interval);
            messageApi.success('导入完成');
            setTimeout(() => {
              setIsModalOpen(false);
              resetModal();
            }, 2000);
          } else if (response.data.status === 'FAILED') {
            clearTimeout(timeout);
            clearInterval(interval);
            messageApi.error(`导入失败: ${response.data.message}`);
          }
        }
      } catch (error) {
        clearTimeout(timeout);
        clearInterval(interval);
        console.error('Failed to check task status:', error);
        messageApi.error('检查导入状态失败，请稍后手动查看导入结果');
      }
    }, 2000);
  };

  // 处理极空间配置
  const handleJspaceConfig = async () => {
    if (!jspaceConfig.url || !jspaceConfig.username || !jspaceConfig.password) {
      messageApi.error('请填写完整的极空间配置信息');
      return;
    }

    try {
      const response = await configureJSpace(jspaceConfig);
      if (response.code === 200) {
        messageApi.success('极空间配置成功');
        setJspaceModalVisible(false);
        setAccessToken('jspace-configured'); // 设置特殊的 token 标识
        
        // 自动获取极空间文件列表
        await fetchFiles('jspace', 'jspace-configured');
      } else {
        messageApi.error('极空间配置失败');
      }
    } catch {
      messageApi.error('极空间配置失败');
    }
  };

  // 重置模态框状态
  const resetModal = () => {
    setSelectedProvider('');
    setFiles([]);
    setSelectedFiles([]);
    setAccessToken('');
    setImportTask(null);
  };

  // 格式化文件大小


  // 获取状态图标
  const getStatusIcon = (status: CloudTaskStatus) => {
    switch (status) {
      case CloudTaskStatus.INITIALIZING:
      case CloudTaskStatus.PARSING:
        return <LoadingOutlined spin />;
      case CloudTaskStatus.SUCCESS:
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case CloudTaskStatus.FAILED:
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return null;
    }
  };

  useEffect(() => {
    if (isModalOpen) {
      fetchProviders();
    }
  }, [isModalOpen, fetchProviders]);

  const treeData = convertToTreeData(files);

  return (
    <>
      <Button
        type="text"
        icon={<CloudDownloadOutlined />}
        onClick={() => setIsModalOpen(true)}
        style={{ color: 'inherit' }}
      >
        网盘导入
      </Button>

      <Modal
        title={
          <Space>
            <CloudDownloadOutlined />
            <span>网盘音乐导入</span>
          </Space>
        }
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          resetModal();
        }}
        footer={null}
        width={800}
        destroyOnClose
      >
        <div className={styles.container}>
          {/* 第一步：选择网盘 */}
          <div className={styles.step}>
            <Title level={4}>1. 选择网盘</Title>
            <Select
              placeholder="请选择网盘"
              style={{ width: '100%', marginBottom: 16 }}
              value={selectedProvider}
              onChange={setSelectedProvider}
              disabled={!!accessToken}
            >
              {providers.map(provider => (
                <Select.Option key={provider.id} value={provider.id}>
                  {provider.displayName}
                </Select.Option>
              ))}
            </Select>
            
            {selectedProvider && !accessToken && (
              <>
                {selectedProvider === 'jspace' ? (
                  <Button
                    type="primary"
                    icon={<SettingOutlined />}
                    onClick={() => setJspaceModalVisible(true)}
                  >
                    配置极空间
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    icon={<LinkOutlined />}
                    onClick={() => handleAuth(selectedProvider)}
                  >
                    连接网盘
                  </Button>
                )}
              </>
            )}
            
            {accessToken && (
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <Text type="success">已连接</Text>
                <Button size="small" onClick={() => setAccessToken('')}>
                  重新连接
                </Button>
              </Space>
            )}
          </div>

          {/* 第二步：选择文件 */}
          {accessToken && (
            <div className={styles.step}>
              <Title level={4}>2. 选择音乐文件</Title>
              
              {/* 目录和深度控制 - 仅对极空间显示 */}
              {selectedProvider === 'jspace' && (
                <Card size="small" style={{ marginBottom: 16 }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text strong>扫描目录：</Text>
                      <Radio.Group 
                        value={pathInputMode} 
                        onChange={(e) => setPathInputMode(e.target.value)}
                        style={{ marginLeft: 8 }}
                      >
                        <Radio value="preset">预设目录</Radio>
                        <Radio value="custom">自定义目录</Radio>
                      </Radio.Group>
                    </div>
                    
                    {pathInputMode === 'preset' ? (
                      <div>
                        <Select
                          value={selectedPath}
                          onChange={setSelectedPath}
                          style={{ width: '100%' }}
                          placeholder="选择目录"
                        >
                          <Option value="/">根目录</Option>
                          <Option value="/music">音乐目录</Option>
                          <Option value="/downloads">下载目录</Option>
                          <Option value="/documents">文档目录</Option>
                          <Option value="/videos">视频目录</Option>
                        </Select>
                      </div>
                    ) : (
                      <div>
                        <Input
                          value={customPath}
                          onChange={(e) => setCustomPath(e.target.value)}
                          placeholder="输入自定义路径，如 /my/music"
                          addonBefore="/"
                        />
                      </div>
                    )}
                    
                    <div>
                      <Text strong>扫描深度：</Text>
                      <InputNumber
                        min={0}
                        max={5}
                        value={maxDepth}
                        onChange={(value) => setMaxDepth(value || 0)}
                        style={{ width: 80, marginLeft: 8 }}
                      />
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        (0=当前目录，1=一层子目录，以此类推)
                      </Text>
                    </div>
                    
                    <Button 
                      type="primary" 
                      size="small" 
                      onClick={() => fetchFiles(selectedProvider)}
                      loading={loadingFiles}
                    >
                      重新扫描
                    </Button>
                  </Space>
                </Card>
              )}
              
              {loadingFiles ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <Spin size="large" />
                </div>
              ) : files.length > 0 ? (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Text type="secondary">已选择 {selectedFiles.length} 个文件</Text>
                  </div>
                  
                  <Card style={{ height: 300, overflow: 'auto' }}>
                    <DirectoryTree
                      checkable
                      onCheck={handleFileSelect}
                      treeData={treeData}
                      expandedKeys={expandedKeys}
                      onExpand={(expandedKeys: any[]) => setExpandedKeys(expandedKeys as string[])}
                    />
                  </Card>
                </>
              ) : (
                <Empty description="没有找到音乐文件" />
              )}
            </div>
          )}

          {/* 第三步：导入进度 */}
          {importTask && (
            <div className={styles.step}>
              <Title level={4}>3. 导入进度</Title>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {getStatusIcon(importTask.status)}
                  <Text>
                  {importTask.status === CloudTaskStatus.INITIALIZING && '初始化中...'}
                  {importTask.status === CloudTaskStatus.PARSING && '下载和导入中...'}
                  {importTask.status === CloudTaskStatus.SUCCESS && '导入完成'}
                  {importTask.status === CloudTaskStatus.FAILED && '导入失败'}
                </Text>
                </div>
                
                {importTask.total && importTask.current && (
                  <Progress
                    percent={Math.round((importTask.current / importTask.total) * 100)}
                    status={importTask.status === CloudTaskStatus.FAILED ? 'exception' : 'active'}
                  />
                )}
                
                {importTask.message && (
                  <Text type={importTask.status === 'FAILED' ? 'danger' : 'secondary'}>
                    {importTask.message}
                  </Text>
                )}
              </Space>
            </div>
          )}

          {/* 导入按钮 */}
          {accessToken && !importTask && (
            <div style={{ textAlign: 'right', marginTop: 24 }}>
              <Space>
                <Button onClick={() => setIsModalOpen(false)}>
                  取消
                </Button>
                <Button
                  type="primary"
                  icon={<CloudDownloadOutlined />}
                  onClick={startImport}
                  loading={loading}
                  disabled={selectedFiles.length === 0}
                >
                  开始导入
                </Button>
              </Space>
            </div>
          )}
        </div>
      </Modal>

      {/* 极空间配置模态框 */}
      <Modal
        title="配置极空间"
        open={jspaceModalVisible}
        onOk={handleJspaceConfig}
        onCancel={() => setJspaceModalVisible(false)}
        okText="保存配置"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>极空间地址：</Text>
            <Input
              placeholder="http://your-jspace-ip:port"
              value={jspaceConfig.url}
              onChange={(e) => setJspaceConfig({ ...jspaceConfig, url: e.target.value })}
              style={{ marginTop: 8 }}
            />
          </div>
          <div>
            <Text strong>用户名：</Text>
            <Input
              placeholder="请输入用户名"
              value={jspaceConfig.username}
              onChange={(e) => setJspaceConfig({ ...jspaceConfig, username: e.target.value })}
              style={{ marginTop: 8 }}
            />
          </div>
          <div>
            <Text strong>密码：</Text>
            <Input.Password
              placeholder="请输入密码"
              value={jspaceConfig.password}
              onChange={(e) => setJspaceConfig({ ...jspaceConfig, password: e.target.value })}
              style={{ marginTop: 8 }}
            />
          </div>
        </Space>
      </Modal>
    </>
  );
};

export default CloudImport;