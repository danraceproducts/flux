import { useEffect, useState } from 'preact/hooks';
import { route, RoutableProps } from 'preact-router';
import type { Product, CreateProductInput, UpdateProductInput } from '@flux/shared';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductCategories,
  getProductBrands,
} from '../stores/api';
import { Modal, ThemeToggle } from '../components';

// Format currency for display
function formatCurrency(amount: number, currency: string = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
  }).format(amount);
}

export default function Products(_props: RoutableProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSubcategory, setFormSubcategory] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formCostPrice, setFormCostPrice] = useState('');
  const [formSellPrice, setFormSellPrice] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFitment, setFormFitment] = useState<string[]>([]);
  const [formFitmentInput, setFormFitmentInput] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [productsData, categoriesData, brandsData] = await Promise.all([
        getProducts(),
        getProductCategories(),
        getProductBrands(),
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
      setBrands(brandsData);
    } catch (err) {
      setError('Failed to load products');
    }
    setLoading(false);
  }

  async function loadProducts() {
    const filters: { category?: string; brand?: string; isActive?: boolean; search?: string } = {};
    if (filterCategory) filters.category = filterCategory;
    if (filterBrand) filters.brand = filterBrand;
    if (filterActive === 'active') filters.isActive = true;
    if (filterActive === 'inactive') filters.isActive = false;
    if (searchQuery) filters.search = searchQuery;

    const productsData = await getProducts(filters);
    setProducts(productsData);
  }

  useEffect(() => {
    if (!loading) {
      loadProducts();
    }
  }, [filterCategory, filterBrand, filterActive, searchQuery]);

  function openCreateForm() {
    setEditingProduct(null);
    setFormSku('');
    setFormName('');
    setFormCategory('');
    setFormSubcategory('');
    setFormBrand('');
    setFormCostPrice('');
    setFormSellPrice('');
    setFormDescription('');
    setFormFitment([]);
    setFormFitmentInput('');
    setFormIsActive(true);
    setError(null);
    setShowForm(true);
  }

  function openEditForm(product: Product) {
    setEditingProduct(product);
    setFormSku(product.sku);
    setFormName(product.name);
    setFormCategory(product.category);
    setFormSubcategory(product.subcategory);
    setFormBrand(product.brand);
    setFormCostPrice(product.costPrice > 0 ? String(product.costPrice) : '');
    setFormSellPrice(String(product.sellPrice));
    setFormDescription(product.description);
    setFormFitment([...product.fitment]);
    setFormFitmentInput('');
    setFormIsActive(product.isActive);
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError(null);

    if (!formSku || !formName || !formCategory || !formSellPrice) {
      setError('SKU, name, category, and sell price are required');
      return;
    }

    const sellPrice = parseFloat(formSellPrice);
    if (isNaN(sellPrice) || sellPrice < 0) {
      setError('Sell price must be a valid positive number');
      return;
    }

    const costPrice = formCostPrice ? parseFloat(formCostPrice) : undefined;
    if (formCostPrice && (isNaN(costPrice!) || costPrice! < 0)) {
      setError('Cost price must be a valid positive number');
      return;
    }

    try {
      if (editingProduct) {
        const updates: UpdateProductInput = {
          sku: formSku,
          name: formName,
          category: formCategory,
          subcategory: formSubcategory,
          brand: formBrand,
          costPrice,
          sellPrice,
          description: formDescription,
          fitment: formFitment,
          isActive: formIsActive,
        };
        await updateProduct(editingProduct.id, updates);
      } else {
        const input: CreateProductInput = {
          sku: formSku,
          name: formName,
          category: formCategory,
          subcategory: formSubcategory || undefined,
          brand: formBrand || undefined,
          costPrice,
          sellPrice,
          description: formDescription || undefined,
          fitment: formFitment.length > 0 ? formFitment : undefined,
          isActive: formIsActive,
        };
        await createProduct(input);
      }

      setShowForm(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    }
  }

  async function handleDelete(product: Product) {
    if (!confirm(`Deactivate product "${product.name}"?`)) return;
    await deleteProduct(product.id);
    loadData();
  }

  function addFitment() {
    if (formFitmentInput.trim() && !formFitment.includes(formFitmentInput.trim())) {
      setFormFitment([...formFitment, formFitmentInput.trim()]);
      setFormFitmentInput('');
    }
  }

  function removeFitment(fitment: string) {
    setFormFitment(formFitment.filter(f => f !== fitment));
  }

  function handleFitmentKeyPress(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFitment();
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
          <span class="text-xl font-bold px-4">Products</span>
        </div>
        <div class="flex-none flex items-center gap-2">
          <button class="btn btn-primary btn-sm" onClick={openCreateForm}>
            + Add Product
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
                    placeholder="Search SKU, name, fitment..."
                    class="input input-bordered input-sm w-full"
                    value={searchQuery}
                    onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                  />
                </div>

                {/* Category filter */}
                <div class="form-control">
                  <select
                    class="select select-bordered select-sm"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory((e.target as HTMLSelectElement).value)}
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Brand filter */}
                <div class="form-control">
                  <select
                    class="select select-bordered select-sm"
                    value={filterBrand}
                    onChange={(e) => setFilterBrand((e.target as HTMLSelectElement).value)}
                  >
                    <option value="">All Brands</option>
                    {brands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>

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

          {/* Products Table */}
          {products.length === 0 ? (
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body text-center py-12">
                <h2 class="text-lg font-semibold mb-2">No products found</h2>
                <p class="text-base-content/60 mb-4">
                  {searchQuery || filterCategory || filterBrand || filterActive !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Add your first product to get started'}
                </p>
                {!searchQuery && !filterCategory && !filterBrand && filterActive === 'all' && (
                  <button class="btn btn-primary" onClick={openCreateForm}>
                    Add your first product
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div class="card bg-base-100 shadow-xl overflow-x-auto">
              <table class="table table-zebra">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Brand</th>
                    <th class="text-right">Sell Price</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr
                      key={product.id}
                      class="hover cursor-pointer"
                      onClick={() => openEditForm(product)}
                    >
                      <td class="font-mono text-sm">{product.sku}</td>
                      <td>
                        <div class="font-medium">{product.name}</div>
                        {product.fitment.length > 0 && (
                          <div class="text-xs text-base-content/60">
                            {product.fitment.slice(0, 2).join(', ')}
                            {product.fitment.length > 2 && ` +${product.fitment.length - 2} more`}
                          </div>
                        )}
                      </td>
                      <td>
                        <span class="badge badge-outline badge-sm">{product.category}</span>
                        {product.subcategory && (
                          <span class="text-xs text-base-content/60 ml-1">/ {product.subcategory}</span>
                        )}
                      </td>
                      <td>{product.brand || '-'}</td>
                      <td class="text-right font-medium">
                        {formatCurrency(product.sellPrice, product.currency)}
                      </td>
                      <td>
                        <span class={`badge badge-sm ${product.isActive ? 'badge-success' : 'badge-ghost'}`}>
                          {product.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          class="btn btn-ghost btn-xs text-error"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(product);
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

          {/* Product count */}
          <div class="text-sm text-base-content/60 mt-4 text-center">
            {products.length} product{products.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      <Modal
        isOpen={showForm}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        onClose={() => setShowForm(false)}
      >
        <form onSubmit={handleSubmit} class="space-y-4">
          {error && (
            <div class="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div class="grid grid-cols-2 gap-4">
            {/* SKU */}
            <div class="form-control">
              <label class="label">
                <span class="label-text">SKU *</span>
              </label>
              <input
                type="text"
                class="input input-bordered w-full font-mono"
                value={formSku}
                onInput={(e) => setFormSku((e.target as HTMLInputElement).value)}
                placeholder="BK-WIL-001"
                required
              />
            </div>

            {/* Name */}
            <div class="form-control col-span-2 sm:col-span-1">
              <label class="label">
                <span class="label-text">Name *</span>
              </label>
              <input
                type="text"
                class="input input-bordered w-full"
                value={formName}
                onInput={(e) => setFormName((e.target as HTMLInputElement).value)}
                placeholder="Wilwood 6-Pot Brake Kit"
                required
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            {/* Category */}
            <div class="form-control">
              <label class="label">
                <span class="label-text">Category *</span>
              </label>
              <input
                type="text"
                class="input input-bordered w-full"
                value={formCategory}
                onInput={(e) => setFormCategory((e.target as HTMLInputElement).value)}
                placeholder="Brakes"
                list="category-list"
                required
              />
              <datalist id="category-list">
                {categories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            {/* Subcategory */}
            <div class="form-control">
              <label class="label">
                <span class="label-text">Subcategory</span>
              </label>
              <input
                type="text"
                class="input input-bordered w-full"
                value={formSubcategory}
                onInput={(e) => setFormSubcategory((e.target as HTMLInputElement).value)}
                placeholder="Brake Kits"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            {/* Brand */}
            <div class="form-control">
              <label class="label">
                <span class="label-text">Brand</span>
              </label>
              <input
                type="text"
                class="input input-bordered w-full"
                value={formBrand}
                onInput={(e) => setFormBrand((e.target as HTMLInputElement).value)}
                placeholder="Wilwood"
                list="brand-list"
              />
              <datalist id="brand-list">
                {brands.map(brand => (
                  <option key={brand} value={brand} />
                ))}
              </datalist>
            </div>

            {/* Active status */}
            <div class="form-control">
              <label class="label">
                <span class="label-text">Status</span>
              </label>
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
          </div>

          <div class="grid grid-cols-2 gap-4">
            {/* Cost Price */}
            <div class="form-control">
              <label class="label">
                <span class="label-text">Cost Price (AUD)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                class="input input-bordered w-full"
                value={formCostPrice}
                onInput={(e) => setFormCostPrice((e.target as HTMLInputElement).value)}
                placeholder="0.00"
              />
            </div>

            {/* Sell Price */}
            <div class="form-control">
              <label class="label">
                <span class="label-text">Sell Price (AUD) *</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                class="input input-bordered w-full"
                value={formSellPrice}
                onInput={(e) => setFormSellPrice((e.target as HTMLInputElement).value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div class="form-control">
            <label class="label">
              <span class="label-text">Description</span>
            </label>
            <textarea
              class="textarea textarea-bordered w-full"
              rows={3}
              value={formDescription}
              onInput={(e) => setFormDescription((e.target as HTMLTextAreaElement).value)}
              placeholder="Product description..."
            />
          </div>

          {/* Fitment */}
          <div class="form-control">
            <label class="label">
              <span class="label-text">Vehicle Fitment</span>
            </label>
            <div class="flex gap-2">
              <input
                type="text"
                class="input input-bordered flex-1"
                value={formFitmentInput}
                onInput={(e) => setFormFitmentInput((e.target as HTMLInputElement).value)}
                onKeyPress={handleFitmentKeyPress}
                placeholder="e.g., Nissan Patrol Y62"
              />
              <button
                type="button"
                class="btn btn-outline"
                onClick={addFitment}
              >
                Add
              </button>
            </div>
            {formFitment.length > 0 && (
              <div class="flex flex-wrap gap-2 mt-2">
                {formFitment.map(f => (
                  <span key={f} class="badge badge-lg gap-1">
                    {f}
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      onClick={() => removeFitment(f)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div class="flex justify-end gap-2 pt-4">
            <button type="button" class="btn btn-ghost" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              {editingProduct ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
