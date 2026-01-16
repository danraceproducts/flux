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
  quotes?: Quote[];
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

// ============ Quote Types ============

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export const QUOTE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected', 'expired'];

export const QUOTE_STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#6b7280' },
  sent: { label: 'Sent', color: '#3b82f6' },
  accepted: { label: 'Accepted', color: '#22c55e' },
  rejected: { label: 'Rejected', color: '#ef4444' },
  expired: { label: 'Expired', color: '#f59e0b' },
};

// Quote line item - links to a product
export type QuoteLineItem = {
  id: string;
  productId: string;
  productSku: string;              // Denormalized for display
  productName: string;             // Denormalized for display
  quantity: number;
  unitPrice: number;               // Price per unit (can override product price)
  discount: number;                // Discount percentage (0-100)
  lineTotal: number;               // Calculated: quantity * unitPrice * (1 - discount/100)
};

// Quote represents a sales quote for a customer
export type Quote = {
  id: string;
  quoteNumber: string;             // "Q-2026-0001"

  // Customer link
  customerId: string;
  customerName: string;            // Denormalized for display

  // Line items
  lineItems: QuoteLineItem[];

  // Totals
  subtotal: number;                // Sum of line totals
  taxRate: number;                 // Tax percentage (default 10 for GST)
  taxAmount: number;               // Calculated: subtotal * taxRate/100
  total: number;                   // subtotal + taxAmount

  // Status
  status: QuoteStatus;

  // Dates
  issueDate: string;
  validUntil: string;              // Expiry date

  // Notes
  notes?: string;
  terms?: string;                  // Terms and conditions

  // Metadata
  createdAt: string;
  updatedAt: string;
};

export type CreateQuoteLineItemInput = {
  productId: string;
  quantity: number;
  unitPrice?: number;              // Optional - defaults to product sellPrice
  discount?: number;               // Optional - defaults to 0
};

export type CreateQuoteInput = {
  customerId: string;
  lineItems: CreateQuoteLineItemInput[];
  taxRate?: number;                // Defaults to 10 (GST)
  validDays?: number;              // Days until expiry (default 30)
  notes?: string;
  terms?: string;
  status?: QuoteStatus;
};

export type UpdateQuoteInput = {
  customerId?: string;
  lineItems?: CreateQuoteLineItemInput[];
  taxRate?: number;
  validUntil?: string;
  notes?: string;
  terms?: string;
  status?: QuoteStatus;
};

export type QuoteFilters = {
  customerId?: string;
  status?: QuoteStatus;
  search?: string;                 // Search quote number, customer name
  fromDate?: string;
  toDate?: string;
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
  | 'customer.deleted'
  | 'quote.created'
  | 'quote.updated'
  | 'quote.deleted'
  | 'quote.status_changed';

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
  'quote.created',
  'quote.updated',
  'quote.deleted',
  'quote.status_changed',
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
  'quote.created': 'Quote Created',
  'quote.updated': 'Quote Updated',
  'quote.deleted': 'Quote Deleted',
  'quote.status_changed': 'Quote Status Changed',
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
    quote?: Quote;
    previous?: Partial<Project | Epic | Task | Product | Customer | Quote>; // For update events
  };
};

// Store is the JSON document root - updated to include webhooks
export type StoreWithWebhooks = Store & {
  webhooks?: Webhook[];
  webhook_deliveries?: WebhookDelivery[];
};
