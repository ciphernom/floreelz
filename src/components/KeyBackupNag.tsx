import { useState, useEffect } from 'react';

const LOCAL_STORAGE_KEY = 'floreelz_backup_nag_dismissed';

interface Props {
  onBackup: () => void;
}

function KeyBackupNag({ onBackup }: Props) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, 'true');
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="key-backup-nag">
      <p>
        <strong>Welcome!</strong> To keep your account safe, please back up your key.
      </p>
      <div className="key-backup-nag-actions">
        <button onClick={onBackup} className="backup-btn">Backup Key</button>
        <button onClick={handleDismiss} className="dismiss-btn">Dismiss</button>
      </div>
    </div>
  );
}

export default KeyBackupNag;
