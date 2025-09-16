import { useState, useEffect } from 'react';
import { getProfileManager, UserProfile } from '../core/profiles';
import { nostrClient } from '../core/nostr';
import { nip19 } from 'nostr-tools';
import { toast } from 'react-hot-toast';
import { VideoData } from '../types';
import './ProfileView.css';

interface Props {
  pubkey?: string;
  onClose: () => void;
  onVideoSelect?: (video: VideoData) => void;
}

interface ProfileStats {
  following: number;
  followers: number;
  likes: number;
}

type TabType = 'videos' | 'liked' | 'private';

function ProfileView({ pubkey, onClose, onVideoSelect }: Props) {
  const profileManager = getProfileManager();
  const isOwnProfile = !pubkey || pubkey === nostrClient.publicKey;
  const targetPubkey = pubkey || nostrClient.publicKey;
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('videos');
  const [userVideos, setUserVideos] = useState<VideoData[]>([]);
  const [likedVideos, setLikedVideos] = useState<VideoData[]>([]);
  const [stats, setStats] = useState<ProfileStats>({
    following: 0,
    followers: 0,
    likes: 0
  });
  const [isFollowing, setIsFollowing] = useState(false);
  const [showKeyExport, setShowKeyExport] = useState(false);
  
  const [editForm, setEditForm] = useState({
    name: '',
    about: '',
    picture: '',
  });

  useEffect(() => {
    loadProfile();
    loadUserVideos();
    loadStats();
    if (!isOwnProfile) {
      checkFollowStatus();
    }
  }, [targetPubkey]);

  useEffect(() => {
    if (activeTab === 'liked' && isOwnProfile && likedVideos.length === 0) {
      loadLikedVideos();
    }
  }, [activeTab]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const p = await profileManager.getProfile(targetPubkey);
      setProfile(p);
      setEditForm({
        name: p.name || '',
        about: p.about || '',
        picture: p.picture || '',
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserVideos = async () => {
    try {
      const videos = await nostrClient.getUserVideos(targetPubkey);
      setUserVideos(videos);
    } catch (error) {
      console.error('Failed to load user videos:', error);
    }
  };

  const loadLikedVideos = async () => {
    try {
      const videos = await nostrClient.getLikedVideos();
      setLikedVideos(videos);
    } catch (error) {
      console.error('Failed to load liked videos:', error);
    }
  };

  const loadStats = async () => {
    try {
      const userStats = await nostrClient.getUserStats(targetPubkey);
      setStats(userStats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const checkFollowStatus = async () => {
    try {
      const following = await nostrClient.isFollowing(targetPubkey);
      setIsFollowing(following);
    } catch (error) {
      console.error('Failed to check follow status:', error);
    }
  };

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await nostrClient.unfollow(targetPubkey);
        setIsFollowing(false);
        setStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
        toast.success('Unfollowed');
      } else {
        await nostrClient.follow(targetPubkey);
        setIsFollowing(true);
        setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
        toast.success('Following');
      }
    } catch (error) {
      toast.error('Failed to update follow status');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await profileManager.updateMyProfile(editForm);
      setProfile({ ...profile, ...editForm, pubkey: targetPubkey });
      setIsEditing(false);
      toast.success('Profile updated!');
    } catch (error) {
      toast.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = () => {
    const npub = nip19.npubEncode(targetPubkey);
    navigator.clipboard.writeText(`nostr:${npub}`);
    toast.success('Profile link copied!');
  };

  const handleExportKeys = () => {
    const secretKey = nostrClient.getSecretKey();
    const nsec = nip19.nsecEncode(secretKey);
    const npub = nip19.npubEncode(nostrClient.publicKey);
    
    const keyData = `NOSTR PRIVATE KEY (KEEP SECRET!):\n${nsec}\n\nPUBLIC KEY:\n${npub}`;
    
    navigator.clipboard.writeText(keyData);
    toast.success('Keys copied to clipboard! Keep them safe!', { duration: 5000 });
    setShowKeyExport(false);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 10000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  if (isLoading) {
    return (
      <div className="tiktok-profile-container">
        <div className="tiktok-profile-loading">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  const npub = nip19.npubEncode(targetPubkey);
  const displayName = profile?.name || 'Anonymous';
  const username = `@${npub.slice(5, 13)}...${npub.slice(-4)}`;

  return (
    <div className="tiktok-profile-container">
      {/* Header */}
      <div className="tiktok-profile-header">
        <button className="back-button" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <span className="header-username">{displayName}</span>
        <div className="header-actions">
          {isOwnProfile && (
            <button className="settings-button" onClick={() => setShowKeyExport(!showKeyExport)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
              </svg>
            </button>
          )}
          <button className="more-button" onClick={handleShare}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Key Export Modal */}
      {showKeyExport && isOwnProfile && (
        <div className="key-export-modal">
          <h3>Export Keys</h3>
          <p>⚠️ WARNING: Never share your private key!</p>
          <button onClick={handleExportKeys}>Copy Keys to Clipboard</button>
          <button onClick={() => setShowKeyExport(false)}>Cancel</button>
        </div>
      )}

      {/* Profile Info Section */}
      <div className="tiktok-profile-info">
        <div className="profile-avatar-section">
          {isEditing ? (
            <div className="avatar-edit-container">
              <img 
                src={editForm.picture || `https://robohash.org/${targetPubkey}`}
                alt={displayName}
                className="profile-avatar"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://robohash.org/${targetPubkey}`;
                }}
              />
              <input
                type="url"
                className="avatar-url-input"
                placeholder="Profile picture URL"
                value={editForm.picture}
                onChange={(e) => setEditForm({ ...editForm, picture: e.target.value })}
              />
            </div>
          ) : (
            <img 
              src={profile?.picture || `https://robohash.org/${targetPubkey}`}
              alt={displayName}
              className="profile-avatar"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://robohash.org/${targetPubkey}`;
              }}
            />
          )}
        </div>

        {isEditing ? (
          <div className="edit-form">
            <input
              type="text"
              className="edit-name"
              placeholder="Name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              maxLength={30}
            />
            <textarea
              className="edit-bio"
              placeholder="Bio"
              value={editForm.about}
              onChange={(e) => setEditForm({ ...editForm, about: e.target.value })}
              maxLength={80}
              rows={2}
            />
          </div>
        ) : (
          <>
            <h1 className="profile-display-name">{displayName}</h1>
            <p className="profile-username">{username}</p>
          </>
        )}

        {/* Stats */}
        <div className="profile-stats">
          <div className="stat-item">
            <span className="stat-number">{formatNumber(stats.following)}</span>
            <span className="stat-label">Following</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{formatNumber(stats.followers)}</span>
            <span className="stat-label">Followers</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{formatNumber(stats.likes)}</span>
            <span className="stat-label">Likes</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="profile-actions">
          {isOwnProfile ? (
            isEditing ? (
              <div className="edit-actions">
                <button className="cancel-button" onClick={() => {
                  setEditForm({
                    name: profile?.name || '',
                    about: profile?.about || '',
                    picture: profile?.picture || '',
                  });
                  setIsEditing(false);
                }}>
                  Cancel
                </button>
                <button className="save-button" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            ) : (
              <button className="edit-profile-button" onClick={() => setIsEditing(true)}>
                Edit profile
              </button>
            )
          ) : (
            <div className="follow-actions">
              <button 
                className={`follow-button ${isFollowing ? 'following' : ''}`}
                onClick={handleFollow}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button className="message-button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Bio */}
        {!isEditing && profile?.about && (
          <p className="profile-bio">{profile.about}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        <button 
          className={`tab-button ${activeTab === 'videos' ? 'active' : ''}`}
          onClick={() => setActiveTab('videos')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/>
          </svg>
        </button>
        <button 
          className={`tab-button ${activeTab === 'liked' ? 'active' : ''}`}
          onClick={() => setActiveTab('liked')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </button>
        {isOwnProfile && (
          <button 
            className={`tab-button ${activeTab === 'private' ? 'active' : ''}`}
            onClick={() => setActiveTab('private')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Video Grid */}
      <div className="video-grid">
        {activeTab === 'videos' && (
          userVideos.length > 0 ? (
            userVideos.map((video) => (
              <div 
                key={video.id} 
                className="video-thumbnail"
                onClick={() => {
                  onVideoSelect?.(video);
                  onClose();
                }}
              >
                <div className="thumbnail-placeholder">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
                <div className="thumbnail-info">
                  <p className="video-title">{video.title}</p>
                  <div className="video-stats">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    <span>{Math.floor(Math.random() * 10000)}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <p>{isOwnProfile ? 'Upload your first video!' : 'No videos yet'}</p>
            </div>
          )
        )}
        
        {activeTab === 'liked' && (
          isOwnProfile ? (
            likedVideos.length > 0 ? (
              likedVideos.map((video) => (
                <div 
                  key={video.id} 
                  className="video-thumbnail"
                  onClick={() => {
                    onVideoSelect?.(video);
                    onClose();
                  }}
                >
                  <div className="thumbnail-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                  <div className="thumbnail-info">
                    <p className="video-title">{video.title}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No liked videos yet</p>
              </div>
            )
          ) : (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="#666">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
              <p>Only users can see their liked videos</p>
            </div>
          )
        )}
        
        {activeTab === 'private' && (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="#666">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
            <p>Your private videos</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfileView;
