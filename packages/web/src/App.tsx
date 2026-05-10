import { useEffect, useState } from 'react'
import type { Product, ProductUrl, ProductStatus } from './types'
import * as api from './api'
import './App.css'

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null)
  const [urlsByProduct, setUrlsByProduct] = useState<Record<number, ProductUrl[]>>({})
  const [showCreateForm, setShowCreateForm] = useState(false)

  const loadProducts = async () => {
    const data = await api.fetchProducts(statusFilter || undefined)
    setProducts(data)
  }

  useEffect(() => { loadProducts() }, [statusFilter])

  const toggleExpand = async (productId: number) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null)
      return
    }
    setExpandedProduct(productId)
    const urls = await api.fetchProductUrls(productId)
    setUrlsByProduct((prev) => ({ ...prev, [productId]: urls }))
  }

  const handleStatusChange = async (id: number, action: 'pause' | 'activate' | 'archive') => {
    await api.updateProductStatus(id, action)
    loadProducts()
  }

  const handleDeleteProduct = async (id: number) => {
    await api.deleteProduct(id)
    if (expandedProduct === id) setExpandedProduct(null)
    loadProducts()
  }

  const handleUrlAdded = async (productId: number) => {
    const urls = await api.fetchProductUrls(productId)
    setUrlsByProduct((prev) => ({ ...prev, [productId]: urls }))
  }

  const handlePauseUrl = async (productId: number, urlId: number) => {
    await api.pauseProductUrl(urlId)
    handleUrlAdded(productId)
  }

  const handleDeleteUrl = async (productId: number, urlId: number) => {
    await api.deleteProductUrl(urlId)
    handleUrlAdded(productId)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Spawncamper</h1>
        <p>Product price tracker</p>
      </header>

      <div className="toolbar">
        <div className="filter-group">
          <label>Filter:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? 'Cancel' : '+ New Product'}
        </button>
      </div>

      {showCreateForm && (
        <CreateProductForm
          onCreated={() => { setShowCreateForm(false); loadProducts() }}
        />
      )}

      <div className="product-list">
        {products.length === 0 && (
          <p className="empty-state">No products found. Create one to get started.</p>
        )}
        {products.map((product) => (
          <div key={product.id} className="product-card">
            <div className="product-header" onClick={() => toggleExpand(product.id)}>
              <div className="product-info">
                <h3>{product.name}</h3>
                <div className="product-meta">
                  <StatusBadge status={product.status} />
                  {product.target_price != null && (
                    <span className="target-price">${product.target_price.toFixed(2)}</span>
                  )}
                </div>
              </div>
              <span className="expand-icon">{expandedProduct === product.id ? '▾' : '▸'}</span>
            </div>

            {expandedProduct === product.id && (
              <div className="product-detail">
                <div className="product-actions">
                  {product.status !== 'active' && (
                    <button className="btn btn-sm btn-success" onClick={() => handleStatusChange(product.id, 'activate')}>Activate</button>
                  )}
                  {product.status === 'active' && (
                    <button className="btn btn-sm btn-warn" onClick={() => handleStatusChange(product.id, 'pause')}>Pause</button>
                  )}
                  {product.status !== 'archived' && (
                    <button className="btn btn-sm btn-muted" onClick={() => handleStatusChange(product.id, 'archive')}>Archive</button>
                  )}
                  <button className="btn btn-sm btn-danger" onClick={() => handleDeleteProduct(product.id)}>Delete</button>
                </div>

                <div className="urls-section">
                  <h4>URLs</h4>
                  <UrlList
                    urls={urlsByProduct[product.id] ?? []}
                    productId={product.id}
                    onPause={handlePauseUrl}
                    onDelete={handleDeleteUrl}
                  />
                  <AddUrlForm productId={product.id} onAdded={() => handleUrlAdded(product.id)} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────

function StatusBadge({ status }: { status: ProductStatus }) {
  return <span className={`badge badge-${status}`}>{status}</span>
}

function CreateProductForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    await api.createProduct({
      name: name.trim(),
      target_price: targetPrice ? Number(targetPrice) : null,
    })
    setName('')
    setTargetPrice('')
    setSubmitting(false)
    onCreated()
  }

  return (
    <form className="create-form" onSubmit={handleSubmit}>
      <h3>New Product</h3>
      <div className="form-row">
        <input
          type="text"
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="number"
          step="0.01"
          placeholder="Target price (optional)"
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  )
}

function UrlList({
  urls,
  productId,
  onPause,
  onDelete,
}: {
  urls: ProductUrl[]
  productId: number
  onPause: (productId: number, urlId: number) => void
  onDelete: (productId: number, urlId: number) => void
}) {
  if (urls.length === 0) return <p className="empty-urls">No URLs added yet.</p>

  return (
    <ul className="url-list">
      {urls.map((u) => (
        <li key={u.id} className={u.active ? '' : 'url-inactive'}>
          <div className="url-info">
            <span className="url-retailer">{u.retailer}</span>
            <a href={u.url} target="_blank" rel="noopener noreferrer" className="url-link">
              {u.url}
            </a>
          </div>
          <div className="url-actions">
            {u.active && (
              <button className="btn btn-xs btn-warn" onClick={() => onPause(productId, u.id)}>Pause</button>
            )}
            <button className="btn btn-xs btn-danger" onClick={() => onDelete(productId, u.id)}>Delete</button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function AddUrlForm({ productId, onAdded }: { productId: number; onAdded: () => void }) {
  const [url, setUrl] = useState('')
  const [retailer, setRetailer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || !retailer.trim()) return
    setSubmitting(true)
    await api.createProductUrl(productId, {
      url: url.trim(),
      retailer: retailer.trim(),
    })
    setUrl('')
    setRetailer('')
    setSubmitting(false)
    onAdded()
  }

  return (
    <form className="add-url-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <input
          type="text"
          placeholder="Retailer (e.g. Amazon)"
          value={retailer}
          onChange={(e) => setRetailer(e.target.value)}
          required
        />
        <input
          type="url"
          placeholder="Product URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button className="btn btn-sm btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Adding...' : '+ Add URL'}
        </button>
      </div>
    </form>
  )
}

export default App
