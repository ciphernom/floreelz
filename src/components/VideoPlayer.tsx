import { useEffect, useRef, useState } from 'react';
import { webTorrentClient } from '../core/webtorrent';
import { ipfsClient } from '../core/ipfs'; // Phase 3: For IPFS fallback
import './VideoPlayer.css';

interface Props {
  magnetURI: string;
  hash?: string;
  cid?: string; // Phase 3: Add prop for fallback
  isActive: boolean;
}

function VideoPlayer({ magnetURI, hash, cid, isActive }: Props) {
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('videoMuted') === 'true');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const currentMagnetRef = useRef<string>('');

  useEffect(() => {
    let mounted = true;
    const videoElement = videoRef.current;
    
    if (isActive && videoElement && magnetURI && mounted) {
      if (currentMagnetRef.current !== magnetURI) {
        setError(null); 
        videoElement.src = '';
        currentMagnetRef.current = magnetURI;

        const tryStream = async () => {
            try {
                await Promise.race([
                    webTorrentClient.stream(magnetURI, videoElement, hash),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('No WebTorrent peers found in time')), 10000) // 10s timeout
                    )
                ]);
            } catch (err: any) {
                if (err.message.includes('No WebTorrent peers') && cid) {
                    console.log('🔄 Falling back to IPFS');
                    try {
                        const ipfsUrl = await ipfsClient.getFileUrl(cid);
                        videoElement.src = ipfsUrl;
                        videoElement.load();
                    } catch (ipfsErr: any) {
                        // Throw the IPFS error if fallback also fails
                        throw ipfsErr;
                    }
                } else {
                    throw err;
                }
            }
        };

        tryStream().catch((err: any) => {
            if (mounted) {
                // FIX 1: Always use err.message
                setError(err.message || 'Failed to load video');
            }
        });

        const handleError = (e: any) => {
          if (mounted) {
            // FIX 2: Be specific with video element errors
            setError('Video playback error: ' + (e?.target?.error?.message || 'Unknown error'));
          }
        };

        videoElement.addEventListener('error', handleError);

        return () => {
            videoElement.removeEventListener('error', handleError);
        };
      }
    } else if (videoElement && mounted) {
      videoElement.pause();
    }
    
    return () => {
      mounted = false;
    };
  }, [isActive, magnetURI, hash, cid]);

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
      currentMagnetRef.current = ''; // Force re-initialization
      // The main useEffect will now re-trigger the stream on the next render cycle
    }
  };

  if (error) {
    return (
      <div className="video-player error-container">
        <div className="error-overlay">
          <p>{error}</p> {/* This will now correctly render a string */}
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
        controls={false}
        onClick={toggleMute}
        crossOrigin="anonymous"
      />
    
      {isActive && (
        <button className="mute-btn" onClick={toggleMute} aria-label="Toggle Mute">
          {isMuted ? '🔇' : '🔊'}
        </button>
      )}
  </>);
}

export default VideoPlayer;
