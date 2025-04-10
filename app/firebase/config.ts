// firebase/config.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCmqaD64dP4M9THoFDjNrlSl2FvRsiojTA",
  authDomain: "tag-eb9b0.firebaseapp.com",
  projectId: "tag-eb9b0",
  storageBucket: "tag-eb9b0.appspot.com",
  messagingSenderId: "395312466224",
  appId: "1:395312466224:web:bbaa7be4aa4ea05fc720f5",
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Export services you'll use
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); 
