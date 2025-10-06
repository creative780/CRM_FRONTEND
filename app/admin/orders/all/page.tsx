"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Pencil, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardNavbar from "@/app/components/navbar/DashboardNavbar";
import { toast } from "react-hot-toast";
import { ordersApi, Order as ApiOrder } from "@/lib/orders-api";

// ---- types for sorting & arrows ----
type Order = {
  id: number;
  company: string;
  name: string;
  phone: string;
  detail: string;
  date: string;
  price: number;
  advance: number;
  remaining: number;
  location: string;
  status: string;
  zone?: string;
  finalPrice?: number;
  items?: ApiOrder["items"];
  assignedSalesPerson?: string;
  assignedDesigner?: string;
  assignedProductionPerson?: string;
  stage?: string;
};
const numericFields: Array<keyof Order> = ["id", "price", "advance", "remaining"];
const summarizeItems = (items?: ApiOrder["items"]) => {
  if (!items || items.length === 0) return "Custom Order";
  return items
    .map((item) => {
      const qty = item.quantity && item.quantity > 0 ? `${item.quantity} x ` : "";
      return `${qty}${item.name}`;
    })
    .join(", ");
};

export default function Page() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<keyof Order | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);

  const getEffectivePrice = (o: Order) =>
    typeof o.finalPrice === "number" ? o.finalPrice : o.price;

  // Load orders from API
  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiOrders = await ordersApi.getOrders();
        
        // Convert API orders to display format
        const convertedOrders: Order[] = apiOrders.map((order: ApiOrder) => {
          const summary = summarizeItems(order.items);
          const detail = order.specs ? `${summary} - ${order.specs}` : summary;
          const quotation = order.quotation;
          return {
            id: order.id,
            company: order.client_name,
            name: order.client_name,
            phone: order.phone || "+971-XXXXXXXXX",
            detail,
            date: order.created_at.split('T')[0],
            price: quotation?.grand_total || 0,
            advance: quotation?.advance_paid || 0,
            remaining: quotation?.remaining || 0,
            location: "Dubai",
            status:
              order.status === 'new'
                ? 'Pending'
                : order.status === 'active' || order.status === 'in_progress'
                ? 'In Progress'
                : order.status === 'completed'
                ? 'Completed'
                : 'Pending',
            items: order.items,
            finalPrice: quotation?.grand_total,
            // Add assigned personnel information
            assignedSalesPerson: order.assigned_sales_person || quotation?.sales_person || 'Not assigned',
            assignedDesigner: order.assigned_designer || 'Not assigned',
            assignedProductionPerson: order.assigned_production_person || 'Not assigned',
            stage: order.stage || order.status,
          };
        });


        
        setOrders(convertedOrders);
      } catch (err: any) {
        setError(err.message || 'Failed to load orders');
        console.error('Error loading orders:', err);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, []);

  // Read & clear one-time flash, then toast (when navigated from Quotation Save)
  useEffect(() => {
    try {
      const flashRaw =
        typeof window !== "undefined" &&
        window.localStorage.getItem("orders_flash");
      if (flashRaw) {
        const { id, name } = JSON.parse(flashRaw) || {};
        if (id) {
          toast.success(`Order #${id}${name ? ` (${name})` : ""} added to table`);
        }
        window.localStorage.removeItem("orders_flash");
      }
    } catch {}
  }, []);

  const handleEditClick = async (order: Order) => {
    setSelectedOrder(order);
    setShowModal(true);
    setLoadingOrderDetails(true);
    
    // Fetch complete order data from backend
    try {
      const fullOrderData = await ordersApi.getOrder(order.id);
      console.log('=== FULL ORDER DATA FROM BACKEND ===');
      console.log('Order ID:', order.id);
      console.log('Full order data:', fullOrderData);
      console.log('Assigned sales person:', fullOrderData.assigned_sales_person);
      console.log('Assigned designer:', fullOrderData.assigned_designer);
      console.log('Assigned production person:', fullOrderData.assigned_production_person);
      console.log('Stage:', fullOrderData.stage);
      console.log('Status:', fullOrderData.status);
      console.log('Items:', fullOrderData.items);
      console.log('Quotation:', fullOrderData.quotation);
      
      // Update the selected order with complete backend data
      setSelectedOrder({
        ...order,
        // Update with real backend data
        assignedSalesPerson: fullOrderData.assigned_sales_person || 'Not assigned',
        assignedDesigner: fullOrderData.assigned_designer || 'Not assigned',
        assignedProductionPerson: fullOrderData.assigned_production_person || 'Not assigned',
        stage: fullOrderData.stage || fullOrderData.status,
        items: fullOrderData.items || [],
        // Update other fields with real data
        company: fullOrderData.company_name || fullOrderData.client_name,
        name: fullOrderData.client_name,
        phone: fullOrderData.phone || order.phone,
        detail: fullOrderData.specs || order.detail,
        status: fullOrderData.status,
        // Update pricing from quotation if available
        price: fullOrderData.quotation?.grand_total || order.price,
        advance: fullOrderData.quotation?.advance_paid || order.advance,
        remaining: fullOrderData.quotation?.remaining || order.remaining,
      });
    } catch (error) {
      console.error('Failed to fetch full order data:', error);
      toast.error('Failed to load complete order details');
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const closeModal = () => {
    setSelectedOrder(null);
    setShowModal(false);
    setShowStatusDropdown(false);
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;

    try {
      // Update order in backend
      await ordersApi.updateOrder(selectedOrder.id, {
        client_name: selectedOrder.company, // Using company as client_name
        specs: selectedOrder.detail.split(' - ')[1] || '',
        urgency:
          selectedOrder.status === 'Urgent'
            ? 'Urgent'
            : selectedOrder.status === 'In Progress'
            ? 'High'
            : 'Normal',
        status:
          selectedOrder.status === 'Completed'
            ? 'completed'
            : selectedOrder.status === 'In Progress'
            ? 'in_progress'
            : 'new',
        items: selectedOrder.items,
      });

      // Update local state
      setOrders((prev) =>
        prev.map((o) => (o.id === selectedOrder.id ? selectedOrder : o))
      );

      toast.success(`Order #${selectedOrder.id} updated successfully!`);
      closeModal();
    } catch (err: any) {
      toast.error(`Failed to update order: ${err.message}`);
      console.error('Error updating order:', err);
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    
    try {
      await ordersApi.deleteOrder(orderId);
      setOrders(prev => prev.filter(order => order.id !== orderId));
      toast.success('Order deleted successfully!');
    } catch (err: any) {
      toast.error(`Failed to delete order: ${err.message}`);
      console.error('Error deleting order:', err);
    }
  };

  const handleSort = (field: keyof Order) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const renderSortArrow = (field: keyof Order) => {
    // Show arrows on numeric-like fields including custom handling for "price"
    const eligible = new Set<keyof Order>([...numericFields, "date"]);
    if (!eligible.has(field)) return null;

    const isActive = sortField === field;
    const Icon = sortDirection === "asc" && isActive ? ChevronUp : ChevronDown;
    return (
      <span
        className="inline-flex items-center cursor-pointer"
        onClick={() => handleSort(field)}
      >
        <Icon className={`w-4 h-4 ml-1 ${isActive ? "text-white" : "text-white"}`} />
      </span>
    );
  };

  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        const searchLower = search.toLowerCase();
        const searchMatch =
          order.name.toLowerCase().includes(searchLower) ||
          order.phone.toLowerCase().includes(searchLower) ||
          order.detail.toLowerCase().includes(searchLower) ||
          order.company.toLowerCase().includes(searchLower);

        const statusMatch = selectedStatus === "All" || order.status === selectedStatus;

        const monthMatch =
          selectedMonth === "All" ||
          new Date(order.date).toLocaleString("default", { month: "long" }) === selectedMonth;

        return searchMatch && statusMatch && monthMatch;
      })
      .sort((a, b) => {
        if (!sortField) return 0;

        // Special cases
        if (sortField === "date") {
          const at = new Date(a.date).getTime();
          const bt = new Date(b.date).getTime();
          return sortDirection === "asc" ? at - bt : bt - at;
        }
        if (sortField === "price") {
          const ap = getEffectivePrice(a);
          const bp = getEffectivePrice(b);
          return sortDirection === "asc" ? ap - bp : bp - ap;
        }

        // Generic numeric sort
        const aValue = a[sortField] as any;
        const bValue = b[sortField] as any;

        if (typeof aValue === "number" && typeof bValue === "number") {
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
        }
        return 0;
      });
  }, [orders, search, selectedStatus, selectedMonth, sortField, sortDirection]);

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">
      <DashboardNavbar />
      <br />
      <div className="max-w-[96rem] mx-auto h-full flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <h2 className="text-3xl font-bold text-[#891F1A]">Orders</h2>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Status Dropdown */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border border-gray-300 text-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#891F1A]"
            >
              <option value="All">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="In Progress">In Progress</option>
              <option value="Pending">Pending</option>
            </select>

            {/* Month Filter */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border border-gray-300 text-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#891F1A]"
            >
              <option value="All">All Months</option>
              <option value="January">January</option>
              <option value="February">February</option>
              <option value="March">March</option>
              <option value="April">April</option>
              <option value="May">May</option>
              <option value="June">June</option>
              <option value="July">July</option>
              <option value="August">August</option>
              <option value="September">September</option>
              <option value="October">October</option>
              <option value="November">November</option>
              <option value="December">December</option>
            </select>

            {/* Search Bar */}
            <input
              type="text"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-black text-black placeholder-gray-500"
            />

            {/* Add Order Button */}
            <button
              onClick={() => (window.location.href = "/admin/order-lifecycle")}
              className="bg-[#891F1A] text-white border border-[#891F1A] hover:bg-red-900 hover:text-white font-semibold px-4 py-2 rounded transition-all duration-200"
            >
              Add Order
            </button>
          </div>
        </div>

        <div className="flex-1 rounded-xl shadow bg-white overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg text-gray-600">Loading orders...</div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-lg text-red-600 mb-4">Error: {error}</div>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-[#891F1A] text-white px-4 py-2 rounded hover:bg-red-800"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className="w-full h-full overflow-y-auto overflow-x-auto scrollbar-custom">
              <table className="w-full table-auto text-xs divide-y divide-gray-100 text-center border-collapse">
              <thead className="font-semibold sticky top-0 z-10">
                <tr className="bg-[#891F1A] rounded-t-lg w-full">
                  <th
                    className="px-3 py-3 text-white sticky top-0 z-20 rounded-tl-lg cursor-pointer min-w-[80px]"
                    onClick={() => handleSort("id")}
                  >
                    <div className="flex items-center justify-center gap-1 text-center">
                      ID {renderSortArrow("id")}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-white sticky top-0 z-20 cursor-pointer text-center min-w-[120px]"
                    onClick={() => handleSort("company")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Company {renderSortArrow("company")}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-white sticky top-0 z-20 cursor-pointer text-center min-w-[120px]"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Customer {renderSortArrow("name")}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-white sticky top-0 z-20 cursor-pointer text-center min-w-[120px]"
                    onClick={() => handleSort("phone")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Phone {renderSortArrow("phone")}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-white sticky top-0 z-20 cursor-pointer text-center min-w-[200px]"
                    onClick={() => handleSort("detail")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Order Details {renderSortArrow("detail")}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-white sticky top-0 z-20 cursor-pointer text-center min-w-[100px]"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Date {renderSortArrow("date")}
                    </div>
                  </th>
                  {/* PRICE column (shows finalPrice if present, else price) */}
                  <th
                    className="px-3 py-3 text-white sticky top-0 z-20 cursor-pointer text-center min-w-[100px]"
                    onClick={() => handleSort("price")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Price {renderSortArrow("price")}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-white sticky top-0 z-20 cursor-pointer text-center min-w-[100px]"
                    onClick={() => handleSort("advance")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Advance {renderSortArrow("advance")}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-white sticky top-0 z-20 cursor-pointer text-center min-w-[100px]"
                    onClick={() => handleSort("remaining")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Remaining {renderSortArrow("remaining")}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-white sticky top-0 z-20 cursor-pointer text-center min-w-[100px]"
                    onClick={() => handleSort("location")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Location {renderSortArrow("location")}
                    </div>
                  </th>
                  <th className="px-3 py-3 text-white sticky top-0 z-20 text-center min-w-[100px]">
                    Status
                  </th>
                  <th className="px-3 py-3 text-white sticky top-0 z-20 rounded-tr-lg text-center min-w-[120px] relative">
                    <div className="absolute inset-0 bg-[#891F1A] rounded-tr-lg"></div>
                    <div className="relative z-10">Actions</div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.map((order) => (
                  <tr 
                    key={order.id} 
                    className="text-gray-800 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100"
                    onClick={() => handleEditClick(order)}
                  >
                    <td className="px-3 py-3 text-center font-semibold">{order.id}</td>
                    <td className="px-3 py-3 text-center">{order.company}</td>
                    <td className="px-3 py-3 text-center">{order.name}</td>
                    <td className="px-3 py-3 text-center">{order.phone}</td>
                    <td className="px-3 py-3 text-center max-w-[200px] truncate" title={order.detail}>{order.detail}</td>
                    <td className="px-3 py-3 text-center">{order.date}</td>
                    {/* Effective price display */}
                    <td className="px-3 py-3 text-center font-semibold">
                      ${getEffectivePrice(order)}
                    </td>
                    <td className="px-3 py-3 text-center font-semibold">${order.advance}</td>
                    <td className="px-3 py-3 text-center font-semibold">${order.remaining}</td>
                    <td className="px-3 py-3 text-center">{order.location}</td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                          order.status === "Completed"
                            ? "bg-green-100 text-green-800"
                            : order.status === "In Progress"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        )}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(order);
                          }}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="View/Edit order details"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOrder(order.id);
                          }}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete order"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {showModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-lg shadow-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#891F1A]">Order Details</h2>
                <p className="text-sm text-gray-600 mt-1">Order #{selectedOrder.id} - {selectedOrder.company}</p>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-black text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            {/* Order Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs font-medium text-blue-700 mb-1">Total Price</div>
                <div className="text-lg font-bold text-gray-900">${getEffectivePrice(selectedOrder)}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-xs font-medium text-green-700 mb-1">Advance Paid</div>
                <div className="text-lg font-bold text-gray-900">${selectedOrder.advance}</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="text-xs font-medium text-orange-700 mb-1">Remaining</div>
                <div className="text-lg font-bold text-gray-900">${selectedOrder.remaining}</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-xs font-medium text-purple-700 mb-1">Status</div>
                <div className="text-sm font-bold text-gray-900">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                      selectedOrder.status === "Completed"
                        ? "bg-green-100 text-green-800"
                        : selectedOrder.status === "In Progress"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    )}
                  >
                    {selectedOrder.status}
                  </span>
                </div>
              </div>
            </div>

            <hr className="border-gray-200 mb-6" />
            
            {/* Loading State */}
            {loadingOrderDetails && (
              <div className="flex items-center justify-center py-8 mb-6">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#891F1A]"></div>
                <span className="ml-3 text-gray-600">Loading complete order details...</span>
              </div>
            )}
            
            {/* Order Information Section */}
            {!loadingOrderDetails && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Customer Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-blue-700">Company Name</label>
                        <p className="text-sm text-gray-900 font-medium">{selectedOrder.company}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-blue-700">Customer Name</label>
                        <p className="text-sm text-gray-900 font-medium">{selectedOrder.name}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-blue-700">Phone Number</label>
                        <p className="text-sm text-gray-900 font-medium">{selectedOrder.phone}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-blue-700">Location</label>
                        <p className="text-sm text-gray-900 font-medium">{selectedOrder.location}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Order Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-green-700">Order Date</label>
                        <p className="text-sm text-gray-900 font-medium">{selectedOrder.date}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-green-700">Order Details</label>
                        <p className="text-sm text-gray-900 font-medium">{selectedOrder.detail}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-green-700">Order ID</label>
                        <p className="text-sm text-gray-900 font-medium">#{selectedOrder.id}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Assigned Personnel
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-purple-700">Sales Person</label>
                        <p className="text-sm text-gray-900 font-medium">
                          {selectedOrder.assignedSalesPerson || 'Not assigned'}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-purple-700">Designer</label>
                        <p className="text-sm text-gray-900 font-medium">
                          {selectedOrder.assignedDesigner || 'Not assigned'}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-purple-700">Production</label>
                        <p className="text-sm text-gray-900 font-medium">
                          {selectedOrder.assignedProductionPerson || 'Not assigned'}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-purple-700">Current Stage</label>
                        <p className="text-sm text-gray-900 font-medium">
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800">
                            {selectedOrder.stage || selectedOrder.status}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Items Section */}
                {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      Order Items
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedOrder.items.map((item: any, index: number) => (
                        <div key={index} className="bg-white border border-gray-300 rounded-lg p-3">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center flex-shrink-0">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-md" />
                              ) : (
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 truncate">{item.name}</h4>
                              <p className="text-xs text-gray-600">Quantity: {item.quantity || 1}</p>
                              {item.sku && <p className="text-xs text-gray-500">SKU: {item.sku}</p>}
                              {item.attributes && Object.keys(item.attributes).length > 0 && (
                                <div className="mt-1">
                                  {Object.entries(item.attributes).map(([key, value]) => (
                                    <span key={key} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded mr-1 mb-1">
                                      {key}: {String(value)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Edit Section */}
            {!loadingOrderDetails && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Order Details</h3>
              <form className="space-y-4 text-black" onSubmit={(e) => e.preventDefault()}>
              {/* Price, Final Price & Advance */}
              <div className="flex gap-4">
                <div className="flex flex-col flex-1">
                  <label className="text-sm font-medium text-gray-700">Base Price</label>
                  <input
                    type="number"
                    value={selectedOrder.price}
                    onChange={(e) =>
                      e.target.value.length <= 6 &&
                      setSelectedOrder({
                        ...selectedOrder,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <span className="text-[10px] text-gray-500 mt-1">
                    Shown only if Final Price is empty.
                  </span>
                </div>
                <div className="flex flex-col flex-1">
                  <label className="text-sm font-medium text-gray-700">Final Price</label>
                  <input
                    type="number"
                    value={selectedOrder.finalPrice ?? ""}
                    onChange={(e) =>
                      e.target.value.length <= 6 &&
                      setSelectedOrder({
                        ...selectedOrder,
                        finalPrice:
                          e.target.value === ""
                            ? undefined
                            : parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <span className="text-[10px] text-gray-500 mt-1">
                    If set, this is what appears in the Price column.
                  </span>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col flex-1">
                  <label className="text-sm font-medium text-gray-700">Advance</label>
                  <input
                    type="number"
                    value={selectedOrder.advance}
                    onChange={(e) =>
                      e.target.value.length <= 6 &&
                      setSelectedOrder({
                        ...selectedOrder,
                        advance: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                {/* Remaining */}
                <div className="flex flex-col flex-1">
                  <label className="text-sm font-medium text-gray-700">Remaining</label>
                  <input
                    type="number"
                    value={selectedOrder.remaining}
                    onChange={(e) =>
                      setSelectedOrder({
                        ...selectedOrder,
                        remaining: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">Location</label>
                <input
                  type="text"
                  value={selectedOrder.location}
                  onChange={(e) =>
                    setSelectedOrder({
                      ...selectedOrder,
                      location: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Status & Zone */}
              <div className="flex gap-4 items-end relative">
                <div className="flex flex-col flex-1 relative">
                  <label className="text-sm font-medium text-gray-700 mb-1">Status</label>
                  <button
                    type="button"
                    onClick={() => setShowStatusDropdown((prev) => !prev)}
                    className={`w-full flex justify-between items-center px-3 py-2 rounded border text-base font-semibold focus:outline-none focus:ring-2 focus:ring-black ${
                      selectedOrder.status === "Completed"
                        ? "bg-green-100 text-green-700 border-green-300"
                        : selectedOrder.status === "In Progress"
                        ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                        : "bg-red-100 text-red-600 border-red-300"
                    }`}
                  >
                    <span>{selectedOrder.status}</span>
                    <span className="text-sm ml-2">â–¼</span>
                  </button>

                  {showStatusDropdown && (
                    <div className="absolute top-full mt-1 w-full bg-white border border-gray-300 rounded shadow z-10">
                      {["Completed", "In Progress", "Pending"].map((status) => (
                        <div
                          key={status}
                          onClick={() => {
                            setSelectedOrder({ ...selectedOrder, status });
                            setShowStatusDropdown(false);
                          }}
                          className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                            selectedOrder.status === status ? "font-bold" : ""
                          }`}
                        >
                          {status}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col flex-1">
                  <label className="text-sm font-medium text-gray-700">Zone</label>
                  <input
                    type="text"
                    value={selectedOrder.zone || ""}
                    onChange={(e) =>
                      setSelectedOrder({
                        ...selectedOrder,
                        zone: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              {/* Status Display & Save */}
              <div className="flex justify-between items-center pt-2">
                <div className="text-base font-semibold flex items-center gap-3">
                  Status:
                  <span
                    className={`px-4 py-1.5 rounded-full text-base font-semibold ${
                      selectedOrder.status === "Completed"
                        ? "bg-green-100 text-green-700"
                        : selectedOrder.status === "In Progress"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {selectedOrder.status}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleUpdateOrder}
                  className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
                >
                  Save
                </button>
              </div>
              </form>
            </div>
            )}
            
            {/* Modal Footer */}
            <div className="border-t border-gray-200 pt-4 mt-6 flex justify-between items-center">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleUpdateOrder}
                className="bg-[#891F1A] text-white px-6 py-2 rounded hover:bg-red-800 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}












