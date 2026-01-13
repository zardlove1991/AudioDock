import { Album, Track, getAlbumById, getAlbumTracks } from '@soundx/services';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useEffect, useState } from 'react';
import MiniPlayer from '../../components/MiniPlayer';
import { usePlayer } from '../../context/PlayerContext';
import { getBaseURL } from '../../utils/request';
import './index.scss';

export default function AlbumDetail() {
  const router = useRouter();
  const { id } = router.params;
  const { playTrack, currentTrack, isPlaying } = usePlayer();

  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadData(Number(id));
    }
  }, [id]);

  const loadData = async (albumId: number) => {
    setLoading(true);
    try {
      const [albumRes, tracksRes] = await Promise.all([
          getAlbumById(albumId),
          getAlbumTracks(albumId, 200, 0, 'asc', '')
      ]);

      if (albumRes.code === 200) setAlbum(albumRes.data);
      if (tracksRes.code === 200) setTracks(tracksRes.data.list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (url: string | null) => {
    if (!url) return `https://picsum.photos/300/300`;
    if (url.startsWith('http')) return url;
    return `${getBaseURL()}${url}`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString()}`;
  };

  const handlePlayAll = () => {
      if (tracks.length > 0) {
          playTrack(tracks[0]);
      }
  };

  if (loading) return <View className='loading'><Text>Loading...</Text></View>;
  if (!album) return <View className='error'><Text>Album not found</Text></View>;

  return (
    <View className='album-container'>
         <View className='nav-bar'>
             <View className='back-btn' onClick={() => Taro.navigateBack()}>
                 <Text className='back-icon'>←</Text>
             </View>
         </View>
         <ScrollView scrollY className='content-scroll'>
             <View className='header'>
                 <Image src={getImageUrl(album.cover)} className='cover' mode='aspectFill' />
                 <Text className='title'>{album.name}</Text>
                 <Text className='artist'>{album.artist}</Text>
                 
                 <View className='actions'>
                     <View className='play-all-btn' onClick={handlePlayAll}>
                         <Text className='play-icon'>▶</Text>
                         <Text className='play-text'>播放全部</Text>
                     </View>
                     <View className='like-btn'>
                         <Text className='like-icon'>♡</Text>
                     </View>
                 </View>
             </View>

             <View className='track-list'>
                 {tracks.map((track, index) => (
                     <View 
                        key={track.id} 
                        className='track-item'
                        onClick={() => playTrack(track)}
                     >
                        <View className='track-idx-container'>
                            {currentTrack?.id === track.id && isPlaying ? (
                                <Text className='active-icon'>🎵</Text>
                            ) : (
                                <Text className={`track-index ${currentTrack?.id === track.id ? 'active' : ''}`}>{index + 1}</Text>
                            )}
                        </View>
                         <Image src={getImageUrl(track.cover)} className='track-cover' mode='aspectFill' />
                         <View className='track-info'>
                             <Text className={`track-name ${currentTrack?.id === track.id ? 'active' : ''}`} numberOfLines={1}>{track.name}</Text>
                         </View>
                         <Text className='track-duration'>{formatDuration(track.duration || 0)}</Text>
                     </View>
                 ))}
             </View>

             <View style={{ height: '160rpx' }}></View>
         </ScrollView>
         <MiniPlayer />
    </View>
  );
}
