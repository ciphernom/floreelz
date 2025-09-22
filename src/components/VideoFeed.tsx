import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Mousewheel, Virtual } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/virtual';
import { VideoFeedSkeleton } from './SkeletonLoader';
import { nostrClient } from '../core/nostr';
import { getProfileManager, UserProfile } from '../core/profiles';
import { nip19 } from 'nostr-tools';
import { VideoData } from '../types';
import VideoPlayer from './VideoPlayer';
import InteractionBar from './InteractionBar';
import ProfileView from './ProfileView';
import { toast } from 'react-hot-toast';

// ADDED: SVG icon components for clarity and reusability.
const FollowIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);

const ZapIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
  </svg>
);


function VideoFeed() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProfilePubkey, setSelectedProfilePubkey] = useState<string | null>(null);
  const [feedType, setFeedType] = useState<'global' | 'following'>('global');
  
  // ADDED: State to hold full author profiles and the user's follow list.
  const [authorProfiles, setAuthorProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [followedPubkeys, setFollowedPubkeys] = useState<Set<string>>(new Set());

  // CHANGED: useEffect now also fetches the user's follow list once.
  useEffect(() => {
    const receivedIds = new Set<string>();
    const profileManager = getProfileManager();

    // Fetch the list of users we are following to manage button states
    const fetchFollows = async () => {
      if (nostrClient.publicKey) {
        const followed = await nostrClient.getFollowedPubkeys();
        setFollowedPubkeys(new Set(followed));
      }
    };
    fetchFollows();

    setIsLoading(true);
    setVideos([]);
    
    nostrClient.subscribeToVideos(feedType, async (video) => {
      if (!(video as VideoData).id) {
          setIsLoading(false);
          return;
      }
      const videoData = video as VideoData;
        
      if (receivedIds.has(videoData.id)) return;
      receivedIds.add(videoData.id);

      setVideos((prevVideos) => {
       const updated = [videoData, ...prevVideos].sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
       return updated;
      });

      // Fetch and store the full profile to check for zap details (lud16)
      try {
        const profile = await profileManager.getProfile(videoData.author);
        if (profile) {
          setAuthorProfiles((prev) => new Map(prev).set(videoData.author, profile));
        }
      } catch (error) {
        console.error('Failed to load author profile:', error);
      }
      
      setIsLoading(false);
    });

    return () => {
      nostrClient.unsubscribeFromVideos();
    };
  }, [feedType]);

  // ADDED: Handlers for following and zapping directly from the feed.
  const handleFollowToggle = async (pubkey: string) => {
    const isFollowing = followedPubkeys.has(pubkey);
    try {
      if (isFollowing) {
        await nostrClient.unfollow(pubkey);
        setFollowedPubkeys(prev => {
          const next = new Set(prev);
          next.delete(pubkey);
          return next;
        });
        toast('💔 Unfollowed');
      } else {
        await nostrClient.follow(pubkey);
        setFollowedPubkeys(prev => new Set(prev).add(pubkey));
        toast('✅ Following!');
      }
    } catch (error) {
      toast.error('Could not update follow status.');
    }
  };

  const handleZap = async (profile: UserProfile) => {
    if (!profile.lud16) {
      toast.error("User doesn't have a Lightning Address.");
      return;
    }
    try {
      // Defaulting to 21 sats for a quick zap.
      await nostrClient.zapUser(profile.pubkey, profile.lud16, 21);
    } catch (error) {
      // The nostrClient will show its own specific error toast.
      console.error('Zap failed in component:', error);
    }
  };

  const renderContent = () => {
    if (isLoading) return <VideoFeedSkeleton />;
    if (videos.length === 0) {
      return (
        <div className="empty-feed-message">
          <h2>{feedType === 'following' ? 'Your Following Feed is Empty' : 'No videos found!'}</h2>
          <p>{feedType === 'following' ? 'Follow creators to see their videos here.' : 'The global feed might be quiet.'}</p>
        </div>
      );
    }

    return (
      <Swiper direction={'vertical'} className="swiper-container" modules={[Mousewheel, Virtual]} mousewheel virtual>
        {videos.map((video, index) => {
          const authorProfile = authorProfiles.get(video.author);
          const displayName = authorProfile?.name || `${nip19.npubEncode(video.author).slice(0, 12)}...`;
          
          // Determine button states for the current video
          const isMyVideo = nostrClient.publicKey === video.author;
          const isFollowing = followedPubkeys.has(video.author);
          const canZap = authorProfile?.lud16;

          return (
            <SwiperSlide key={video.id} virtualIndex={index} className="slide">
              {({ isActive }) => (
                <>
                  <VideoPlayer magnetURI={video.magnetURI} hash={video.hash} cid={video.cid} isActive={isActive} />
                  
                  {/* The video overlay now includes the new Follow and Zap buttons. */}
                  <div className="overlay-info">
                    <h3>{video.title}</h3>
                    <p>{video.summary}</p>
                      {video.hashtags && video.hashtags.length > 0 && (
                        <p className="hashtags">
                          {video.hashtags.map(tag => `#${tag}`).join(' ')}
                        </p>
                      )}
                    <div className="author-line">
                      <p className="author" onClick={() => setSelectedProfilePubkey(video.author)}>
                        By: {displayName}
                      </p>
                      {!isMyVideo && (
                        <div className="author-actions">
                          <button 
                            className={`follow-btn ${isFollowing ? 'following' : ''}`}
                            onClick={() => handleFollowToggle(video.author)}
                            title={isFollowing ? 'Unfollow' : 'Follow'}
                          >
                            <FollowIcon />
                          </button>
                          {canZap && (
                            <button className="zap-btn" onClick={() => handleZap(authorProfile)} title="Zap User">
                              <ZapIcon />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <InteractionBar video={video} />
                </>
              )}
            </SwiperSlide>
          );
        })}
      </Swiper>
    );
  };
  
  return (
    <>
      <div className="feed-toggle">
        <button className={feedType === 'global' ? 'active' : ''} onClick={() => setFeedType('global')}>
          For You
        </button>
        <button className={feedType === 'following' ? 'active' : ''} onClick={() => setFeedType('following')}>
          Following
        </button>
      </div>

      {renderContent()}

      {selectedProfilePubkey && (
        <ProfileView pubkey={selectedProfilePubkey} onClose={() => setSelectedProfilePubkey(null)} />
      )}
    </>
  );
}

export default VideoFeed;
