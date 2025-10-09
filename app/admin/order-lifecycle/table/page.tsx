"use client";

import { useMemo, useState, useCallback, Fragment, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Button } from "@/app/components/Button";
import QuotationFormWithPreview from "@/app/components/quotation/QuotationFormWithPreview";
import OrderIntakeForm, {
  createOrderIntakeDefaults,
  OrderIntakeFormValues,
} from "@/app/components/order-stages/OrderIntakeForm";
import DashboardNavbar from "@/app/components/navbar/DashboardNavbar";
import { ordersApi, Order } from "@/lib/orders-api";
import { getApiBaseUrl } from "@/lib/env";
import { toast } from "react-hot-toast";
import { Trash2, CheckCircle, XCircle, Clock, FileText, User, Calendar, Download, Eye, AlertCircle } from "lucide-react";
import ProductSearchModal from "@/app/components/modals/ProductSearchModal";
import ProductConfigModal from "@/app/components/modals/ProductConfigModal";
import DesignFilePreviewModal from "@/app/components/modals/DesignFilePreviewModal";
import { BaseProduct, ConfiguredProduct } from "@/app/types/products";
import { getPendingApprovals, approveDesign, DesignApproval } from "@/app/lib/workflowApi";

/* ===== Types ===== */
type Urgency = "Urgent" | "High" | "Normal" | "Low";
type Status = "New" | "Active" | "Completed";

interface Row {
  id: number;
  orderCode: string;
  title: string;
  date: string;
  time: string;
  urgency: Urgency;
  status: Status;
}

const urgencyBadge = (u: Urgency) => {
  const classes: Record<Urgency, string> = {
    Urgent: "bg-red-100 text-red-700 border-red-200",
    High: "bg-amber-100 text-amber-800 border-amber-200",
    Normal: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Low: "bg-zinc-100 text-zinc-700 border-zinc-200",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs border font-medium ${classes[u]}`}>
      {u}
    </span>
  );
};

const toLocalYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const normalizeToYMD = (input: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return toLocalYMD(d);
};

const statusMap: Record<string, Status> = {
  new: "New",
  active: "Active",
  in_progress: "Active",
  completed: "Completed",
  delivered: "Completed",
};

const summarizeItems = (items?: Order['items']) => {
  if (!items || items.length === 0) return 'Custom Order';
  return items
    .map((item) => {
      const qty = item.quantity && item.quantity > 0 ? `${item.quantity} x ` : '';
      return `${qty}${item.name}`;
    })
    .join(', ');
};

const orderToRow = (order: Order): Row => {
  const [datePart = "", timePart = ""] = (order.created_at || "").split("T");
  const time = timePart ? timePart.split(".")[0]?.substring(0, 5) ?? "" : "";
  const summary = summarizeItems(order.items);
  return {
    id: order.id,
    orderCode: order.order_code,
    title: `${summary} - ${order.client_name}`,
    date: datePart,
    time,
    urgency: (order.urgency || "Normal") as Urgency,
    status: statusMap[order.status as keyof typeof statusMap] ?? "New",
  };
};

const mapOrders = (orders: Order[]): Row[] => orders.map(orderToRow);

/**
 * The orders table page displays existing orders grouped by status and
 * exposes functionality to create, update and delete orders.  It also
 * demonstrates how to use the globally shared form store when opening the
 * quotation dialog.
 */
export default function OrdersTablePage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'orders' | 'approvals'>('orders');
  
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState<Row[]>([]);
  const [savedOrders, setSavedOrders] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);

  // Local state for quotation data (order-specific)
  const [quotationData, setQuotationData] = useState<any>({});

  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customFormData, setCustomFormData] = useState<OrderIntakeFormValues>(() => createOrderIntakeDefaults());

  const [selectedProducts, setSelectedProducts] = useState<ConfiguredProduct[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pendingBaseProduct, setPendingBaseProduct] = useState<BaseProduct | null>(null);
  const [pendingInitialQty, setPendingInitialQty] = useState<number | undefined>(undefined);
  const [pendingInitialAttributes, setPendingInitialAttributes] = useState<Record<string, string> | undefined>(undefined);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingToSales, setSendingToSales] = useState(false);
  
  // Approvals state
  const [approvals, setApprovals] = useState<DesignApproval[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<DesignApproval | null>(null);
  const [approvalsError, setApprovalsError] = useState<string | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);
  
  // File preview state
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<Array<{file_id: number, file_name: string, file_size: number, mime_type: string}>>([]);
  const [previewOrderId, setPreviewOrderId] = useState<string>("");

  const serializeSelectedProducts = (items: ConfiguredProduct[] = selectedProducts) =>
    items.map((item) => ({
      product_id: item.productId,
      name: item.name,
      quantity: item.quantity,
      attributes: item.attributes,
      sku: item.sku,
      unit_price: item.price, // Include unit price
      line_total: item.price * item.quantity, // Calculate line total
      customRequirements: item.customRequirements || '',
      design_ready: item.design?.ready || false,
      design_need_custom: item.design?.needCustom || false,
      design_files_manifest: item.design?.files?.map(f => ({
        id: f.name, // Use name as temporary ID
        name: f.name,
        size: f.size,
        type: f.type
      })) || []
    }));

  // Helper function to upload design files for a product
  const uploadDesignFilesForProduct = async (orderId: number, product: ConfiguredProduct) => {
    if (!product.design?.files || product.design.files.length === 0) {
      console.log(`ℹ️ No design files to upload for product: ${product.name}`);
      return;
    }

    // Validate orderId
    if (!orderId || orderId === undefined || orderId === null) {
      throw new Error(`Invalid order ID: ${orderId} for product: ${product.name}`);
    }

    console.log(`📁 Uploading ${product.design.files.length} design files for product: ${product.name} to order: ${orderId}`);
    
    try {
      // Upload each file individually
      const uploadPromises = product.design.files.map(async (fileInfo) => {
        if (!fileInfo.file) {
          console.warn(`⚠️ No File object found for ${fileInfo.name}, skipping upload`);
          return null;
        }

        const formData = new FormData();
        formData.append('file', fileInfo.file);
        formData.append('file_type', 'design'); // Required field with valid choice
        formData.append('stage', 'design');
        formData.append('description', `Design file for ${product.name}`);
        formData.append('product_related', product.name);
              // Send visible_to_roles as a JSON string
              formData.append('visible_to_roles', JSON.stringify(['admin', 'sales', 'designer', 'production']));

        const response = await fetch(`${getApiBaseUrl()}/api/orders/${orderId}/files/upload/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
          },
          body: formData
        });

        if (!response.ok) {
          let errorMessage = `Failed to upload ${fileInfo.name} (Status: ${response.status})`;
          
          try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const errorData = await response.json();
              errorMessage = errorData.error || errorData.message || errorMessage;
            } else {
              // If it's not JSON, try to get text content
              const textContent = await response.text();
              console.error('Non-JSON error response:', textContent.substring(0, 200));
              errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
            }
          } catch (parseError) {
            console.error('Failed to parse error response:', parseError);
            errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
          }
          
          throw new Error(errorMessage);
        }

        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.warn('Response is not JSON, treating as success');
          return { success: true, message: 'File uploaded successfully' };
        }

        const result = await response.json();
        console.log(`✅ Successfully uploaded: ${fileInfo.name}`, result);
        console.log(`📋 Upload details:`, {
          orderId,
          fileName: fileInfo.name,
          fileType: 'design',
          stage: 'design',
          productName: product.name,
          result
        });
        return result;
      });

      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(result => result !== null);
      
      console.log(`✅ Successfully uploaded ${successfulUploads.length}/${product.design.files.length} files for product: ${product.name}`);
      return successfulUploads;
    } catch (error) {
      console.error(`❌ Failed to upload design files for product: ${product.name}`, error);
      throw error;
    }
  };

  const handleAddProductClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setShowSearchModal(true);
  };

  const resetPendingProduct = () => {
    setPendingBaseProduct(null);
    setPendingInitialQty(undefined);
    setPendingInitialAttributes(undefined);
    setEditingProductId(null);
  };

  const handlePickBaseProduct = (product: BaseProduct, qty = 1) => {
    setPendingBaseProduct(product);
    setPendingInitialQty(qty);
    setPendingInitialAttributes(undefined);
    setEditingProductId(null);
    setShowSearchModal(false);
    setShowConfigModal(true);
  };

  const handleConfirmProduct = (configured: ConfiguredProduct) => {
    setSelectedProducts((prev) => {
      const index = prev.findIndex((item) => item.id === configured.id);
      return index >= 0
        ? prev.map((item, idx) => (idx === index ? configured : item))
        : [...prev, configured];
    });
    resetPendingProduct();
  };

  const handleRemoveProduct = (id: string) => {
    setSelectedProducts((prev) => prev.filter((item) => item.id !== id));
  };

  const handleEditProduct = (id: string) => {
    const existing = selectedProducts.find((item) => item.id === id);
    if (!existing) return;
    setPendingBaseProduct({
      id: existing.productId,
      name: existing.name,
      imageUrl: existing.imageUrl,
    });
    setPendingInitialQty(existing.quantity);
    setPendingInitialAttributes(existing.attributes);
    setEditingProductId(existing.id);
    setShowConfigModal(true);
  };

  const handleCloseSearchModal = () => {
    setShowSearchModal(false);
  };



  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleCloseConfigModal = () => {
    setShowConfigModal(false);
    resetPendingProduct();
  };

  // Load pending approvals
  const loadApprovals = async () => {
    try {
      setApprovalsLoading(true);
      setApprovalsError(null);
      const data = await getPendingApprovals();
      setApprovals(data);
      console.log('📋 Loaded approvals:', data.length, data);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load approvals";
      setApprovalsError(errorMessage);
      toast.error("Failed to load pending approvals");
      console.error('❌ Failed to load approvals:', err);
    } finally {
      setApprovalsLoading(false);
    }
  };


  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiOrders = await ordersApi.getOrders();

        // Convert API orders to Row format
        const convertedOrders = mapOrders(apiOrders);

        setSavedOrders(convertedOrders);
        setOrders(convertedOrders);
      } catch (err: any) {
        setError(err.message || "Failed to load orders");
        console.error("Error loading orders:", err);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
    const onUpdate = () => {
      loadOrders();
      if (isCustomOpen) setIsCustomOpen(false);
    };
    window.addEventListener("orders:updated", onUpdate);
    return () => window.removeEventListener("orders:updated", onUpdate);
  }, [isCustomOpen]);

  // Handle approval actions
  const handleApprove = (approval: DesignApproval) => {
    setSelectedApproval(approval);
    handleApprovalDecision('approve');
  };

  const handleRejectClick = (approval: DesignApproval) => {
    setSelectedApproval(approval);
    setIsRejectModalOpen(true);
  };

  const handleApprovalDecision = async (action: 'approve' | 'reject', rejectionReason?: string) => {
    if (!selectedApproval) return;
    
    setProcessing(true);
    
    try {
      // Map frontend action to backend format
      const backendAction = action === 'approve' ? 'approved' : 'rejected';
      await approveDesign(selectedApproval.id, backendAction, rejectionReason);
      
      // Refresh the approvals list
      await loadApprovals();
      
      // Show success message
      toast.success(`Design ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      
      // Close modal if reject modal is open
      if (isRejectModalOpen) {
        setIsRejectModalOpen(false);
      }
      
    } catch (error) {
      console.error(`Failed to ${action} design:`, error);
      toast.error(`Failed to ${action} design. Please try again.`);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = (reason: string) => {
    handleApprovalDecision('reject', reason);
  };

  const handleRejectSubmit = () => {
    if (rejectionReason.trim()) {
      handleReject(rejectionReason);
      setRejectionReason("");
    }
  };

  // Handle file preview
  const handlePreviewFiles = (approval: DesignApproval) => {
    if (approval.design_files_manifest && approval.design_files_manifest.length > 0) {
      // Convert design files manifest to preview format
      const files = approval.design_files_manifest.map((file: any) => ({
        file_id: file.id || null, // Use null for temp files to prevent backend API calls
        file_name: file.name || `${file.type || 'design'}_file`,
        file_size: file.size || 0,
        mime_type: file.type || 'application/octet-stream',
        content: file.content || file.data, // Base64 content from localStorage
        url: file.url, // Direct URL if available
        blob: file.blob // Blob object if available
      }));
      
      setPreviewFiles(files);
      setPreviewOrderId(approval.order.toString());
      setIsPreviewModalOpen(true);
    } else {
      toast.error('No files available for preview');
    }
  };



  useEffect(() => {
    if (!isCustomOpen) {
      setSelectedProducts([]);
      resetPendingProduct();
      setShowSearchModal(false);
      setShowConfigModal(false);
    }
  }, [isCustomOpen]);

  // Load approvals when switching to approvals tab
  useEffect(() => {
    if (activeTab === 'approvals') {
      console.log('🔄 Switching to approvals tab, loading approvals...');
      loadApprovals();
      
      // Listen for new approval requests from designers
      const onApprovalRequest = (event: any) => {
        console.log('🎯 Received approval request event:', event.detail);
        const { orderCode, designer, clientName } = event.detail;
        toast.success(`🎯 ${designer} requested approval for order ${orderCode} (${clientName})`);
        setTimeout(() => loadApprovals(), 1000);
      };
      
      window.addEventListener("approval-requested", onApprovalRequest);
      
      return () => {
        window.removeEventListener("approval-requested", onApprovalRequest);
      };
    }
  }, [activeTab]);

  const openForRow = useCallback(
    async (row: Row) => {
      setSelected(row);
      setIsOpen(true);
      
      try {
        // Load full order data from API
        const orderData = await ordersApi.getOrder(row.id);
        console.log('=== LOADING ORDER DATA ===');
        console.log('Order ID:', row.id);
        console.log('Order data keys:', Object.keys(orderData));
        console.log('Company Name:', orderData.company_name);
        console.log('Phone:', orderData.phone);
        console.log('TRN from orderData:', orderData.trn);
        console.log('Pricing Status:', orderData.pricing_status);
        console.log('Order data stringified:', JSON.stringify(orderData, null, 2));
        
        // Load quotation data
        let quotationData = null;
        try {
          const quotationResponse = await ordersApi.getQuotation(row.id);
          quotationData = quotationResponse;
          console.log('=== LOADING QUOTATION DATA ===');
          console.log('Order ID:', row.id);
          console.log('Quotation response:', quotationResponse);
          console.log('Quotation response type:', typeof quotationResponse);
          console.log('Quotation response keys:', Object.keys(quotationResponse));
          console.log('quotationData.labour_cost:', quotationData?.labour_cost);
          console.log('quotationData.finishing_cost:', quotationData?.finishing_cost);
          console.log('quotationData.paper_cost:', quotationData?.paper_cost);
          console.log('TRN from quotationData:', quotationData?.trn);
          console.log('quotationData keys:', quotationData ? Object.keys(quotationData) : 'undefined');
          console.log('quotationData stringified:', JSON.stringify(quotationData, null, 2));
        } catch (quotationError) {
          console.log('No quotation found for order, will create new one');
        }
        
          // Set form data with loaded order data
          const orderIdInt = parseInt(orderData.id.toString(), 10);
          if (isNaN(orderIdInt)) {
            console.error('Invalid order ID from API:', orderData.id);
            throw new Error('Invalid order ID received from server');
          }
          
          const formDataToSet = {
            orderId: orderData.order_code,
            _orderId: orderIdInt, // Ensure it's an integer
            projectDescription: row.title,
            date: normalizeToYMD(row.date) || row.date,
            clientName: orderData.client_name,
            clientCompany: orderData.company_name || "",
            clientPhone: orderData.phone || "",
            trn: orderData.trn || "",
            email: orderData.email || "",
            address: orderData.address || "",
            specifications: orderData.specs,
            urgency: orderData.urgency,
            status: orderData.pricing_status || "Not Priced",
            stage: orderData.stage,
            // Load quotation data if available
            labourCost: quotationData?.labour_cost || "",
            finishingCost: quotationData?.finishing_cost || "",
            paperCost: quotationData?.paper_cost || "",
            machineCost: quotationData?.machine_cost || "",
            designCost: quotationData?.design_cost || "",
            deliveryCost: quotationData?.delivery_cost || "",
            otherCharges: quotationData?.other_charges || "",
            discount: quotationData?.discount || "",
            advancePaid: quotationData?.advance_paid || "",
            quotationNotes: quotationData?.quotation_notes || "",
            customField: quotationData?.custom_field || "",
            grandTotal: quotationData?.grand_total || "",
            finalPrice: quotationData?.grand_total || "",
            salesPerson: quotationData?.sales_person || (typeof window !== "undefined" ? localStorage.getItem("admin_username") || "Unknown User" : "Unknown User"),
            // Load items
            items: orderData.items || [],
            products: orderData.items || [],
            // Default sendTo value
            sendTo: "Sales",
          };
        
        console.log('Final TRN value being set:', orderData.trn || "");
        console.log('Setting form data with quotation values:', {
          labourCost: formDataToSet.labourCost,
          finishingCost: formDataToSet.finishingCost,
          paperCost: formDataToSet.paperCost,
          machineCost: formDataToSet.machineCost,
          designCost: formDataToSet.designCost,
          deliveryCost: formDataToSet.deliveryCost,
          otherCharges: formDataToSet.otherCharges,
          discount: formDataToSet.discount,
          advancePaid: formDataToSet.advancePaid,
        });
        
        setQuotationData(formDataToSet);
      } catch (error) {
        console.error('Failed to load order data:', error);
        toast.error('Failed to load order data');
        // Fallback to basic data
        setQuotationData({
          orderId: row.orderCode,
          _orderId: row.id,
          projectDescription: row.title,
          date: normalizeToYMD(row.date) || row.date,
          sendTo: "Sales",
        });
      }
    },
    [],
  );

  const openOrderLifecycle = useCallback(
    (row: Row) => {
      // Navigate to order lifecycle page with order ID
      window.location.href = `/admin/order-lifecycle?orderId=${row.id}`;
    },
    [],
  );

  const createOrder = async (data: OrderIntakeFormValues) => {
  const clientName = (data?.clientName ?? "").trim();
  const itemsPayload = serializeSelectedProducts();
  const orderDetails = (data?.orderDetails ?? "").trim();
  const specsInput = data?.specifications;
  const specs =
    typeof specsInput === "string" && specsInput.trim().length > 0 ? specsInput.trim() : orderDetails;
  const urgency = data?.urgency ?? "Normal";

  if (!clientName) {
    toast.error("Please enter a client name");
    return;
  }

  if (itemsPayload.length === 0) {
    toast.error("Please add at least one product before creating the order");
    return;
  }

  try {
    setLoading(true);
    setError(null);
    const createdOrder = await ordersApi.createOrder({
      clientName,
      specs,
      urgency,
      items: itemsPayload,
    });

    console.log('✅ Order created successfully:', createdOrder);
    
    // Extract the actual order data from the response
    // Handle both wrapped and direct response formats
    const orderData = (createdOrder as any).data || createdOrder;
    const orderId = orderData.id;
    
    console.log('Order ID:', orderId);
    console.log('Order structure:', JSON.stringify(createdOrder, null, 2));

    // Check if order was created successfully and has an ID
    if (!orderData || !orderId) {
      throw new Error('Order creation failed - no ID returned');
    }

    // Upload design files for products that have them
    console.log('🔄 Starting file uploads for created order:', orderId);
    const fileUploadPromises = selectedProducts.map(product => 
      uploadDesignFilesForProduct(orderId, product).catch(error => {
        console.error(`Failed to upload files for product ${product.name}:`, error);
        // Don't throw here, just log the error - we want the order to be created even if file upload fails
        return null;
      })
    );

    await Promise.all(fileUploadPromises);
    console.log('✅ All file uploads completed for order:', orderId);

    const apiOrders = await ordersApi.getOrders();
    const convertedOrders = mapOrders(apiOrders);

    setSavedOrders(convertedOrders);
    setOrders(convertedOrders);
    setIsCustomOpen(false);
    setCustomFormData(createOrderIntakeDefaults());
    setSelectedProducts([]);
    toast.success("Order created successfully!");
  } catch (err: any) {
    setError(err.message || "Failed to create order");
    toast.error(`Failed to create order: ${err.message}`);
    console.error("Error creating order:", err);
  } finally {
    setLoading(false);
  }
};

  const ensureOrderForCustom = async (data: OrderIntakeFormValues): Promise<number | null> => {
  const clientName = (data?.clientName ?? "").trim();
  const itemsPayload = serializeSelectedProducts();
  const orderDetails = (data?.orderDetails ?? "").trim();
  const specsInput = data?.specifications;
  const specs =
    typeof specsInput === "string" && specsInput.trim().length > 0 ? specsInput.trim() : orderDetails;
  const urgency = data?.urgency ?? "Normal";

  if (!clientName) {
    toast.error("Please enter a client name");
    return null;
  }

  if (itemsPayload.length === 0) {
    toast.error("Please add at least one product before saving");
    return null;
  }

  try {
    let orderId: number;
    
    if (!data?._orderId) {
      const created = await ordersApi.createOrder({ clientName, specs, urgency, items: itemsPayload });
      console.log('✅ Order created in ensureOrderForCustom:', created);
      
      // Extract the actual order data from the response
      // Handle both wrapped and direct response formats
      const orderData = (created as any).data || created;
      const createdOrderId = orderData.id;
      
      console.log('Created order ID:', createdOrderId);
      
      if (!orderData || !createdOrderId) {
        throw new Error('Order creation failed - no ID returned');
      }
      
      orderId = createdOrderId;
      setCustomFormData((prev) => ({
        ...(prev || {}),
        _orderId: createdOrderId,
        orderId: orderData.order_code || orderData.order_id,
      } as any));
    } else {
      orderId = data._orderId as number;
      console.log('🔄 Updating existing order:', orderId);
      await ordersApi.updateOrder(orderId, {
        client_name: clientName,
        specs,
        urgency,
        items: itemsPayload,
      });
    }

    // Upload design files for products that have them
    console.log('🔄 Starting file uploads for order:', orderId);
    const fileUploadPromises = selectedProducts.map(product => 
      uploadDesignFilesForProduct(orderId, product).catch(error => {
        console.error(`Failed to upload files for product ${product.name}:`, error);
        // Don't throw here, just log the error - we want the order to be saved even if file upload fails
        return null;
      })
    );

    await Promise.all(fileUploadPromises);
    console.log('✅ All file uploads completed for order:', orderId);

    return orderId;
  } catch (err: any) {
    toast.error(err.message || "Failed to save draft");
    return null;
  }
};

  const handleSaveDraftCustom = async () => {
    if (savingDraft) return;
    setSavingDraft(true);
    try {
      const orderId = await ensureOrderForCustom(customFormData);
      if (!orderId) return;

      const apiOrders = await ordersApi.getOrders();
      const convertedOrders = mapOrders(apiOrders);
      setSavedOrders(convertedOrders);
      setOrders(convertedOrders);
      toast.success("Draft saved");
    } catch (err: any) {
      toast.error(`Failed to save draft: ${err.message}`);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSendToSalesCustom = async () => {
    if (sendingToSales) return;
    setSendingToSales(true);
    try {
      const orderId = await ensureOrderForCustom(customFormData);
      if (!orderId) return;
      await ordersApi.updateOrder(orderId, { stage: "quotation" });

      const apiOrders = await ordersApi.getOrders();
      const convertedOrders = mapOrders(apiOrders);
      setSavedOrders(convertedOrders);
      setOrders(convertedOrders);
      toast.success("Sent to Sales");
    } catch (err: any) {
      toast.error(`Failed to send: ${err.message || "Unknown error"}`);
    } finally {
      setSendingToSales(false);
    }
  };

  const deleteOrder = async (orderId: number, orderCode?: string) => {
    if (!confirm("Are you sure you want to delete this order?")) return;

    try {
      await ordersApi.deleteOrder(orderId);

      // Refresh orders list
      const apiOrders = await ordersApi.getOrders();
      const convertedOrders = mapOrders(apiOrders);

      setSavedOrders(convertedOrders);
      setOrders(convertedOrders);
      toast.success(orderCode ? `Order ${orderCode} deleted successfully!` : "Order deleted successfully!");
    } catch (err: any) {
      toast.error(`Failed to delete order: ${err.message}`);
      console.error("Error deleting order:", err);
    }
  };

  const ALL: Row[] = useMemo(() => {
    return savedOrders;
  }, [savedOrders]);

  const filtered = useMemo(() => {
    return ALL.filter((r) => {
      const okDay = selectedDate ? normalizeToYMD(r.date) === selectedDate : true;
      const hay = [String(r.id), r.orderCode, r.title, r.date, r.time, r.urgency]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const okQuery = q.trim() === "" ? true : hay.includes(q.toLowerCase());
      return okDay && okQuery;
    });
  }, [ALL, selectedDate, q]);

  const by = (s: Status) => filtered.filter((r) => r.status === s);

  const Section = ({ title, rows }: { title: string; rows: Row[] }) => (
    <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-4 bg-gray-50 border-b">
        <h2 className="text-xl font-bold text-[#891F1A] flex items-center gap-2">
          {title}
          <span className="text-sm font-normal text-gray-600">({rows.length})</span>
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-center border-collapse">
          <thead>
            <tr className="bg-[#7a1b17] text-white rounded-t-lg w-full">
              <th className="px-3 py-3 text-center w-20 min-w-[80px] rounded-tl-lg">Sr No</th>
              <th className="px-3 py-3 text-center w-36 min-w-[140px]">Order Id</th>
              <th className="px-3 py-3 text-center min-w-[200px]">Order Details</th>
              <th className="px-3 py-3 text-center w-36 min-w-[120px]">Date</th>
              <th className="px-3 py-3 text-center w-28 min-w-[100px]">Time</th>
              <th className="px-3 py-3 text-center w-40 min-w-[120px]">Urgency</th>
              <th className="px-3 py-3 text-center w-24 min-w-[120px] rounded-tr-lg relative">
                <div className="absolute inset-0 bg-[#7a1b17] rounded-tr-lg"></div>
                <div className="relative z-10">Actions</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-gray-500" colSpan={7}>
                  No records
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr 
                  key={r.id} 
                  className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => openForRow(r)}
                >
                  <td className="px-3 py-3 text-center">{i + 1}</td>
                  <td className="px-3 py-3 text-center font-medium text-gray-900">{r.orderCode}</td>
                  <td className="px-3 py-3 text-center max-w-[200px] truncate" title={r.title}>
                    {r.title}
                  </td>
                  <td className="px-3 py-3 text-center">{normalizeToYMD(r.date) || r.date}</td>
                  <td className="px-3 py-3 text-center">{r.time}</td>
                  <td className="px-3 py-3 text-center">{urgencyBadge(r.urgency)}</td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openOrderLifecycle(r);
                        }}
                        className="text-blue-400 hover:text-blue-600 transition-colors"
                        title="Open Order Lifecycle"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteOrder(r.id, r.orderCode);
                        }}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Delete order"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12 text-black">
      <DashboardNavbar />
      <br />

      <div className="max-w-7xl mx-auto pb-16">
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-4xl font-bold text-[#891F1A]">Sales Orders</h1>
          <Button onClick={() => setIsCustomOpen(true)} className="bg-[#891F1A] text-white hover:bg-red-900 transition">
            + Add a Custom Order
          </Button>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'orders'
                ? 'text-[#891F1A] border-b-2 border-[#891F1A]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Orders
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'approvals'
                ? 'text-[#891F1A] border-b-2 border-[#891F1A]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Approvals
            {approvals.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                {approvals.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'orders' ? (
          <>
            {/* Filters */}
            <div className="mt-4 flex flex-col md:flex-row gap-3">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 rounded border bg-white"
              />
              <input
                placeholder="Search (Order Id, order, date, time, urgency)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="px-3 py-2 rounded border bg-white flex-1"
              />
            </div>

            {/* Loading and Error States */}
            {loading && (
              <div className="mt-6 text-center py-8">
                <div className="text-lg text-gray-600">Loading orders...</div>
              </div>
            )}

            {error && (
              <div className="mt-6 text-center py-8">
                <div className="text-lg text-red-600">Error: {error}</div>
                <Button onClick={() => window.location.reload()} className="mt-2 bg-[#891F1A] text-white hover:bg-[#6c1714]">
                  Retry
                </Button>
              </div>
            )}

            {/* Sections */}
            {!loading && !error && (
              <div className="mt-6 grid grid-cols-1 gap-6">
                <Section title="New Orders" rows={by("New")} />
                <Section title="Active Orders" rows={by("Active")} />
                <Section title="Completed Orders" rows={by("Completed")} />
              </div>
            )}
          </>
        ) : (
          <>
            {/* Approvals Tab Content */}
            <div className="mt-6">
              {approvalsLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#891F1A]"></div>
                  <p className="mt-4 text-gray-600">Loading approvals...</p>
                </div>
              ) : approvals.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                    <CheckCircle className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium">No pending approvals</p>
                  <p className="text-sm text-gray-500 mt-1">All designs have been reviewed!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {approvals.map((approval) => (
                    <div key={approval.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-6">
                        {/* Left side - Main info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {approval.order_code}
                            </h3>
                            <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                              Pending Review
                            </span>
                            <span className="text-sm text-gray-500">{getTimeAgo(approval.submitted_at)}</span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-gray-400" />
                              <div>
                                <p className="text-gray-500 text-xs">Client</p>
                                <p className="text-gray-900 font-medium">{approval.client_name}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-gray-400" />
                              <div>
                                <p className="text-gray-500 text-xs">Designer</p>
                                <p className="text-gray-900 font-medium">{approval.designer}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <div>
                                <p className="text-gray-500 text-xs">Submitted</p>
                                <p className="text-gray-900 font-medium">{formatDate(approval.submitted_at)}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <div className="flex-1">
                                <p className="text-gray-500 text-xs">Files</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-gray-900 font-medium">{approval.design_files_manifest?.length || 0} files</p>
                                  {approval.design_files_manifest && approval.design_files_manifest.length > 0 && (
                                    <button
                                      onClick={() => handlePreviewFiles(approval)}
                                      className="text-blue-600 hover:text-blue-700 text-xs underline"
                                    >
                                      Preview
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {approval.approval_notes && (
                            <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                              <p className="text-xs text-blue-700 font-medium mb-1">Designer's Notes:</p>
                              <p className="text-sm text-gray-700">{approval.approval_notes}</p>
                            </div>
                          )}
                        </div>

                        {/* Right side - Actions */}
                        <div className="flex flex-col gap-2 min-w-[120px]">
                          <Button
                            onClick={() => handleApprove(approval)}
                            className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 justify-center"
                            disabled={processing}
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </Button>
                          <Button
                            onClick={() => handleRejectClick(approval)}
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 flex items-center gap-2 justify-center"
                            disabled={processing}
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Quotation Popup */}
      <Transition show={isOpen} as={Fragment}>
        <Dialog onClose={() => {
          setIsOpen(false);
          setQuotationData({}); // Clear quotation data when closing
        }} className="relative z-50">
          <div className="fixed inset-0 bg-black/40" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b px-6 py-4 z-10 flex items-center justify-between">
                <div>
                  <Dialog.Title className="text-lg font-semibold text-[#891F1A]">
                    Quotation for {selected?.orderCode}
                  </Dialog.Title>
                  <p className="text-xs text-gray-500">
                    {selected?.title} Â· {selected && (normalizeToYMD(selected.date) || selected.date)}
                    {selected && " Â· "} {selected?.time}
                  </p>
                </div>
                <button onClick={() => {
                  setIsOpen(false);
                  setQuotationData({}); // Clear quotation data when closing
                }} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
                  Close
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                {/* Sales fills everything here, and it writes into local quotationData */}
                <QuotationFormWithPreview formData={quotationData} setFormData={setQuotationData} />
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                  <label htmlFor="sendTo" className="text-sm font-medium text-gray-700">
                    Send to:
                  </label>
                  <select
                    id="sendTo"
                    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#891F1A]/30 focus:border-[#891F1A] transition"
                    value={quotationData?.sendTo ?? "Sales"}
                    onChange={(e) =>
                      setQuotationData((prev: any) => ({
                        ...(prev || {}),
                        sendTo: e.target.value as "Sales" | "Designer" | "Production",
                      }))
                    }
                  >
                    <option value="Sales">Sales</option>
                    <option value="Designer">Designer</option>
                    <option value="Production">Production</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <Button onClick={() => {
                    setIsOpen(false);
                    setQuotationData({}); // Clear quotation data when canceling
                  }} variant="outline">
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!selected) return;

                      try {
                        setLoading(true);
                        
        // Update order in backend (only basic fields, don't change status)
        const orderUpdateData = {
          client_name: quotationData?.clientName || selected.title.split(" - ")[1] || "",
          company_name: quotationData?.clientCompany || "",
          phone: quotationData?.clientPhone || "",
          trn: quotationData?.trn || "",
          email: quotationData?.email || "",
          address: quotationData?.address || "",
          specs: quotationData?.specifications || "",
          urgency: quotationData?.urgency || selected.urgency,
          pricing_status: quotationData?.status || "Not Priced",
          // Don't change status when saving quotations
        };
        console.log('=== SAVING ORDER DATA ===');
        console.log('Order update data:', orderUpdateData);
        await ordersApi.updateOrder(selected.id, orderUpdateData);
        
        // Handle workflow transitions using dedicated endpoints
        if (quotationData?.sendTo === "Designer") {
          console.log('🚀 Sending order to designer...');
          try {
            const sendToDesignerResponse = await fetch(`${getApiBaseUrl()}/api/orders/${selected.id}/send-to-designer/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
              },
              body: JSON.stringify({})
            });
            
            if (!sendToDesignerResponse.ok) {
              const errorData = await sendToDesignerResponse.json();
              throw new Error(errorData.error || 'Failed to send order to designer');
            }
            
            const sendToDesignerResult = await sendToDesignerResponse.json();
            console.log('✅ Send to designer response:', sendToDesignerResult);
          } catch (error) {
            console.error('❌ Failed to send to designer:', error);
            toast.error(`Failed to send order to designer: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        } else if (quotationData?.sendTo === "Production") {
          console.log('🚀 Sending order to production...');
          try {
            const sendToProductionResponse = await fetch(`${getApiBaseUrl()}/api/orders/${selected.id}/send-to-production/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
              },
              body: JSON.stringify({})
            });
            
            if (!sendToProductionResponse.ok) {
              const errorData = await sendToProductionResponse.json();
              throw new Error(errorData.error || 'Failed to send order to production');
            }
            
            const sendToProductionResult = await sendToProductionResponse.json();
            console.log('✅ Send to production response:', sendToProductionResult);
          } catch (error) {
            console.error('❌ Failed to send to production:', error);
            toast.error(`Failed to send order to production: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

                        // Always update quotation data when saving
                        if (quotationData) {
                          try {
                            const quotationResponse = await ordersApi.updateQuotation(selected.id, {
                              labour_cost: quotationData.labourCost || 0,
                              finishing_cost: quotationData.finishingCost || 0,
                              paper_cost: quotationData.paperCost || 0,
                              machine_cost: quotationData.machineCost || 0,
                              design_cost: quotationData.designCost || 0,
                              delivery_cost: quotationData.deliveryCost || 0,
                              other_charges: quotationData.otherCharges || 0,
                              discount: quotationData.discount || 0,
                              advance_paid: quotationData.advancePaid || 0,
                              quotation_notes: quotationData.quotationNotes || "",
                              custom_field: quotationData.customField || "",
                              grand_total: quotationData.finalPrice || quotationData.grandTotal || 0,
                              sales_person: typeof window !== "undefined" ? localStorage.getItem("admin_username") || "Unknown User" : "Unknown User",
                            });
                          } catch (quotationError) {
                            console.error('Failed to save quotation:', quotationError);
                            toast.error('Failed to save quotation data');
                            return; // Don't continue if quotation save fails
                          }
                        } else {
                          console.log('No quotationData to save');
                        }

                        // Refresh orders list
                        const apiOrders = await ordersApi.getOrders();
                        const convertedOrders = mapOrders(apiOrders);

                        setSavedOrders(convertedOrders);
                        setOrders(convertedOrders);
                          setIsOpen(false);
                          setQuotationData({}); // Clear quotation data after successful save
                         
                          // Show appropriate success message based on where order was sent
                          const successMessage = quotationData?.sendTo === "Designer" 
                            ? "Order sent to Designer successfully!"
                            : quotationData?.sendTo === "Production"
                            ? "Order sent to Production successfully!"
                            : "Order and quotation updated successfully!";
                          toast.success(successMessage);
                      } catch (err: any) {
                        toast.error(`Failed to update order: ${err.message}`);
                        console.error("Error updating order:", err);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="bg-[#891F1A] text-white hover:bg-[#6c1714]"
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      {/* Custom Order Popup */}
      <Transition show={isCustomOpen} as={Fragment}>
        <Dialog 
          onClose={() => {
            if (!showSearchModal && !showConfigModal) {
              setIsCustomOpen(false);
            }
          }} 
          className="relative z-50"
          static={showSearchModal || showConfigModal}
        >
          <div className="fixed inset-0 bg-black/40" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel 
              className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b bg-white sticky top-0 z-10">
                <Dialog.Title className="text-lg font-semibold text-[#891F1A]">Add a Custom Order</Dialog.Title>
                <button onClick={() => setIsCustomOpen(false)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                <OrderIntakeForm
                  formData={customFormData}
                  setFormData={setCustomFormData}
                  requireProductsAndFiles
                  selectedProducts={selectedProducts}
                  onAddProduct={handleAddProductClick}
                  onRemoveProduct={handleRemoveProduct}
                  onEditProduct={handleEditProduct}
                />
              </div>

              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end space-x-3">
                <Button onClick={() => setIsCustomOpen(false)} variant="outline">
                  Cancel
                </Button>
                <Button onClick={() => createOrder(customFormData)} disabled={loading} className="bg-[#891F1A] text-white hover:bg-[#6c1714]">
                  {loading ? "Creating..." : "Create Order"}
                </Button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      <ProductSearchModal
        open={showSearchModal}
        onClose={handleCloseSearchModal}
        onPickBaseProduct={handlePickBaseProduct}
      />

      <ProductConfigModal
        open={showConfigModal}
        onClose={handleCloseConfigModal}
        baseProduct={pendingBaseProduct}
        onConfirm={handleConfirmProduct}
        initialQty={pendingInitialQty}
        initialAttributes={pendingInitialAttributes}
        editingProductId={editingProductId ?? undefined}
      />

      {/* Design File Preview Modal */}
      <DesignFilePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        orderId={previewOrderId}
        files={previewFiles}
        orderCode={selectedApproval?.order_code || ""}
      />

      {/* Rejection Modal */}
      <Transition show={isRejectModalOpen} as={Fragment}>
        <Dialog onClose={() => setIsRejectModalOpen(false)} className="relative z-50">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">
                    Reject Design - {selectedApproval?.order_code}
                  </Dialog.Title>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reason for Rejection *
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#891F1A] focus:border-transparent resize-none"
                        placeholder="Please explain what needs to be revised..."
                        required
                      />
                    </div>

                    <div className="flex gap-3 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setIsRejectModalOpen(false)}
                        disabled={processing}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleRejectSubmit}
                        className="bg-red-600 hover:bg-red-700 text-white"
                        disabled={processing || !rejectionReason.trim()}
                      >
                        {processing ? 'Rejecting...' : 'Confirm Rejection'}
                      </Button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
















