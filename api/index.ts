import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  setStorageAdapter,
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

let initialized = false;

async function init() {
  if (initialized) return;

  const creds = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!creds) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');

  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(creds)) });
  }

  const adapter = createFirestoreAdapter(getFirestore());
  setStorageAdapter(adapter);
  await (adapter as any).readAsync();
  initialized = true;
}

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await init();
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }

  const url = new URL(req.url!, `http://${req.headers.host}`);
  const path = url.pathname.replace(/^\/api/, '');
  const method = req.method!;
  const body = req.body || {};

  try {
    // Projects
    if (path === '/projects' && method === 'GET') {
      return res.json(getProjects().map(p => ({ ...p, stats: getProjectStats(p.id) })));
    }
    if (path === '/projects' && method === 'POST') {
      const p = createProject(body.name, body.description);
      triggerWebhooks('project.created', { project: p });
      return res.status(201).json(p);
    }

    let m = path.match(/^\/projects\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (method === 'GET') {
        const p = getProject(id);
        return p ? res.json({ ...p, stats: getProjectStats(id) }) : res.status(404).json({ error: 'Not found' });
      }
      if (method === 'PATCH') {
        const prev = getProject(id);
        const p = updateProject(id, body);
        if (!p) return res.status(404).json({ error: 'Not found' });
        triggerWebhooks('project.updated', { project: p, previous: prev }, p.id);
        return res.json(p);
      }
      if (method === 'DELETE') {
        const p = getProject(id);
        deleteProject(id);
        if (p) triggerWebhooks('project.deleted', { project: p }, p.id);
        return res.json({ success: true });
      }
    }

    // Epics
    m = path.match(/^\/projects\/([^/]+)\/epics$/);
    if (m) {
      if (method === 'GET') return res.json(getEpics(m[1]));
      if (method === 'POST') {
        const e = createEpic(m[1], body.title, body.notes);
        triggerWebhooks('epic.created', { epic: e }, m[1]);
        return res.status(201).json(e);
      }
    }

    m = path.match(/^\/epics\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (method === 'GET') {
        const e = getEpic(id);
        return e ? res.json(e) : res.status(404).json({ error: 'Not found' });
      }
      if (method === 'PATCH') {
        const prev = getEpic(id);
        const e = updateEpic(id, body);
        if (!e) return res.status(404).json({ error: 'Not found' });
        triggerWebhooks('epic.updated', { epic: e, previous: prev }, e.project_id);
        return res.json(e);
      }
      if (method === 'DELETE') {
        const e = getEpic(id);
        if (!deleteEpic(id)) return res.status(404).json({ error: 'Not found' });
        if (e) triggerWebhooks('epic.deleted', { epic: e }, e.project_id);
        return res.json({ success: true });
      }
    }

    // Tasks
    m = path.match(/^\/projects\/([^/]+)\/tasks$/);
    if (m) {
      if (method === 'GET') {
        return res.json(getTasks(m[1]).map(t => ({ ...t, blocked: isTaskBlocked(t.id) })));
      }
      if (method === 'POST') {
        const t = createTask(m[1], body.title, body.epic_id, body.notes);
        triggerWebhooks('task.created', { task: t }, m[1]);
        return res.status(201).json(t);
      }
    }

    m = path.match(/^\/tasks\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (method === 'GET') {
        const t = getTask(id);
        return t ? res.json({ ...t, blocked: isTaskBlocked(id) }) : res.status(404).json({ error: 'Not found' });
      }
      if (method === 'PATCH') {
        const prev = getTask(id);
        const t = updateTask(id, body);
        if (!t) return res.status(404).json({ error: 'Not found' });
        const events: WebhookEventType[] = ['task.updated'];
        if (prev && body.status && prev.status !== body.status) events.push('task.status_changed');
        if (body.archived && (!prev || !prev.archived)) events.push('task.archived');
        events.forEach(ev => triggerWebhooks(ev, { task: t, previous: prev }, t.project_id));
        return res.json({ ...t, blocked: isTaskBlocked(id) });
      }
      if (method === 'DELETE') {
        const t = getTask(id);
        if (!deleteTask(id)) return res.status(404).json({ error: 'Not found' });
        if (t) triggerWebhooks('task.deleted', { task: t }, t.project_id);
        return res.json({ success: true });
      }
    }

    m = path.match(/^\/projects\/([^/]+)\/cleanup$/);
    if (m && method === 'POST') {
      return res.json({ success: true, ...cleanupProject(m[1], body.archiveTasks ?? true, body.archiveEpics ?? true) });
    }

    // Webhooks
    if (path === '/webhooks' && method === 'GET') return res.json(getWebhooks());
    if (path === '/webhooks' && method === 'POST') {
      if (!body.name || !body.url || !body.events) return res.status(400).json({ error: 'Missing fields' });
      return res.status(201).json(createWebhook(body.name, body.url, body.events, body));
    }

    m = path.match(/^\/webhooks\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (method === 'GET') {
        const w = getWebhook(id);
        return w ? res.json(w) : res.status(404).json({ error: 'Not found' });
      }
      if (method === 'PATCH') {
        const w = updateWebhook(id, body);
        return w ? res.json(w) : res.status(404).json({ error: 'Not found' });
      }
      if (method === 'DELETE') {
        return deleteWebhook(id) ? res.json({ success: true }) : res.status(404).json({ error: 'Not found' });
      }
    }

    m = path.match(/^\/webhooks\/([^/]+)\/deliveries$/);
    if (m && method === 'GET') {
      if (!getWebhook(m[1])) return res.status(404).json({ error: 'Not found' });
      return res.json(getWebhookDeliveries(m[1], parseInt(url.searchParams.get('limit') || '50')));
    }

    // Products
    if (path === '/products/categories' && method === 'GET') return res.json(getProductCategories());
    if (path === '/products/brands' && method === 'GET') return res.json(getProductBrands());
    if (path === '/products' && method === 'GET') {
      const f: ProductFilters = {};
      const p = url.searchParams;
      if (p.get('category')) f.category = p.get('category')!;
      if (p.get('brand')) f.brand = p.get('brand')!;
      if (p.has('isActive')) f.isActive = p.get('isActive') === 'true';
      if (p.get('search')) f.search = p.get('search')!;
      if (p.get('minPrice')) f.minPrice = parseFloat(p.get('minPrice')!);
      if (p.get('maxPrice')) f.maxPrice = parseFloat(p.get('maxPrice')!);
      return res.json(listProducts(f));
    }
    if (path === '/products' && method === 'POST') {
      const b = body as CreateProductInput;
      if (!b.sku || !b.name || !b.category || b.sellPrice === undefined) return res.status(400).json({ error: 'Missing fields' });
      if (getProductBySku(b.sku)) return res.status(400).json({ error: 'SKU exists' });
      const prod = createProduct(b);
      triggerWebhooks('product.created', { product: prod });
      return res.status(201).json(prod);
    }

    m = path.match(/^\/products\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (method === 'GET') {
        const p = getProduct(id);
        return p ? res.json(p) : res.status(404).json({ error: 'Not found' });
      }
      if (method === 'PATCH') {
        const prev = getProduct(id);
        const b = body as UpdateProductInput;
        if (b.sku && prev) {
          const ex = getProductBySku(b.sku);
          if (ex && ex.id !== prev.id) return res.status(400).json({ error: 'SKU exists' });
        }
        const p = updateProduct(id, b);
        if (!p) return res.status(404).json({ error: 'Not found' });
        triggerWebhooks('product.updated', { product: p, previous: prev });
        return res.json(p);
      }
      if (method === 'DELETE') {
        const p = getProduct(id);
        if (!deleteProduct(id)) return res.status(404).json({ error: 'Not found' });
        if (p) triggerWebhooks('product.deleted', { product: p });
        return res.json({ success: true });
      }
    }

    // Customers
    if (path === '/customers/tags' && method === 'GET') return res.json(getCustomerTags());
    if (path === '/customers/sources' && method === 'GET') return res.json(getCustomerSources());
    if (path === '/customers' && method === 'GET') {
      const f: CustomerFilters = {};
      const p = url.searchParams;
      const t = p.get('type');
      if (t === 'individual' || t === 'business') f.type = t;
      if (p.get('tag')) f.tag = p.get('tag')!;
      if (p.get('source')) f.source = p.get('source')!;
      if (p.has('isActive')) f.isActive = p.get('isActive') === 'true';
      if (p.get('search')) f.search = p.get('search')!;
      return res.json(listCustomers(f));
    }
    if (path === '/customers' && method === 'POST') {
      const b = body as CreateCustomerInput;
      if (!b.type || !b.name) return res.status(400).json({ error: 'Missing fields' });
      const c = createCustomer(b);
      triggerWebhooks('customer.created', { customer: c });
      return res.status(201).json(c);
    }

    m = path.match(/^\/customers\/([^/]+)\/quotes$/);
    if (m && method === 'GET') {
      if (!getCustomer(m[1])) return res.status(404).json({ error: 'Not found' });
      return res.json(getQuotesByCustomer(m[1]));
    }

    m = path.match(/^\/customers\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (method === 'GET') {
        const c = getCustomer(id);
        return c ? res.json(c) : res.status(404).json({ error: 'Not found' });
      }
      if (method === 'PATCH') {
        const prev = getCustomer(id);
        const c = updateCustomer(id, body as UpdateCustomerInput);
        if (!c) return res.status(404).json({ error: 'Not found' });
        triggerWebhooks('customer.updated', { customer: c, previous: prev });
        return res.json(c);
      }
      if (method === 'DELETE') {
        const c = getCustomer(id);
        if (!deleteCustomer(id)) return res.status(404).json({ error: 'Not found' });
        if (c) triggerWebhooks('customer.deleted', { customer: c });
        return res.json({ success: true });
      }
    }

    // Quotes
    if (path === '/quotes' && method === 'GET') {
      const f: QuoteFilters = {};
      const p = url.searchParams;
      if (p.get('customerId')) f.customerId = p.get('customerId')!;
      if (p.get('status')) f.status = p.get('status') as QuoteStatus;
      if (p.get('search')) f.search = p.get('search')!;
      if (p.get('fromDate')) f.fromDate = p.get('fromDate')!;
      if (p.get('toDate')) f.toDate = p.get('toDate')!;
      return res.json(listQuotes(f));
    }
    if (path === '/quotes' && method === 'POST') {
      const b = body as CreateQuoteInput;
      if (!b.customerId || !b.lineItems?.length) return res.status(400).json({ error: 'Missing fields' });
      try {
        const q = createQuote(b);
        triggerWebhooks('quote.created', { quote: q });
        return res.status(201).json(q);
      } catch (e: any) {
        return res.status(400).json({ error: e.message });
      }
    }

    m = path.match(/^\/quotes\/([^/]+)\/status$/);
    if (m && method === 'PATCH') {
      const prev = getQuote(m[1]);
      if (!prev) return res.status(404).json({ error: 'Not found' });
      if (!body.status) return res.status(400).json({ error: 'Missing status' });
      const q = updateQuoteStatus(m[1], body.status as QuoteStatus);
      if (!q) return res.status(404).json({ error: 'Not found' });
      triggerWebhooks('quote.updated', { quote: q, previous: prev });
      if (prev.status !== body.status) triggerWebhooks('quote.status_changed', { quote: q, previous: prev });
      return res.json(q);
    }

    m = path.match(/^\/quotes\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (method === 'GET') {
        const q = getQuote(id);
        return q ? res.json(q) : res.status(404).json({ error: 'Not found' });
      }
      if (method === 'PATCH') {
        const prev = getQuote(id);
        if (!prev) return res.status(404).json({ error: 'Not found' });
        try {
          const q = updateQuote(id, body as UpdateQuoteInput);
          if (!q) return res.status(404).json({ error: 'Not found' });
          const events: WebhookEventType[] = ['quote.updated'];
          if (body.status && prev.status !== body.status) events.push('quote.status_changed');
          events.forEach(ev => triggerWebhooks(ev, { quote: q, previous: prev }));
          return res.json(q);
        } catch (e: any) {
          return res.status(400).json({ error: e.message });
        }
      }
      if (method === 'DELETE') {
        const q = getQuote(id);
        if (!deleteQuote(id)) return res.status(404).json({ error: 'Not found' });
        if (q) triggerWebhooks('quote.deleted', { quote: q });
        return res.json({ success: true });
      }
    }

    return res.status(404).json({ error: 'Not found', path });
  } catch (e: any) {
    console.error('API Error:', e);
    return res.status(500).json({ error: e.message });
  }
}
