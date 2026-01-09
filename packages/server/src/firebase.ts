import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let app: App | null = null;
let firestore: Firestore | null = null;

/**
 * Initialize Firebase Admin SDK
 * Supports multiple initialization methods:
 * 1. Service Account JSON (FIREBASE_SERVICE_ACCOUNT env var)
 * 2. Service Account JSON file path (FIREBASE_SERVICE_ACCOUNT_PATH env var)
 * 3. Default Application Credentials (when running on GCP)
 */
export function initializeFirebase(): Firestore {
  // Check if already initialized
  if (firestore) {
    return firestore;
  }

  // Check if app is already initialized (by another part of the application)
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
    firestore = getFirestore(app);
    return firestore;
  }

  try {
    // Method 1: Service Account JSON string from environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        app = initializeApp({
          credential: cert(serviceAccount),
        });
        console.log('Firebase initialized with service account from env var');
      } catch (error) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', error);
        throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON');
      }
    }
    // Method 2: Service Account JSON file path
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      app = initializeApp({
        credential: cert(process.env.FIREBASE_SERVICE_ACCOUNT_PATH),
      });
      console.log('Firebase initialized with service account from file path');
    }
    // Method 3: Default Application Credentials (for GCP deployment)
    else {
      app = initializeApp();
      console.log('Firebase initialized with default credentials');
    }

    firestore = getFirestore(app);

    // Set Firestore settings
    firestore.settings({
      ignoreUndefinedProperties: true,
    });

    return firestore;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw new Error('Firebase initialization failed. Please check your credentials.');
  }
}

/**
 * Get the Firestore instance (must call initializeFirebase first)
 */
export function getFirestoreInstance(): Firestore {
  if (!firestore) {
    throw new Error('Firestore not initialized. Call initializeFirebase() first.');
  }
  return firestore;
}

/**
 * Check if Firebase is configured
 */
export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}
