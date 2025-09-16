import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Mousewheel, Virtual } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/virtual';

import { nostrClient } from '../core/nostr';
import { getProfileManager } from '../core/profiles';
import { nip19 } from 'nostr-tools';
import { VideoData } from '../types';
import VideoPlayer from './VideoPlayer';
import InteractionBar from './InteractionBar';
import ProfileView from './ProfileView';

function VideoFeed() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProfilePubkey, setSelectedProfilePubkey] = useState<string | null>(null);
  const [authorNames, setAuthorNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const receivedIds = new Set<string>();
    const profileManager = getProfileManager();

    nostrClient.subscribeToVideos(async (video) => {
      if (receivedIds.has(video.id)) return;
      receivedIds.add(video.id);

      setVideos((prevVideos) => {
        const updatedVideos = [video, ...prevVideos];
        return updatedVideos.sort((a, b) => b.createdAt - a.createdAt);
      });

      // Load author profile in the background
      try {
        const profile = await profileManager.getProfile(video.author);
        if (profile && profile.name) {
          setAuthorNames((prev) => new Map(prev).set(video.author, profile.name!));
        }
      } catch (error) {
        console.error('Failed to load author profile:', error);
      }

      setIsLoading(false);
    });

    return () => {
      nostrClient.unsubscribeFromVideos();
    };
  }, []);

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
    <>
      <Swiper
        direction={'vertical'}
        className="swiper-container"
        modules={[Mousewheel, Virtual]}
        mousewheel
        virtual
      >
        {videos.map((video, index) => {
          const npub = nip19.npubEncode(video.author);
          const authorName = authorNames.get(video.author);
          const displayName = authorName || `${npub.slice(0, 12)}...${npub.slice(-4)}`;

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
                    <p 
                      className="author"
                      onClick={() => setSelectedProfilePubkey(video.author)}
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      By: {displayName}
                    </p>
                  </div>
                  <InteractionBar video={video} />
                </>
              )}
            </SwiperSlide>
          );
        })}
      </Swiper>

      {selectedProfilePubkey && (
        <ProfileView
          pubkey={selectedProfilePubkey}
          onClose={() => setSelectedProfilePubkey(null)}
        />
      )}
    </>
  );
}

export default VideoFeed;
