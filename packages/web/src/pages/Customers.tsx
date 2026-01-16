import { useEffect, useState } from 'preact/hooks';
import { route, RoutableProps } from 'preact-router';
import type { Customer, CreateCustomerInput, UpdateCustomerInput } from '@flux/shared';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerTags,
  getCustomerSources,
} from '../stores/api';
import { Modal, ThemeToggle } from '../components';

export default function Customers(_props: RoutableProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filterType, setFilterType] = useState<'' | 'individual' | 'business'>('');
  const [filterTag, setFilterTag] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formType, setFormType] = useState<'individual' | 'business'>('individual');
  const [formName, setFormName] = useState('');
  const [formContactName, setFormContactName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formStreet, setFormStreet] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formPostcode, setFormPostcode] = useState('');
  const [formCountry, setFormCountry] = useState('Australia');
  const [formAbn, setFormAbn] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formTagInput, setFormTagInput] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [customersData, tagsData, sourcesData] = await Promise.all([
        getCustomers(),
        getCustomerTags(),
        getCustomerSources(),
      ]);
      setCustomers(customersData);
      setTags(tagsData);
      setSources(sourcesData);
    } catch (err) {
      setError('Failed to load customers');
    }
    setLoading(false);
  }

  async function loadCustomers() {
    const filters: { type?: 'individual' | 'business'; tag?: string; source?: string; isActive?: boolean; search?: string } = {};
    if (filterType) filters.type = filterType;
    if (filterTag) filters.tag = filterTag;
    if (filterSource) filters.source = filterSource;
    if (filterActive === 'active') filters.isActive = true;
    if (filterActive === 'inactive') filters.isActive = false;
    if (searchQuery) filters.search = searchQuery;

    const customersData = await getCustomers(filters);
    setCustomers(customersData);
  }

  useEffect(() => {
    if (!loading) {
      loadCustomers();
    }
  }, [filterType, filterTag, filterSource, filterActive, searchQuery]);

  function openCreateForm() {
    setEditingCustomer(null);
    setFormType('individual');
    setFormName('');
    setFormContactName('');
    setFormEmail('');
    setFormPhone('');
    setFormMobile('');
    setFormStreet('');
    setFormCity('');
    setFormState('');
    setFormPostcode('');
    setFormCountry('Australia');
    setFormAbn('');
    setFormTags([]);
    setFormTagInput('');
    setFormSource('');
    setFormNotes('');
    setFormIsActive(true);
    setError(null);
    setShowForm(true);
  }

  function openEditForm(customer: Customer) {
    setEditingCustomer(customer);
    setFormType(customer.type);
    setFormName(customer.name);
    setFormContactName(customer.contactName || '');
    setFormEmail(customer.email || '');
    setFormPhone(customer.phone || '');
    setFormMobile(customer.mobile || '');
    setFormStreet(customer.address?.street || '');
    setFormCity(customer.address?.city || '');
    setFormState(customer.address?.state || '');
    setFormPostcode(customer.address?.postcode || '');
    setFormCountry(customer.address?.country || 'Australia');
    setFormAbn(customer.abn || '');
    setFormTags([...(customer.tags || [])]);
    setFormTagInput('');
    setFormSource(customer.source || '');
    setFormNotes(customer.notes || '');
    setFormIsActive(customer.isActive);
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError(null);

    if (!formName) {
      setError('Name is required');
      return;
    }

    try {
      const address = (formStreet || formCity || formState || formPostcode || formCountry) ? {
        street: formStreet || undefined,
        city: formCity || undefined,
        state: formState || undefined,
        postcode: formPostcode || undefined,
        country: formCountry || undefined,
      } : undefined;

      if (editingCustomer) {
        const updates: UpdateCustomerInput = {
          type: formType,
          name: formName,
          contactName: formContactName || undefined,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          mobile: formMobile || undefined,
          address,
          abn: formAbn || undefined,
          tags: formTags,
          source: formSource || undefined,
          notes: formNotes || undefined,
          isActive: formIsActive,
        };
        await updateCustomer(editingCustomer.id, updates);
      } else {
        const input: CreateCustomerInput = {
          type: formType,
          name: formName,
          contactName: formContactName || undefined,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          mobile: formMobile || undefined,
          address,
          abn: formAbn || undefined,
          tags: formTags.length > 0 ? formTags : undefined,
          source: formSource || undefined,
          notes: formNotes || undefined,
          isActive: formIsActive,
        };
        await createCustomer(input);
      }

      setShowForm(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save customer');
    }
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`Deactivate customer "${customer.name}"?`)) return;
    await deleteCustomer(customer.id);
    loadData();
  }

  function addTag() {
    if (formTagInput.trim() && !formTags.includes(formTagInput.trim())) {
      setFormTags([...formTags, formTagInput.trim()]);
      setFormTagInput('');
    }
  }

  function removeTag(tag: string) {
    setFormTags(formTags.filter(t => t !== tag));
  }

  function handleTagKeyPress(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
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
          <span class="text-xl font-bold px-4">Customers</span>
        </div>
        <div class="flex-none flex items-center gap-2">
          <button class="btn btn-primary btn-sm" onClick={openCreateForm}>
            + Add Customer
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
                    placeholder="Search name, email, phone..."
                    class="input input-bordered input-sm w-full"
                    value={searchQuery}
                    onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                  />
                </div>

                {/* Type filter */}
                <div class="form-control">
                  <select
                    class="select select-bordered select-sm"
                    value={filterType}
                    onChange={(e) => setFilterType((e.target as HTMLSelectElement).value as '' | 'individual' | 'business')}
                  >
                    <option value="">All Types</option>
                    <option value="individual">Individual</option>
                    <option value="business">Business</option>
                  </select>
                </div>

                {/* Tag filter */}
                {tags.length > 0 && (
                  <div class="form-control">
                    <select
                      class="select select-bordered select-sm"
                      value={filterTag}
                      onChange={(e) => setFilterTag((e.target as HTMLSelectElement).value)}
                    >
                      <option value="">All Tags</option>
                      {tags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Source filter */}
                {sources.length > 0 && (
                  <div class="form-control">
                    <select
                      class="select select-bordered select-sm"
                      value={filterSource}
                      onChange={(e) => setFilterSource((e.target as HTMLSelectElement).value)}
                    >
                      <option value="">All Sources</option>
                      {sources.map(source => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Active filter */}
                <div class="btn-group">
                  <button
                    class={`btn btn-sm ${filterActive === 'all' ? 'btn-active' : ''}`}
                    onClick={() => setFilterActive('all')}
                  >
                    All
                  </button>
                  <button
                    class={`btn btn-sm ${filterActive === 'active' ? 'btn-active' : ''}`}
                    onClick={() => setFilterActive('active')}
                  >
                    Active
                  </button>
                  <button
                    class={`btn btn-sm ${filterActive === 'inactive' ? 'btn-active' : ''}`}
                    onClick={() => setFilterActive('inactive')}
                  >
                    Inactive
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Customers Table */}
          {customers.length === 0 ? (
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body text-center py-12">
                <h2 class="text-lg font-semibold mb-2">No customers found</h2>
                <p class="text-base-content/60 mb-4">
                  {searchQuery || filterType || filterTag || filterSource || filterActive !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Add your first customer to get started'}
                </p>
                {!searchQuery && !filterType && !filterTag && !filterSource && filterActive === 'all' && (
                  <button class="btn btn-primary" onClick={openCreateForm}>
                    Add your first customer
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div class="card bg-base-100 shadow-xl overflow-x-auto">
              <table class="table table-zebra">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Contact</th>
                    <th>Tags</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(customer => (
                    <tr
                      key={customer.id}
                      class="hover cursor-pointer"
                      onClick={() => openEditForm(customer)}
                    >
                      <td>
                        <div class="font-medium">{customer.name}</div>
                        {customer.contactName && (
                          <div class="text-xs text-base-content/60">
                            Contact: {customer.contactName}
                          </div>
                        )}
                      </td>
                      <td>
                        <span class={`badge badge-sm ${customer.type === 'business' ? 'badge-primary' : 'badge-secondary'}`}>
                          {customer.type === 'business' ? 'Business' : 'Individual'}
                        </span>
                      </td>
                      <td>
                        {customer.email && (
                          <div class="text-sm">{customer.email}</div>
                        )}
                        {(customer.phone || customer.mobile) && (
                          <div class="text-xs text-base-content/60">
                            {customer.mobile || customer.phone}
                          </div>
                        )}
                      </td>
                      <td>
                        <div class="flex flex-wrap gap-1">
                          {(customer.tags || []).slice(0, 3).map(tag => (
                            <span key={tag} class="badge badge-outline badge-xs">{tag}</span>
                          ))}
                          {(customer.tags?.length || 0) > 3 && (
                            <span class="badge badge-ghost badge-xs">+{customer.tags!.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span class={`badge badge-sm ${customer.isActive ? 'badge-success' : 'badge-ghost'}`}>
                          {customer.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          class="btn btn-ghost btn-xs text-error"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(customer);
                          }}
                          title="Deactivate"
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

          {/* Customer count */}
          <div class="text-sm text-base-content/60 mt-4 text-center">
            {customers.length} customer{customers.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      <Modal
        isOpen={showForm}
        title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
        onClose={() => setShowForm(false)}
      >
        <form onSubmit={handleSubmit} class="space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div class="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {/* Type and Name */}
          <div class="grid grid-cols-3 gap-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">Type *</span>
              </label>
              <select
                class="select select-bordered w-full"
                value={formType}
                onChange={(e) => setFormType((e.target as HTMLSelectElement).value as 'individual' | 'business')}
              >
                <option value="individual">Individual</option>
                <option value="business">Business</option>
              </select>
            </div>

            <div class="form-control col-span-2">
              <label class="label">
                <span class="label-text">{formType === 'business' ? 'Business Name *' : 'Full Name *'}</span>
              </label>
              <input
                type="text"
                class="input input-bordered w-full"
                value={formName}
                onInput={(e) => setFormName((e.target as HTMLInputElement).value)}
                placeholder={formType === 'business' ? 'Acme Pty Ltd' : 'John Smith'}
                required
              />
            </div>
          </div>

          {/* Contact Name (for business) */}
          {formType === 'business' && (
            <div class="form-control">
              <label class="label">
                <span class="label-text">Primary Contact</span>
              </label>
              <input
                type="text"
                class="input input-bordered w-full"
                value={formContactName}
                onInput={(e) => setFormContactName((e.target as HTMLInputElement).value)}
                placeholder="John Smith"
              />
            </div>
          )}

          {/* Contact Details */}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">Email</span>
              </label>
              <input
                type="email"
                class="input input-bordered w-full"
                value={formEmail}
                onInput={(e) => setFormEmail((e.target as HTMLInputElement).value)}
                placeholder="email@example.com"
              />
            </div>
            <div class="form-control">
              <label class="label">
                <span class="label-text">Phone</span>
              </label>
              <input
                type="tel"
                class="input input-bordered w-full"
                value={formPhone}
                onInput={(e) => setFormPhone((e.target as HTMLInputElement).value)}
                placeholder="(02) 1234 5678"
              />
            </div>
            <div class="form-control">
              <label class="label">
                <span class="label-text">Mobile</span>
              </label>
              <input
                type="tel"
                class="input input-bordered w-full"
                value={formMobile}
                onInput={(e) => setFormMobile((e.target as HTMLInputElement).value)}
                placeholder="0412 345 678"
              />
            </div>
          </div>

          {/* Address */}
          <div class="divider text-xs">Address</div>
          <div class="form-control">
            <input
              type="text"
              class="input input-bordered w-full"
              value={formStreet}
              onInput={(e) => setFormStreet((e.target as HTMLInputElement).value)}
              placeholder="Street address"
            />
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="form-control">
              <input
                type="text"
                class="input input-bordered w-full"
                value={formCity}
                onInput={(e) => setFormCity((e.target as HTMLInputElement).value)}
                placeholder="City"
              />
            </div>
            <div class="form-control">
              <input
                type="text"
                class="input input-bordered w-full"
                value={formState}
                onInput={(e) => setFormState((e.target as HTMLInputElement).value)}
                placeholder="State"
              />
            </div>
            <div class="form-control">
              <input
                type="text"
                class="input input-bordered w-full"
                value={formPostcode}
                onInput={(e) => setFormPostcode((e.target as HTMLInputElement).value)}
                placeholder="Postcode"
              />
            </div>
            <div class="form-control">
              <input
                type="text"
                class="input input-bordered w-full"
                value={formCountry}
                onInput={(e) => setFormCountry((e.target as HTMLInputElement).value)}
                placeholder="Country"
              />
            </div>
          </div>

          {/* Business details */}
          {formType === 'business' && (
            <div class="form-control">
              <label class="label">
                <span class="label-text">ABN</span>
              </label>
              <input
                type="text"
                class="input input-bordered w-full"
                value={formAbn}
                onInput={(e) => setFormAbn((e.target as HTMLInputElement).value)}
                placeholder="12 345 678 901"
              />
            </div>
          )}

          {/* Tags and Source */}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">Tags</span>
              </label>
              <div class="flex gap-2">
                <input
                  type="text"
                  class="input input-bordered flex-1"
                  value={formTagInput}
                  onInput={(e) => setFormTagInput((e.target as HTMLInputElement).value)}
                  onKeyPress={handleTagKeyPress}
                  placeholder="VIP, Trade, etc."
                  list="tag-list"
                />
                <button type="button" class="btn btn-outline" onClick={addTag}>Add</button>
              </div>
              <datalist id="tag-list">
                {tags.map(tag => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
              {formTags.length > 0 && (
                <div class="flex flex-wrap gap-2 mt-2">
                  {formTags.map(t => (
                    <span key={t} class="badge badge-lg gap-1">
                      {t}
                      <button type="button" class="btn btn-ghost btn-xs" onClick={() => removeTag(t)}>
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Source</span>
              </label>
              <input
                type="text"
                class="input input-bordered w-full"
                value={formSource}
                onInput={(e) => setFormSource((e.target as HTMLInputElement).value)}
                placeholder="Referral, Website, etc."
                list="source-list"
              />
              <datalist id="source-list">
                {sources.map(source => (
                  <option key={source} value={source} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Notes */}
          <div class="form-control">
            <label class="label">
              <span class="label-text">Notes</span>
            </label>
            <textarea
              class="textarea textarea-bordered w-full"
              rows={3}
              value={formNotes}
              onInput={(e) => setFormNotes((e.target as HTMLTextAreaElement).value)}
              placeholder="Notes about this customer..."
            />
          </div>

          {/* Active status */}
          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                class="toggle toggle-success"
                checked={formIsActive}
                onChange={(e) => setFormIsActive((e.target as HTMLInputElement).checked)}
              />
              <span class="label-text">{formIsActive ? 'Active' : 'Inactive'}</span>
            </label>
          </div>

          <div class="flex justify-end gap-2 pt-4">
            <button type="button" class="btn btn-ghost" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              {editingCustomer ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
