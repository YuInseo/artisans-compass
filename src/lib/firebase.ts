import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAnalytics, Analytics, isSupported as analyticsSupported } from 'firebase/analytics';
import { getFirestore, Firestore } from 'firebase/firestore';
import {
    getAuth,
    Auth,
    signInAnonymously,
    onAuthStateChanged,
    User,
} from 'firebase/auth';

const firebaseConfig = {
    apiKey: 'AIzaSyDvfUJRNcx5WLYUtF6MJzINzN6zccpX1YU',
    authDomain: 'artisans-43c31.firebaseapp.com',
    projectId: 'artisans-43c31',
    storageBucket: 'artisans-43c31.firebasestorage.app',
    messagingSenderId: '1019379048263',
    appId: '1:1019379048263:web:dbc23e7daa27d192e93662',
    measurementId: 'G-0G4FJZKWS7',
};

export const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firestore: Firestore = getFirestore(firebaseApp);
export const firebaseAuth: Auth = getAuth(firebaseApp);

// Analytics requires a browser context with cookies/IndexedDB. In Electron
// renderer this usually works, but in some Node-only contexts (preload, tests)
// it fails. Lazy-load it.
let analytics: Analytics | null = null;
export async function getFirebaseAnalytics(): Promise<Analytics | null> {
    if (analytics) return analytics;
    try {
        if (await analyticsSupported()) {
            analytics = getAnalytics(firebaseApp);
        }
    } catch {
        analytics = null;
    }
    return analytics;
}

let currentUser: User | null = null;
const userListeners = new Set<(user: User | null) => void>();

onAuthStateChanged(firebaseAuth, (user) => {
    currentUser = user;
    userListeners.forEach((cb) => cb(user));
});

export function getCurrentUser(): User | null {
    return currentUser;
}

export function subscribeUser(cb: (user: User | null) => void): () => void {
    userListeners.add(cb);
    cb(currentUser);
    return () => userListeners.delete(cb);
}

let signInPromise: Promise<User> | null = null;

export function ensureSignedIn(): Promise<User> {
    if (currentUser) return Promise.resolve(currentUser);
    if (signInPromise) return signInPromise;
    signInPromise = signInAnonymously(firebaseAuth)
        .then((cred) => {
            currentUser = cred.user;
            return cred.user;
        })
        .finally(() => {
            signInPromise = null;
        });
    return signInPromise;
}
