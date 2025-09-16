import { useState } from 'react';
import { nostrClient } from '../core/nostr';
import { webTorrentClient } from '../core/webtorrent';
import { toast } from 'react-hot-toast';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit

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
    console.log('🚀 Starting upload process...');
    console.log('File:', file?.name, 'Size:', file?.size);
    console.log('Title:', title);
    console.log('Summary:', summary);
    
  if (!file || !title || isUploading) {
    console.warn('⚠️ Missing required fields or already uploading');
    toast.error(!file ? 'Please select a file' : !title ? 'Please add a title' : 'Already uploading');
    return;
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    toast.error(`File too large! Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    return;
  }

    setIsUploading(true);
    const toastId = toast.loading('Seeding video to network. Please keep this tab open.');

    try {
      // 1. Seed the file
      console.log('Step 1: Seeding file to WebTorrent...');
      const magnetURI = await webTorrentClient.seed(file);
      console.log('✅ Seeding complete! Magnet URI:', magnetURI);

      // 2. Publish to Nostr
      console.log('Step 2: Publishing to Nostr...');
      const event = await nostrClient.publishVideo(magnetURI, title, summary);
      console.log('✅ Published to Nostr! Event ID:', event.id);

      toast.success('Upload complete!', { id: toastId });
      
      // Reset form
      setFile(null);
      setTitle('');
      setSummary('');
      
      onClose();
    } catch (error) {
      console.error('❌ Upload failed:', error);
      toast.error('Upload failed. Check console for details.', { id: toastId });
    } finally {
      setIsUploading(false);
      console.log('Upload process finished');
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
          onChange={e => {
            setTitle(e.target.value);
            console.log('Title changed:', e.target.value);
          }} 
        />
        <textarea 
          placeholder="Summary" 
          value={summary}
          onChange={e => {
            setSummary(e.target.value);
            console.log('Summary changed:', e.target.value);
          }} 
        />
        <input 
          type="file" 
          accept="video/mp4" 
          onChange={e => {
            const selectedFile = e.target.files?.[0] || null;
            setFile(selectedFile);
            console.log('File selected:', selectedFile?.name, 'Size:', selectedFile?.size);
          }} 
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
