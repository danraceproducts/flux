import { useEffect, useState } from 'preact/hooks';
import { route, RoutableProps } from 'preact-router';
import type { Quote, Customer, Product, QuoteStatus, CreateQuoteInput, CreateQuoteLineItemInput } from '@flux/shared';
import { QUOTE_STATUSES, QUOTE_STATUS_CONFIG } from '@flux/shared';
import {
  getQuotes,
  createQuote,
  updateQuote,
  updateQuoteStatus,
  deleteQuote,
  getCustomers,
  getProducts,
} from '../stores/api';
import { Modal, ThemeToggle } from '../components';

interface LineItemForm {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export default function Quotes(_props: RoutableProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | QuoteStatus>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formLineItems, setFormLineItems] = useState<LineItemForm[]>([]);
  const [formTaxRate, setFormTaxRate] = useState(10);
  const [formNotes, setFormNotes] = useState('');
  const [formTerms, setFormTerms] = useState('');
  const [formStatus, setFormStatus] = useState<QuoteStatus>('draft');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [quotesData, customersData, productsData] = await Promise.all([
        getQuotes(),
        getCustomers({ isActive: true }),
        getProducts({ isActive: true }),
      ]);
      setQuotes(quotesData);
      setCustomers(customersData);
      setProducts(productsData);
    } catch (err) {
      setError('Failed to load data');
    }
    setLoading(false);
  }

  async function loadQuotes() {
    const filters: { customerId?: string; status?: QuoteStatus; search?: string } = {};
    if (filterCustomer) filters.customerId = filterCustomer;
    if (filterStatus) filters.status = filterStatus;
    if (searchQuery) filters.search = searchQuery;

    const quotesData = await getQuotes(filters);
    setQuotes(quotesData);
  }

  useEffect(() => {
    if (!loading) {
      loadQuotes();
    }
  }, [filterCustomer, filterStatus, searchQuery]);

  function openCreateForm() {
    setEditingQuote(null);
    setFormCustomerId('');
    setFormLineItems([{ productId: '', quantity: 1, unitPrice: 0, discount: 0 }]);
    setFormTaxRate(10);
    setFormNotes('');
    setFormTerms('');
    setFormStatus('draft');
    setError(null);
    setShowForm(true);
  }

  function openEditForm(quote: Quote) {
    setEditingQuote(quote);
    setFormCustomerId(quote.customerId);
    setFormLineItems(
      quote.lineItems.map(li => ({
        productId: li.productId,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        discount: li.discount,
      }))
    );
    setFormTaxRate(quote.taxRate);
    setFormNotes(quote.notes || '');
    setFormTerms(quote.terms || '');
    setFormStatus(quote.status);
    setError(null);
    setShowForm(true);
  }

  function addLineItem() {
    setFormLineItems([...formLineItems, { productId: '', quantity: 1, unitPrice: 0, discount: 0 }]);
  }

  function removeLineItem(index: number) {
    if (formLineItems.length > 1) {
      setFormLineItems(formLineItems.filter((_, i) => i !== index));
    }
  }

  function updateLineItem(index: number, field: keyof LineItemForm, value: string | number) {
    const updated = [...formLineItems];
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      updated[index] = {
        ...updated[index],
        productId: value as string,
        unitPrice: product?.sellPrice || 0,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setFormLineItems(updated);
  }

  function calculateLineTotal(item: LineItemForm): number {
    return Math.round(item.quantity * item.unitPrice * (1 - item.discount / 100) * 100) / 100;
  }

  function calculateSubtotal(): number {
    return formLineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  }

  function calculateTax(): number {
    return Math.round(calculateSubtotal() * formTaxRate / 100 * 100) / 100;
  }

  function calculateTotal(): number {
    return Math.round((calculateSubtotal() + calculateTax()) * 100) / 100;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError(null);

    if (!formCustomerId) {
      setError('Please select a customer');
      return;
    }

    const validLineItems = formLineItems.filter(li => li.productId && li.quantity > 0);
    if (validLineItems.length === 0) {
      setError('Please add at least one product');
      return;
    }

    try {
      const lineItems: CreateQuoteLineItemInput[] = validLineItems.map(li => ({
        productId: li.productId,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        discount: li.discount,
      }));

      if (editingQuote) {
        await updateQuote(editingQuote.id, {
          customerId: formCustomerId,
          lineItems,
          taxRate: formTaxRate,
          notes: formNotes || undefined,
          terms: formTerms || undefined,
          status: formStatus,
        });
      } else {
        const input: CreateQuoteInput = {
          customerId: formCustomerId,
          lineItems,
          taxRate: formTaxRate,
          notes: formNotes || undefined,
          terms: formTerms || undefined,
          status: formStatus,
        };
        await createQuote(input);
      }

      setShowForm(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save quote');
    }
  }

  async function handleStatusChange(quote: Quote, newStatus: QuoteStatus) {
    try {
      await updateQuoteStatus(quote.id, newStatus);
      loadQuotes();
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    }
  }

  async function handleDelete(quote: Quote) {
    if (!confirm(`Delete quote "${quote.quoteNumber}"?`)) return;
    await deleteQuote(quote.id);
    loadData();
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  if (loading) {
    return (
      <div class="min-h-screen bg-base-200 flex items-center justify-center">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div class="min-h-screen bg-base-200">
      {/* Navbar */}
      <div class="navbar bg-base-100 shadow-lg">
        <div class="flex-1">
          <button class="btn btn-ghost btn-sm" onClick={() => route('/')}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <span class="text-xl font-bold px-4">Quotes</span>
        </div>
        <div class="flex-none flex items-center gap-2">
          <button class="btn btn-primary btn-sm" onClick={openCreateForm}>
            + New Quote
          </button>
          <ThemeToggle />
        </div>
      </div>

      <div class="p-6">
        <div class="max-w-6xl mx-auto">
          {/* Filters */}
          <div class="card bg-base-100 shadow-xl mb-6">
            <div class="card-body py-4">
              <div class="flex flex-wrap gap-4 items-center">
                {/* Search */}
                <div class="form-control flex-1 min-w-[200px]">
                  <input
                    type="text"
                    placeholder="Search quote number, customer..."
                    class="input input-bordered input-sm w-full"
                    value={searchQuery}
                    onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                  />
                </div>

                {/* Customer filter */}
                <div class="form-control">
                  <select
                    class="select select-bordered select-sm"
                    value={filterCustomer}
                    onChange={(e) => setFilterCustomer((e.target as HTMLSelectElement).value)}
                  >
                    <option value="">All Customers</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Status filter */}
                <div class="form-control">
                  <select
                    class="select select-bordered select-sm"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus((e.target as HTMLSelectElement).value as '' | QuoteStatus)}
                  >
                    <option value="">All Statuses</option>
                    {QUOTE_STATUSES.map(status => (
                      <option key={status} value={status}>{QUOTE_STATUS_CONFIG[status].label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Quotes Table */}
          {quotes.length === 0 ? (
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body text-center py-12">
                <h2 class="text-lg font-semibold mb-2">No quotes found</h2>
                <p class="text-base-content/60 mb-4">
                  {searchQuery || filterCustomer || filterStatus
                    ? 'Try adjusting your filters'
                    : 'Create your first quote to get started'}
                </p>
                {!searchQuery && !filterCustomer && !filterStatus && (
                  <button class="btn btn-primary" onClick={openCreateForm}>
                    Create your first quote
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div class="card bg-base-100 shadow-xl overflow-x-auto">
              <table class="table table-zebra">
                <thead>
                  <tr>
                    <th>Quote #</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Issue Date</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map(quote => (
                    <tr
                      key={quote.id}
                      class="hover cursor-pointer"
                      onClick={() => openEditForm(quote)}
                    >
                      <td>
                        <div class="font-medium font-mono">{quote.quoteNumber}</div>
                      </td>
                      <td>
                        <div class="font-medium">{quote.customerName}</div>
                      </td>
                      <td>
                        <span class="text-sm">{quote.lineItems.length} item{quote.lineItems.length !== 1 ? 's' : ''}</span>
                      </td>
                      <td>
                        <div class="font-medium">{formatCurrency(quote.total)}</div>
                        <div class="text-xs text-base-content/60">
                          {formatCurrency(quote.subtotal)} + {formatCurrency(quote.taxAmount)} GST
                        </div>
                      </td>
                      <td>
                        <div>{formatDate(quote.issueDate)}</div>
                        <div class="text-xs text-base-content/60">
                          Valid until {formatDate(quote.validUntil)}
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select
                          class="select select-bordered select-xs"
                          style={{ backgroundColor: QUOTE_STATUS_CONFIG[quote.status].color + '20', color: QUOTE_STATUS_CONFIG[quote.status].color }}
                          value={quote.status}
                          onChange={(e) => handleStatusChange(quote, (e.target as HTMLSelectElement).value as QuoteStatus)}
                        >
                          {QUOTE_STATUSES.map(status => (
                            <option key={status} value={status}>{QUOTE_STATUS_CONFIG[status].label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          class="btn btn-ghost btn-xs text-error"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(quote);
                          }}
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Quote count */}
          <div class="text-sm text-base-content/60 mt-4 text-center">
            {quotes.length} quote{quotes.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      <Modal
        isOpen={showForm}
        title={editingQuote ? `Edit Quote ${editingQuote.quoteNumber}` : 'New Quote'}
        onClose={() => setShowForm(false)}
      >
        <form onSubmit={handleSubmit} class="space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div class="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {/* Customer Selection */}
          <div class="form-control">
            <label class="label">
              <span class="label-text">Customer *</span>
            </label>
            <select
              class="select select-bordered w-full"
              value={formCustomerId}
              onChange={(e) => setFormCustomerId((e.target as HTMLSelectElement).value)}
              required
            >
              <option value="">Select a customer...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Line Items */}
          <div class="divider text-xs">Line Items</div>
          <div class="space-y-3">
            {formLineItems.map((item, index) => (
              <div key={index} class="flex gap-2 items-start p-3 bg-base-200 rounded-lg">
                <div class="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div class="form-control col-span-2">
                    <select
                      class="select select-bordered select-sm w-full"
                      value={item.productId}
                      onChange={(e) => updateLineItem(index, 'productId', (e.target as HTMLSelectElement).value)}
                    >
                      <option value="">Select product...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </div>
                  <div class="form-control">
                    <input
                      type="number"
                      class="input input-bordered input-sm w-full"
                      value={item.quantity}
                      min="1"
                      onChange={(e) => updateLineItem(index, 'quantity', parseInt((e.target as HTMLInputElement).value) || 1)}
                      placeholder="Qty"
                    />
                  </div>
                  <div class="form-control">
                    <input
                      type="number"
                      class="input input-bordered input-sm w-full"
                      value={item.unitPrice}
                      min="0"
                      step="0.01"
                      onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat((e.target as HTMLInputElement).value) || 0)}
                      placeholder="Price"
                    />
                  </div>
                  <div class="form-control">
                    <div class="input-group">
                      <input
                        type="number"
                        class="input input-bordered input-sm w-full"
                        value={item.discount}
                        min="0"
                        max="100"
                        onChange={(e) => updateLineItem(index, 'discount', parseFloat((e.target as HTMLInputElement).value) || 0)}
                        placeholder="Disc"
                      />
                      <span class="bg-base-300 px-2 text-sm">%</span>
                    </div>
                  </div>
                  <div class="form-control col-span-1">
                    <div class="input input-bordered input-sm bg-base-100 flex items-center justify-end font-medium">
                      {formatCurrency(calculateLineTotal(item))}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm btn-square"
                  onClick={() => removeLineItem(index)}
                  disabled={formLineItems.length <= 1}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <button type="button" class="btn btn-outline btn-sm" onClick={addLineItem}>
            + Add Line Item
          </button>

          {/* Totals */}
          <div class="bg-base-200 rounded-lg p-4 space-y-2">
            <div class="flex justify-between">
              <span>Subtotal:</span>
              <span class="font-medium">{formatCurrency(calculateSubtotal())}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="flex items-center gap-2">
                GST (
                <input
                  type="number"
                  class="input input-bordered input-xs w-16 text-center"
                  value={formTaxRate}
                  min="0"
                  max="100"
                  onChange={(e) => setFormTaxRate(parseFloat((e.target as HTMLInputElement).value) || 0)}
                />
                %):
              </span>
              <span class="font-medium">{formatCurrency(calculateTax())}</span>
            </div>
            <div class="divider my-1"></div>
            <div class="flex justify-between text-lg">
              <span class="font-semibold">Total:</span>
              <span class="font-bold">{formatCurrency(calculateTotal())}</span>
            </div>
          </div>

          {/* Status */}
          <div class="form-control">
            <label class="label">
              <span class="label-text">Status</span>
            </label>
            <select
              class="select select-bordered w-full"
              value={formStatus}
              onChange={(e) => setFormStatus((e.target as HTMLSelectElement).value as QuoteStatus)}
            >
              {QUOTE_STATUSES.map(status => (
                <option key={status} value={status}>{QUOTE_STATUS_CONFIG[status].label}</option>
              ))}
            </select>
          </div>

          {/* Notes and Terms */}
          <div class="form-control">
            <label class="label">
              <span class="label-text">Notes</span>
            </label>
            <textarea
              class="textarea textarea-bordered w-full"
              rows={2}
              value={formNotes}
              onInput={(e) => setFormNotes((e.target as HTMLTextAreaElement).value)}
              placeholder="Internal notes..."
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Terms & Conditions</span>
            </label>
            <textarea
              class="textarea textarea-bordered w-full"
              rows={2}
              value={formTerms}
              onInput={(e) => setFormTerms((e.target as HTMLTextAreaElement).value)}
              placeholder="Payment terms, delivery conditions..."
            />
          </div>

          <div class="flex justify-end gap-2 pt-4">
            <button type="button" class="btn btn-ghost" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              {editingQuote ? 'Save Changes' : 'Create Quote'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
