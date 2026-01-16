#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { existsSync, mkdirSync, writeFileSync, readFileSync, openSync, closeSync, unlinkSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setStorageAdapter,
  initStore,
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectStats,
  getEpics,
  getEpic,
  createEpic,
  updateEpic,
  deleteEpic,
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  isTaskBlocked,
  getWebhooks,
  getWebhook,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  // Product imports
  listProducts,
  getProduct,
  getProductBySku,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  // Customer imports
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  searchCustomers,
  type Store,
  STATUSES,
  WEBHOOK_EVENT_TYPES,
  type WebhookEventType,
  type CreateProductInput,
  type ProductFilters,
  type CreateCustomerInput,
  type CustomerFilters,
} from '@flux/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Data file path - shared with API server
const DATA_DIR = join(__dirname, '../../data');
const DATA_FILE = join(DATA_DIR, 'flux.json');
const LOCK_FILE = `${DATA_FILE}.lock`;
const TMP_FILE = `${DATA_FILE}.tmp`;

// Default store data
const defaultData: Store = {
  projects: [],
  epics: [],
  tasks: [],
};

// Create file-based storage adapter
function createFileAdapter(): { read: () => void; write: () => void; data: Store } {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!existsSync(DATA_FILE)) {
    writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }

  let data: Store = { ...defaultData };

  const sleep = (ms: number) => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  };

  const withFileLock = <T,>(fn: () => T): T => {
    const start = Date.now();
    while (true) {
      try {
        const fd = openSync(LOCK_FILE, 'wx');
        try {
          return fn();
        } finally {
          closeSync(fd);
          try {
            unlinkSync(LOCK_FILE);
          } catch {
            // Best-effort cleanup; stale lock handled by timeout.
          }
        }
      } catch (error: any) {
        if (error?.code !== 'EEXIST') throw error;
        if (Date.now() - start > 2000) {
          throw new Error(`Timed out waiting for data lock: ${LOCK_FILE}`);
        }
        sleep(25);
      }
    }
  };

  return {
    read() {
      withFileLock(() => {
        try {
          const content = readFileSync(DATA_FILE, 'utf-8');
          data = JSON.parse(content);
        } catch {
          data = { ...defaultData };
        }
      });
    },
    write() {
      withFileLock(() => {
        writeFileSync(TMP_FILE, JSON.stringify(data, null, 2));
        renameSync(TMP_FILE, DATA_FILE);
      });
    },
    get data() {
      return data;
    },
  };
}

// Initialize storage
const fileAdapter = createFileAdapter();
setStorageAdapter(fileAdapter);
initStore();

// Create MCP server
const server = new Server(
  {
    name: 'flux-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// ============ Resources ============

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const projects = getProjects();
  const resources = [
    {
      uri: 'flux://projects',
      name: 'All Projects',
      description: 'List of all Flux projects',
      mimeType: 'application/json',
    },
  ];

  // Add individual project resources
  for (const project of projects) {
    resources.push({
      uri: `flux://projects/${project.id}`,
      name: project.name,
      description: project.description || `Project: ${project.name}`,
      mimeType: 'application/json',
    });
    resources.push({
      uri: `flux://projects/${project.id}/epics`,
      name: `${project.name} - Epics`,
      description: `Epics in ${project.name}`,
      mimeType: 'application/json',
    });
    resources.push({
      uri: `flux://projects/${project.id}/tasks`,
      name: `${project.name} - Tasks`,
      description: `Tasks in ${project.name}`,
      mimeType: 'application/json',
    });
  }

  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  // Parse URI
  if (uri === 'flux://projects') {
    const projects = getProjects().map(p => ({
      ...p,
      stats: getProjectStats(p.id),
    }));
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(projects, null, 2),
        },
      ],
    };
  }

  // Match flux://projects/:id
  const projectMatch = uri.match(/^flux:\/\/projects\/([^/]+)$/);
  if (projectMatch) {
    const project = getProject(projectMatch[1]);
    if (!project) {
      throw new Error(`Project not found: ${projectMatch[1]}`);
    }
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ ...project, stats: getProjectStats(project.id) }, null, 2),
        },
      ],
    };
  }

  // Match flux://projects/:id/epics
  const epicsMatch = uri.match(/^flux:\/\/projects\/([^/]+)\/epics$/);
  if (epicsMatch) {
    const epics = getEpics(epicsMatch[1]);
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(epics, null, 2),
        },
      ],
    };
  }

  // Match flux://projects/:id/tasks
  const tasksMatch = uri.match(/^flux:\/\/projects\/([^/]+)\/tasks$/);
  if (tasksMatch) {
    const tasks = getTasks(tasksMatch[1]).map(t => ({
      ...t,
      blocked: isTaskBlocked(t.id),
    }));
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(tasks, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource URI: ${uri}`);
});

// ============ Tools ============

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Project tools
      {
        name: 'list_projects',
        description: 'List all Flux projects with their stats',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create_project',
        description: 'Create a new Flux project',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Project name' },
            description: { type: 'string', description: 'Optional project description' },
          },
          required: ['name'],
        },
      },
      {
        name: 'update_project',
        description: 'Update an existing project',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: 'Project ID' },
            name: { type: 'string', description: 'New project name' },
            description: { type: 'string', description: 'New project description' },
          },
          required: ['project_id'],
        },
      },
      {
        name: 'delete_project',
        description: 'Delete a project and all its epics and tasks',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: 'Project ID to delete' },
          },
          required: ['project_id'],
        },
      },

      // Epic tools
      {
        name: 'list_epics',
        description: 'List all epics in a project',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: 'Project ID' },
          },
          required: ['project_id'],
        },
      },
      {
        name: 'create_epic',
        description: 'Create a new epic in a project',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: 'Project ID' },
            title: { type: 'string', description: 'Epic title' },
            notes: { type: 'string', description: 'Optional epic notes' },
          },
          required: ['project_id', 'title'],
        },
      },
      {
        name: 'update_epic',
        description: 'Update an existing epic',
        inputSchema: {
          type: 'object',
          properties: {
            epic_id: { type: 'string', description: 'Epic ID' },
            title: { type: 'string', description: 'New epic title' },
            notes: { type: 'string', description: 'New epic notes' },
            status: {
              type: 'string',
              enum: STATUSES,
              description: 'New epic status (todo, in_progress, done)',
            },
            depends_on: {
              type: 'array',
              items: { type: 'string' },
              description: 'IDs of epics this epic depends on',
            },
          },
          required: ['epic_id'],
        },
      },
      {
        name: 'delete_epic',
        description: 'Delete an epic (tasks will become unassigned)',
        inputSchema: {
          type: 'object',
          properties: {
            epic_id: { type: 'string', description: 'Epic ID to delete' },
          },
          required: ['epic_id'],
        },
      },

      // Task tools
      {
        name: 'list_tasks',
        description: 'List all tasks in a project with their blocked status',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: 'Project ID' },
            epic_id: { type: 'string', description: 'Optional: filter by epic ID' },
            status: {
              type: 'string',
              enum: STATUSES,
              description: 'Optional: filter by status',
            },
          },
          required: ['project_id'],
        },
      },
      {
        name: 'create_task',
        description: 'Create a new task in a project',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: 'Project ID' },
            title: { type: 'string', description: 'Task title' },
            epic_id: { type: 'string', description: 'Optional: assign to epic' },
            notes: { type: 'string', description: 'Optional task notes' },
          },
          required: ['project_id', 'title'],
        },
      },
      {
        name: 'update_task',
        description: 'Update an existing task (change status, title, notes, epic, or dependencies). Note: tasks must be moved to "todo" before they can be started (moved to "in_progress").',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'string', description: 'Task ID' },
            title: { type: 'string', description: 'New task title' },
            notes: { type: 'string', description: 'New task notes' },
            status: {
              type: 'string',
              enum: STATUSES,
              description: 'New task status (planning, todo, in_progress, done). Tasks in "planning" cannot be moved directly to "in_progress".',
            },
            epic_id: { type: 'string', description: 'Assign to epic (or empty to unassign)' },
            depends_on: {
              type: 'array',
              items: { type: 'string' },
              description: 'IDs of tasks this task depends on',
            },
          },
          required: ['task_id'],
        },
      },
      {
        name: 'delete_task',
        description: 'Delete a task',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'string', description: 'Task ID to delete' },
          },
          required: ['task_id'],
        },
      },
      {
        name: 'move_task_status',
        description: 'Quickly move a task to a new status. Note: tasks must be in "todo" before they can be started (moved to "in_progress").',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'string', description: 'Task ID' },
            status: {
              type: 'string',
              enum: STATUSES,
              description: 'New status (planning, todo, in_progress, done). Tasks in "planning" cannot be moved directly to "in_progress".',
            },
          },
          required: ['task_id', 'status'],
        },
      },

      // Webhook tools
      {
        name: 'list_webhooks',
        description: 'List all configured webhooks',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create_webhook',
        description: 'Create a new webhook to receive notifications when events occur',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Webhook name for identification' },
            url: { type: 'string', description: 'URL to send webhook POST requests to' },
            events: {
              type: 'array',
              items: { type: 'string', enum: WEBHOOK_EVENT_TYPES },
              description: 'List of events to trigger this webhook (e.g., task.created, task.status_changed)',
            },
            secret: { type: 'string', description: 'Optional secret for HMAC signature verification' },
            project_id: { type: 'string', description: 'Optional: only trigger for this project' },
          },
          required: ['name', 'url', 'events'],
        },
      },
      {
        name: 'update_webhook',
        description: 'Update an existing webhook configuration',
        inputSchema: {
          type: 'object',
          properties: {
            webhook_id: { type: 'string', description: 'Webhook ID to update' },
            name: { type: 'string', description: 'New webhook name' },
            url: { type: 'string', description: 'New URL to send webhook requests to' },
            events: {
              type: 'array',
              items: { type: 'string', enum: WEBHOOK_EVENT_TYPES },
              description: 'New list of events to trigger this webhook',
            },
            secret: { type: 'string', description: 'New secret for signature verification' },
            project_id: { type: 'string', description: 'New project filter (empty to clear)' },
            enabled: { type: 'boolean', description: 'Enable or disable the webhook' },
          },
          required: ['webhook_id'],
        },
      },
      {
        name: 'delete_webhook',
        description: 'Delete a webhook',
        inputSchema: {
          type: 'object',
          properties: {
            webhook_id: { type: 'string', description: 'Webhook ID to delete' },
          },
          required: ['webhook_id'],
        },
      },
      {
        name: 'list_webhook_deliveries',
        description: 'List recent webhook delivery attempts for a specific webhook',
        inputSchema: {
          type: 'object',
          properties: {
            webhook_id: { type: 'string', description: 'Webhook ID to get deliveries for' },
            limit: { type: 'number', description: 'Maximum number of deliveries to return (default 20)' },
          },
          required: ['webhook_id'],
        },
      },

      // Product tools
      {
        name: 'list_products',
        description: 'List products with optional filters',
        inputSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Filter by category (e.g., "Brakes", "Suspension")' },
            brand: { type: 'string', description: 'Filter by brand' },
            isActive: { type: 'boolean', description: 'Filter by active status' },
            search: { type: 'string', description: 'Search SKU, name, description, or fitment' },
          },
        },
      },
      {
        name: 'create_product',
        description: 'Add a new product to the catalog',
        inputSchema: {
          type: 'object',
          properties: {
            sku: { type: 'string', description: 'Product SKU (e.g., "BK-WIL-001")' },
            name: { type: 'string', description: 'Product name' },
            category: { type: 'string', description: 'Product category (e.g., "Brakes", "Suspension", "Drivetrain")' },
            sellPrice: { type: 'number', description: 'Selling price in AUD' },
            costPrice: { type: 'number', description: 'Cost price (what you pay)' },
            brand: { type: 'string', description: 'Brand name' },
            subcategory: { type: 'string', description: 'Subcategory' },
            description: { type: 'string', description: 'Product description' },
            fitment: {
              type: 'array',
              items: { type: 'string' },
              description: 'Vehicle fitment list (e.g., ["Nissan Patrol Y62", "Toyota LC200"])',
            },
          },
          required: ['sku', 'name', 'category', 'sellPrice'],
        },
      },
      {
        name: 'get_product',
        description: 'Get a product by ID or SKU',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Product ID' },
            sku: { type: 'string', description: 'Product SKU' },
          },
        },
      },
      {
        name: 'update_product',
        description: 'Update an existing product',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Product ID (required)' },
            sku: { type: 'string', description: 'New SKU' },
            name: { type: 'string', description: 'New name' },
            category: { type: 'string', description: 'New category' },
            subcategory: { type: 'string', description: 'New subcategory' },
            brand: { type: 'string', description: 'New brand' },
            costPrice: { type: 'number', description: 'New cost price' },
            sellPrice: { type: 'number', description: 'New sell price' },
            description: { type: 'string', description: 'New description' },
            fitment: {
              type: 'array',
              items: { type: 'string' },
              description: 'New fitment list',
            },
            isActive: { type: 'boolean', description: 'Active status' },
          },
          required: ['id'],
        },
      },
      {
        name: 'search_products',
        description: 'Search products by SKU, name, description, or fitment',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
      {
        name: 'delete_product',
        description: 'Deactivate a product (soft delete)',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Product ID to delete' },
          },
          required: ['id'],
        },
      },

      // Customer tools
      {
        name: 'list_customers',
        description: 'List customers with optional filters',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['individual', 'business'], description: 'Filter by customer type' },
            tag: { type: 'string', description: 'Filter by tag (e.g., "VIP", "Trade")' },
            source: { type: 'string', description: 'Filter by source (e.g., "Referral", "Website")' },
            isActive: { type: 'boolean', description: 'Filter by active status' },
            search: { type: 'string', description: 'Search name, email, phone, or notes' },
          },
        },
      },
      {
        name: 'create_customer',
        description: 'Add a new customer to the CRM',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['individual', 'business'], description: 'Customer type' },
            name: { type: 'string', description: 'Full name or business name' },
            contactName: { type: 'string', description: 'Primary contact name (for businesses)' },
            email: { type: 'string', description: 'Email address' },
            phone: { type: 'string', description: 'Phone number' },
            mobile: { type: 'string', description: 'Mobile number' },
            street: { type: 'string', description: 'Street address' },
            city: { type: 'string', description: 'City' },
            state: { type: 'string', description: 'State' },
            postcode: { type: 'string', description: 'Postcode' },
            country: { type: 'string', description: 'Country' },
            abn: { type: 'string', description: 'Australian Business Number' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tags (e.g., ["VIP", "Trade"])' },
            source: { type: 'string', description: 'Lead source (e.g., "Referral", "Website")' },
            notes: { type: 'string', description: 'Notes about the customer' },
          },
          required: ['type', 'name'],
        },
      },
      {
        name: 'get_customer',
        description: 'Get a customer by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Customer ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'update_customer',
        description: 'Update an existing customer',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Customer ID (required)' },
            type: { type: 'string', enum: ['individual', 'business'], description: 'Customer type' },
            name: { type: 'string', description: 'Full name or business name' },
            contactName: { type: 'string', description: 'Primary contact name' },
            email: { type: 'string', description: 'Email address' },
            phone: { type: 'string', description: 'Phone number' },
            mobile: { type: 'string', description: 'Mobile number' },
            street: { type: 'string', description: 'Street address' },
            city: { type: 'string', description: 'City' },
            state: { type: 'string', description: 'State' },
            postcode: { type: 'string', description: 'Postcode' },
            country: { type: 'string', description: 'Country' },
            abn: { type: 'string', description: 'Australian Business Number' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tags' },
            source: { type: 'string', description: 'Lead source' },
            notes: { type: 'string', description: 'Notes' },
            isActive: { type: 'boolean', description: 'Active status' },
          },
          required: ['id'],
        },
      },
      {
        name: 'search_customers',
        description: 'Search customers by name, email, phone, or notes',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
      {
        name: 'delete_customer',
        description: 'Deactivate a customer (soft delete)',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Customer ID to delete' },
          },
          required: ['id'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Re-read data to get latest state (in case web app made changes)
  fileAdapter.read();

  switch (name) {
    // Project operations
    case 'list_projects': {
      const projects = getProjects().map(p => ({
        ...p,
        stats: getProjectStats(p.id),
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }],
      };
    }

    case 'create_project': {
      const project = createProject(args?.name as string, args?.description as string);
      return {
        content: [
          { type: 'text', text: `Created project "${project.name}" with ID: ${project.id}` },
        ],
      };
    }

    case 'update_project': {
      const updates: Record<string, string> = {};
      if (args?.name) updates.name = args.name as string;
      if (args?.description !== undefined) updates.description = args.description as string;
      const project = updateProject(args?.project_id as string, updates);
      if (!project) {
        return { content: [{ type: 'text', text: 'Project not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Updated project: ${JSON.stringify(project, null, 2)}` }],
      };
    }

    case 'delete_project': {
      deleteProject(args?.project_id as string);
      return {
        content: [{ type: 'text', text: `Deleted project ${args?.project_id}` }],
      };
    }

    // Epic operations
    case 'list_epics': {
      const epics = getEpics(args?.project_id as string);
      return {
        content: [{ type: 'text', text: JSON.stringify(epics, null, 2) }],
      };
    }

    case 'create_epic': {
      const epic = createEpic(
        args?.project_id as string,
        args?.title as string,
        args?.notes as string
      );
      return {
        content: [{ type: 'text', text: `Created epic "${epic.title}" with ID: ${epic.id}` }],
      };
    }

    case 'update_epic': {
      const updates: Record<string, unknown> = {};
      if (args?.title) updates.title = args.title;
      if (args?.notes !== undefined) updates.notes = args.notes;
      if (args?.status) updates.status = args.status;
      if (args?.depends_on) updates.depends_on = args.depends_on;
      const epic = updateEpic(args?.epic_id as string, updates);
      if (!epic) {
        return { content: [{ type: 'text', text: 'Epic not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Updated epic: ${JSON.stringify(epic, null, 2)}` }],
      };
    }

    case 'delete_epic': {
      const success = deleteEpic(args?.epic_id as string);
      if (!success) {
        return { content: [{ type: 'text', text: 'Epic not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Deleted epic ${args?.epic_id}` }],
      };
    }

    // Task operations
    case 'list_tasks': {
      let tasks = getTasks(args?.project_id as string).map(t => ({
        ...t,
        blocked: isTaskBlocked(t.id),
      }));

      // Apply filters
      if (args?.epic_id) {
        tasks = tasks.filter(t => t.epic_id === args.epic_id);
      }
      if (args?.status) {
        tasks = tasks.filter(t => t.status === args.status);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }],
      };
    }

    case 'create_task': {
      const task = createTask(
        args?.project_id as string,
        args?.title as string,
        args?.epic_id as string,
        args?.notes as string
      );
      return {
        content: [{ type: 'text', text: `Created task "${task.title}" with ID: ${task.id}` }],
      };
    }

    case 'update_task': {
      // Validate workflow: tasks in 'planning' cannot go directly to 'in_progress'
      if (args?.status === 'in_progress') {
        const currentTask = getTask(args?.task_id as string);
        if (currentTask?.status === 'planning') {
          return {
            content: [{ type: 'text', text: 'Cannot start a task that is still in planning. Move the task to "todo" first.' }],
            isError: true,
          };
        }
      }
      const updates: Record<string, unknown> = {};
      if (args?.title) updates.title = args.title;
      if (args?.notes !== undefined) updates.notes = args.notes;
      if (args?.status) updates.status = args.status;
      if (args?.epic_id !== undefined) updates.epic_id = args.epic_id || undefined;
      if (args?.depends_on) updates.depends_on = args.depends_on;
      const task = updateTask(args?.task_id as string, updates);
      if (!task) {
        return { content: [{ type: 'text', text: 'Task not found' }], isError: true };
      }
      return {
        content: [
          {
            type: 'text',
            text: `Updated task: ${JSON.stringify({ ...task, blocked: isTaskBlocked(task.id) }, null, 2)}`,
          },
        ],
      };
    }

    case 'delete_task': {
      const success = deleteTask(args?.task_id as string);
      if (!success) {
        return { content: [{ type: 'text', text: 'Task not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Deleted task ${args?.task_id}` }],
      };
    }

    case 'move_task_status': {
      // Validate workflow: tasks in 'planning' cannot go directly to 'in_progress'
      if (args?.status === 'in_progress') {
        const currentTask = getTask(args?.task_id as string);
        if (currentTask?.status === 'planning') {
          return {
            content: [{ type: 'text', text: 'Cannot start a task that is still in planning. Move the task to "todo" first.' }],
            isError: true,
          };
        }
      }
      const task = updateTask(args?.task_id as string, { status: args?.status as string });
      if (!task) {
        return { content: [{ type: 'text', text: 'Task not found' }], isError: true };
      }
      return {
        content: [
          { type: 'text', text: `Moved task "${task.title}" to ${args?.status}` },
        ],
      };
    }

    // Webhook operations
    case 'list_webhooks': {
      const webhooks = getWebhooks();
      return {
        content: [{ type: 'text', text: JSON.stringify(webhooks, null, 2) }],
      };
    }

    case 'create_webhook': {
      const webhook = createWebhook(
        args?.name as string,
        args?.url as string,
        args?.events as WebhookEventType[],
        {
          secret: args?.secret as string | undefined,
          project_id: args?.project_id as string | undefined,
        }
      );
      return {
        content: [
          { type: 'text', text: `Created webhook "${webhook.name}" with ID: ${webhook.id}` },
        ],
      };
    }

    case 'update_webhook': {
      const updates: Record<string, unknown> = {};
      if (args?.name) updates.name = args.name;
      if (args?.url) updates.url = args.url;
      if (args?.events) updates.events = args.events;
      if (args?.secret !== undefined) updates.secret = args.secret || undefined;
      if (args?.project_id !== undefined) updates.project_id = args.project_id || undefined;
      if (args?.enabled !== undefined) updates.enabled = args.enabled;

      const webhook = updateWebhook(args?.webhook_id as string, updates);
      if (!webhook) {
        return { content: [{ type: 'text', text: 'Webhook not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Updated webhook: ${JSON.stringify(webhook, null, 2)}` }],
      };
    }

    case 'delete_webhook': {
      const success = deleteWebhook(args?.webhook_id as string);
      if (!success) {
        return { content: [{ type: 'text', text: 'Webhook not found' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Deleted webhook ${args?.webhook_id}` }],
      };
    }

    case 'list_webhook_deliveries': {
      const limit = (args?.limit as number) || 20;
      const deliveries = getWebhookDeliveries(args?.webhook_id as string, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(deliveries, null, 2) }],
      };
    }

    // Product operations
    case 'list_products': {
      const filters: ProductFilters = {};
      if (args?.category) filters.category = args.category as string;
      if (args?.brand) filters.brand = args.brand as string;
      if (args?.isActive !== undefined) filters.isActive = args.isActive as boolean;
      if (args?.search) filters.search = args.search as string;

      const products = listProducts(filters);
      return {
        content: [{ type: 'text', text: JSON.stringify(products, null, 2) }],
      };
    }

    case 'create_product': {
      const input: CreateProductInput = {
        sku: args?.sku as string,
        name: args?.name as string,
        category: args?.category as string,
        sellPrice: args?.sellPrice as number,
        costPrice: args?.costPrice as number | undefined,
        brand: args?.brand as string | undefined,
        subcategory: args?.subcategory as string | undefined,
        description: args?.description as string | undefined,
        fitment: args?.fitment as string[] | undefined,
      };

      // Check for duplicate SKU
      const existingProduct = getProductBySku(input.sku);
      if (existingProduct) {
        return {
          content: [{ type: 'text', text: `Error: Product with SKU "${input.sku}" already exists` }],
          isError: true,
        };
      }

      const product = createProduct(input);
      return {
        content: [
          { type: 'text', text: `Created product "${product.name}" (SKU: ${product.sku}) with ID: ${product.id}` },
        ],
      };
    }

    case 'get_product': {
      let product = null;
      if (args?.id) {
        product = getProduct(args.id as string);
      } else if (args?.sku) {
        product = getProductBySku(args.sku as string);
      } else {
        return {
          content: [{ type: 'text', text: 'Error: Either id or sku is required' }],
          isError: true,
        };
      }

      if (!product) {
        return {
          content: [{ type: 'text', text: 'Product not found' }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(product, null, 2) }],
      };
    }

    case 'update_product': {
      if (!args?.id) {
        return {
          content: [{ type: 'text', text: 'Error: id is required' }],
          isError: true,
        };
      }

      // Check for duplicate SKU if updating SKU
      if (args?.sku) {
        const existingProduct = getProductBySku(args.sku as string);
        if (existingProduct && existingProduct.id !== args.id) {
          return {
            content: [{ type: 'text', text: `Error: Product with SKU "${args.sku}" already exists` }],
            isError: true,
          };
        }
      }

      const updates: Record<string, unknown> = {};
      if (args?.sku) updates.sku = args.sku;
      if (args?.name) updates.name = args.name;
      if (args?.category) updates.category = args.category;
      if (args?.subcategory !== undefined) updates.subcategory = args.subcategory;
      if (args?.brand !== undefined) updates.brand = args.brand;
      if (args?.costPrice !== undefined) updates.costPrice = args.costPrice;
      if (args?.sellPrice !== undefined) updates.sellPrice = args.sellPrice;
      if (args?.description !== undefined) updates.description = args.description;
      if (args?.fitment) updates.fitment = args.fitment;
      if (args?.isActive !== undefined) updates.isActive = args.isActive;

      const product = updateProduct(args.id as string, updates);
      if (!product) {
        return {
          content: [{ type: 'text', text: 'Product not found' }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: `Updated product: ${JSON.stringify(product, null, 2)}` }],
      };
    }

    case 'search_products': {
      if (!args?.query) {
        return {
          content: [{ type: 'text', text: 'Error: query is required' }],
          isError: true,
        };
      }

      const products = searchProducts(args.query as string);
      return {
        content: [{ type: 'text', text: JSON.stringify(products, null, 2) }],
      };
    }

    case 'delete_product': {
      if (!args?.id) {
        return {
          content: [{ type: 'text', text: 'Error: id is required' }],
          isError: true,
        };
      }

      const success = deleteProduct(args.id as string);
      if (!success) {
        return {
          content: [{ type: 'text', text: 'Product not found' }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: `Product ${args.id} has been deactivated` }],
      };
    }

    // Customer operations
    case 'list_customers': {
      const filters: CustomerFilters = {};
      if (args?.type) filters.type = args.type as 'individual' | 'business';
      if (args?.tag) filters.tag = args.tag as string;
      if (args?.source) filters.source = args.source as string;
      if (args?.isActive !== undefined) filters.isActive = args.isActive as boolean;
      if (args?.search) filters.search = args.search as string;

      const customers = listCustomers(filters);
      return {
        content: [{ type: 'text', text: JSON.stringify(customers, null, 2) }],
      };
    }

    case 'create_customer': {
      const input: CreateCustomerInput = {
        type: args?.type as 'individual' | 'business',
        name: args?.name as string,
        contactName: args?.contactName as string | undefined,
        email: args?.email as string | undefined,
        phone: args?.phone as string | undefined,
        mobile: args?.mobile as string | undefined,
        abn: args?.abn as string | undefined,
        tags: args?.tags as string[] | undefined,
        source: args?.source as string | undefined,
        notes: args?.notes as string | undefined,
      };

      // Build address if any address fields provided
      if (args?.street || args?.city || args?.state || args?.postcode || args?.country) {
        input.address = {
          street: args?.street as string | undefined,
          city: args?.city as string | undefined,
          state: args?.state as string | undefined,
          postcode: args?.postcode as string | undefined,
          country: args?.country as string | undefined,
        };
      }

      const customer = createCustomer(input);
      return {
        content: [
          { type: 'text', text: `Created customer "${customer.name}" with ID: ${customer.id}` },
        ],
      };
    }

    case 'get_customer': {
      if (!args?.id) {
        return {
          content: [{ type: 'text', text: 'Error: id is required' }],
          isError: true,
        };
      }

      const customer = getCustomer(args.id as string);
      if (!customer) {
        return {
          content: [{ type: 'text', text: 'Customer not found' }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(customer, null, 2) }],
      };
    }

    case 'update_customer': {
      if (!args?.id) {
        return {
          content: [{ type: 'text', text: 'Error: id is required' }],
          isError: true,
        };
      }

      const updates: Record<string, unknown> = {};
      if (args?.type) updates.type = args.type;
      if (args?.name) updates.name = args.name;
      if (args?.contactName !== undefined) updates.contactName = args.contactName;
      if (args?.email !== undefined) updates.email = args.email;
      if (args?.phone !== undefined) updates.phone = args.phone;
      if (args?.mobile !== undefined) updates.mobile = args.mobile;
      if (args?.abn !== undefined) updates.abn = args.abn;
      if (args?.tags) updates.tags = args.tags;
      if (args?.source !== undefined) updates.source = args.source;
      if (args?.notes !== undefined) updates.notes = args.notes;
      if (args?.isActive !== undefined) updates.isActive = args.isActive;

      // Build address if any address fields provided
      if (args?.street !== undefined || args?.city !== undefined || args?.state !== undefined ||
          args?.postcode !== undefined || args?.country !== undefined) {
        updates.address = {
          street: args?.street as string | undefined,
          city: args?.city as string | undefined,
          state: args?.state as string | undefined,
          postcode: args?.postcode as string | undefined,
          country: args?.country as string | undefined,
        };
      }

      const customer = updateCustomer(args.id as string, updates);
      if (!customer) {
        return {
          content: [{ type: 'text', text: 'Customer not found' }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: `Updated customer: ${JSON.stringify(customer, null, 2)}` }],
      };
    }

    case 'search_customers': {
      if (!args?.query) {
        return {
          content: [{ type: 'text', text: 'Error: query is required' }],
          isError: true,
        };
      }

      const customers = searchCustomers(args.query as string);
      return {
        content: [{ type: 'text', text: JSON.stringify(customers, null, 2) }],
      };
    }

    case 'delete_customer': {
      if (!args?.id) {
        return {
          content: [{ type: 'text', text: 'Error: id is required' }],
          isError: true,
        };
      }

      const success = deleteCustomer(args.id as string);
      if (!success) {
        return {
          content: [{ type: 'text', text: 'Customer not found' }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: `Customer ${args.id} has been deactivated` }],
      };
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Flux MCP server running on stdio');
}

main().catch(console.error);
