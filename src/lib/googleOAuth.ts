import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { YouTubeChannelInfo } from '../shared/types';

export const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({ prompt: 'consent' });

let isSigningIn = false;
// Stored strictly in memory (never localStorage or sessionStorage)
let cachedAccessToken: string | null = null;

export function initAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.(user);
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.(null);
    }
  });
}

export async function fetchYouTubeChannelInfo(
  accessToken: string
): Promise<YouTubeChannelInfo | null> {
  try {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const ch = data?.items?.[0];
    if (!ch) return null;
    return {
      id: ch.id,
      title: ch.snippet?.title || 'Connected Channel',
      subscriberCount: ch.statistics?.subscriberCount || '0',
      videoCount: ch.statistics?.videoCount || '0',
      thumbnailUrl: ch.snippet?.thumbnails?.default?.url,
    };
  } catch {
    return null;
  }
}

export async function googleSignIn(): Promise<{
  user: User;
  accessToken: string;
  channel: YouTubeChannelInfo | null;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google access token. Please allow YouTube & Sheets permissions.');
    }
    cachedAccessToken = credential.accessToken;
    const channel = await fetchYouTubeChannelInfo(cachedAccessToken);
    return {
      user: result.user,
      accessToken: cachedAccessToken,
      channel,
    };
  } finally {
    isSigningIn = false;
  }
}

export async function getAccessToken(): Promise<string | null> {
  return cachedAccessToken;
}

export function getInMemoryGoogleToken(): string | null {
  return cachedAccessToken;
}

export async function logout(): Promise<void> {
  await auth.signOut();
  cachedAccessToken = null;
}

export async function clearInMemoryGoogleToken(): Promise<void> {
  await logout();
}
