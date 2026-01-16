import { handle } from '@hono/node-server/vercel';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
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
  cleanupProject,
  getWebhooks,
  getWebhook,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  triggerWebhooks,
  createFirestoreAdapter,
  listProducts,
  getProduct,
  getProductBySku,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductCategories,
  getProductBrands,
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerTags,
  getCustomerSources,
  listQuotes,
  getQuote,
  getQuotesByCustomer,
  createQuote,
  updateQuote,
  updateQuoteStatus,
  deleteQuote,
  type Store,
  type WebhookEventType,
  type ProductFilters,
  type CreateProductInput,
  type UpdateProductInput,
  type CustomerFilters,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type QuoteFilters,
  type CreateQuoteInput,
  type UpdateQuoteInput,
  type QuoteStatus,
} from '@flux/shared';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase if configured
let firestoreDb: FirebaseFirestore.Firestore | null = null;

function initializeFirebase() {
  if (getApps().length > 0) {
    return getFirestore();
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT not configured');
  }

  const credentials = JSON.parse(serviceAccount);
  initializeApp({
    credential: cert(credentials),
  });

  return getFirestore();
}

// Initialize storage
let initialized = false;

async function ensureInitialized() {
  if (initialized) return;

  try {
    firestoreDb = initializeFirebase();
    const adapter = createFirestoreAdapter(firestoreDb);
    setStorageAdapter(adapter);
    await (adapter as any).readAsync();
    initialized = true;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw error;
  }
}

// Create Hono app
const app = new Hono().basePath('/api');

app.use('*', cors());

// Ensure initialized before each request
app.use('*', async (c, next) => {
  await ensureInitialized();
  return next();
});

// Projects
app.get('/projects', (c) => {
  const projects = getProjects().map(p => ({
    ...p,
    stats: getProjectStats(p.id),
  }));
  return c.json(projects);
});

app.get('/projects/:id', (c) => {
  const project = getProject(c.req.param('id'));
  if (!project) return c.json({ error: 'Project not found' }, 404);
  return c.json({ ...project, stats: getProjectStats(project.id) });
});

app.post('/projects', async (c) => {
  const body = await c.req.json();
  const project = createProject(body.name, body.description);
  triggerWebhooks('project.created', { project });
  return c.json(project, 201);
});

app.patch('/projects/:id', async (c) => {
  const body = await c.req.json();
  const previous = getProject(c.req.param('id'));
  const project = updateProject(c.req.param('id'), body);
  if (!project) return c.json({ error: 'Project not found' }, 404);
  triggerWebhooks('project.updated', { project, previous }, project.id);
  return c.json(project);
});

app.delete('/projects/:id', (c) => {
  const project = getProject(c.req.param('id'));
  deleteProject(c.req.param('id'));
  if (project) {
    triggerWebhooks('project.deleted', { project }, project.id);
  }
  return c.json({ success: true });
});

// Epics
app.get('/projects/:projectId/epics', (c) => {
  const epics = getEpics(c.req.param('projectId'));
  return c.json(epics);
});

app.post('/projects/:projectId/epics', async (c) => {
  const body = await c.req.json();
  const projectId = c.req.param('projectId');
  const epic = createEpic(projectId, body.title, body.notes);
  triggerWebhooks('epic.created', { epic }, projectId);
  return c.json(epic, 201);
});

app.patch('/epics/:id', async (c) => {
  const body = await c.req.json();
  const previous = getEpic(c.req.param('id'));
  const epic = updateEpic(c.req.param('id'), body);
  if (!epic) return c.json({ error: 'Epic not found' }, 404);
  triggerWebhooks('epic.updated', { epic, previous }, epic.project_id);
  return c.json(epic);
});

app.delete('/epics/:id', (c) => {
  const epic = getEpic(c.req.param('id'));
  const success = deleteEpic(c.req.param('id'));
  if (!success) return c.json({ error: 'Epic not found' }, 404);
  if (epic) {
    triggerWebhooks('epic.deleted', { epic }, epic.project_id);
  }
  return c.json({ success: true });
});

// Tasks
app.get('/projects/:projectId/tasks', (c) => {
  const tasks = getTasks(c.req.param('projectId')).map(t => ({
    ...t,
    blocked: isTaskBlocked(t.id),
  }));
  return c.json(tasks);
});

app.post('/projects/:projectId/tasks', async (c) => {
  const body = await c.req.json();
  const projectId = c.req.param('projectId');
  const task = createTask(projectId, body.title, body.epic_id, body.notes);
  triggerWebhooks('task.created', { task }, projectId);
  return c.json(task, 201);
});

app.patch('/tasks/:id', async (c) => {
  const body = await c.req.json();
  const previous = getTask(c.req.param('id'));
  const task = updateTask(c.req.param('id'), body);
  if (!task) return c.json({ error: 'Task not found' }, 404);

  const events: WebhookEventType[] = ['task.updated'];
  if (previous && body.status && previous.status !== body.status) {
    events.push('task.status_changed');
  }
  if (body.archived === true && (!previous || !previous.archived)) {
    events.push('task.archived');
  }
  for (const event of events) {
    triggerWebhooks(event, { task, previous }, task.project_id);
  }

  return c.json({ ...task, blocked: isTaskBlocked(task.id) });
});

app.delete('/tasks/:id', (c) => {
  const task = getTask(c.req.param('id'));
  const success = deleteTask(c.req.param('id'));
  if (!success) return c.json({ error: 'Task not found' }, 404);
  if (task) {
    triggerWebhooks('task.deleted', { task }, task.project_id);
  }
  return c.json({ success: true });
});

app.post('/projects/:projectId/cleanup', async (c) => {
  const body = await c.req.json();
  const result = cleanupProject(
    c.req.param('projectId'),
    body.archiveTasks ?? true,
    body.archiveEpics ?? true
  );
  return c.json({ success: true, ...result });
});

// Webhooks
app.get('/webhooks', (c) => c.json(getWebhooks()));
app.get('/webhooks/:id', (c) => {
  const webhook = getWebhook(c.req.param('id'));
  if (!webhook) return c.json({ error: 'Webhook not found' }, 404);
  return c.json(webhook);
});
app.post('/webhooks', async (c) => {
  const body = await c.req.json();
  if (!body.name || !body.url || !body.events) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  const webhook = createWebhook(body.name, body.url, body.events, {
    secret: body.secret,
    project_id: body.project_id,
    enabled: body.enabled,
  });
  return c.json(webhook, 201);
});
app.patch('/webhooks/:id', async (c) => {
  const body = await c.req.json();
  const webhook = updateWebhook(c.req.param('id'), body);
  if (!webhook) return c.json({ error: 'Webhook not found' }, 404);
  return c.json(webhook);
});
app.delete('/webhooks/:id', (c) => {
  const success = deleteWebhook(c.req.param('id'));
  if (!success) return c.json({ error: 'Webhook not found' }, 404);
  return c.json({ success: true });
});
app.get('/webhooks/:id/deliveries', (c) => {
  const webhook = getWebhook(c.req.param('id'));
  if (!webhook) return c.json({ error: 'Webhook not found' }, 404);
  const limit = parseInt(c.req.query('limit') || '50');
  return c.json(getWebhookDeliveries(c.req.param('id'), limit));
});

// Products
app.get('/products/categories', (c) => c.json(getProductCategories()));
app.get('/products/brands', (c) => c.json(getProductBrands()));
app.get('/products', (c) => {
  const filters: ProductFilters = {};
  const { category, brand, isActive, search, minPrice, maxPrice } = c.req.query();
  if (category) filters.category = category;
  if (brand) filters.brand = brand;
  if (isActive !== undefined && isActive !== '') filters.isActive = isActive === 'true';
  if (search) filters.search = search;
  if (minPrice) filters.minPrice = parseFloat(minPrice);
  if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
  return c.json(listProducts(filters));
});
app.get('/products/:id', (c) => {
  const product = getProduct(c.req.param('id'));
  if (!product) return c.json({ error: 'Product not found' }, 404);
  return c.json(product);
});
app.post('/products', async (c) => {
  const body = await c.req.json() as CreateProductInput;
  if (!body.sku || !body.name || !body.category || body.sellPrice === undefined) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  if (getProductBySku(body.sku)) {
    return c.json({ error: `SKU "${body.sku}" already exists` }, 400);
  }
  const product = createProduct(body);
  triggerWebhooks('product.created', { product });
  return c.json(product, 201);
});
app.patch('/products/:id', async (c) => {
  const body = await c.req.json() as UpdateProductInput;
  const previous = getProduct(c.req.param('id'));
  if (body.sku && previous) {
    const existing = getProductBySku(body.sku);
    if (existing && existing.id !== previous.id) {
      return c.json({ error: `SKU "${body.sku}" already exists` }, 400);
    }
  }
  const product = updateProduct(c.req.param('id'), body);
  if (!product) return c.json({ error: 'Product not found' }, 404);
  triggerWebhooks('product.updated', { product, previous });
  return c.json(product);
});
app.delete('/products/:id', (c) => {
  const product = getProduct(c.req.param('id'));
  const success = deleteProduct(c.req.param('id'));
  if (!success) return c.json({ error: 'Product not found' }, 404);
  if (product) triggerWebhooks('product.deleted', { product });
  return c.json({ success: true });
});

// Customers
app.get('/customers/tags', (c) => c.json(getCustomerTags()));
app.get('/customers/sources', (c) => c.json(getCustomerSources()));
app.get('/customers', (c) => {
  const filters: CustomerFilters = {};
  const { type, tag, source, isActive, search } = c.req.query();
  if (type === 'individual' || type === 'business') filters.type = type;
  if (tag) filters.tag = tag;
  if (source) filters.source = source;
  if (isActive !== undefined && isActive !== '') filters.isActive = isActive === 'true';
  if (search) filters.search = search;
  return c.json(listCustomers(filters));
});
app.get('/customers/:id', (c) => {
  const customer = getCustomer(c.req.param('id'));
  if (!customer) return c.json({ error: 'Customer not found' }, 404);
  return c.json(customer);
});
app.post('/customers', async (c) => {
  const body = await c.req.json() as CreateCustomerInput;
  if (!body.type || !body.name) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  const customer = createCustomer(body);
  triggerWebhooks('customer.created', { customer });
  return c.json(customer, 201);
});
app.patch('/customers/:id', async (c) => {
  const body = await c.req.json() as UpdateCustomerInput;
  const previous = getCustomer(c.req.param('id'));
  const customer = updateCustomer(c.req.param('id'), body);
  if (!customer) return c.json({ error: 'Customer not found' }, 404);
  triggerWebhooks('customer.updated', { customer, previous });
  return c.json(customer);
});
app.delete('/customers/:id', (c) => {
  const customer = getCustomer(c.req.param('id'));
  const success = deleteCustomer(c.req.param('id'));
  if (!success) return c.json({ error: 'Customer not found' }, 404);
  if (customer) triggerWebhooks('customer.deleted', { customer });
  return c.json({ success: true });
});

// Quotes
app.get('/quotes', (c) => {
  const filters: QuoteFilters = {};
  const { customerId, status, search, fromDate, toDate } = c.req.query();
  if (customerId) filters.customerId = customerId;
  if (status) filters.status = status as QuoteStatus;
  if (search) filters.search = search;
  if (fromDate) filters.fromDate = fromDate;
  if (toDate) filters.toDate = toDate;
  return c.json(listQuotes(filters));
});
app.get('/quotes/:id', (c) => {
  const quote = getQuote(c.req.param('id'));
  if (!quote) return c.json({ error: 'Quote not found' }, 404);
  return c.json(quote);
});
app.get('/customers/:customerId/quotes', (c) => {
  const customer = getCustomer(c.req.param('customerId'));
  if (!customer) return c.json({ error: 'Customer not found' }, 404);
  return c.json(getQuotesByCustomer(c.req.param('customerId')));
});
app.post('/quotes', async (c) => {
  const body = await c.req.json() as CreateQuoteInput;
  if (!body.customerId || !body.lineItems || body.lineItems.length === 0) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  try {
    const quote = createQuote(body);
    triggerWebhooks('quote.created', { quote });
    return c.json(quote, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});
app.patch('/quotes/:id', async (c) => {
  const body = await c.req.json() as UpdateQuoteInput;
  const previous = getQuote(c.req.param('id'));
  if (!previous) return c.json({ error: 'Quote not found' }, 404);
  try {
    const quote = updateQuote(c.req.param('id'), body);
    if (!quote) return c.json({ error: 'Quote not found' }, 404);
    const events: WebhookEventType[] = ['quote.updated'];
    if (body.status && previous.status !== body.status) {
      events.push('quote.status_changed');
    }
    for (const event of events) {
      triggerWebhooks(event, { quote, previous });
    }
    return c.json(quote);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});
app.patch('/quotes/:id/status', async (c) => {
  const body = await c.req.json();
  const previous = getQuote(c.req.param('id'));
  if (!previous) return c.json({ error: 'Quote not found' }, 404);
  if (!body.status) return c.json({ error: 'Missing status' }, 400);
  const quote = updateQuoteStatus(c.req.param('id'), body.status as QuoteStatus);
  if (!quote) return c.json({ error: 'Quote not found' }, 404);
  triggerWebhooks('quote.updated', { quote, previous });
  if (previous.status !== body.status) {
    triggerWebhooks('quote.status_changed', { quote, previous });
  }
  return c.json(quote);
});
app.delete('/quotes/:id', (c) => {
  const quote = getQuote(c.req.param('id'));
  const success = deleteQuote(c.req.param('id'));
  if (!success) return c.json({ error: 'Quote not found' }, 404);
  if (quote) triggerWebhooks('quote.deleted', { quote });
  return c.json({ success: true });
});

export default handle(app);
