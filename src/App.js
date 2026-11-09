import React, { useState, useEffect, useMemo } from "react";
import "./App.css";

// 1. API CONFIGURATION
const API_BASE = "https://hiring.harrisons.my/api/mock/sales-orders";
const API_KEY = "hssb-assessment-mock-2026";

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: "10" },
  { value: 25, label: "25" },
  { value: 50, label: "50" },
  { value: 100, label: "100 (Max/All)" },
];


// 2. API SERVICE
async function apiRequest(endpoint, signal) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "GET",
    headers: {
      "x-assessment-key": API_KEY,
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`API Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

function fetchOrders(filters, signal) {
  const params = new URLSearchParams();
  params.set("page", filters.page);
  params.set("pageSize", filters.pageSize);

  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.site) params.set("site", filters.site);

  return apiRequest(`?${params.toString()}`, signal);
}

function fetchMetadata(signal) {
  return apiRequest("/meta", signal);
}

function fetchOrderDetails(salesId, signal) {
  if (!salesId) throw new Error("Sales order number is missing.");
  return apiRequest(`/${encodeURIComponent(salesId)}`, signal);
}

// 3. DATA HELPERS
function getValue(object, paths, fallback = null) {
  for (const path of paths) {
    const value = path
      .split(".")
      .reduce((current, key) => current?.[key], object);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return fallback;
}

function getRecords(response) {
  const candidates = [
    response?.data,
    response?.data?.data,
    response?.orders,
    response?.results,
  ];
  return candidates.find(Array.isArray) || [];
}

function normalizeOrder(order) {
  // FIXED: Typo "orde." changed to "order."
  let rawAmount =
    order.HAR_TotalSOAmount ?? 
    order.IAR_TotalSOAmount ??
    order.financials?.total_amount ??
    order.financials?.totalAmount ??
    order.SalesAmount ??
    order.SalesTotal ??
    order.TotalAmount ??
    order.totalAmount ??
    order.OrderAmount ??
    order.Amount ??
    order.amount ??
    order.total ??
    0;

  if (rawAmount === 0) {
    const possibleAmountKey = Object.keys(order).find(
      (key) =>
        key.toLowerCase().includes("amount") || key.toLowerCase() === "total"
    );
    if (possibleAmountKey) rawAmount = order[possibleAmountKey];
  }

  if (typeof rawAmount === "string") {
    rawAmount = parseFloat(rawAmount.replace(/[^0-9.-]+/g, ""));
  }

  return {
    ...order,
    id: String(getValue(order, ["SalesId", "salesId", "order_id"]) || ""),
    customer:
      getValue(order, ["SalesName", "customer.company_name"]) || "Unknown",
    customerAccount: getValue(order, ["CustAccount"]) || "—",
    site: getValue(order, ["InventSiteId", "site"]) || "—",
    date: getValue(order, ["CreatedDateTime1", "order_date"]) || null,
    shippingDate: getValue(order, ["ShippingDateRequested"]) || null,
    status: getValue(order, ["SalesStatus", "status"]) || "Unknown",
    documentStatus: getValue(order, ["DocumentStatus"]) || "—",
    amount: isNaN(rawAmount) ? 0 : rawAmount,
  };
}

// 4. SUMMARY & PAGINATION HELPERS
function getSummary(response) {
  return response?.summary || response?.data?.summary || {};
}

function getPaginationInfo(response, page, pageSize, count) {
  const summary = getSummary(response);
  const totalValue = getValue(
    response,
    ["total", "totalCount", "totalOrders", "pagination.total"],
    getValue(summary, ["total_orders", "totalOrders", "total", "count"])
  );
  const pagesValue = getValue(response, [
    "totalPages",
    "pages",
    "pagination.totalPages",
  ]);

  const total = totalValue == null ? null : Number(totalValue);
  const apiPages = pagesValue == null ? null : Number(pagesValue);

  const totalPages =
    Number.isFinite(apiPages) && apiPages > 0
      ? apiPages
      : Number.isFinite(total) && total >= 0
      ? Math.max(1, Math.ceil(total / pageSize))
      : null;

  return {
    total,
    totalPages,
    hasMore: totalPages !== null ? page < totalPages : count === pageSize,
  };
}

// 5. FORMATTING HELPERS
function formatCurrency(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusClass(status) {
  const value = String(status).toLowerCase();
  if (value.includes("cancel")) return "status-cancelled";
  if (
    value.includes("complete") ||
    value.includes("invoice") ||
    value.includes("deliver") ||
    value.includes("ship")
  )
    return "status-completed";
  if (
    value.includes("open") ||
    value.includes("pending") ||
    value.includes("process") ||
    value.includes("draft")
  )
    return "status-pending";
  return "status-default";
}

// 6. COMPONENTS
function StatCard({ title, value, icon, color, description }) {
  return (
    <div className="card">
      <div className="stat-header">
        <div>
          <p className="stat-title">{title}</p>
          <h2 className="stat-value">{value}</h2>
          <p className="stat-description">{description}</p>
        </div>
        <div className={`stat-icon ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function OrderDetails({ order, onClose }) {
  if (!order) return null;
  const normalized = normalizeOrder(order);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>Order Details</h2>
            <p>{normalized.id}</p>
          </div>
          <button className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="detail-row">
            <strong>Order Number</strong>
            <span>{normalized.id || "—"}</span>
          </div>
          <div className="detail-row">
            <strong>Customer</strong>
            <span>{normalized.customer}</span>
          </div>
          <div className="detail-row">
            <strong>Branch / Site</strong>
            <span>{normalized.site}</span>
          </div>
          <div className="detail-row">
            <strong>Order Date</strong>
            <span>{formatDate(normalized.date)}</span>
          </div>
          <div className="detail-row">
            <strong>Status</strong>
            <span className={`badge ${getStatusClass(normalized.status)}`}>
              {normalized.status}
            </span>
          </div>
          <div className="detail-row">
            <strong>Order Amount</strong>
            <strong>{formatCurrency(normalized.amount)}</strong>
          </div>

          <h3 className="items-heading">Additional Order Information</h3>
          <div className="detail-row">
            <strong>Customer Account</strong>
            <span>{order.CustAccount || "—"}</span>
          </div>
          <div className="detail-row">
            <strong>Document Status</strong>
            <span>{order.DocumentStatus || "—"}</span>
          </div>
          <div className="detail-row">
            <strong>Sales Group</strong>
            <span>{order.SalesGroup || "—"}</span>
          </div>
          <div className="detail-row">
            <strong>Requested Shipping</strong>
            <span>{formatDate(order.ShippingDateRequested) || "—"}</span>
          </div>
        </div>
        <button className="btn-primary modal-close-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

// 7. MAIN APPLICATION
export default function App() {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({});
  const [metadata, setMetadata] = useState({ sites: [], statuses: [] });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metaError, setMetaError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [site, setSite] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalOrders, setTotalOrders] = useState(null);
  const [totalPages, setTotalPages] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch Metadata
  useEffect(() => {
    const controller = new AbortController();
    async function loadMetadata() {
      try {
        const response = await fetchMetadata(controller.signal);
        const rawStatuses = getValue(response, ["statuses", "data.statuses"], []);
        const rawSites = getValue(response, ["sites", "data.sites"], ["B20", "C30", "D40", "E50"]); 

        setMetadata({
          statuses: rawStatuses
            .map((s) => (typeof s === "string" ? s : s.SalesStatus || s.status))
            .filter(Boolean),
          sites: rawSites
            .map((s) => (typeof s === "string" ? s : s.InventSiteId || s.id))
            .filter(Boolean),
        });
      } catch (err) {
        if (err.name !== "AbortError") setMetaError(err.message);
      }
    }
    loadMetadata();
    return () => controller.abort();
  }, []);

  // Fetch Orders
  useEffect(() => {
    const controller = new AbortController();
    async function loadOrders() {
      setLoading(true);
      setError("");
      try {
        const response = await fetchOrders(
          { page, pageSize, search, status, site },
          controller.signal
        );

        const records = getRecords(response);
        const normalizedOrders = records.map(normalizeOrder);

        setOrders(normalizedOrders);
        setSummary(getSummary(response));

        const pagination = getPaginationInfo(response, page, pageSize, records.length);
        setTotalOrders(pagination.total);
        setTotalPages(pagination.totalPages);
        setHasMore(pagination.hasMore);
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(err.message || "Unable to load orders.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    const timer = setTimeout(loadOrders, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, pageSize, search, status, site, refreshKey]);

  // Handle Filters & Sorting
  const handleSearch = (val) => { setSearch(val); setPage(1); };
  const handleStatusChange = (val) => { setStatus(val); setPage(1); };
  const handleSiteChange = (val) => { setSite(val); setPage(1); };
  const clearFilters = () => { setSearch(""); setStatus(""); setSite(""); setPage(1); };
  const handlePageSizeChange = (val) => { setPageSize(Number(val)); setPage(1); };

  const handleSort = (field) => {
    if (sortField === field)
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // DYNAMIC DROPDOWNS
  const availableStatuses = useMemo(() => {
    const fromOrders = orders.map((o) => o.status).filter(Boolean);
    return Array.from(new Set([...metadata.statuses, ...fromOrders])).sort();
  }, [orders, metadata.statuses]);

  const availableSites = useMemo(() => {
    const fromOrders = orders.map((o) => o.site).filter(Boolean);
    return Array.from(new Set([...metadata.sites, ...fromOrders])).sort();
  }, [orders, metadata.sites]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const first = a[sortField], second = b[sortField];
      if (first == null && second == null) return 0;
      if (first == null) return 1;
      if (second == null) return -1;

      let comparison;
      if (sortField === "date")
        comparison = new Date(first).getTime() - new Date(second).getTime();
      else if (sortField === "amount")
        comparison = Number(first) - Number(second);
      else
        comparison = String(first).localeCompare(String(second), undefined, {
          numeric: true,
          sensitivity: "base",
        });

      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [orders, sortField, sortOrder]);

  // Fetch Single Order Details
  async function handleViewOrder(salesId) {
    if (!salesId) return setDetailError("Invalid Order ID.");
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError("");
    setSelectedOrder(null);
    try {
      const response = await fetchOrderDetails(salesId, controller.signal);
      const detail =
        response?.data?.order ?? response?.data ?? response?.order ?? response;
      setSelectedOrder(detail);
    } catch (err) {
      if (err.name !== "AbortError") setDetailError(err.message);
    } finally {
      if (!controller.signal.aborted) setDetailLoading(false);
    }
  }

  // Dashboard Stats (FIXED: Accurate math using exact API keys)
  const getGlobalCount = (keyword) => {
    if (!summary || Object.keys(summary).length === 0) return null;
    let count = 0;
    let found = false;

    Object.keys(summary).forEach((key) => {
      if (key.toLowerCase().replace(/[^a-z]/g, "").includes(keyword)) {
        const val = summary[key];
        if (typeof val === "number") {
          count += val;
          found = true;
        } else if (typeof val === "object" && typeof val.count === "number") {
          count += val.count;
          found = true;
        }
      }
    });
    return found ? count : null;
  };

  const calculatePageCount = (keyword) =>
    orders.filter((o) => String(o.status).toLowerCase().includes(keyword)).length;

  // Added "total_orders" to the array
  const totalCount =
    getValue(summary, ["total_orders", "total", "totalOrders", "count", "Total"]) ??
    totalOrders;

  const openCount =
    getGlobalCount("open") ||
    getGlobalCount("pending") ||
    getGlobalCount("draft") ||
    calculatePageCount("open");

  // FIXED: Math logic to add Invoiced (360) + Delivered (300) = 660
  const completedCount =
    (getGlobalCount("invoice") || 0) + (getGlobalCount("deliver") || 0) ||
    (calculatePageCount("deliver") + calculatePageCount("invoice"));

  const cancelledCount =
    getGlobalCount("cancel") || calculatePageCount("cancel");

  const totalValue = getValue(summary, [
    "total_order_value",
    "totalValue",
    "totalAmount",
    "total_amount",
    "TotalAmount",
    "totalSales",
  ]);
  
  const fallbackValue = orders.reduce(
    (sum, order) => sum + (Number(order.amount) || 0),
    0
  );
  const displayValue =
    totalValue != null ? totalValue : orders.length > 0 ? fallbackValue : 0;

  return (
    <div className="app-container">
      <header className="main-header">
        <div>
          <h1>Sales Order Monitoring</h1>
          <p>Harrisons Sabah Sdn Bhd — IT Assessment</p>
        </div>
        <button
          className="btn-refresh"
          onClick={() => setRefreshKey((v) => v + 1)}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </header>

      <main className="main-content">
        <section className="page-heading">
          <div>
            <p className="eyebrow">OVERVIEW</p>
            <h2>Sales Dashboard</h2>
            <p>Monitor sales orders across all branches.</p>
          </div>
          <div className="connection-status">
            <span className="connection-dot"></span> Assessment Mock API
          </div>
        </section>

        {error && (
          <div className="error-message">
            <strong>Unable to load sales orders</strong>
            <p>{error}</p>
            <button onClick={() => setRefreshKey((v) => v + 1)}>Retry</button>
          </div>
        )}
        {metaError && (
          <div className="warning-message">
            Unable to load metadata: {metaError}
          </div>
        )}

        <section className="dashboard">
          <StatCard
            title="Total Orders"
            value={totalCount == null ? "—" : Number(totalCount).toLocaleString()}
            description="Total sales orders"
            icon="▣"
            color="blue"
          />
          <StatCard
            title="Total Order Value"
            value={formatCurrency(displayValue)}
            description="Combined order value"
            icon="RM"
            color="purple"
          />
          <StatCard
            title="Open / Pending"
            value={openCount == null ? "—" : Number(openCount).toLocaleString()}
            description="Awaiting completion"
            icon="◷"
            color="orange"
          />
          <StatCard
            title="Completed"
            value={completedCount == null ? "—" : Number(completedCount).toLocaleString()}
            description="Invoiced / delivered"
            icon="✓"
            color="green"
          />
          <StatCard
            title="Cancelled"
            value={cancelledCount == null ? "—" : Number(cancelledCount).toLocaleString()}
            description="Cancelled orders"
            icon="×"
            color="red"
          />
        </section>

        <section className="orders-section">
          <div className="orders-heading">
            <div>
              <h3>Sales Orders</h3>
              <p>Search, filter and monitor sales transactions.</p>
            </div>
            <span className="record-count">
              {totalOrders == null
                ? `${orders.length} records on this page`
                : `${totalOrders.toLocaleString()} total records`}
            </span>
          </div>

          <div className="filters">
            <div className="search-wrapper">
              <span className="search-icon">⌕</span>
              <input
                type="search"
                placeholder="Search order number or customer..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            <select
              value={site}
              onChange={(e) => handleSiteChange(e.target.value)}
            >
              <option value="">All Branches</option>
              {availableSites.map((siteVal) => (
                <option key={siteVal} value={siteVal}>
                  {siteVal}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="">All Statuses</option>
              {availableStatuses.map((statusVal) => (
                <option key={statusVal} value={statusVal}>
                  {statusVal}
                </option>
              ))}
            </select>

            <button className="btn-clear" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>
                    <button onClick={() => handleSort("id")}>
                      Order Number ↕
                    </button>
                  </th>
                  <th>Customer</th>
                  <th>Branch / Site</th>
                  <th>
                    <button onClick={() => handleSort("date")}>
                      Order Date ↕
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort("status")}>
                      Status ↕
                    </button>
                  </th>
                  <th className="amount-column">
                    <button onClick={() => handleSort("amount")}>
                      Amount ↕
                    </button>
                  </th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7">
                      <div className="state-message">
                        <div className="loader"></div>
                        <p>Loading sales orders...</p>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="7">
                      <div className="state-message">
                        Unable to retrieve orders.
                      </div>
                    </td>
                  </tr>
                ) : sortedOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7">
                      <div className="state-message">
                        <div className="empty-icon">▤</div>
                        <strong>No sales orders found</strong>
                        <p>Try changing your search or filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedOrders.map((order, index) => (
                    <tr key={order.id || `order-${index}`}>
                      <td>
                        <strong className="order-number">
                          {order.id || "—"}
                        </strong>
                      </td>
                      <td>{order.customer}</td>
                      <td>{order.site}</td>
                      <td>{formatDate(order.date)}</td>
                      <td>
                        <span
                          className={`badge ${getStatusClass(order.status)}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="amount-column">
                        {formatCurrency(order.amount)}
                      </td>
                      <td>
                        <button
                          className="btn-view"
                          disabled={!order.id || detailLoading}
                          onClick={() => handleViewOrder(order.id)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <div className="pagination-info">
              Page {page} {totalPages != null ? `of ${totalPages}` : ""}
            </div>
            <div className="pagination-controls">
              <label htmlFor="pageSize">Show:</label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(e.target.value)}
              >
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </button>
              <button
                disabled={!hasMore || loading}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <footer className="app-footer">
          <p>Sales Order Monitoring System</p>
          <p>Harrisons Sabah Sdn Bhd | IT Assessment</p>
        </footer>
      </main>

      {detailLoading && (
        <div className="modal-overlay">
          <div className="loading-modal">
            <div className="loader"></div>Loading order details...
          </div>
        </div>
      )}
      {detailError && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Unable to load order</h2>
              <button className="btn-close" onClick={() => setDetailError("")}>
                ×
              </button>
            </div>
            <p className="error-text">{detailError}</p>
            <button
              className="btn-primary modal-close-button"
              onClick={() => setDetailError("")}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {selectedOrder && (
        <OrderDetails
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
