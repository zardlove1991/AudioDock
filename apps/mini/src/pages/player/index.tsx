import { Image, ScrollView, Slider, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { usePlayMode } from '../../utils/playMode';
import { getBaseURL } from '../../utils/request';
import './index.scss';

// Match mobile lyric line interface
interface LyricLine {
  time: number;
  text: string;
}

// Match mobile parseLyrics logic
const parseLyrics = (lyrics: string): LyricLine[] => {
  if (!lyrics) return [];

  const lines = lyrics.split('\n');
  const parsed: LyricLine[] = [];

  for (const line of lines) {
    const match = line.match(/\[(\d+):(\d+)(?:\.(\d+))?\](.*)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const milliseconds = match[3] ? parseInt(match[3]) : 0;
      const time = minutes * 60 + seconds + milliseconds / 1000;
      const text = match[4].trim();

      if (text) {
        parsed.push({ time, text });
      }
    } else if (line.trim() && !line.startsWith('[')) {
      parsed.push({ time: 0, text: line.trim() });
    }
  }

  return parsed.sort((a, b) => a.time - b.time);
};

export default function Player() {
  const { currentTrack, isPlaying, pause, resume, playNext, playPrevious, duration, currentTime, seek } = usePlayer();
  const { mode, setMode } = usePlayMode();
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);

  useEffect(() => {
    if (currentTrack && currentTrack.lyrics) {
        setLyrics(parseLyrics(currentTrack.lyrics));
    } else {
        setLyrics([]);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (lyrics.length > 0) {
      const activeIndex = lyrics.findIndex((line, index) => {
        return (
          line.time <= currentTime &&
          (index === lyrics.length - 1 || lyrics[index + 1].time > currentTime)
        );
      });

      if (activeIndex !== -1 && activeIndex !== currentLyricIndex) {
        setCurrentLyricIndex(activeIndex);
      }
    }
  }, [currentTime, lyrics, currentLyricIndex]);

  const getImageUrl = (url: string | null) => {
    if (!url) return `https://picsum.photos/400/400`;
    if (url.startsWith('http')) return url;
    return `${getBaseURL()}${url}`;
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSliderChange = (e) => {
    const val = e.detail.value;
    seek(val);
  };

  if (!currentTrack) return (
    <View className='player-container empty'>
      <Text>No track playing</Text>
      <View onClick={() => Taro.navigateBack()} className='back-link'>Go Back</View>
    </View>
  );

  return (
    <View className='player-container'>
        <View className='header'>
            <View className='header-btn' onClick={() => Taro.navigateBack()}>
                <Text className='icon-btn'>⌄</Text>
            </View>
            <View className='header-btn' onClick={() => {/* more modal */}}>
                <Text className='icon-btn'>⋮</Text>
            </View>
        </View>

        <View className='content'>
            <View className='artwork-lyric-area' onClick={() => setShowLyrics(!showLyrics)}>
                {!showLyrics ? (
                    <View className='artwork-container'>
                        <Image 
                            src={getImageUrl(currentTrack.cover)} 
                            className='artwork' 
                            mode='aspectFill'
                        />
                    </View>
                ) : (
                    <View className='lyrics-container'>
                        {lyrics.length > 0 ? (
                            <ScrollView 
                                scrollY 
                                className='lyrics-scroll' 
                                scrollIntoView={`line-${currentLyricIndex > 3 ? currentLyricIndex - 3 : 0}`}
                                scrollWithAnimation
                            >
                                {lyrics.map((line, index) => (
                                    <View key={index} id={`line-${index}`} className={`lyric-line ${index === currentLyricIndex ? 'active' : ''}`}>
                                        <Text className='lyric-text'>{line.text}</Text>
                                    </View>
                                ))}
                            </ScrollView>
                        ) : (
                            <View className='no-lyrics'>
                                <Text>暂无歌词</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>

            <View className='bottom-controls'>
                <View className='info-row'>
                    <View className='track-info'>
                        <Text className='track-title' numberOfLines={1}>{currentTrack.name}</Text>
                        <Text className='track-artist' numberOfLines={1}>{currentTrack.artist}</Text>
                    </View>
                    <View className='action-btns'>
                        <View className='action-btn' onClick={() => {/* like */}}>
                            <Text className='action-icon'>♡</Text>
                        </View>
                        <View className='action-btn' onClick={() => {/* more */}}>
                            <Text className='action-icon'>⋯</Text>
                        </View>
                    </View>
                </View>

                <View className='progress-area'>
                    <View className='time-container'>
                        <Text className='time-text'>{formatTime(currentTime)}</Text>
                        <Slider 
                            className='slider' 
                            min={0} 
                            max={duration} 
                            value={currentTime} 
                            onChange={handleSliderChange}
                            activeColor='#333'
                            backgroundColor='#eee'
                            blockSize={12}
                        />
                        <Text className='time-text'>{formatTime(duration)}</Text>
                    </View>
                </View>

                <View className='player-controls'>
                    <View className='ctrl-btn' onClick={() => setMode(mode === 'MUSIC' ? 'AUDIOBOOK' : 'MUSIC')}>
                        <Text className='ctrl-icon-small'>{mode === 'MUSIC' ? '🔁' : '🎧'}</Text>
                    </View>
                    <View className='main-ctrls'>
                        <View className='ctrl-btn' onClick={playPrevious}>
                            <Text className='ctrl-icon'>⏮</Text>
                        </View>
                        <View className='ctrl-btn play-pause-btn' onClick={isPlaying ? pause : resume}>
                            <Text className='ctrl-icon-large'>{isPlaying ? '⏸' : '▶'}</Text>
                        </View>
                        <View className='ctrl-btn' onClick={playNext}>
                            <Text className='ctrl-icon'>⏭</Text>
                        </View>
                    </View>
                    <View className='ctrl-btn' onClick={() => {/* show playlist */}}>
                        <Text className='ctrl-icon-small'>≡</Text>
                    </View>
                </View>
            </View>
        </View>
    </View>
  );
}
