import type { StorageAdapter } from './store.js';
import type { Store, StoreWithWebhooks } from './types.js';

/**
 * Firebase Firestore storage adapter for Flux
 * Uses Firestore collections for projects, epics, tasks, webhooks, and webhook_deliveries
 */
export class FirestoreAdapter implements StorageAdapter {
  data: Store;
  private db: any; // Firestore instance
  private writePromise: Promise<void> | null = null;

  constructor(firestoreDb: any) {
    this.db = firestoreDb;
    this.data = {
      projects: [],
      epics: [],
      tasks: [],
    };
  }

  /**
   * Read all data from Firestore collections into memory
   * This must be called and awaited before using the adapter
   */
  async readAsync(): Promise<void> {
    try {
      // Read projects
      const projectsSnapshot = await this.db.collection('projects').get();
      this.data.projects = projectsSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Read epics
      const epicsSnapshot = await this.db.collection('epics').get();
      this.data.epics = epicsSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Read tasks
      const tasksSnapshot = await this.db.collection('tasks').get();
      this.data.tasks = tasksSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Read webhooks (optional collections)
      try {
        const webhooksSnapshot = await this.db.collection('webhooks').get();
        (this.data as StoreWithWebhooks).webhooks = webhooksSnapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (e) {
        (this.data as StoreWithWebhooks).webhooks = [];
      }

      // Read webhook deliveries (optional collections)
      try {
        const deliveriesSnapshot = await this.db.collection('webhook_deliveries').get();
        (this.data as StoreWithWebhooks).webhook_deliveries = deliveriesSnapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (e) {
        (this.data as StoreWithWebhooks).webhook_deliveries = [];
      }
    } catch (error) {
      console.error('Error reading from Firestore:', error);
      throw error;
    }
  }

  /**
   * Synchronous read - required by interface but not used with Firebase
   * Call readAsync() instead during initialization
   */
  read(): void {
    // No-op for Firebase adapter - async read is done during initialization
  }

  /**
   * Synchronous write - triggers async write in background
   * This is called after any data modification
   */
  write(): void {
    // Trigger async write but don't wait for it (fire and forget)
    // Store the promise so we can wait for it if needed
    this.writePromise = this.writeAsync();
  }

  /**
   * Async write implementation - writes all data to Firestore
   */
  private async writeAsync(): Promise<void> {
    try {
      const batch = this.db.batch();

      // Write projects
      for (const project of this.data.projects) {
        const { id, ...data } = project;
        const ref = this.db.collection('projects').doc(id);
        batch.set(ref, data, { merge: true });
      }

      // Write epics
      for (const epic of this.data.epics) {
        const { id, ...data } = epic;
        const ref = this.db.collection('epics').doc(id);
        batch.set(ref, data, { merge: true });
      }

      // Write tasks
      for (const task of this.data.tasks) {
        const { id, ...data } = task;
        const ref = this.db.collection('tasks').doc(id);
        batch.set(ref, data, { merge: true });
      }

      // Write webhooks if they exist
      const dataWithWebhooks = this.data as StoreWithWebhooks;
      if (dataWithWebhooks.webhooks) {
        for (const webhook of dataWithWebhooks.webhooks) {
          const { id, ...data } = webhook;
          const ref = this.db.collection('webhooks').doc(id);
          batch.set(ref, data, { merge: true });
        }
      }

      // Write webhook deliveries if they exist
      if (dataWithWebhooks.webhook_deliveries) {
        for (const delivery of dataWithWebhooks.webhook_deliveries) {
          const { id, ...data } = delivery;
          const ref = this.db.collection('webhook_deliveries').doc(id);
          batch.set(ref, data, { merge: true });
        }
      }

      await batch.commit();
    } catch (error) {
      console.error('Error writing to Firestore:', error);
      throw error;
    }
  }

  /**
   * Delete a document from Firestore
   */
  async delete(collection: string, id: string): Promise<void> {
    try {
      await this.db.collection(collection).doc(id).delete();
    } catch (error) {
      console.error(`Error deleting ${collection}/${id} from Firestore:`, error);
      throw error;
    }
  }

  /**
   * Handle deletions - this is called when items are removed from arrays
   */
  async handleDeletions(
    collection: string,
    existingIds: string[],
    currentIds: string[]
  ): Promise<void> {
    const deletedIds = existingIds.filter(id => !currentIds.includes(id));
    for (const id of deletedIds) {
      await this.delete(collection, id);
    }
  }
}

/**
 * Create a Firestore adapter instance
 * Note: You must call readAsync() on the adapter before using it
 */
export function createFirestoreAdapter(firestoreDb: any): FirestoreAdapter {
  return new FirestoreAdapter(firestoreDb);
}

/**
 * Wait for any pending writes to complete
 * Useful for graceful shutdown or testing
 */
export async function flushFirestoreWrites(adapter: FirestoreAdapter): Promise<void> {
  if (adapter['writePromise']) {
    await adapter['writePromise'];
  }
}
