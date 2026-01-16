// Agent options for tasks
export type Agent = 'claude' | 'codex' | 'gemini' | 'other';

export const AGENTS: Agent[] = ['claude', 'codex', 'gemini', 'other'];

export const AGENT_CONFIG: Record<Agent, { label: string }> = {
  claude: { label: 'Claude' },
  codex: { label: 'Codex' },
  gemini: { label: 'Gemini' },
  other: { label: 'Other' },
};

// Task represents a single work item.
export type Task = {
  id: string;
  title: string;
  status: string; // e.g. "todo" | "in_progress" | "done"
  depends_on: string[];
  notes: string;
  epic_id?: string;
  project_id: string;
  agent?: Agent; // Optional agent assignment
  archived?: boolean; // Whether the task is archived
};

// Epic represents a grouped set of tasks.
export type Epic = {
  id: string;
  title: string;
  status: string;
  depends_on: string[];
  notes: string;
  project_id: string;
};

// Project represents a Kanban project.
export type Project = {
  id: string;
  name: string;
  description?: string;
};

// Store is the JSON document root.
export type Store = {
  projects: Project[];
  epics: Epic[];
  tasks: Task[];
  products?: Product[];
  customers?: Customer[];
};

// ============ Product Types ============

// Product represents a product in the catalog
export type Product = {
  id: string;
  sku: string;                     // "BK-WIL-001"
  name: string;                    // "Wilwood 6-Pot Brake Kit - Front"

  // Classification
  category: string;                // "Brakes", "Suspension", "Drivetrain"
  subcategory: string;             // "Brake Kits", "Calipers", "Rotors"
  brand: string;                   // "Race Products", "Wilwood", "Eibach"

  // Pricing (AUD)
  costPrice: number;               // What we pay
  sellPrice: number;               // List price
  currency: string;                // Default "AUD"

  // Details
  description: string;
  fitment: string[];               // ["Nissan Patrol Y62", "Toyota LC200"]

  // Status
  isActive: boolean;

  // Metadata
  createdAt: string;
  updatedAt: string;
};

export type CreateProductInput = {
  sku: string;
  name: string;
  category: string;
  subcategory?: string;
  brand?: string;
  costPrice?: number;
  sellPrice: number;
  currency?: string;
  description?: string;
  fitment?: string[];
  isActive?: boolean;
};

export type UpdateProductInput = {
  sku?: string;
  name?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  costPrice?: number;
  sellPrice?: number;
  description?: string;
  fitment?: string[];
  isActive?: boolean;
};

export type ProductFilters = {
  category?: string;
  brand?: string;
  isActive?: boolean;
  search?: string;                 // Search sku, name, fitment
  minPrice?: number;
  maxPrice?: number;
};

// ============ Customer Types ============

// Customer represents a customer/contact in the CRM
export type Customer = {
  id: string;

  // Basic info
  type: 'individual' | 'business';
  name: string;                    // Full name or business name
  contactName?: string;            // Primary contact (for businesses)

  // Contact details
  email?: string;
  phone?: string;
  mobile?: string;

  // Address
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };

  // Business details
  abn?: string;                    // Australian Business Number

  // Classification
  tags?: string[];                 // "VIP", "Trade", "Retail", etc.
  source?: string;                 // "Referral", "Website", "Walk-in"

  // Notes
  notes?: string;

  // Status
  isActive: boolean;

  // Metadata
  createdAt: string;
  updatedAt: string;
};

export type CreateCustomerInput = {
  type: 'individual' | 'business';
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  abn?: string;
  tags?: string[];
  source?: string;
  notes?: string;
  isActive?: boolean;
};

export type UpdateCustomerInput = {
  type?: 'individual' | 'business';
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  abn?: string;
  tags?: string[];
  source?: string;
  notes?: string;
  isActive?: boolean;
};

export type CustomerFilters = {
  type?: 'individual' | 'business';
  tag?: string;
  source?: string;
  isActive?: boolean;
  search?: string;                 // Search name, email, phone, notes
};

// Status columns for the Kanban board
export type Status = 'planning' | 'todo' | 'in_progress' | 'done';

export const STATUSES: Status[] = ['planning', 'todo', 'in_progress', 'done'];

// Status display names and colors
export const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  planning: { label: 'Planning', color: '#a855f7' },
  todo: { label: 'To Do', color: '#6b7280' },
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  done: { label: 'Done', color: '#22c55e' },
};

// Epic colors palette
export const EPIC_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // orange/amber
  '#8b5cf6', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

// ============ Webhook Types ============

// Webhook event types
export type WebhookEventType =
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'epic.created'
  | 'epic.updated'
  | 'epic.deleted'
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'task.status_changed'
  | 'task.archived'
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted';

export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  'project.created',
  'project.updated',
  'project.deleted',
  'epic.created',
  'epic.updated',
  'epic.deleted',
  'task.created',
  'task.updated',
  'task.deleted',
  'task.status_changed',
  'task.archived',
  'product.created',
  'product.updated',
  'product.deleted',
  'customer.created',
  'customer.updated',
  'customer.deleted',
];

// Webhook event type labels for UI
export const WEBHOOK_EVENT_LABELS: Record<WebhookEventType, string> = {
  'project.created': 'Project Created',
  'project.updated': 'Project Updated',
  'project.deleted': 'Project Deleted',
  'epic.created': 'Epic Created',
  'epic.updated': 'Epic Updated',
  'epic.deleted': 'Epic Deleted',
  'task.created': 'Task Created',
  'task.updated': 'Task Updated',
  'task.deleted': 'Task Deleted',
  'task.status_changed': 'Task Status Changed',
  'task.archived': 'Task Archived',
  'product.created': 'Product Created',
  'product.updated': 'Product Updated',
  'product.deleted': 'Product Deleted',
  'customer.created': 'Customer Created',
  'customer.updated': 'Customer Updated',
  'customer.deleted': 'Customer Deleted',
};

// Webhook configuration
export type Webhook = {
  id: string;
  name: string;
  url: string;
  secret?: string; // Optional secret for HMAC signature verification
  events: WebhookEventType[];
  enabled: boolean;
  project_id?: string; // Optional: only trigger for specific project
  created_at: string;
  updated_at: string;
};

// Webhook delivery record
export type WebhookDelivery = {
  id: string;
  webhook_id: string;
  event: WebhookEventType;
  payload: WebhookPayload;
  status: 'pending' | 'success' | 'failed';
  response_code?: number;
  response_body?: string;
  error?: string;
  attempts: number;
  created_at: string;
  delivered_at?: string;
};

// Webhook payload structure
export type WebhookPayload = {
  event: WebhookEventType;
  timestamp: string;
  webhook_id: string;
  data: {
    project?: Project;
    epic?: Epic;
    task?: Task;
    product?: Product;
    customer?: Customer;
    previous?: Partial<Project | Epic | Task | Product | Customer>; // For update events
  };
};

// Store is the JSON document root - updated to include webhooks
export type StoreWithWebhooks = Store & {
  webhooks?: Webhook[];
  webhook_deliveries?: WebhookDelivery[];
};
