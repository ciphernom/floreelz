import { useState, useEffect } from 'react';
import VideoFeed from './components/VideoFeed';
import UploadModal from './components/UploadModal';
import ProfileView from './components/ProfileView';
import './index.css';
import { Toaster } from 'react-hot-toast';
import { nostrClient } from './core/nostr';
import KeyBackupNag from './components/KeyBackupNag';

function App() {
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [showBackupNag, setShowBackupNag] = useState(false);

  useEffect(() => {
    // Show backup reminder only for new users with browser-generated keys
    if (nostrClient.isNewUser && !nostrClient.usingExtension) {
      setShowBackupNag(true);
    }
  }, []);

  return (
    <div className="app-container">
      {showBackupNag && (
        <KeyBackupNag onBackup={() => setProfileOpen(true)} />
      )}
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#333',
            color: '#fff',
          },
        }}
      />
      
      <VideoFeed />
      
      {/* Profile Button */}
      <button 
        className="profile-btn-nav" 
        onClick={() => setProfileOpen(true)}
        aria-label="View profile"
      >
        👤
      </button>
      
      {/* Upload Button */}
      <button 
        className="upload-btn" 
        onClick={() => setUploadModalOpen(true)}
        aria-label="Upload video"
      >
        +
      </button>
      
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
      />
      
      {isProfileOpen && (
        <ProfileView
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
