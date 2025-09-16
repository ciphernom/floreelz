import { useState } from 'react';
import { nostrClient } from '../core/nostr';
import { VideoData } from '../types';
import { toast } from 'react-hot-toast';

interface Props {
  video: VideoData;
}

function InteractionBar({ video }: Props) {
  const [isLiked, setIsLiked] = useState(nostrClient.likedVideos.has(video.id));

  const handleLike = async () => {
    const newLikedState = await nostrClient.likeVideo(video);
    setIsLiked(newLikedState);
    
    if (newLikedState) {
      toast('❤️ Liked!');
    } else {
      toast('💔 Unliked');
    }
  };

  return (
    <div className="interaction-bar">
      <button 
        onClick={handleLike}
        style={{ color: isLiked ? 'red' : 'white' }}
      >
        ❤️
      </button>
      <button>💬</button>
      <button>🔗</button>
    </div>
  );
}

export default InteractionBar;
