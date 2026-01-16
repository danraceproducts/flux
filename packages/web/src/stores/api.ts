import type { Task, Epic, Project, Webhook, WebhookDelivery, WebhookEventType, Product, CreateProductInput, UpdateProductInput, ProductFilters, Customer, CreateCustomerInput, UpdateCustomerInput, CustomerFilters } from '@flux/shared';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

// Project with stats from API
export interface ProjectWithStats extends Project {
  stats: { total: number; done: number };
}

// Task with blocked status from API
export interface TaskWithBlocked extends Task {
  blocked: boolean;
}

// ============ Project Operations ============

export async function getProjects(): Promise<ProjectWithStats[]> {
  const res = await fetch(`${API_BASE}/projects`);
  return res.json();
}

export async function getProject(id: string): Promise<ProjectWithStats | null> {
  const res = await fetch(`${API_BASE}/projects/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createProject(name: string, description?: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  return res.json();
}

export async function updateProject(id: string, updates: Partial<Omit<Project, 'id'>>): Promise<Project | null> {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
}

// ============ Epic Operations ============

export async function getEpics(projectId: string): Promise<Epic[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/epics`);
  return res.json();
}

export async function getEpic(id: string): Promise<Epic | null> {
  const res = await fetch(`${API_BASE}/epics/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createEpic(projectId: string, title: string, notes?: string): Promise<Epic> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/epics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, notes }),
  });
  return res.json();
}

export async function updateEpic(id: string, updates: Partial<Omit<Epic, 'id'>>): Promise<Epic | null> {
  const res = await fetch(`${API_BASE}/epics/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteEpic(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/epics/${id}`, { method: 'DELETE' });
  return res.ok;
}

// ============ Task Operations ============

export async function getTasks(projectId: string): Promise<TaskWithBlocked[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/tasks`);
  return res.json();
}

export async function getTask(id: string): Promise<TaskWithBlocked | null> {
  const res = await fetch(`${API_BASE}/tasks/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createTask(
  projectId: string,
  title: string,
  epicId?: string,
  notes?: string
): Promise<Task> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, epic_id: epicId, notes }),
  });
  return res.json();
}

export async function updateTask(id: string, updates: Partial<Omit<Task, 'id'>>): Promise<TaskWithBlocked | null> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteTask(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function cleanupProject(
  projectId: string,
  archiveTasks: boolean,
  archiveEpics: boolean
): Promise<{ success: boolean; archivedTasks: number; deletedEpics: number }> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/cleanup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ archiveTasks, archiveEpics }),
  });
  return res.json();
}

// ============ Webhook Operations ============

export async function getWebhooks(): Promise<Webhook[]> {
  const res = await fetch(`${API_BASE}/webhooks`);
  return res.json();
}

export async function getWebhook(id: string): Promise<Webhook | null> {
  const res = await fetch(`${API_BASE}/webhooks/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createWebhook(
  name: string,
  url: string,
  events: WebhookEventType[],
  options?: { secret?: string; project_id?: string; enabled?: boolean }
): Promise<Webhook> {
  const res = await fetch(`${API_BASE}/webhooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, url, events, ...options }),
  });
  return res.json();
}

export async function updateWebhook(
  id: string,
  updates: Partial<Omit<Webhook, 'id' | 'created_at'>>
): Promise<Webhook | null> {
  const res = await fetch(`${API_BASE}/webhooks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteWebhook(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/webhooks/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function testWebhook(id: string): Promise<{
  success: boolean;
  status_code?: number;
  response?: string;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/webhooks/${id}/test`, { method: 'POST' });
  return res.json();
}

export async function getWebhookDeliveries(webhookId: string, limit: number = 50): Promise<WebhookDelivery[]> {
  const res = await fetch(`${API_BASE}/webhooks/${webhookId}/deliveries?limit=${limit}`);
  return res.json();
}

// ============ Product Operations ============

export async function getProducts(filters?: ProductFilters): Promise<Product[]> {
  const params = new URLSearchParams();
  if (filters?.category) params.append('category', filters.category);
  if (filters?.brand) params.append('brand', filters.brand);
  if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
  if (filters?.search) params.append('search', filters.search);
  if (filters?.minPrice !== undefined) params.append('minPrice', String(filters.minPrice));
  if (filters?.maxPrice !== undefined) params.append('maxPrice', String(filters.maxPrice));

  const queryString = params.toString();
  const url = queryString ? `${API_BASE}/products?${queryString}` : `${API_BASE}/products`;
  const res = await fetch(url);
  return res.json();
}

export async function getProduct(id: string): Promise<Product | null> {
  const res = await fetch(`${API_BASE}/products/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const res = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create product');
  }
  return res.json();
}

export async function updateProduct(
  id: string,
  updates: UpdateProductInput
): Promise<Product | null> {
  const res = await fetch(`${API_BASE}/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update product');
  }
  return res.json();
}

export async function deleteProduct(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function getProductCategories(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/products/categories`);
  return res.json();
}

export async function getProductBrands(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/products/brands`);
  return res.json();
}

// ============ Customer Operations ============

export async function getCustomers(filters?: CustomerFilters): Promise<Customer[]> {
  const params = new URLSearchParams();
  if (filters?.type) params.append('type', filters.type);
  if (filters?.tag) params.append('tag', filters.tag);
  if (filters?.source) params.append('source', filters.source);
  if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
  if (filters?.search) params.append('search', filters.search);

  const queryString = params.toString();
  const url = queryString ? `${API_BASE}/customers?${queryString}` : `${API_BASE}/customers`;
  const res = await fetch(url);
  return res.json();
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const res = await fetch(`${API_BASE}/customers/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const res = await fetch(`${API_BASE}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create customer');
  }
  return res.json();
}

export async function updateCustomer(
  id: string,
  updates: UpdateCustomerInput
): Promise<Customer | null> {
  const res = await fetch(`${API_BASE}/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update customer');
  }
  return res.json();
}

export async function deleteCustomer(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/customers/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function getCustomerTags(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/customers/tags`);
  return res.json();
}

export async function getCustomerSources(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/customers/sources`);
  return res.json();
}
