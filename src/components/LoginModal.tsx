import { useState, useEffect } from 'react';
import { ipfsClient } from '../core/ipfs';
import { toast } from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function LoginModal({ isOpen, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);


  // Effect to poll for authentication status
  useEffect(() => {
    if (!isOpen || !isLoggingIn) {
      return;
    }

    // Check for login status every 2 seconds
    const intervalId = setInterval(async () => {
      const authenticated = await ipfsClient.isAuthenticated();
      if (authenticated) {
        clearInterval(intervalId);
        toast.success('Login detected!');
        onClose();
      }
    }, 2000);

    // Cleanup on component unmount or when modal closes
    return () => {
      clearInterval(intervalId);
    };
  }, [isOpen, isLoggingIn, onClose]);
 

  const handleLogin = async () => {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    setIsLoggingIn(true);
    try {
      await ipfsClient.login(email);
      // The login function in ipfs.ts shows its own toasts.
      // The page will reload on success, so we don't need to close the modal here.
      // We can add a message to the user.
      toast('After you click the magic link in your email, this page will reload.', {
        duration: 8000,
        icon: '📧',
      });
    } catch (error) {
      console.error('Login failed:', error);
      setIsLoggingIn(false); // Only reset on failure
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Login to Upload</h2>
        <p style={{ fontSize: '0.9rem', color: '#ccc', margin: '10px 0' }}>
          To store your videos decentrally, please log in to Storacha. A "magic link" will be sent to your email.
        </p>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={isLoggingIn}
        />
        <div className="modal-actions">
          <button onClick={onClose} disabled={isLoggingIn}>Cancel</button>
          <button onClick={handleLogin} disabled={isLoggingIn}>
            {isLoggingIn ? 'Check Your Email...' : 'Send Magic Link'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginModal;
