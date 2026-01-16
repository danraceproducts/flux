import type { Task, Epic, Project, Store, Webhook, WebhookDelivery, WebhookEventType, WebhookPayload, StoreWithWebhooks, Product, CreateProductInput, UpdateProductInput, ProductFilters, Customer, CreateCustomerInput, UpdateCustomerInput, CustomerFilters } from './types.js';

// Storage adapter interface - can be localStorage or file-based
export interface StorageAdapter {
  read(): void;
  write(): void;
  data: Store;
}

let db: StorageAdapter;

// Generate a short unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Set the storage adapter (called once at app startup)
export function setStorageAdapter(adapter: StorageAdapter): void {
  db = adapter;
}

// Get current storage adapter
export function getStorageAdapter(): StorageAdapter {
  return db;
}

// Initialize the store
export function initStore(): Store {
  if (!db) throw new Error('Storage adapter not set. Call setStorageAdapter first.');
  db.read();

  // Migrate from old single-project structure if needed
  const data = db.data as any;
  if (!Array.isArray(data.projects)) {
    data.projects = [];
    // Migrate old project if it exists
    if (data.project) {
      const oldProject = data.project;
      data.projects.push(oldProject);
      // Update tasks and epics with project_id
      if (Array.isArray(data.tasks)) {
        data.tasks.forEach((t: any) => { t.project_id = oldProject.id; });
      }
      if (Array.isArray(data.epics)) {
        data.epics.forEach((e: any) => { e.project_id = oldProject.id; });
      }
      delete data.project;
      db.write();
    }
  }

  // Ensure arrays exist
  if (!Array.isArray(data.tasks)) data.tasks = [];
  if (!Array.isArray(data.epics)) data.epics = [];
  if (!Array.isArray(data.products)) data.products = [];
  if (!Array.isArray(data.customers)) data.customers = [];

  return db.data;
}

// ============ Project Operations ============

export function getProjects(): Project[] {
  return [...(db.data.projects || [])];
}

export function getProject(id: string): Project | undefined {
  return (db.data.projects || []).find(p => p.id === id);
}

export function createProject(name: string, description?: string): Project {
  const project: Project = {
    id: generateId(),
    name,
    description,
  };
  if (!db.data.projects) db.data.projects = [];
  db.data.projects.push(project);
  db.write();
  return project;
}

export function updateProject(id: string, updates: Partial<Omit<Project, 'id'>>): Project | undefined {
  const index = db.data.projects.findIndex(p => p.id === id);
  if (index === -1) return undefined;
  db.data.projects[index] = { ...db.data.projects[index], ...updates };
  db.write();
  return db.data.projects[index];
}

export function deleteProject(id: string): void {
  const index = db.data.projects.findIndex(p => p.id === id);
  if (index === -1) return;
  db.data.projects.splice(index, 1);
  // Remove all epics and tasks for this project
  db.data.epics = db.data.epics.filter(e => e.project_id !== id);
  db.data.tasks = db.data.tasks.filter(t => t.project_id !== id);
  db.write();
}

export function getProjectStats(projectId: string): { total: number; done: number } {
  const tasks = db.data.tasks.filter(t => t.project_id === projectId && !t.archived);
  return {
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
  };
}

// ============ Epic Operations ============

export function getEpics(projectId: string): Epic[] {
  return [...db.data.epics.filter(e => e.project_id === projectId)];
}

export function getAllEpics(): Epic[] {
  return [...db.data.epics];
}

export function getEpic(id: string): Epic | undefined {
  return db.data.epics.find(e => e.id === id);
}

export function createEpic(projectId: string, title: string, notes: string = ''): Epic {
  const epic: Epic = {
    id: generateId(),
    title,
    status: 'planning',
    depends_on: [],
    notes,
    project_id: projectId,
  };
  db.data.epics.push(epic);
  db.write();
  return epic;
}

export function updateEpic(id: string, updates: Partial<Omit<Epic, 'id'>>): Epic | undefined {
  const index = db.data.epics.findIndex(e => e.id === id);
  if (index === -1) return undefined;
  db.data.epics[index] = { ...db.data.epics[index], ...updates };
  db.write();
  return db.data.epics[index];
}

export function deleteEpic(id: string): boolean {
  const index = db.data.epics.findIndex(e => e.id === id);
  if (index === -1) return false;
  db.data.epics.splice(index, 1);
  // Remove epic_id from tasks that belonged to this epic
  db.data.tasks.forEach(task => {
    if (task.epic_id === id) {
      task.epic_id = undefined;
    }
  });
  db.write();
  return true;
}

// ============ Task Operations ============

export function getTasks(projectId: string): Task[] {
  return [...db.data.tasks.filter(t => t.project_id === projectId && !t.archived)];
}

export function getAllTasks(): Task[] {
  return [...db.data.tasks];
}

export function getTask(id: string): Task | undefined {
  return db.data.tasks.find(t => t.id === id);
}

export function getTasksByEpic(projectId: string, epicId: string | undefined): Task[] {
  return db.data.tasks.filter(t => t.project_id === projectId && t.epic_id === epicId);
}

export function getTasksByStatus(projectId: string, status: string): Task[] {
  return db.data.tasks.filter(t => t.project_id === projectId && t.status === status);
}

export function createTask(
  projectId: string,
  title: string,
  epicId?: string,
  notes: string = ''
): Task {
  const task: Task = {
    id: generateId(),
    title,
    status: 'planning',
    depends_on: [],
    notes,
    epic_id: epicId,
    project_id: projectId,
  };
  db.data.tasks.push(task);
  db.write();
  return task;
}

export function updateTask(id: string, updates: Partial<Omit<Task, 'id'>>): Task | undefined {
  const index = db.data.tasks.findIndex(t => t.id === id);
  if (index === -1) return undefined;
  db.data.tasks[index] = { ...db.data.tasks[index], ...updates };
  db.write();
  return db.data.tasks[index];
}

export function deleteTask(id: string): boolean {
  const index = db.data.tasks.findIndex(t => t.id === id);
  if (index === -1) return false;
  db.data.tasks.splice(index, 1);
  // Remove this task from any depends_on arrays
  db.data.tasks.forEach(task => {
    const depIndex = task.depends_on.indexOf(id);
    if (depIndex !== -1) {
      task.depends_on.splice(depIndex, 1);
    }
  });
  db.write();
  return true;
}

// ============ Dependency Operations ============

export function addDependency(taskId: string, dependsOnId: string): boolean {
  const task = db.data.tasks.find(t => t.id === taskId);
  if (!task) return false;
  if (task.depends_on.includes(dependsOnId)) return true;
  task.depends_on.push(dependsOnId);
  db.write();
  return true;
}

export function removeDependency(taskId: string, dependsOnId: string): boolean {
  const task = db.data.tasks.find(t => t.id === taskId);
  if (!task) return false;
  const index = task.depends_on.indexOf(dependsOnId);
  if (index === -1) return false;
  task.depends_on.splice(index, 1);
  db.write();
  return true;
}

export function isTaskBlocked(taskId: string): boolean {
  const task = db.data.tasks.find(t => t.id === taskId);
  if (!task || task.depends_on.length === 0) return false;
  return task.depends_on.some(depId => {
    const dep = db.data.tasks.find(t => t.id === depId);
    return dep && dep.status !== 'done';
  });
}

// ============ Archive Operations ============

export function archiveDoneTasks(projectId: string): number {
  let count = 0;
  db.data.tasks.forEach(task => {
    if (task.project_id === projectId && task.status === 'done' && !task.archived) {
      task.archived = true;
      count++;
    }
  });
  if (count > 0) {
    db.write();
  }
  return count;
}

export function archiveEmptyEpics(projectId: string): number {
  let count = 0;
  const epicIdsToDelete: string[] = [];

  db.data.epics.forEach(epic => {
    if (epic.project_id === projectId) {
      // Check if epic has any non-archived tasks
      const hasActiveTasks = db.data.tasks.some(
        task => task.epic_id === epic.id && !task.archived
      );
      if (!hasActiveTasks) {
        epicIdsToDelete.push(epic.id);
        count++;
      }
    }
  });

  if (epicIdsToDelete.length > 0) {
    db.data.epics = db.data.epics.filter(e => !epicIdsToDelete.includes(e.id));
    db.write();
  }

  return count;
}

export function cleanupProject(projectId: string, archiveTasks: boolean, archiveEpics: boolean): { archivedTasks: number; deletedEpics: number } {
  let archivedTasks = 0;
  let deletedEpics = 0;

  if (archiveTasks) {
    archivedTasks = archiveDoneTasks(projectId);
  }

  if (archiveEpics) {
    deletedEpics = archiveEmptyEpics(projectId);
  }

  return { archivedTasks, deletedEpics };
}

// ============ Webhook Operations ============

// Get typed data accessor
function getWebhookData(): StoreWithWebhooks {
  return db.data as StoreWithWebhooks;
}

// Ensure webhooks arrays exist
function ensureWebhooksArrays(): void {
  const data = getWebhookData();
  if (!data.webhooks) data.webhooks = [];
  if (!data.webhook_deliveries) data.webhook_deliveries = [];
}

export function getWebhooks(): Webhook[] {
  ensureWebhooksArrays();
  return [...(getWebhookData().webhooks || [])];
}

export function getWebhook(id: string): Webhook | undefined {
  ensureWebhooksArrays();
  return getWebhookData().webhooks?.find(w => w.id === id);
}

export function getWebhooksByProject(projectId: string): Webhook[] {
  ensureWebhooksArrays();
  return (getWebhookData().webhooks || []).filter(
    w => !w.project_id || w.project_id === projectId
  );
}

export function createWebhook(
  name: string,
  url: string,
  events: WebhookEventType[],
  options?: { secret?: string; project_id?: string; enabled?: boolean }
): Webhook {
  ensureWebhooksArrays();
  const now = new Date().toISOString();
  const webhook: Webhook = {
    id: generateId(),
    name,
    url,
    events,
    enabled: options?.enabled ?? true,
    secret: options?.secret,
    project_id: options?.project_id,
    created_at: now,
    updated_at: now,
  };
  getWebhookData().webhooks!.push(webhook);
  db.write();
  return webhook;
}

export function updateWebhook(
  id: string,
  updates: Partial<Omit<Webhook, 'id' | 'created_at'>>
): Webhook | undefined {
  ensureWebhooksArrays();
  const webhooks = getWebhookData().webhooks!;
  const index = webhooks.findIndex(w => w.id === id);
  if (index === -1) return undefined;
  webhooks[index] = {
    ...webhooks[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  db.write();
  return webhooks[index];
}

export function deleteWebhook(id: string): boolean {
  ensureWebhooksArrays();
  const data = getWebhookData();
  const index = data.webhooks!.findIndex(w => w.id === id);
  if (index === -1) return false;
  data.webhooks!.splice(index, 1);
  // Also remove any delivery records for this webhook
  data.webhook_deliveries = data.webhook_deliveries!.filter(d => d.webhook_id !== id);
  db.write();
  return true;
}

export function testWebhook(id: string): Webhook | undefined {
  return getWebhook(id);
}

// ============ Webhook Delivery Operations ============

export function getWebhookDeliveries(webhookId?: string, limit: number = 50): WebhookDelivery[] {
  ensureWebhooksArrays();
  let deliveries = [...(getWebhookData().webhook_deliveries || [])];
  if (webhookId) {
    deliveries = deliveries.filter(d => d.webhook_id === webhookId);
  }
  // Sort by created_at descending (most recent first)
  deliveries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return deliveries.slice(0, limit);
}

export function createWebhookDelivery(
  webhookId: string,
  event: WebhookEventType,
  payload: WebhookPayload
): WebhookDelivery {
  ensureWebhooksArrays();
  const delivery: WebhookDelivery = {
    id: generateId(),
    webhook_id: webhookId,
    event,
    payload,
    status: 'pending',
    attempts: 0,
    created_at: new Date().toISOString(),
  };
  getWebhookData().webhook_deliveries!.push(delivery);
  db.write();
  return delivery;
}

export function updateWebhookDelivery(
  id: string,
  updates: Partial<Omit<WebhookDelivery, 'id' | 'webhook_id' | 'event' | 'payload' | 'created_at'>>
): WebhookDelivery | undefined {
  ensureWebhooksArrays();
  const deliveries = getWebhookData().webhook_deliveries!;
  const index = deliveries.findIndex(d => d.id === id);
  if (index === -1) return undefined;
  deliveries[index] = { ...deliveries[index], ...updates };
  db.write();
  return deliveries[index];
}

export function cleanupOldDeliveries(maxAge: number = 7 * 24 * 60 * 60 * 1000): number {
  ensureWebhooksArrays();
  const data = getWebhookData();
  const cutoff = new Date(Date.now() - maxAge).toISOString();
  const originalCount = data.webhook_deliveries!.length;
  data.webhook_deliveries = data.webhook_deliveries!.filter(d => d.created_at > cutoff);
  const removed = originalCount - data.webhook_deliveries.length;
  if (removed > 0) {
    db.write();
  }
  return removed;
}

// ============ Webhook Triggering ============

// Webhook event handler type
export type WebhookEventHandler = (
  event: WebhookEventType,
  payload: WebhookPayload,
  webhook: Webhook
) => Promise<void>;

// Global webhook event handler (set by server)
let webhookEventHandler: WebhookEventHandler | null = null;

export function setWebhookEventHandler(handler: WebhookEventHandler | null): void {
  webhookEventHandler = handler;
}

export function getWebhookEventHandler(): WebhookEventHandler | null {
  return webhookEventHandler;
}

// Trigger webhooks for an event
export async function triggerWebhooks(
  event: WebhookEventType,
  data: WebhookPayload['data'],
  projectId?: string
): Promise<void> {
  if (!webhookEventHandler) return;

  ensureWebhooksArrays();
  const webhooks = getWebhookData().webhooks || [];

  // Find matching webhooks
  const matchingWebhooks = webhooks.filter(w => {
    if (!w.enabled) return false;
    if (!w.events.includes(event)) return false;
    if (w.project_id && projectId && w.project_id !== projectId) return false;
    return true;
  });

  // Trigger each webhook
  for (const webhook of matchingWebhooks) {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      webhook_id: webhook.id,
      data,
    };

    try {
      await webhookEventHandler(event, payload, webhook);
    } catch (error) {
      console.error(`Failed to trigger webhook ${webhook.id}:`, error);
    }
  }
}

// ============ Product Operations ============

// Ensure products array exists
function ensureProductsArray(): void {
  if (!db.data.products) db.data.products = [];
}

export function getProducts(): Product[] {
  ensureProductsArray();
  return [...(db.data.products || [])];
}

export function listProducts(filters?: ProductFilters): Product[] {
  ensureProductsArray();
  let products = [...(db.data.products || [])];

  if (filters) {
    if (filters.category) {
      products = products.filter(p => p.category.toLowerCase() === filters.category!.toLowerCase());
    }
    if (filters.brand) {
      products = products.filter(p => p.brand.toLowerCase() === filters.brand!.toLowerCase());
    }
    if (filters.isActive !== undefined) {
      products = products.filter(p => p.isActive === filters.isActive);
    }
    if (filters.minPrice !== undefined) {
      products = products.filter(p => p.sellPrice >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      products = products.filter(p => p.sellPrice <= filters.maxPrice!);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      products = products.filter(p =>
        p.sku.toLowerCase().includes(searchLower) ||
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower) ||
        p.fitment.some(f => f.toLowerCase().includes(searchLower))
      );
    }
  }

  return products;
}

export function getProduct(id: string): Product | undefined {
  ensureProductsArray();
  return db.data.products?.find(p => p.id === id);
}

export function getProductBySku(sku: string): Product | undefined {
  ensureProductsArray();
  return db.data.products?.find(p => p.sku.toLowerCase() === sku.toLowerCase());
}

export function createProduct(input: CreateProductInput): Product {
  ensureProductsArray();
  const now = new Date().toISOString();
  const product: Product = {
    id: generateId(),
    sku: input.sku,
    name: input.name,
    category: input.category,
    subcategory: input.subcategory || '',
    brand: input.brand || '',
    costPrice: input.costPrice || 0,
    sellPrice: input.sellPrice,
    currency: input.currency || 'AUD',
    description: input.description || '',
    fitment: input.fitment || [],
    isActive: input.isActive !== undefined ? input.isActive : true,
    createdAt: now,
    updatedAt: now,
  };
  db.data.products!.push(product);
  db.write();
  return product;
}

export function updateProduct(id: string, input: UpdateProductInput): Product | undefined {
  ensureProductsArray();
  const index = db.data.products!.findIndex(p => p.id === id);
  if (index === -1) return undefined;

  const product = db.data.products![index];
  const updated: Product = {
    ...product,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  db.data.products![index] = updated;
  db.write();
  return updated;
}

export function deleteProduct(id: string): boolean {
  ensureProductsArray();
  const index = db.data.products!.findIndex(p => p.id === id);
  if (index === -1) return false;

  // Soft delete - set isActive to false
  db.data.products![index].isActive = false;
  db.data.products![index].updatedAt = new Date().toISOString();
  db.write();
  return true;
}

export function hardDeleteProduct(id: string): boolean {
  ensureProductsArray();
  const index = db.data.products!.findIndex(p => p.id === id);
  if (index === -1) return false;

  db.data.products!.splice(index, 1);
  db.write();
  return true;
}

export function getProductCategories(): string[] {
  ensureProductsArray();
  const categories = new Set<string>();
  for (const product of db.data.products || []) {
    if (product.category) {
      categories.add(product.category);
    }
  }
  return [...categories].sort();
}

export function getProductBrands(): string[] {
  ensureProductsArray();
  const brands = new Set<string>();
  for (const product of db.data.products || []) {
    if (product.brand) {
      brands.add(product.brand);
    }
  }
  return [...brands].sort();
}

export function searchProducts(query: string): Product[] {
  ensureProductsArray();
  const searchLower = query.toLowerCase();
  return (db.data.products || []).filter(p =>
    p.sku.toLowerCase().includes(searchLower) ||
    p.name.toLowerCase().includes(searchLower) ||
    p.description.toLowerCase().includes(searchLower) ||
    p.fitment.some(f => f.toLowerCase().includes(searchLower))
  );
}

// ============ Customer Operations ============

// Ensure customers array exists
function ensureCustomersArray(): void {
  if (!db.data.customers) db.data.customers = [];
}

export function getCustomers(): Customer[] {
  ensureCustomersArray();
  return [...(db.data.customers || [])];
}

export function listCustomers(filters?: CustomerFilters): Customer[] {
  ensureCustomersArray();
  let customers = [...(db.data.customers || [])];

  if (filters) {
    if (filters.type) {
      customers = customers.filter(c => c.type === filters.type);
    }
    if (filters.tag) {
      customers = customers.filter(c => c.tags?.includes(filters.tag!));
    }
    if (filters.source) {
      customers = customers.filter(c => c.source?.toLowerCase() === filters.source!.toLowerCase());
    }
    if (filters.isActive !== undefined) {
      customers = customers.filter(c => c.isActive === filters.isActive);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      customers = customers.filter(c =>
        c.name.toLowerCase().includes(searchLower) ||
        c.contactName?.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower) ||
        c.phone?.toLowerCase().includes(searchLower) ||
        c.mobile?.toLowerCase().includes(searchLower) ||
        c.notes?.toLowerCase().includes(searchLower)
      );
    }
  }

  return customers;
}

export function getCustomer(id: string): Customer | undefined {
  ensureCustomersArray();
  return db.data.customers?.find(c => c.id === id);
}

export function getCustomerByEmail(email: string): Customer | undefined {
  ensureCustomersArray();
  return db.data.customers?.find(c => c.email?.toLowerCase() === email.toLowerCase());
}

export function createCustomer(input: CreateCustomerInput): Customer {
  ensureCustomersArray();
  const now = new Date().toISOString();
  const customer: Customer = {
    id: generateId(),
    type: input.type,
    name: input.name,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    mobile: input.mobile,
    address: input.address,
    abn: input.abn,
    tags: input.tags || [],
    source: input.source,
    notes: input.notes,
    isActive: input.isActive !== undefined ? input.isActive : true,
    createdAt: now,
    updatedAt: now,
  };
  db.data.customers!.push(customer);
  db.write();
  return customer;
}

export function updateCustomer(id: string, input: UpdateCustomerInput): Customer | undefined {
  ensureCustomersArray();
  const index = db.data.customers!.findIndex(c => c.id === id);
  if (index === -1) return undefined;

  const customer = db.data.customers![index];
  const updated: Customer = {
    ...customer,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  db.data.customers![index] = updated;
  db.write();
  return updated;
}

export function deleteCustomer(id: string): boolean {
  ensureCustomersArray();
  const index = db.data.customers!.findIndex(c => c.id === id);
  if (index === -1) return false;

  // Soft delete - set isActive to false
  db.data.customers![index].isActive = false;
  db.data.customers![index].updatedAt = new Date().toISOString();
  db.write();
  return true;
}

export function hardDeleteCustomer(id: string): boolean {
  ensureCustomersArray();
  const index = db.data.customers!.findIndex(c => c.id === id);
  if (index === -1) return false;

  db.data.customers!.splice(index, 1);
  db.write();
  return true;
}

export function getCustomerTags(): string[] {
  ensureCustomersArray();
  const tags = new Set<string>();
  for (const customer of db.data.customers || []) {
    for (const tag of customer.tags || []) {
      tags.add(tag);
    }
  }
  return [...tags].sort();
}

export function getCustomerSources(): string[] {
  ensureCustomersArray();
  const sources = new Set<string>();
  for (const customer of db.data.customers || []) {
    if (customer.source) {
      sources.add(customer.source);
    }
  }
  return [...sources].sort();
}

export function searchCustomers(query: string): Customer[] {
  ensureCustomersArray();
  const searchLower = query.toLowerCase();
  return (db.data.customers || []).filter(c =>
    c.name.toLowerCase().includes(searchLower) ||
    c.contactName?.toLowerCase().includes(searchLower) ||
    c.email?.toLowerCase().includes(searchLower) ||
    c.phone?.toLowerCase().includes(searchLower) ||
    c.mobile?.toLowerCase().includes(searchLower) ||
    c.notes?.toLowerCase().includes(searchLower)
  );
}
