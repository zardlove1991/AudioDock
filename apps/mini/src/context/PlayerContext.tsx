import Taro from '@tarojs/taro';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getBaseURL } from '../utils/request';

// Simplified Track interface for MP
export interface Track {
  id: number;
  name: string;
  artist: string;
  path: string;
  cover: string | null;
  album?: string;
  duration?: number | null;
  lyrics?: string | null;
}

interface PlayerContextType {
  isPlaying: boolean;
  currentTrack: Track | null;
  trackList: Track[];
  isLoading: boolean;
  playTrack: (track: Track) => Promise<void>;
  pause: () => void;
  resume: () => void;
  playNext: () => void;
  playPrevious: () => void;
  duration: number;
  currentTime: number;
  seek: (position: number) => void;
  setTrackList: (list: Track[]) => void;
}

const PlayerContext = createContext<PlayerContextType>({
  isPlaying: false,
  currentTrack: null,
  trackList: [],
  isLoading: false,
  duration: 0,
  currentTime: 0,
  playTrack: async () => {},
  pause: () => {},
  resume: () => {},
  playNext: () => {},
  playPrevious: () => {},
  seek: () => {},
  setTrackList: () => {},
});

export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [trackList, setTrackListState] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const setTrackList = (list: Track[]) => {
      setTrackListState(list);
  };

  
  // Use BackgroundAudioManager
  const bgAudioManager = useRef<Taro.BackgroundAudioManager | null>(null);

  useEffect(() => {
    bgAudioManager.current = Taro.getBackgroundAudioManager();
    const manager = bgAudioManager.current;

    manager.onPlay(() => {
      setIsPlaying(true);
      setIsLoading(false);
    });

    manager.onPause(() => {
      setIsPlaying(false);
    });

    manager.onStop(() => {
      setIsPlaying(false);
    });

    manager.onEnded(() => {
      playNext();
    });

    manager.onError(() => {
      console.error('Background Audio Error');
      setIsPlaying(false);
      setIsLoading(false);
    });
    
    manager.onTimeUpdate(() => {
        if (manager.duration) setDuration(manager.duration);
        setCurrentTime(manager.currentTime);
    });

    // Remote control events
    manager.onNext(() => {
        playNext();
    });
    manager.onPrev(() => {
        playPrevious();
    });
    // Sync external seek if any
    manager.onSeeked(() => {
        setCurrentTime(manager.currentTime);
    });

    return () => {
      // Cleanup if needed? Usually background audio should persist
    };
  }, []); // Empty dependency array? Need to access current state in callbacks? 
  // Callbacks in Taro Audio Manager might be tricky with closures. 
  // Using refs for state in callbacks is safer.

  const trackListRef = useRef(trackList);
  const currentTrackRef = useRef(currentTrack);

  useEffect(() => {
    trackListRef.current = trackList;
  }, [trackList]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);


  const playTrack = async (track: Track) => {
    setIsLoading(true);
    setCurrentTrack(track);
    
    // Construct URL
    const baseUrl = getBaseURL();
    const uri = track.path.startsWith('http') ? track.path : `${baseUrl}${track.path}`;
    const cover = track.cover 
      ? (track.cover.startsWith('http') ? track.cover : `${baseUrl}${track.cover}`) 
      : undefined;

    const manager = bgAudioManager.current;
    if (manager) {
        manager.title = track.name;
        manager.epname = track.album || track.name;
        manager.singer = track.artist;
        manager.coverImgUrl = cover || '';
        // Setting src starts playback automatically
        manager.src = uri; 
    }
  };

  const pause = () => {
    bgAudioManager.current?.pause();
  };

  const resume = () => {
    bgAudioManager.current?.play();
  };

  const playNext = () => {
    const list = trackListRef.current;
    const current = currentTrackRef.current;
    if (!current || list.length === 0) return;

    const currentIndex = list.findIndex(t => t.id === current.id);
    const nextIndex = (currentIndex + 1) % list.length;
    playTrack(list[nextIndex]);
  };

  const playPrevious = () => {
    const list = trackListRef.current;
    const current = currentTrackRef.current;
    if (!current || list.length === 0) return;

    const currentIndex = list.findIndex(t => t.id === current.id);
    const prevIndex = (currentIndex - 1 + list.length) % list.length;
    playTrack(list[prevIndex]);
  };

  const seek = (position: number) => {
      bgAudioManager.current?.seek(position);
  };

  return (
    <PlayerContext.Provider
      value={{
        isPlaying,
        currentTrack,
        trackList,
        isLoading,
        duration,
        currentTime,
        playTrack,
        pause,
        resume,
        playNext,
        playPrevious,
        seek,
        setTrackList
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};
