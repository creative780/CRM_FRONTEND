import { getApiBaseUrl } from './env';

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

export interface UploadProgress {
  fileName: string;
  fileSize: number;
  progress: number;
  isComplete: boolean;
  error?: string;
}

export interface UploadOptions {
  orderId: number;
  fileType?: string;
  stage?: string;
  description?: string;
  productRelated?: string;
  visibleToRoles?: string[];
  onProgress?: (progress: UploadProgress) => void;
}

/**
 * Upload a single file to the backend
 */
export const uploadFileToBackend = async (
  file: File,
  options: UploadOptions
): Promise<OrderFile> => {
  const {
    orderId,
    fileType = 'design',
    stage = 'design',
    description = '',
    productRelated = '',
    visibleToRoles = ['admin', 'sales', 'designer', 'production'],
    onProgress
  } = options;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('file_type', fileType);
  formData.append('stage', stage);
  if (description) formData.append('description', description);
  if (productRelated) formData.append('product_related', productRelated);
  if (visibleToRoles) formData.append('visible_to_roles', JSON.stringify(visibleToRoles));

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  
  if (!token) {
    throw new Error('No authentication token found');
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress({
            fileName: file.name,
            fileSize: file.size,
            progress: percentComplete,
            isComplete: false
          });
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (onProgress) {
            onProgress({
              fileName: file.name,
              fileSize: file.size,
              progress: 100,
              isComplete: true
            });
          }
          resolve(response);
        } catch (error) {
          reject(new Error('Invalid response from server'));
        }
      } else {
        const errorMessage = `Upload failed with status ${xhr.status}: ${xhr.responseText}`;
        if (onProgress) {
          onProgress({
            fileName: file.name,
            fileSize: file.size,
            progress: 0,
            isComplete: false,
            error: errorMessage
          });
        }
        reject(new Error(errorMessage));
      }
    });

    xhr.addEventListener('error', () => {
      const errorMessage = 'Network error occurred during upload';
      if (onProgress) {
        onProgress({
          fileName: file.name,
          fileSize: file.size,
          progress: 0,
          isComplete: false,
          error: errorMessage
        });
      }
      reject(new Error(errorMessage));
    });

    xhr.addEventListener('abort', () => {
      const errorMessage = 'Upload was aborted';
      if (onProgress) {
        onProgress({
          fileName: file.name,
          fileSize: file.size,
          progress: 0,
          isComplete: false,
          error: errorMessage
        });
      }
      reject(new Error(errorMessage));
    });

    xhr.open('POST', `${getApiBaseUrl()}/api/orders/${orderId}/files/upload/`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
};

/**
 * Upload multiple files to the backend
 */
export const uploadMultipleFilesToBackend = async (
  files: File[],
  options: UploadOptions
): Promise<OrderFile[]> => {
  const results: OrderFile[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const result = await uploadFileToBackend(file, options);
      results.push(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const fullErrorMessage = `Failed to upload ${file.name}: ${errorMessage}`;
      errors.push(fullErrorMessage);
      console.error(fullErrorMessage, error);
    }
  }

  if (errors.length > 0 && results.length === 0) {
    throw new Error(`All uploads failed: ${errors.join(', ')}`);
  }

  return results;
};

/**
 * Get files for an order
 */
export const getOrderFiles = async (orderId: number): Promise<OrderFile[]> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(`${getApiBaseUrl()}/api/orders/${orderId}/files/`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get order files: ${response.statusText}`);
  }

  const files = await response.json();
  console.log(`📡 API Response for order ${orderId} files:`, files);
  return files;
};

/**
 * Delete a file from an order
 */
export const deleteOrderFile = async (orderId: number, fileId: number): Promise<void> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(`${getApiBaseUrl()}/api/orders/${orderId}/files/${fileId}/delete/`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to delete file: ${response.statusText}`);
  }
};

