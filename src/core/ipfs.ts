import { create, Client } from '@web3-storage/w3up-client';
import { toast } from 'react-hot-toast';

export class LoginRequiredError extends Error {
  constructor(message = 'Login is required for IPFS upload.') {
    super(message);
    this.name = 'LoginRequiredError';
  }
}

// Create a single, shared client instance that can be reused.
let client: Client | null = null;
 
 class IPFSClient {
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
    const toastId = toast.loading('Login required. Please check your email for a magic link from web3.storage.');
    try {
      await web3Client.login(email as `${string}@${string}`);
      // The page will reload after a successful login via the magic link.
      // The UI should inform the user of this.
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
     let spaces = web3Client.spaces();
     if (spaces.length > 0) {
       await web3Client.setCurrentSpace(spaces[0].did());
     } else {
      // If no space exists for a new user, create one.
      const newSpace = await web3Client.createSpace('floreelz-videos');
      await web3Client.setCurrentSpace(newSpace.did());
      console.log('✨ Created and set new web3.storage space.');
     }
 
     console.log('📁 Uploading to web3.storage:', file.name);
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
