import { useState } from 'react';
import VideoFeed from './components/VideoFeed';
import UploadModal from './components/UploadModal';
import './index.css';
// 1. Import the Toaster component
import { Toaster } from 'react-hot-toast';

function App() {
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);

  return (
    <div className="app-container">
      {/* 2. Place the Toaster here. It handles rendering all toast notifications. */}
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
    </div>
  );
}

export default App;
