const music = require('music-metadata');

async function checkLyrics() {
  try {
    const filePath = 'd:/wlsk/videoDock/services/api/music/music/06.十一月的萧邦.2005-11-01/06. 枫.flac';
    const metadata = await music.parseFile(filePath);
    
    console.log('=== 基本信息 ===');
    console.log('标题:', metadata.common.title);
    console.log('艺术家:', metadata.common.artist);
    console.log('专辑:', metadata.common.album);
    console.log('时长:', metadata.format.duration, '秒');
    
    console.log('\n=== 歌词信息 ===');
    console.log('common.lyrics:', metadata.common.lyrics);
    console.log('common.lyrics类型:', typeof metadata.common.lyrics);
    console.log('common.lyrics是否为数组:', Array.isArray(metadata.common.lyrics));
    
    console.log('\n=== 原生标签 ===');
    console.log('Vorbis标签数量:', metadata.native && metadata.native.vorbis ? metadata.native.vorbis.length : 0);
    
    if (metadata.native && metadata.native.vorbis) {
      console.log('\n=== Vorbis标签详情 ===');
      metadata.native.vorbis.forEach(tag => {
        if (tag.id.toLowerCase().includes('lyric') || tag.id.toLowerCase().includes('text')) {
          console.log(tag.id + ':', tag.value);
        }
      });
    }
    
    console.log('\n=== 所有原生标签类型 ===');
    if (metadata.native) {
      Object.keys(metadata.native).forEach(key => {
        console.log(key + ':', metadata.native[key].length, '个标签');
      });
    }
    
  } catch (err) {
    console.error('错误:', err);
  }
}

checkLyrics();