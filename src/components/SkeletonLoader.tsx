import React from 'react';

const SkeletonBar: React.FC<{ width?: string; height?: string; className?: string }> = ({
  width = '100%',
  height = '16px',
  className = '',
}) => <div className={`skeleton-bar ${className}`} style={{ width, height }} />;

export const VideoFeedSkeleton: React.FC = () => (
  <div className="video-feed-skeleton">
    <div className="skeleton-video-player">
      <div className="skeleton-overlay">
        <SkeletonBar width="80%" height="24px" />
        <SkeletonBar width="60%" height="16px" />
        <SkeletonBar width="40%" height="16px" className="author" />
      </div>
      <div className="skeleton-interaction-bar">
        <div className="skeleton-icon" />
        <div className="skeleton-icon" />
        <div className="skeleton-icon" />
        <div className="skeleton-icon" />
      </div>
    </div>
  </div>
);

export const ProfileSkeleton: React.FC = () => (
  <div className="profile-skeleton">
    <div className="profile-skeleton-header">
      <div className="skeleton-avatar" />
      <div style={{ flex: 1 }}>
        <SkeletonBar width="50%" height="24px" />
        <SkeletonBar width="30%" height="16px" />
      </div>
    </div>
    <div className="profile-skeleton-stats">
      <SkeletonBar width="40px" height="30px" />
      <SkeletonBar width="40px" height="30px" />
      <SkeletonBar width="40px" height="30px" />
    </div>
    <SkeletonBar width="100%" height="40px" />
    <div className="profile-skeleton-grid">
      {[...Array(9)].map((_, i) => (
        <div key={i} className="skeleton-thumbnail" />
      ))}
    </div>
  </div>
);
