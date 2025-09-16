import { useState } from 'react';
import VideoFeed from './components/VideoFeed';
import UploadModal from './components/UploadModal';
import ProfileView from './components/ProfileView';
import './index.css';
import { Toaster } from 'react-hot-toast';

function App() {
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);

  return (
    <div className="app-container">
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
