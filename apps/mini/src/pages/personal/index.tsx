import { Button, Text, View } from '@tarojs/components'
import MiniPlayer from '../../components/MiniPlayer'
import { useAuth } from '../../context/AuthContext'
import './index.scss'

export default function Personal() {
  const { user, logout } = useAuth()

  return (
    <View className='personal'>
      <View className='user-info'>
        <Text>用户: {user?.username}</Text>
      </View>
      <Button className='logout-btn' onClick={logout}>退出登录</Button>
      <MiniPlayer />
    </View>
  )
}
