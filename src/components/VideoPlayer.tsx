import { useEffect, useRef } from 'react';
import { webTorrentClient } from '../core/webtorrent';

interface Props {
  magnetURI: string;
  isActive: boolean;
}

function VideoPlayer({ magnetURI, isActive }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentMagnetRef = useRef<string>('');

  console.log(`[VideoPlayer] Render - isActive: ${isActive}, magnetURI: ${magnetURI?.substring(0, 30)}...`);

  useEffect(() => {
    const videoElement = videoRef.current;
    
    console.log(`[VideoPlayer] Effect triggered:`, {
      isActive,
      hasVideoElement: !!videoElement,
      magnetURI: magnetURI?.substring(0, 30) + '...',
      currentMagnet: currentMagnetRef.current?.substring(0, 30) + '...'
    });
    
    if (isActive && videoElement && magnetURI) {
      if (currentMagnetRef.current !== magnetURI) {
        console.log('[VideoPlayer] Loading new video...');
        
        // Clear previous video
        console.log('[VideoPlayer] Clearing previous video source');
        videoElement.src = '';
        videoElement.load();
        
        currentMagnetRef.current = magnetURI;
        console.log('[VideoPlayer] Calling webTorrentClient.stream()');
        webTorrentClient.stream(magnetURI, videoElement);
        
        // Add video element event listeners for debugging
        videoElement.addEventListener('loadstart', () => 
          console.log('[VideoPlayer] Video event: loadstart'));
        videoElement.addEventListener('loadedmetadata', () => 
          console.log('[VideoPlayer] Video event: loadedmetadata'));
        videoElement.addEventListener('loadeddata', () => 
          console.log('[VideoPlayer] Video event: loadeddata'));
        videoElement.addEventListener('canplay', () => 
          console.log('[VideoPlayer] Video event: canplay'));
        videoElement.addEventListener('canplaythrough', () => 
          console.log('[VideoPlayer] Video event: canplaythrough'));
        videoElement.addEventListener('play', () => 
          console.log('[VideoPlayer] Video event: play'));
        videoElement.addEventListener('pause', () => 
          console.log('[VideoPlayer] Video event: pause'));
        videoElement.addEventListener('error', (e) => 
          console.error('[VideoPlayer] Video error:', e));
      } else {
        console.log('[VideoPlayer] Same video, no reload needed');
      }
    } else if (videoElement) {
      console.log('[VideoPlayer] Pausing video (not active)');
      videoElement.pause();
    }
    
    return () => {
      console.log(`[VideoPlayer] Cleanup for magnetURI: ${magnetURI?.substring(0, 30)}...`);
      if (magnetURI) {
        webTorrentClient.remove(magnetURI);
      }
    };
  }, [isActive, magnetURI]);

  return (
    <video
      ref={videoRef}
      className="video-player"
      loop
      playsInline
      muted
      controls
      onError={(e) => console.error('[VideoPlayer] Video element error:', e)}
    />
  );
}

export default VideoPlayer;
