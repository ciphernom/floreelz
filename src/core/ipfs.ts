import { create } from 'ipfs-http-client';

 
 // Replace with environment variables in a real application
 const IPFS_PROJECT_ID = import.meta.env.VITE_IPFS_PROJECT_ID;
 const IPFS_PROJECT_SECRET = import.meta.env.VITE_IPFS_PROJECT_SECRET;
 
 const auth = 'Basic ' + btoa(IPFS_PROJECT_ID + ':' + IPFS_PROJECT_SECRET);
 const ipfs = create({ url: 'https://ipfs.infura.io:5001', headers: { authorization: auth } });
 
 class IPFSClient {
   public async uploadFile(file: File): Promise<string> {
     console.log('📁 Uploading to IPFS:', file.name);
     const { cid } = await ipfs.add(file);
     const cidString = cid.toString();
     console.log('✅ IPFS CID:', cidString);
     return cidString;
   }
 
   public getFileUrl(cid: string): string {
     return `https://ipfs.io/ipfs/${cid}`;
   }
 }
 
 export const ipfsClient = new IPFSClient();
