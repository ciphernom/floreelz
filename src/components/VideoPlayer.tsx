import { useEffect, useRef, useState } from 'react';
import { webTorrentClient } from '../core/webtorrent';
import { ipfsClient } from '../core/ipfs';
import './VideoPlayer.css';

interface Props {
  magnetURI: string;
  hash?: string;
  cid?: string;
  isActive: boolean;
}

function VideoPlayer({ magnetURI, hash, cid, isActive }: Props) {
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('videoMuted') === 'true');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const currentMagnetRef = useRef<string>('');
  const currentSrcRef = useRef<string>('');
  const isLoadingRef = useRef<boolean>(false); // Track loading state to suppress interim errors

  useEffect(() => {
    let mounted = true;
    const videoElement = videoRef.current;

    if (isActive && videoElement && magnetURI && mounted) {
      if (currentMagnetRef.current !== magnetURI) {
        setError(null);
        videoElement.src = '';
        if (currentSrcRef.current?.startsWith('blob:')) {
          URL.revokeObjectURL(currentSrcRef.current);
        }
        currentSrcRef.current = '';
        currentMagnetRef.current = magnetURI;
        isLoadingRef.current = true; // Suppress errors during load

        const tryStream = async () => {
          try {
            await Promise.race([
              webTorrentClient.stream(magnetURI, videoElement, hash),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('No WebTorrent peers found in time')), 15000)
              ),
            ]);
          } catch (err: any) {
            if ((err.message.includes('No WebTorrent peers') || err.message.includes('timeout')) && cid) {
              console.log('🔄 Falling back to IPFS');
              try {
                const ipfsUrl = await ipfsClient.getFileUrl(cid);
                videoElement.src = ipfsUrl;
                videoElement.crossOrigin = 'anonymous';
                videoElement.load();
                currentSrcRef.current = ipfsUrl;
                console.log('✅ IPFS src set');
              } catch (ipfsErr: any) {
                throw new Error(`IPFS failed: ${ipfsErr.message}`);
              }
            } else {
              throw err;
            }
          } finally {
            isLoadingRef.current = false; // Allow errors post-load
          }
        };

        tryStream().catch((err: any) => {
          if (mounted) {
            setError(err.message || 'Failed to load video');
          }
        });

        // Manual play after metadata loaded (avoids empty src autoplay)
        const handleLoadedMetadata = () => {
          if (mounted && isActive && !isLoadingRef.current) {
            videoElement.play().catch(e => console.warn('Play failed after load:', e));
          }
        };
        videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);

        const handleError = (e: any) => {
          if (mounted && !isLoadingRef.current) { // Suppress during load
            const msg = e?.target?.error?.message || 'Unknown error';
            console.error('Video error:', msg);
            setError(`Video playback error: ${msg}`);
            if (currentSrcRef.current?.startsWith('blob:')) {
              URL.revokeObjectURL(currentSrcRef.current);
              console.log('🧹 Revoked bad blob URL');
            }
            currentSrcRef.current = '';
          }
        };

        videoElement.addEventListener('error', handleError);

        return () => {
          videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
          videoElement.removeEventListener('error', handleError);
          if (currentSrcRef.current?.startsWith('blob:')) {
            URL.revokeObjectURL(currentSrcRef.current);
          }
        };
      }
    } else if (videoElement && mounted) {
      videoElement.pause();
    }

    return () => {
      mounted = false;
      if (currentSrcRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(currentSrcRef.current);
      }
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
      if (currentSrcRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(currentSrcRef.current);
      }
      currentSrcRef.current = '';
      currentMagnetRef.current = '';
      isLoadingRef.current = false;
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

  return (
    <>
      <video
        ref={videoRef}
        className="video-player"
        loop
        playsInline
        autoPlay={false} // Disable auto to avoid empty src error
        preload="metadata" // Delay load until src set
        muted={isMuted}
        controls={false}
        onClick={toggleMute}
        crossOrigin="anonymous"
      />
      {isActive && (
        <button
          className="mute-btn"
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          aria-label="Toggle Mute"
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      )}
    </>
  );
}

export default VideoPlayer;
