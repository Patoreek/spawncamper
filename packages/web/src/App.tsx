import { useEffect, useState } from 'react'
import type { Product, ProductUrl, ProductStatus, LatestPriceCheck, CronStatus, UrlData, ProductPriceSummary, NotifyKind, PriceHistoryPoint, UrlFailureSummary, Category } from './types'
import * as api from './api'
import { PriceHistoryChart } from './PriceHistoryChart'
import './App.css'

const NOTIFY_KIND_LABELS: Record<NotifyKind, string> = {
  any_drop: 'On any price drop',
  target_price: 'When ≤ target price',
  percent_below_initial: '% below initial price',
  absolute_below: 'Below fixed amount',
  back_in_stock: 'When back in stock',
  out_of_stock: 'When goes out of stock',
}

const NOTIFY_VALUE_LABEL: Record<NotifyKind, string | null> = {
  any_drop: null,
  target_price: null, // uses product.target_price
  percent_below_initial: '%',
  absolute_below: '$',
  back_in_stock: null,
  out_of_stock: null,
}

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null)
  const [urlsByProduct, setUrlsByProduct] = useState<Record<number, ProductUrl[]>>({})
  const [latestPrices, setLatestPrices] = useState<Record<number, LatestPriceCheck[]>>({})
  const [summaries, setSummaries] = useState<Record<number, ProductPriceSummary>>({})
  const [historyByProduct, setHistoryByProduct] = useState<Record<number, PriceHistoryPoint[]>>({})
  const [failureSummariesByProduct, setFailureSummariesByProduct] = useState<Record<number, UrlFailureSummary[]>>({})
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [checkingProduct, setCheckingProduct] = useState<number | null>(null)
  const [scanningUrl, setScanningUrl] = useState<number | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [testingProduct, setTestingProduct] = useState<number | null>(null)
  const [testFeedback, setTestFeedback] = useState<{ productId: number; ok: boolean; message: string } | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  const loadCategories = async () => {
    const data = await api.fetchCategories()
    setCategories(data)
  }

  useEffect(() => { loadCategories() }, [])

  const loadProducts = async () => {
    const data = await api.fetchProducts(statusFilter || undefined)
    setProducts(data)
    // Fetch summaries for all products so table columns are populated
    const entries = await Promise.all(
      data.map(async (p) => [p.id, await api.fetchPriceSummary(p.id)] as const)
    )
    setSummaries(Object.fromEntries(entries))
  }

  useEffect(() => { loadProducts() }, [statusFilter])

  const toggleExpand = async (productId: number) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null)
      return
    }
    setExpandedProduct(productId)
    const [urls, prices, history, failures] = await Promise.all([
      api.fetchProductUrls(productId),
      api.fetchLatestPrices(productId),
      api.fetchProductPriceHistory(productId),
      api.fetchUrlFailureSummaries(productId),
    ])
    setUrlsByProduct((prev) => ({ ...prev, [productId]: urls }))
    setLatestPrices((prev) => ({ ...prev, [productId]: prices }))
    setHistoryByProduct((prev) => ({ ...prev, [productId]: history }))
    setFailureSummariesByProduct((prev) => ({ ...prev, [productId]: failures }))
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

  const refreshSummary = async (productId: number) => {
    const [prices, summary, history, failures] = await Promise.all([
      api.fetchLatestPrices(productId),
      api.fetchPriceSummary(productId),
      api.fetchProductPriceHistory(productId),
      api.fetchUrlFailureSummaries(productId),
    ])
    setLatestPrices((prev) => ({ ...prev, [productId]: prices }))
    setSummaries((prev) => ({ ...prev, [productId]: summary }))
    setHistoryByProduct((prev) => ({ ...prev, [productId]: history }))
    setFailureSummariesByProduct((prev) => ({ ...prev, [productId]: failures }))
  }

  const handleCheckPrices = async (productId: number) => {
    setCheckingProduct(productId)
    try {
      await api.checkProductPrices(productId)
      await refreshSummary(productId)
    } finally {
      setCheckingProduct(null)
    }
  }

  const handleTestMessage = async (productId: number) => {
    setTestingProduct(productId)
    setTestFeedback(null)
    try {
      const res = await api.sendNotifyTest(productId)
      setTestFeedback({
        productId,
        ok: res.success,
        message: res.success ? 'Sent' : (res.error?.message ?? 'Send failed'),
      })
    } catch (err) {
      setTestFeedback({
        productId,
        ok: false,
        message: err instanceof Error ? err.message : 'Send failed',
      })
    } finally {
      setTestingProduct(null)
      setTimeout(() => setTestFeedback((curr) => (curr?.productId === productId ? null : curr)), 4000)
    }
  }

  const handleSaveNotifyRule = async (productId: number, rule: { enabled: boolean; kind: NotifyKind | null; value: number | null }) => {
    await api.updateNotifyRule(productId, rule)
    await loadProducts()
  }

  const handleCategoryChange = async (productId: number, categoryId: number | null) => {
    await api.updateProductCategory(productId, categoryId)
    await Promise.all([loadProducts(), loadCategories()])
  }

  const handleScanUrl = async (productId: number, urlId: number) => {
    setScanningUrl(urlId)
    setScanError(null)
    try {
      await api.scanProductUrl(urlId)
      await refreshSummary(productId)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanningUrl(null)
    }
  }

  const getPriceForUrl = (productId: number, urlId: number): LatestPriceCheck | undefined => {
    return latestPrices[productId]?.find((p) => p.product_url_id === urlId)
  }

  const getFailureForUrl = (productId: number, urlId: number): UrlFailureSummary | undefined => {
    return failureSummariesByProduct[productId]?.find((s) => s.product_url_id === urlId)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Spawncamper</h1>
        <p>Product price tracker</p>
      </header>

      <UrlScanner />
      <CronPanel />

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
          categories={categories}
          onCreated={() => { setShowCreateForm(false); loadProducts(); loadCategories() }}
        />
      )}

      {products.length === 0 ? (
        <p className="empty-state">No products found. Create one to get started.</p>
      ) : (
        <ProductTableGrouped
          products={products}
          categories={categories}
          summaries={summaries}
          expandedProduct={expandedProduct}
          toggleExpand={toggleExpand}
          checkingProduct={checkingProduct}
          scanningUrl={scanningUrl}
          scanError={scanError}
          testingProduct={testingProduct}
          testFeedback={testFeedback}
          urlsByProduct={urlsByProduct}
          historyByProduct={historyByProduct}
          onCheckPrices={handleCheckPrices}
          onTestMessage={handleTestMessage}
          onStatusChange={handleStatusChange}
          onDeleteProduct={handleDeleteProduct}
          onSaveNotifyRule={handleSaveNotifyRule}
          onCategoryChange={handleCategoryChange}
          onPauseUrl={handlePauseUrl}
          onDeleteUrl={handleDeleteUrl}
          onScanUrl={handleScanUrl}
          onUrlAdded={handleUrlAdded}
          getPriceForUrl={getPriceForUrl}
          getFailureForUrl={getFailureForUrl}
        />
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────

function ProductTableGrouped({
  products, categories, summaries, expandedProduct, toggleExpand,
  checkingProduct, scanningUrl, scanError, testingProduct, testFeedback,
  urlsByProduct, historyByProduct,
  onCheckPrices, onTestMessage, onStatusChange, onDeleteProduct,
  onSaveNotifyRule, onCategoryChange, onPauseUrl, onDeleteUrl, onScanUrl, onUrlAdded,
  getPriceForUrl, getFailureForUrl,
}: {
  products: Product[]
  categories: Category[]
  summaries: Record<number, ProductPriceSummary>
  expandedProduct: number | null
  toggleExpand: (id: number) => void
  checkingProduct: number | null
  scanningUrl: number | null
  scanError: string | null
  testingProduct: number | null
  testFeedback: { productId: number; ok: boolean; message: string } | null
  urlsByProduct: Record<number, ProductUrl[]>
  historyByProduct: Record<number, PriceHistoryPoint[]>
  onCheckPrices: (id: number) => void
  onTestMessage: (id: number) => void
  onStatusChange: (id: number, action: 'pause' | 'activate' | 'archive') => void
  onDeleteProduct: (id: number) => void
  onSaveNotifyRule: (id: number, rule: { enabled: boolean; kind: NotifyKind | null; value: number | null }) => Promise<void>
  onCategoryChange: (id: number, categoryId: number | null) => void
  onPauseUrl: (productId: number, urlId: number) => void
  onDeleteUrl: (productId: number, urlId: number) => void
  onScanUrl: (productId: number, urlId: number) => void
  onUrlAdded: (productId: number) => void
  getPriceForUrl: (productId: number, urlId: number) => LatestPriceCheck | undefined
  getFailureForUrl: (productId: number, urlId: number) => UrlFailureSummary | undefined
}) {
  // Build a map from category id to name
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))

  // Group products: keyed by category name (or 'Uncategorised')
  const grouped = new Map<string, Product[]>()
  for (const p of products) {
    const catName = p.category_id ? (categoryMap.get(p.category_id) ?? 'Uncategorised') : 'Uncategorised'
    if (!grouped.has(catName)) grouped.set(catName, [])
    grouped.get(catName)!.push(p)
  }

  // Sort groups: named categories alphabetically, then Uncategorised last
  const sortedGroups = [...grouped.entries()].sort((a, b) => {
    if (a[0] === 'Uncategorised') return 1
    if (b[0] === 'Uncategorised') return -1
    return a[0].localeCompare(b[0])
  })

  const renderProductRow = (product: Product) => {
    const s = summaries[product.id]
    const isExpanded = expandedProduct === product.id
    const hasPriceData = s && s.initialPrice !== null

    return (
      <div key={product.id} className={`table-row-group ${isExpanded ? 'expanded' : ''}`}>
        <div className="table-row" onClick={() => toggleExpand(product.id)}>
          <span className="col-name">
            <span className="product-name">{product.name}</span>
            {product.target_price != null && (
              <span className="target-price">Target: ${product.target_price.toFixed(2)}</span>
            )}
          </span>
          <span className="col-status">
            <StatusBadge status={product.status} />
          </span>
          <span className="col-price mono">
            {hasPriceData ? `$${s.initialPrice!.toFixed(2)}` : '--'}
          </span>
          <span className="col-price mono lowest-price">
            {hasPriceData ? `$${s.currentLowest!.toFixed(2)}` : '--'}
          </span>
          <span className="col-store">
            {hasPriceData && s.currentLowestRetailer ? s.currentLowestRetailer : '--'}
          </span>
          <span className="col-change">
            {hasPriceData ? (
              <ChangeIndicator value={s.percentageDecrease} />
            ) : '--'}
          </span>
          <span className="col-expand">
            <span className="expand-icon">{isExpanded ? '▾' : '▸'}</span>
          </span>
        </div>

        {isExpanded && (
          <div className="table-detail">
            <div className="product-actions">
              <button
                className="btn btn-sm btn-primary"
                onClick={(e) => { e.stopPropagation(); onCheckPrices(product.id) }}
                disabled={checkingProduct === product.id}
              >
                {checkingProduct === product.id ? 'Checking...' : 'Check Prices'}
              </button>
              <button
                className="btn btn-sm btn-muted"
                onClick={(e) => { e.stopPropagation(); onTestMessage(product.id) }}
                disabled={testingProduct === product.id}
                title="Send a summary message via Telegram"
              >
                {testingProduct === product.id ? 'Sending...' : 'Send Test Message'}
              </button>
              {testFeedback?.productId === product.id && (
                <span className={`test-feedback ${testFeedback.ok ? 'ok' : 'err'}`}>
                  {testFeedback.message}
                </span>
              )}
              {product.status !== 'active' && (
                <button className="btn btn-sm btn-success" onClick={() => onStatusChange(product.id, 'activate')}>Activate</button>
              )}
              {product.status === 'active' && (
                <button className="btn btn-sm btn-warn" onClick={() => onStatusChange(product.id, 'pause')}>Pause</button>
              )}
              {product.status !== 'archived' && (
                <button className="btn btn-sm btn-muted" onClick={() => onStatusChange(product.id, 'archive')}>Archive</button>
              )}
              <button className="btn btn-sm btn-danger" onClick={() => onDeleteProduct(product.id)}>Delete</button>
            </div>

            <CategorySelector
              categories={categories}
              currentCategoryId={product.category_id}
              onChange={(catId) => onCategoryChange(product.id, catId)}
            />

            <NotifyRuleEditor
              product={product}
              onSave={(rule) => onSaveNotifyRule(product.id, rule)}
            />

            <div className="urls-section">
              <h4>URLs</h4>
              {scanError && <p className="scan-error">{scanError}</p>}
              <UrlList
                urls={urlsByProduct[product.id] ?? []}
                productId={product.id}
                onPause={onPauseUrl}
                onDelete={onDeleteUrl}
                onScan={onScanUrl}
                scanningUrl={scanningUrl}
                getPriceForUrl={(urlId) => getPriceForUrl(product.id, urlId)}
                getFailureForUrl={(urlId) => getFailureForUrl(product.id, urlId)}
              />
              <AddUrlForm productId={product.id} onAdded={() => onUrlAdded(product.id)} />
            </div>

            <div className="history-section">
              <h4>Price History (AUD)</h4>
              <PriceHistoryChart history={historyByProduct[product.id] ?? []} />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="product-tables">
      {sortedGroups.map(([groupName, groupProducts]) => {
        let totalInitial = 0
        let totalLowest = 0
        let hasAnyPrice = false
        for (const p of groupProducts) {
          const s = summaries[p.id]
          if (s && s.initialPrice !== null && s.currentLowest !== null) {
            totalInitial += s.initialPrice
            totalLowest += s.currentLowest
            hasAnyPrice = true
          }
        }
        const totalChange = hasAnyPrice && totalInitial > 0
          ? ((totalInitial - totalLowest) / totalInitial) * 100
          : null

        return (
          <div key={groupName} className="category-group">
            <h3 className="category-heading">{groupName}</h3>
            <div className="product-table">
              <div className="table-header">
                <span className="col-name">Product</span>
                <span className="col-status">Status</span>
                <span className="col-price">Initial</span>
                <span className="col-price">Lowest</span>
                <span className="col-store">Best Store</span>
                <span className="col-change">Change</span>
                <span className="col-expand"></span>
              </div>
              {groupProducts.map(renderProductRow)}
              {hasAnyPrice && (
                <div className="table-row table-total-row">
                  <span className="col-name">
                    <span className="total-label">Total</span>
                  </span>
                  <span className="col-status"></span>
                  <span className="col-price mono">${totalInitial.toFixed(2)}</span>
                  <span className="col-price mono lowest-price">${totalLowest.toFixed(2)}</span>
                  <span className="col-store"></span>
                  <span className="col-change">
                    {totalChange !== null ? <ChangeIndicator value={totalChange} /> : '--'}
                  </span>
                  <span className="col-expand"></span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CategorySelector({
  categories,
  currentCategoryId,
  onChange,
}: {
  categories: Category[]
  currentCategoryId: number | null
  onChange: (categoryId: number | null) => void
}) {
  const [mode, setMode] = useState<'select' | 'create'>('select')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (val === '__new__') {
      setMode('create')
      return
    }
    onChange(val === '' ? null : Number(val))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    const cat = await api.createCategory(newName.trim())
    setNewName('')
    setMode('select')
    setSaving(false)
    onChange(cat.id)
  }

  return (
    <div className="category-section">
      <h4>Category</h4>
      {mode === 'select' ? (
        <select
          className="category-select"
          value={currentCategoryId ?? ''}
          onChange={handleChange}
        >
          <option value="">Uncategorised</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value="__new__">+ Create new...</option>
        </select>
      ) : (
        <form className="category-create-form" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="New category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            required
          />
          <button className="btn btn-xs btn-primary" type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create'}
          </button>
          <button className="btn btn-xs btn-muted" type="button" onClick={() => setMode('select')}>
            Cancel
          </button>
        </form>
      )}
    </div>
  )
}

function ChangeIndicator({ value }: { value: number | null }) {
  if (value === null || value === 0) return <span className="change-neutral">0%</span>
  if (value > 0) return <span className="change-down">-{value.toFixed(1)}%</span>
  return <span className="change-up">+{Math.abs(value).toFixed(1)}%</span>
}

function StatusBadge({ status }: { status: ProductStatus }) {
  return <span className={`badge badge-${status}`}>{status}</span>
}

function CronPanel() {
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null)
  const [triggering, setTriggering] = useState(false)

  const loadStatus = async () => {
    const status = await api.fetchCronStatus()
    setCronStatus(status)
  }

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleTrigger = async () => {
    setTriggering(true)
    await api.triggerCronRun()
    setTimeout(loadStatus, 1000)
    setTriggering(false)
  }

  return (
    <div className="panel cron-panel">
      <div className="panel-header">
        <h3>Scheduled Checks</h3>
        <button
          className="btn btn-sm btn-primary"
          onClick={handleTrigger}
          disabled={triggering || cronStatus?.isRunning === true}
        >
          {cronStatus?.isRunning ? 'Running...' : triggering ? 'Starting...' : 'Run All Now'}
        </button>
      </div>
      {cronStatus && (
        <div className="cron-details">
          <div className="cron-row">
            <span className="cron-label">Schedule</span>
            <span>{cronStatus.schedule}</span>
          </div>
          <div className="cron-row">
            <span className="cron-label">Status</span>
            <span>
              {cronStatus.isRunning ? (
                <span className="badge badge-active">Running</span>
              ) : cronStatus.lastRunStatus === 'success' ? (
                <span className="badge badge-active">Last run OK</span>
              ) : cronStatus.lastRunStatus === 'error' ? (
                <span className="badge badge-paused">Last run failed</span>
              ) : (
                <span className="badge badge-archived">No runs yet</span>
              )}
            </span>
          </div>
          {cronStatus.lastRunAt && (
            <>
              <div className="cron-row">
                <span className="cron-label">Last run</span>
                <span>{formatDate(cronStatus.lastRunAt)}</span>
              </div>
              <div className="cron-row">
                <span className="cron-label">Checked</span>
                <span>{cronStatus.productsChecked} products, {cronStatus.urlsChecked} URLs</span>
              </div>
            </>
          )}
          {cronStatus.lastRunError && (
            <div className="cron-row cron-error">
              <span className="cron-label">Error</span>
              <span>{cronStatus.lastRunError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function UrlScanner() {
  const [url, setUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<UrlData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setScanning(true)
    setResult(null)
    setError(null)
    try {
      const data = await api.scanArbitraryUrl(url.trim())
      if ('error' in data) {
        setError((data as any).error?.message || 'Scan failed')
      } else {
        setResult(data)
      }
    } catch {
      setError('Failed to scan URL')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="panel scanner-panel">
      <h3>URL Scanner</h3>
      <p className="panel-desc">Test any product URL to see extracted price data</p>
      <form className="scanner-form" onSubmit={handleScan}>
        <input
          type="url"
          placeholder="https://www.example.com/product..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button className="btn btn-primary" type="submit" disabled={scanning}>
          {scanning ? 'Scanning...' : 'Scan'}
        </button>
      </form>
      {result && (
        <div className="scan-result">
          <div className="scan-result-row">
            <span className="scan-label">Price</span>
            <span className="scan-price">
              {result.price !== null ? formatPriceNative(result.price, result.currency) : 'Not found'}
            </span>
          </div>
          {result.title && (
            <div className="scan-result-row">
              <span className="scan-label">Title</span>
              <span>{result.title}</span>
            </div>
          )}
          <div className="scan-result-row">
            <span className="scan-label">Stock</span>
            <span>{result.in_stock ? 'In Stock' : 'Out of Stock'}</span>
          </div>
          <div className="scan-result-row">
            <span className="scan-label">Source</span>
            <span className="badge badge-archived">{result.source}</span>
          </div>
        </div>
      )}
      {error && <p className="scan-error">{error}</p>}
    </div>
  )
}

function CreateProductForm({ categories, onCreated }: { categories: Category[]; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [categoryMode, setCategoryMode] = useState<'select' | 'create'>('select')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (val === '__new__') {
      setCategoryMode('create')
      setSelectedCategoryId('')
      return
    }
    setSelectedCategoryId(val)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)

    let categoryId: number | null = null
    if (categoryMode === 'create' && newCategoryName.trim()) {
      const cat = await api.createCategory(newCategoryName.trim())
      categoryId = cat.id
    } else if (selectedCategoryId) {
      categoryId = Number(selectedCategoryId)
    }

    await api.createProduct({
      name: name.trim(),
      target_price: targetPrice ? Number(targetPrice) : null,
      category_id: categoryId,
    })
    setName('')
    setTargetPrice('')
    setSelectedCategoryId('')
    setNewCategoryName('')
    setCategoryMode('select')
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
        {categoryMode === 'select' ? (
          <select value={selectedCategoryId} onChange={handleCategoryChange}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value="__new__">+ Create new...</option>
          </select>
        ) : (
          <div className="inline-create-category">
            <input
              type="text"
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              autoFocus
            />
            <button className="btn btn-xs btn-muted" type="button" onClick={() => setCategoryMode('select')}>
              Cancel
            </button>
          </div>
        )}
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
  onScan,
  scanningUrl,
  getPriceForUrl,
  getFailureForUrl,
}: {
  urls: ProductUrl[]
  productId: number
  onPause: (productId: number, urlId: number) => void
  onDelete: (productId: number, urlId: number) => void
  onScan: (productId: number, urlId: number) => void
  scanningUrl: number | null
  getPriceForUrl: (urlId: number) => LatestPriceCheck | undefined
  getFailureForUrl: (urlId: number) => UrlFailureSummary | undefined
}) {
  if (urls.length === 0) return <p className="empty-urls">No URLs added yet.</p>

  return (
    <ul className="url-list">
      {urls.map((u) => {
        const priceData = getPriceForUrl(u.id)
        const failure = getFailureForUrl(u.id)
        return (
          <li key={u.id} className={u.active ? '' : 'url-inactive'}>
            <div className="url-info">
              <div className="url-top-row">
                <span className="url-retailer">
                  {u.retailer}
                  {failure && failure.failures_last_24h > 0 && (
                    <span
                      className="failure-badge"
                      title={`${failure.failures_last_24h} scrape failure${failure.failures_last_24h === 1 ? '' : 's'} in last 24h` +
                        (failure.last_failure_at ? ` (latest: ${formatDate(failure.last_failure_at)})` : '')}
                    >
                      ⚠
                    </span>
                  )}
                </span>
                {priceData && (
                  <span className="url-price">
                    {formatPriceNative(priceData.price, priceData.currency)}
                    <span className={`stock-indicator ${priceData.in_stock ? 'in-stock' : 'out-of-stock'}`}>
                      {priceData.in_stock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </span>
                )}
              </div>
              <a href={u.url} target="_blank" rel="noopener noreferrer" className="url-link">
                {u.url}
              </a>
              {priceData && (
                <span className="url-checked-at">
                  Last checked: {formatDate(priceData.created_at)}
                </span>
              )}
            </div>
            <div className="url-actions">
              <button
                className="btn btn-xs btn-primary"
                onClick={() => onScan(productId, u.id)}
                disabled={scanningUrl === u.id}
              >
                {scanningUrl === u.id ? 'Scanning...' : 'Scan'}
              </button>
              {u.active && (
                <button className="btn btn-xs btn-warn" onClick={() => onPause(productId, u.id)}>Pause</button>
              )}
              <button className="btn btn-xs btn-danger" onClick={() => onDelete(productId, u.id)}>Delete</button>
            </div>
          </li>
        )
      })}
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

function NotifyRuleEditor({
  product,
  onSave,
}: {
  product: Product
  onSave: (rule: { enabled: boolean; kind: NotifyKind | null; value: number | null }) => Promise<void>
}) {
  const [enabled, setEnabled] = useState<boolean>(!!product.notify_enabled)
  const [kind, setKind] = useState<NotifyKind>(product.notify_kind ?? 'any_drop')
  const [value, setValue] = useState<string>(product.notify_value !== null ? String(product.notify_value) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Reset local state when product prop changes (e.g. after refresh)
  useEffect(() => {
    setEnabled(!!product.notify_enabled)
    setKind(product.notify_kind ?? 'any_drop')
    setValue(product.notify_value !== null ? String(product.notify_value) : '')
  }, [product.id, product.notify_enabled, product.notify_kind, product.notify_value])

  const valueUnit = NOTIFY_VALUE_LABEL[kind]
  const needsValue = valueUnit !== null
  const needsTargetPrice = kind === 'target_price'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const parsedValue = needsValue && value.trim() !== '' ? Number(value) : null
      await onSave({
        enabled,
        kind: enabled ? kind : null,
        value: enabled ? parsedValue : null,
      })
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt((curr) => (curr && Date.now() - curr >= 2000 ? null : curr)), 2100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="notify-section">
      <h4>Notifications</h4>
      <form className="notify-form" onSubmit={handleSubmit}>
        <label className="notify-toggle">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>Enabled</span>
        </label>

        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as NotifyKind)}
          disabled={!enabled}
        >
          {(Object.keys(NOTIFY_KIND_LABELS) as NotifyKind[]).map((k) => (
            <option key={k} value={k}>{NOTIFY_KIND_LABELS[k]}</option>
          ))}
        </select>

        {needsValue && (
          <div className="notify-value-input">
            <input
              type="number"
              step="0.01"
              placeholder={valueUnit === '%' ? 'e.g. 15' : 'e.g. 400'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={!enabled}
              required={enabled}
            />
            <span className="notify-unit">{valueUnit}</span>
          </div>
        )}

        {needsTargetPrice && product.target_price === null && (
          <span className="notify-hint">Set the product's target price above to use this rule.</span>
        )}
        {needsTargetPrice && product.target_price !== null && (
          <span className="notify-hint">Uses target: ${product.target_price.toFixed(2)}</span>
        )}

        <button className="btn btn-sm btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>

        {savedAt && <span className="notify-saved">Saved</span>}
        {error && <span className="notify-error">{error}</span>}
      </form>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────

function formatPriceNative(price: number, currency: string): string {
  const c = (currency ?? 'AUD').toUpperCase()
  if (c === 'AUD') return `$${price.toFixed(2)}`
  if (c === 'USD') return `US$${price.toFixed(2)}`
  if (c === 'GBP') return `£${price.toFixed(2)}`
  if (c === 'EUR') return `€${price.toFixed(2)}`
  return `${c} ${price.toFixed(2)}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

export default App
