import { Image, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { getBaseURL } from '../../utils/request';
import './index.scss';

const MiniPlayer: React.FC = () => {
  const { currentTrack, isPlaying, pause, resume, playNext, playPrevious } = usePlayer();
  const router = useRouter();
  
  const tabPages = ['/pages/index/index', '/pages/library/index', '/pages/personal/index'];
  const isTabPage = tabPages.indexOf(router.path) > -1;

  if (!currentTrack) return null;

  const handlePlayPause = (e) => {
    e.stopPropagation();
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  const toPlayer = () => {
    Taro.navigateTo({ url: '/pages/player/index' });
  };

  const getImageUrl = (url: string | null) => {
    if (!url) return `https://picsum.photos/100`;
    if (url.startsWith('http')) return url;
    return `${getBaseURL()}${url}`;
  };

  return (
    <View className={`mini-player-container ${isTabPage ? 'is-tab-page' : ''}`} onClick={toPlayer}>
      <View className='mini-content'>
        <View className='mini-info-container'>
          <Image
            src={getImageUrl(currentTrack.cover)}
            className='mini-cover'
            mode='aspectFill'
          />
          <View className='mini-info'>
            <Text className='mini-title' numberOfLines={1}>{currentTrack.name}</Text>
            <Text className='mini-artist' numberOfLines={1}>{currentTrack.artist}</Text>
          </View>
        </View>
        <View className='mini-controls'>
          <View className='mini-btn' onClick={(e) => { e.stopPropagation(); playPrevious(); }}>
            <Text className='mini-icon'>⏮</Text>
          </View>
          <View className='mini-btn play-btn' onClick={handlePlayPause}>
            <Text className='mini-icon'>{isPlaying ? '⏸' : '▶️'}</Text>
          </View>
          <View className='mini-btn' onClick={(e) => { e.stopPropagation(); playNext(); }}>
            <Text className='mini-icon'>⏭</Text>
          </View>
          <View className='mini-btn' onClick={(e) => { e.stopPropagation(); /* show playlist */ }}>
            <Text className='mini-icon'>≡</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default MiniPlayer;
