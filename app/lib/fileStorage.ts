/**
 * File storage utilities for localStorage persistence
 * Handles serialization and deserialization of File objects
 */

export interface StoredFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  data: string; // base64 encoded file data
}

export interface StoredFileMeta {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  url?: string; // blob URL for preview
}

/**
 * Convert File object to StoredFile for localStorage
 */
export async function fileToStoredFile(file: File): Promise<StoredFile> {
  return new Promise((resolve, reject) => {
    // Validate that we have a proper File object with blob data
    if (!(file instanceof File)) {
      reject(new Error('Invalid file object: not an instance of File'));
      return;
    }
    
    // Check if the file has actual content (size > 0)
    if (file.size === 0) {
      reject(new Error('Cannot process empty file: file size is 0'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = result.split(',')[1];
      
      resolve({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        data: base64Data
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Convert StoredFile back to File object
 */
export function storedFileToFile(storedFile: StoredFile): File {
  try {
    // Validate storedFile structure
    if (!storedFile || typeof storedFile !== 'object') {
      throw new Error('Invalid stored file: not an object');
    }
    
    // Validate required properties
    if (!storedFile.name || !storedFile.type) {
      throw new Error('Invalid stored file: missing name or type');
    }
    
    // Validate that the data is a valid base64 string
    if (!storedFile.data) {
      throw new Error('Invalid base64 data: data is missing');
    }
    
    if (typeof storedFile.data !== 'string') {
      throw new Error(`Invalid base64 data: data is not a string (got ${typeof storedFile.data})`);
    }
    
    // Check if it's a valid base64 string
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(storedFile.data)) {
      throw new Error('Invalid base64 data: string contains invalid characters');
    }
    
    const byteCharacters = atob(storedFile.data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: storedFile.type });
    
    return new File([blob], storedFile.name, {
      type: storedFile.type,
      lastModified: storedFile.lastModified
    });
  } catch (error) {
    console.error('Failed to convert stored file to File object:', error);
    console.error('Stored file data:', {
      name: storedFile?.name,
      type: storedFile?.type,
      size: storedFile?.size,
      dataType: typeof storedFile?.data,
      dataLength: storedFile?.data?.length,
      dataPreview: typeof storedFile?.data === 'string' ? storedFile.data.substring(0, 50) + '...' : storedFile?.data
    });
    
    // Return a placeholder file to prevent crashes
    const placeholderBlob = new Blob([''], { type: storedFile?.type || 'application/octet-stream' });
    return new File([placeholderBlob], storedFile?.name || 'corrupted-file', {
      type: storedFile?.type || 'application/octet-stream',
      lastModified: storedFile?.lastModified || Date.now()
    });
  }
}

/**
 * Convert File to StoredFileMeta (without data, for lightweight storage)
 */
export function fileToStoredFileMeta(file: File, url?: string): StoredFileMeta {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    url
  };
}

/**
 * Save files to localStorage with a given key
 */
export async function saveFilesToStorage(key: string, files: File[]): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    const storedFiles = await Promise.all(files.map(fileToStoredFile));
    localStorage.setItem(key, JSON.stringify(storedFiles));
  } catch (error) {
    console.error('Failed to save files to localStorage:', error);
  }
}

/**
 * Load files from localStorage with a given key
 */
export function loadFilesFromStorage(key: string): File[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    
    const storedFiles: StoredFile[] = JSON.parse(stored);
    
    // Filter out corrupted files and convert valid ones
    const validFiles: File[] = [];
    for (const storedFile of storedFiles) {
      try {
        const file = storedFileToFile(storedFile);
        validFiles.push(file);
      } catch (error) {
        console.warn(`Skipping corrupted file: ${storedFile.name}`, error);
        // Continue with other files
      }
    }
    
    return validFiles;
  } catch (error) {
    console.error('Failed to load files from localStorage:', error);
    // Clear corrupted data
    try {
      localStorage.removeItem(key);
      console.log(`Cleared corrupted localStorage data for key: ${key}`);
    } catch (clearError) {
      console.error('Failed to clear corrupted localStorage data:', clearError);
    }
    return [];
  }
}

/**
 * Save file metadata to localStorage (lightweight version)
 */
export function saveFileMetaToStorage(key: string, files: File[], urls?: string[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    const fileMetas = files.map((file, index) => 
      fileToStoredFileMeta(file, urls?.[index])
    );
    localStorage.setItem(key, JSON.stringify(fileMetas));
  } catch (error) {
    console.error('Failed to save file metadata to localStorage:', error);
  }
}

/**
 * Save files to localStorage with size validation and fallback to metadata only
 */
export async function saveFilesToStorageSafe(key: string, files: File[]): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    // Filter out empty files and invalid file objects
    const validFiles = files.filter(file => {
      if (!(file instanceof File)) {
        console.warn('Skipping invalid file object:', file);
        return false;
      }
      if (file.size === 0) {
        console.warn('Skipping empty file:', file.name);
        return false;
      }
      return true;
    });
    
    // If no valid files, just clear storage
    if (validFiles.length === 0) {
      clearFilesFromStorage(key);
      return;
    }
    
    // Check total size before attempting to save
    const totalSize = validFiles.reduce((sum, file) => sum + file.size, 0);
    const maxSize = 2 * 1024 * 1024; // 2MB limit for localStorage
    
    if (totalSize > maxSize) {
      console.warn(`Files too large (${(totalSize / 1024 / 1024).toFixed(2)}MB), storing metadata only`);
      saveFileMetaToStorage(key, validFiles);
      return;
    }
    
    const storedFiles = await Promise.all(validFiles.map(fileToStoredFile));
    const serialized = JSON.stringify(storedFiles);
    
    // Check if serialized size is still too large
    if (serialized.length > maxSize) {
      console.warn(`Serialized files too large (${(serialized.length / 1024 / 1024).toFixed(2)}MB), storing metadata only`);
      saveFileMetaToStorage(key, validFiles);
      return;
    }
    
    localStorage.setItem(key, serialized);
    console.log(`Files saved successfully (${(serialized.length / 1024).toFixed(2)}KB)`);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, falling back to metadata only');
      // Filter valid files for metadata storage too
      const validFiles = files.filter(file => file instanceof File && file.size > 0);
      saveFileMetaToStorage(key, validFiles);
    } else {
      console.error('Failed to save files to localStorage:', error);
    }
  }
}

/**
 * Load file metadata from localStorage
 */
export function loadFileMetaFromStorage(key: string): StoredFileMeta[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load file metadata from localStorage:', error);
    return [];
  }
}

/**
 * Load files from localStorage with fallback to metadata
 */
export function loadFilesFromStorageSafe(key: string): StoredFileMeta[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    
    // Check if it's full file data or just metadata
    if (parsed.length > 0 && parsed[0].data) {
      // Full file data - validate and return StoredFileMeta objects
      console.log('Loading full file data from localStorage');
      const validFiles: StoredFileMeta[] = [];
      
      for (const storedFile of parsed) {
        try {
          // Validate base64 data before processing
          if (storedFile.data && typeof storedFile.data === 'string') {
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            if (base64Regex.test(storedFile.data)) {
              validFiles.push({
                name: storedFile.name,
                size: storedFile.size,
                type: storedFile.type,
                lastModified: storedFile.lastModified
              });
            } else {
              console.warn(`Skipping file with invalid base64 data: ${storedFile.name}`);
            }
          }
        } catch (error) {
          console.warn(`Skipping corrupted file: ${storedFile.name}`, error);
        }
      }
      
      return validFiles;
    } else {
      // Just metadata
      console.log('Loading file metadata only (files too large for localStorage)');
      return parsed.map((meta: StoredFileMeta) => ({
        name: meta.name,
        size: meta.size,
        type: meta.type,
        lastModified: meta.lastModified,
        url: meta.url
      }));
    }
  } catch (error) {
    console.error('Failed to load files from localStorage:', error);
    // Clear corrupted data
    try {
      localStorage.removeItem(key);
      console.log(`Cleared corrupted localStorage data for key: ${key}`);
    } catch (clearError) {
      console.error('Failed to clear corrupted localStorage data:', clearError);
    }
    return [];
  }
}

/**
 * Clear files from localStorage
 */
export function clearFilesFromStorage(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

/**
 * Clear all corrupted file storage data
 */
export function clearAllCorruptedFileStorage(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const keysToRemove: string[] = [];
    
    // Find all file storage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('orderLifecycle_designFiles_') || key.includes('file'))) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            
            // Check if it's an array of files
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                // Check if any item has corrupted data
                if (item && typeof item === 'object') {
                  // Check for invalid data property
                  if (item.data !== undefined && typeof item.data !== 'string') {
                    console.log(`Found corrupted data in ${key}:`, item.data);
                    keysToRemove.push(key);
                    break;
                  }
                  
                  // Check for invalid base64 data
                  if (item.data && typeof item.data === 'string') {
                    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
                    if (!base64Regex.test(item.data)) {
                      console.log(`Found invalid base64 in ${key}:`, item.data?.substring(0, 50));
                      keysToRemove.push(key);
                      break;
                    }
                  }
                  
                  // Check for missing required properties
                  if (!item.name || !item.type) {
                    console.log(`Found incomplete file data in ${key}:`, item);
                    keysToRemove.push(key);
                    break;
                  }
                }
              }
            } else if (parsed && typeof parsed === 'object') {
              // Single file object
              if (parsed.data !== undefined && typeof parsed.data !== 'string') {
                console.log(`Found corrupted single file data in ${key}:`, parsed.data);
                keysToRemove.push(key);
              }
            }
          }
        } catch (error) {
          // If we can't parse it, it's probably corrupted
          console.log(`Failed to parse data in ${key}, marking for removal:`, error);
          keysToRemove.push(key);
        }
      }
    }
    
    // Remove corrupted keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`🧹 Removed corrupted localStorage key: ${key}`);
    });
    
    if (keysToRemove.length > 0) {
      console.log(`🧹 Cleared ${keysToRemove.length} corrupted file storage entries`);
    } else {
      console.log('🧹 No corrupted file storage entries found');
    }
  } catch (error) {
    console.error('Failed to clear corrupted file storage:', error);
  }
}

/**
 * Clear ALL file storage data (nuclear option)
 */
export function clearAllFileStorage(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const keysToRemove: string[] = [];
    
    // Find all file storage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('orderLifecycle_designFiles_') || key.includes('file'))) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all file storage keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`🧹 Removed all file storage key: ${key}`);
    });
    
    console.log(`🧹 Cleared ALL ${keysToRemove.length} file storage entries`);
  } catch (error) {
    console.error('Failed to clear all file storage:', error);
  }
}

/**
 * Get storage size for a given key (in bytes)
 */
export function getStorageSize(key: string): number {
  if (typeof window === 'undefined') return 0;
  
  try {
    const stored = localStorage.getItem(key);
    return stored ? new Blob([stored]).size : 0;
  } catch (error) {
    console.error('Failed to get storage size:', error);
    return 0;
  }
}
