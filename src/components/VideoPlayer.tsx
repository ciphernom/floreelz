import { useEffect, useRef, useState } from 'react';
import { webTorrentClient } from '../core/webtorrent';
import './VideoPlayer.css';

interface Props {
  magnetURI: string;
  hash?: string;
  isActive: boolean;
}

function VideoPlayer({ magnetURI, hash, isActive }: Props) {
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('videoMuted') === 'true');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const currentMagnetRef = useRef<string>('');

  useEffect(() => {
    let mounted = true;
    const videoElement = videoRef.current;
    
    if (isActive && videoElement && magnetURI && mounted) {
      if (currentMagnetRef.current !== magnetURI) {
        // Reset state for new video
        setError(null); 
        videoElement.src = '';
        currentMagnetRef.current = magnetURI;
        
        webTorrentClient.stream(magnetURI, videoElement, hash)
          .catch((err) => {
            if (mounted) {
              setError(err.message || 'Failed to load video');
            }
          });
        
        videoElement.addEventListener('error', () => {
          if (mounted) {
            setError('Video playback error');
          }
        });
      }
    } else if (videoElement && mounted) {
      videoElement.pause();
    }
    
    return () => {
      mounted = false;
    };
  }, [isActive, magnetURI, hash]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    localStorage.setItem('videoMuted', String(newMutedState));
  };

  const handleRetry = () => {
    setError(null);
    if (videoRef.current) {
      videoRef.current.src = '';
      videoRef.current.load();
    }
    // Re-trigger load if needed
    if (currentMagnetRef.current === magnetURI && isActive) {
      webTorrentClient.stream(magnetURI, videoRef.current!, hash).catch(setError);
    }
  };

  if (error) {
    return (
      <div className="video-player error-container">
        <div className="error-overlay">
          <p>{error}</p>
          <button onClick={handleRetry}>Retry</button>
        </div>
      </div>
    );
  }

  return (<>
      <video
        ref={videoRef}
        className="video-player"
        loop
        playsInline
        autoPlay={isActive}
        controls={false} // Use custom controls
        onClick={toggleMute}
      />
      {isActive && (
        <button className="mute-btn" onClick={toggleMute} aria-label="Toggle Mute">
          {isMuted ? '🔇' : '🔊'}
        </button>
      )}
  </>);
}

export default VideoPlayer;
