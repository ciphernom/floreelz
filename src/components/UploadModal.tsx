import { useState } from 'react';
import { nostrClient } from '../core/nostr';
import { webTorrentClient } from '../core/webtorrent';
import { ipfsClient } from '../core/ipfs';
import { toast } from 'react-hot-toast';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit

const computeHash = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const extractThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas context is not available'));

    video.onloadeddata = () => {
      video.currentTime = 1; // Seek to 1 second in
      video.onseeked = () => {
        canvas.width = 320;
        canvas.height = (video.videoHeight / video.videoWidth) * 320;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/webp', 0.8);
        URL.revokeObjectURL(video.src); // Clean up blob URL
        resolve(dataUrl);
      };
    };
    video.onerror = () => reject(new Error('Failed to load video for thumbnail extraction'));
    video.src = URL.createObjectURL(file);
  });
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function UploadModal({ isOpen, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!file || !title || isUploading) {
      toast.error(!file ? 'Please select a file' : !title ? 'Please add a title' : 'Already uploading');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large! Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Seeding video to network. Please keep this tab open.');

    try {
      const magnetURI = await webTorrentClient.seed(file);
      toast.loading('Uploading to IPFS for persistence...', { id: toastId });
      const cid = await ipfsClient.uploadFile(file);
      console.log('✅ Seeding complete! Magnet URI:', magnetURI);
      console.log('✅ IPFS upload complete! CID:', cid);

      const [hash, thumbnail] = await Promise.all([
        computeHash(file),
        extractThumbnail(file).catch(() => undefined) // Don't block upload if thumbnail fails
      ]);
      console.log('🔐 Computed hash:', hash);

      toast.loading('Publishing to Nostr...', { id: toastId });
      const event = await nostrClient.publishVideo(magnetURI, title, summary, hash, thumbnail, cid);
      console.log('✅ Published to Nostr! Event ID:', event.id);

      toast.success('Upload complete!', { id: toastId });
      
      setFile(null);
      setTitle('');
      setSummary('');
      onClose();
    } catch (error) {
      console.error('❌ Upload failed:', error);
      toast.error('Upload failed. Check console for details.', { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Upload Video</h2>
        <input 
          type="text" 
          placeholder="Title" 
          value={title}
          onChange={e => setTitle(e.target.value)} 
        />
        <textarea 
          placeholder="Summary" 
          value={summary}
          onChange={e => setSummary(e.target.value)} 
        />
        <input 
          type="file" 
          accept="video/mp4" 
          onChange={e => setFile(e.target.files?.[0] || null)} 
        />
        <div className="modal-actions">
          <button onClick={onClose} disabled={isUploading}>Cancel</button>
          <button onClick={handleUpload} disabled={!file || !title || isUploading}>
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UploadModal;
