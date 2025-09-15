import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Mousewheel, Virtual } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/virtual';

import { nostrClient } from '../core/nostr';
import { nip19 } from 'nostr-tools';
import { VideoData } from '../types';
import VideoPlayer from './VideoPlayer';
import InteractionBar from './InteractionBar';

function VideoFeed() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // A set to keep track of received event IDs to prevent duplicates.
    const receivedIds = new Set<string>();

    nostrClient.subscribeToVideos((video) => {
      // If we've already processed this video ID, ignore it.
      if (receivedIds.has(video.id)) return;

      receivedIds.add(video.id);

      setVideos((prevVideos) => {
        // Add the new video to the array and re-sort by creation date.
        const updatedVideos = [video, ...prevVideos];
        return updatedVideos.sort((a, b) => b.createdAt - a.createdAt);
      });

      // Turn off the loading spinner once we have at least one video.
      setIsLoading(false);
    });

    // The cleanup function unsubscribes when the component unmounts.
    return () => {
      nostrClient.unsubscribeFromVideos();
    };
  }, []); // The empty dependency array ensures this runs only on mount/unmount.

  if (isLoading) {
    return <div className="loading-spinner"></div>;
  }

  if (videos.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'white' }}>
        <h2>No videos yet!</h2>
        <p>Upload the first video to get started, or wait for new content to be published.</p>
      </div>
    );
  }

  return (
    <Swiper
      direction={'vertical'}
      className="swiper-container"
      modules={[Mousewheel, Virtual]}
      mousewheel
      virtual
    >
      {videos.map((video, index) => {
        // Convert the hex public key to a user-friendly npub identifier.
        const npub = nip19.npubEncode(video.author);
        // Create a truncated version for clean display.
        const displayName = `${npub.slice(0, 12)}...${npub.slice(-4)}`;

        return (
          <SwiperSlide key={video.id} virtualIndex={index} className="slide">
            {({ isActive }) => (
              <>
                <VideoPlayer
                  magnetURI={video.magnetURI}
                  isActive={isActive}
                />
                <div className="overlay-info">
                  <h3>{video.title}</h3>
                  <p>{video.summary}</p>
                  <p className="author">By: {displayName}</p>
                </div>
                <InteractionBar video={video} />
              </>
            )}
          </SwiperSlide>
        );
      })}
    </Swiper>
  );
}

export default VideoFeed;
