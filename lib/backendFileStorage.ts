/**
 * Backend file storage utilities
 * Handles file operations with the backend API
 */

import { OrderFile, getOrderFiles, deleteOrderFile } from './backendFileUpload';

export interface FileReference {
  id: number;
  orderId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  uploadedAt: string;
  stage: string;
  productRelated?: string;
}

export interface FileCache {
  [orderId: number]: OrderFile[];
}

// Cache for storing file lists to avoid repeated API calls
const fileCache: FileCache = {};
const cacheExpiry: { [orderId: number]: number } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get files for an order with caching
 */
export async function getOrderFilesCached(orderId: number): Promise<OrderFile[]> {
  const now = Date.now();
  
  // Check if we have cached data that's still valid
  if (fileCache[orderId] && cacheExpiry[orderId] && now < cacheExpiry[orderId]) {
    console.log(`📁 Using cached files for order ${orderId}`);
    return fileCache[orderId];
  }
  
  try {
    console.log(`📡 Fetching files from backend for order ${orderId}`);
    const files = await getOrderFiles(orderId);
    
    // Cache the results
    fileCache[orderId] = files;
    cacheExpiry[orderId] = now + CACHE_DURATION;
    
    console.log(`✅ Cached ${files.length} files for order ${orderId}`);
    return files;
  } catch (error) {
    console.error(`❌ Failed to fetch files for order ${orderId}:`, error);
    throw error;
  }
}

/**
 * Preload files for multiple orders (useful for batch operations)
 */
export async function preloadOrderFiles(orderIds: number[]): Promise<void> {
  const promises = orderIds.map(orderId => getOrderFilesCached(orderId));
  await Promise.all(promises);
  console.log(`✅ Preloaded files for ${orderIds.length} orders`);
}

/**
 * Invalidate cache for an order
 */
export function invalidateOrderFilesCache(orderId: number): void {
  delete fileCache[orderId];
  delete cacheExpiry[orderId];
  console.log(`🗑️ Invalidated file cache for order ${orderId}`);
}

/**
 * Add files to cache (when new files are uploaded)
 */
export function addFilesToCache(orderId: number, newFiles: OrderFile[]): void {
  if (!fileCache[orderId]) {
    fileCache[orderId] = [];
  }
  
  // Add new files, avoiding duplicates
  const existingIds = new Set(fileCache[orderId].map(f => f.id));
  const uniqueNewFiles = newFiles.filter(f => !existingIds.has(f.id));
  
  fileCache[orderId] = [...fileCache[orderId], ...uniqueNewFiles];
  cacheExpiry[orderId] = Date.now() + CACHE_DURATION;
  
  console.log(`📁 Added ${uniqueNewFiles.length} new files to cache for order ${orderId}`);
}

/**
 * Remove file from cache
 */
export function removeFileFromCache(orderId: number, fileId: number): void {
  if (fileCache[orderId]) {
    fileCache[orderId] = fileCache[orderId].filter(f => f.id !== fileId);
    console.log(`🗑️ Removed file ${fileId} from cache for order ${orderId}`);
  }
}

/**
 * Get files by stage (design, final, etc.)
 */
export function getFilesByStage(files: OrderFile[], stage: string): OrderFile[] {
  return files.filter(file => file.stage === stage);
}

/**
 * Get files by product
 */
export function getFilesByProduct(files: OrderFile[], productName: string): OrderFile[] {
  return files.filter(file => 
    file.product_related && 
    file.product_related.toLowerCase().includes(productName.toLowerCase())
  );
}

/**
 * Get files by type (design, final, etc.)
 */
export function getFilesByType(files: OrderFile[], fileType: string): OrderFile[] {
  return files.filter(file => file.file_type === fileType);
}

/**
 * Convert OrderFile to FileReference for easier handling
 */
export function orderFileToReference(file: OrderFile): FileReference {
  return {
    id: file.id,
    orderId: file.order,
    fileName: file.file_name,
    fileSize: file.file_size,
    mimeType: file.mime_type,
    url: file.file_url,
    uploadedAt: file.uploaded_at,
    stage: file.stage,
    productRelated: file.product_related
  };
}

/**
 * Get file references for an order
 */
export async function getOrderFileReferences(orderId: number): Promise<FileReference[]> {
  const files = await getOrderFilesCached(orderId);
  return files.map(orderFileToReference);
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
  Object.keys(fileCache).forEach(orderId => {
    delete fileCache[parseInt(orderId)];
    delete cacheExpiry[parseInt(orderId)];
  });
  console.log('🗑️ Cleared all file cache');
}

/**
 * Clear cache for a specific order
 */
export function clearOrderCache(orderId: number): void {
  delete fileCache[orderId];
  delete cacheExpiry[orderId];
  console.log(`🗑️ Cleared cache for order ${orderId}`);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { totalOrders: number; totalFiles: number; expiredEntries: number } {
  const now = Date.now();
  let totalFiles = 0;
  let expiredEntries = 0;
  
  Object.keys(fileCache).forEach(orderId => {
    const files = fileCache[parseInt(orderId)];
    if (files) {
      totalFiles += files.length;
    }
    
    if (cacheExpiry[parseInt(orderId)] && now >= cacheExpiry[parseInt(orderId)]) {
      expiredEntries++;
    }
  });
  
  return {
    totalOrders: Object.keys(fileCache).length,
    totalFiles,
    expiredEntries
  };
}

