import { create, Client } from '@storacha/client';
import { toast } from 'react-hot-toast';

export class LoginRequiredError extends Error {
  constructor(message = 'Login is required for IPFS upload.') {
    super(message);
    this.name = 'LoginRequiredError';
  }
}

// Create a single, shared client instance that can be reused.
let client: Client | null = null;
 type Account = any; 
 
 class IPFSClient {
     private account: Account | null = null; 
   private async getClient(): Promise<Client> {
     if (client) {
       return client;
     }
     client = await create();
     return client;
   }
   
   public async isAuthenticated(): Promise<boolean> {
    const web3Client = await this.getClient();
    return web3Client.proofs().length > 0;
   }

public async login(email: string): Promise<void> {
  const web3Client = await this.getClient();
  const toastId = toast.loading('Login required. Please check your email for a magic link from Storacha.');
  try {
    // The login method resolves with the account object after email verification
    this.account = await web3Client.login(email as `${string}@${string}`); 
    toast.success('Login successful! You can now try uploading again.', { id: toastId });
  } catch (err) {
    toast.error('Login failed. Please try again.', { id: toastId });
    throw err;
  }
}   
   
   
   public async uploadFile(file: File): Promise<string> {
     const web3Client = await this.getClient();
     if (!web3Client.did()) {
      throw new LoginRequiredError();
     }
 
     // Set the active storage space (defaults to one created on login).
if (!this.account) {
    // Attempt to load the account if the user is already authenticated but the session is new
    const accounts = await web3Client.accounts();
    const accountArray = Object.values(accounts);

    if (accountArray.length > 0) {
        // If accounts are available, use the first one.
        this.account = accountArray[0];
    } else {
        // If no accounts are found despite being authenticated, something is wrong.
        throw new LoginRequiredError("No account found after authentication. Please log in again.");
    }
}

    let spaces = web3Client.spaces();
    if (spaces.length > 0) {
        await web3Client.setCurrentSpace(spaces[0].did());
    } else {
        // Create the space and pass the account object in the options
        const newSpace = await web3Client.createSpace('floreelz-videos', { account: this.account });
        await web3Client.setCurrentSpace(newSpace.did());
        console.log('✨ Created and set new recoverable web3.storage space.');
    }
 
     console.log('📁 Uploading to Storacha:', file.name);
     const cid = await web3Client.uploadFile(file);
     const cidString = cid.toString();
     console.log('✅ IPFS CID:', cidString);
     return cidString;
   }
 
   public getFileUrl(cid: string): string {
     return `https://ipfs.io/ipfs/${cid}`;
   }
 }
 
 export const ipfsClient = new IPFSClient();
