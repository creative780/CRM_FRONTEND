/**
 * API client for workflow-specific endpoints
 * Handles design approvals, machine assignments, and file management
 */

import { getApiBaseUrl } from '@/lib/env';

const API_BASE = getApiBaseUrl();

export interface DesignApproval {
  id: number;
  order: number;
  order_code: string;
  client_name: string;
  designer: string;
  sales_person: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  design_files_manifest: any[];
  approval_notes: string;
  rejection_reason: string;
  submitted_at: string;
  responded_at: string | null;
}

export interface MachineAssignment {
  id: number;
  order: number;
  order_code: string;
  product_name: string;
  product_sku: string;
  product_quantity: number;
  machine_id: string;
  machine_name: string;
  estimated_time_minutes: number;
  start_time: string | null;
  expected_completion_time: string | null;
  actual_completion_time: string | null;
  status: 'queued' | 'in_progress' | 'completed' | 'on_hold';
  assigned_by: string;
  notes: string;
}

export interface OrderFile {
  id: number;
  order: number;
  order_code: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  uploaded_by_role: string;
  stage: string;
  visible_to_roles: string[];
  description: string;
  product_related: string;
  uploaded_at: string;
}

const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Design Approval APIs

export const requestDesignApproval = async (
  orderId: number,
  data: {
    designer: string;
    sales_person: string;
    design_files_manifest?: any[];
    approval_notes?: string;
  }
): Promise<DesignApproval> => {
  const response = await fetch(`${API_BASE}/api/orders/${orderId}/request-approval/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to request approval: ${errorText}`);
  }

  return response.json();
};


export const getPendingApprovals = async (): Promise<DesignApproval[]> => {
  console.log('📡 Fetching pending approvals from:', `${API_BASE}/api/approvals/pending/`);
  const response = await fetch(`${API_BASE}/api/approvals/pending/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  console.log('📋 Pending approvals response:', response.status, response.statusText);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Pending approvals error:', errorText);
    throw new Error(`Failed to fetch pending approvals: ${errorText}`);
  }

  const data = await response.json();
  console.log('✅ Pending approvals data:', data);
  return data;
};

export const sendToProduction = async (orderId: number): Promise<any> => {
  const response = await fetch(`${API_BASE}/api/orders/${orderId}/send-to-production/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send to production: ${errorText}`);
  }

  return response.json();
};

// Production APIs

export const assignMachines = async (
  orderId: number,
  assignments: Array<{
    product_name: string;
    product_sku?: string;
    product_quantity: number;
    machine_id: string;
    machine_name: string;
    estimated_time_minutes: number;
    assigned_by?: string;
    notes?: string;
  }>
): Promise<MachineAssignment[]> => {
  const response = await fetch(`${API_BASE}/api/orders/${orderId}/assign-machines/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(assignments),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to assign machines: ${errorText}`);
  }

  return response.json();
};

export const sendToAdmin = async (orderId: number): Promise<any> => {
  const response = await fetch(`${API_BASE}/api/orders/${orderId}/send-to-admin/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send to admin: ${errorText}`);
  }

  return response.json();
};

export const getMachineQueue = async (): Promise<MachineAssignment[]> => {
  const response = await fetch(`${API_BASE}/api/production/machine-queue/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch machine queue: ${errorText}`);
  }

  return response.json();
};

export const updateMachineStatus = async (
  assignmentId: number,
  status: 'queued' | 'in_progress' | 'completed' | 'on_hold'
): Promise<MachineAssignment> => {
  const response = await fetch(`${API_BASE}/api/machine-assignments/${assignmentId}/status/`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update machine status: ${errorText}`);
  }

  return response.json();
};

// File Management APIs

export const uploadOrderFile = async (
  orderId: number,
  file: File,
  fileType: string,
  stage: string,
  description?: string,
  productRelated?: string,
  visibleToRoles?: string[]
): Promise<OrderFile> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('file_type', fileType);
  formData.append('stage', stage);
  if (description) formData.append('description', description);
  if (productRelated) formData.append('product_related', productRelated);
  if (visibleToRoles) formData.append('visible_to_roles', JSON.stringify(visibleToRoles));

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;

  const response = await fetch(`${API_BASE}/api/orders/${orderId}/files/upload/`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload file: ${errorText}`);
  }

  return response.json();
};

export const getOrderFiles = async (orderId: number): Promise<OrderFile[]> => {
  const response = await fetch(`${API_BASE}/api/orders/${orderId}/files/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch order files: ${errorText}`);
  }

  return response.json();
};

export const approveDesign = async (
  approvalId: number, 
  decision: 'approved' | 'rejected', 
  rejectionReason?: string
): Promise<any> => {
  const action = decision === 'approved' ? 'approve' : 'reject';
  console.log(`📋 Submitting ${action} decision for approval ID: ${approvalId}`);
  
  const response = await fetch(`${API_BASE}/api/approvals/${approvalId}/decision/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      action: action,
      rejection_reason: rejectionReason || '',
    }),
  });

  console.log('📋 Approval decision response:', response.status, response.statusText);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Approval decision error:', errorText);
    throw new Error(`Failed to submit approval decision: ${errorText}`);
  }

  const data = await response.json();
  console.log('✅ Approval decision successful:', data);
  return data;
};