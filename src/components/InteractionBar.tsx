import { useState } from 'react';
import { nostrClient } from '../core/nostr';
import { VideoData } from '../types';
import { toast } from 'react-hot-toast';

interface Props {
  video: VideoData;
}

function InteractionBar({ video }: Props) {
  const [isLiked, setIsLiked] = useState(nostrClient.likedVideos.has(video.id));
  const [showReportModal, setShowReportModal] = useState(false);

  const handleLike = async () => {
    const newLikedState = await nostrClient.likeVideo(video);
    setIsLiked(newLikedState);
    
    if (newLikedState) {
      toast('❤️ Liked!');
    } else {
      toast('💔 Unliked');
    }
  };

  const handleReport = async (reason: string) => {
    try {
      await nostrClient.reportVideo(video.id, video.author, reason as any);
      toast.success('Report submitted');
      setShowReportModal(false);
    } catch (error) {
      toast.error('Failed to submit report');
    }
  };

  return (
    <>
      <div className="interaction-bar">
        <button 
          onClick={handleLike}
          style={{ color: isLiked ? 'red' : 'white' }}
        >
          ❤️
        </button>
        <button>💬</button>
        <button>🔗</button>
        <button onClick={() => setShowReportModal(true)} title="Report">
          ⚠️
        </button>
      </div>

      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content report-modal" onClick={e => e.stopPropagation()}>
            <h3>Report this video</h3>
            <div className="report-reasons">
              <button onClick={() => handleReport('spam')}>Spam</button>
              <button onClick={() => handleReport('nsfw')}>Inappropriate Content</button>
              <button onClick={() => handleReport('harassment')}>Harassment</button>
              <button onClick={() => handleReport('illegal')}>Illegal Content</button>
              <button onClick={() => handleReport('other')}>Other</button>
            </div>
            <button onClick={() => setShowReportModal(false)}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}

export default InteractionBar;
