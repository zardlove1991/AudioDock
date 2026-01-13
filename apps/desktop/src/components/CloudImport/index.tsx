import {
  CloudDownloadOutlined,
  FolderOpenOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  Modal,
  Progress,
  Select,
  Space,
  Spin,
  Tree,
  message,
  Typography,
} from 'antd';
import React, { useEffect, useState } from 'react';
import { useMessage } from '../../context/MessageContext';
import styles from './index.module.less';

const { Title, Text, Link } = Typography;
const { DirectoryTree } = Tree;

interface CloudProvider {
  id: string;
  name: string;
  displayName: string;
  enabled: boolean;
}

interface CloudFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'file' | 'folder';
  mimeType?: string;
  downloadUrl?: string;
  modifiedTime?: string;
  children?: CloudFile[];
}

interface CloudImportTask {
  id: string;
  status: 'INITIALIZING' | 'PARSING' | 'SUCCESS' | 'FAILED';
  provider: string;
  files: string[];
  total?: number;
  current?: number;
  downloaded?: number;
  message?: string;
  downloadPath?: string;
}

const CloudImport: React.FC = () => {
  const messageApi = useMessage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [providers, setProviders] = useState<CloudProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [authWindow, setAuthWindow] = useState<Window | null>(null);
  const [accessToken, setAccessToken] = useState<string>('');
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [importTask, setImportTask] = useState<CloudImportTask | null>(null);
  const [loading, setLoading] = useState(false);

  // 获取可用的网盘提供商
  const fetchProviders = async () => {
    try {
      const response = await fetch('http://localhost:3001/cloud-import/providers');
      const data = await response.json();
      if (data.code === 200) {
        setProviders(data.data);
      }
    } catch (error) {
      messageApi.error('获取网盘提供商失败');
    }
  };

  // 处理OAuth认证
  const handleAuth = async (providerId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/cloud-import/auth/${providerId}`);
      const data = await response.json();
      
      if (data.code === 200) {
        const newWindow = window.open(
          data.data.url,
          'oauth',
          'width=800,height=600,scrollbars=yes,resizable=yes'
        );
        
        setAuthWindow(newWindow);
        
        // 监听认证窗口关闭或回调
        const checkClosed = setInterval(() => {
          if (newWindow?.closed) {
            clearInterval(checkClosed);
            setAuthWindow(null);
          }
        }, 1000);

        // 监听来自认证窗口的消息
        const handleMessage = async (event: MessageEvent) => {
          if (event.data.type === 'cloud-auth-callback') {
            clearInterval(checkClosed);
            newWindow?.close();
            setAuthWindow(null);
            
            // 处理认证回调
            const callbackResponse = await fetch('http://localhost:3001/cloud-import/auth/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                provider: providerId,
                code: event.data.code,
                state: event.data.state
              })
            });
            
            const callbackData = await callbackResponse.json();
            if (callbackData.code === 200) {
              setAccessToken(callbackData.data.accessToken);
              messageApi.success('认证成功');
              await fetchFiles(providerId, callbackData.data.accessToken);
            } else {
              messageApi.error('认证失败');
            }
            
            window.removeEventListener('message', handleMessage);
          }
        };
        
        window.addEventListener('message', handleMessage);
      } else {
        messageApi.error('获取认证链接失败');
      }
    } catch (error) {
      messageApi.error('认证失败');
    }
  };

  // 获取文件列表
  const fetchFiles = async (providerId: string, token?: string) => {
    setLoadingFiles(true);
    try {
      const response = await fetch(
        `http://localhost:3001/cloud-import/files/${providerId}?accessToken=${token || accessToken}`
      );
      const data = await response.json();
      
      if (data.code === 200) {
        setFiles(data.data);
      } else {
        messageApi.error('获取文件列表失败');
      }
    } catch (error) {
      messageApi.error('获取文件列表失败');
    } finally {
      setLoadingFiles(false);
    }
  };

  // 转换文件数据为Tree组件格式
  const convertToTreeData = (fileList: CloudFile[], parentPath = ''): any[] => {
    return fileList
      .filter(file => file.type === 'folder' || isAudioFile(file))
      .map(file => ({
        title: file.name,
        key: file.id,
        isLeaf: file.type === 'file',
        children: file.type === 'folder' && file.children 
          ? convertToTreeData(file.children, file.path) 
          : [],
        data: file
      }));
  };

  // 判断是否为音频文件
  const isAudioFile = (file: CloudFile): boolean => {
    const audioExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg'];
    return audioExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  };

  // 处理文件选择
  const handleFileSelect = (checkedKeys: any, info: any) => {
    const selectedKeys = Array.isArray(checkedKeys) ? checkedKeys : checkedKeys.checked;
    setSelectedFiles(selectedKeys);
  };

  // 开始导入
  const startImport = async () => {
    if (selectedFiles.length === 0) {
      messageApi.warning('请选择要导入的文件');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/cloud-import/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          files: selectedFiles,
          accessToken
        })
      });
      
      const data = await response.json();
      if (data.code === 200) {
        setImportTask({ id: data.data.taskId });
        messageApi.success('导入任务已创建');
        
        // 监听导入进度
        monitorImportTask(data.data.taskId);
      } else {
        messageApi.error('创建导入任务失败');
      }
    } catch (error) {
      messageApi.error('导入失败');
    } finally {
      setLoading(false);
    }
  };

  // 监听导入任务
  const monitorImportTask = async (taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:3001/cloud-import/task/${taskId}`);
        const data = await response.json();
        
        if (data.code === 200) {
          setImportTask(data.data);
          
          if (data.data.status === 'SUCCESS') {
            clearInterval(interval);
            messageApi.success('导入完成');
            setTimeout(() => {
              setIsModalOpen(false);
              resetModal();
            }, 2000);
          } else if (data.data.status === 'FAILED') {
            clearInterval(interval);
            messageApi.error(`导入失败: ${data.data.message}`);
          }
        }
      } catch (error) {
        console.error('Failed to check task status:', error);
      }
    }, 2000);
  };

  // 重置模态框状态
  const resetModal = () => {
    setSelectedProvider('');
    setAccessToken('');
    setFiles([]);
    setSelectedFiles([]);
    setImportTask(null);
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取状态图标
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'INITIALIZING':
      case 'PARSING':
        return <LoadingOutlined spin />;
      case 'SUCCESS':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'FAILED':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return null;
    }
  };

  useEffect(() => {
    if (isModalOpen) {
      fetchProviders();
    }
  }, [isModalOpen]);

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
              <Button
                type="primary"
                icon={<LinkOutlined />}
                onClick={() => handleAuth(selectedProvider)}
              >
                连接网盘
              </Button>
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
                      onExpand={setExpandedKeys}
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
                    {importTask.status === 'INITIALIZING' && '初始化中...'}
                    {importTask.status === 'PARSING' && '下载和导入中...'}
                    {importTask.status === 'SUCCESS' && '导入完成'}
                    {importTask.status === 'FAILED' && '导入失败'}
                  </Text>
                </div>
                
                {importTask.total && importTask.current && (
                  <Progress
                    percent={Math.round((importTask.current / importTask.total) * 100)}
                    status={importTask.status === 'FAILED' ? 'exception' : 'active'}
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
    </>
  );
};

export default CloudImport;