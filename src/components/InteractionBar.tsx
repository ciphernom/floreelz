import { nostrClient } from '../core/nostr';
import { VideoData } from '../types';
import { toast } from 'react-hot-toast';

interface Props {
  video: VideoData;
}

function InteractionBar({ video }: Props) {
  const handleLike = () => {
    nostrClient.likeVideo(video);
    toast('❤️ Liked!');
  };

  return (
    <div className="interaction-bar">
      <button onClick={handleLike}>❤️</button>
      <button>💬</button>
      <button>🔗</button>
    </div>
  );
}

export default InteractionBar;
