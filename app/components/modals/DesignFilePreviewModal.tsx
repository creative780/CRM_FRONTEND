"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Download, FileText, Image as ImageIcon, File, ChevronLeft, ChevronRight, Eye, AlertCircle, Loader } from 'lucide-react';
import { getDesignFileUrl, downloadDesignFile } from '@/lib/design-file-api';

interface DesignFile {
  file_id: number | null;
  file_name: string;
  file_size: number;
  mime_type: string;
  url?: string; // For backend files
  content?: string; // For localStorage/temporary files (base64)
  blob?: Blob; // For blob objects
}

interface DesignFilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  files: DesignFile[];
  orderCode: string;
}

export default function DesignFilePreviewModal({
  isOpen,
  onClose,
  orderId,
  files,
  orderCode
}: DesignFilePreviewModalProps) {
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());

  const currentFile = files[currentFileIndex] || null;

  // Load file URLs when modal opens
  const loadFileUrls = useCallback(async () => {
    if (files.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const urls = await Promise.all(
        files.map(async (file) => {
          try {
            // Check if this is a backend file (has valid numeric ID)
            if (typeof file.file_id === 'number' && file.file_id > 0 && !file.content && !file.url) {
              try {
                console.log(`🔍 Attempting to get backend URL for file ${file.file_name} (ID: ${file.file_id})`);
                
                // Try multiple direct media URL patterns (faster and doesn't require auth)
                const urlPatterns = [
                  `http://localhost:8000/uploads/order_files/2025/10/09/${file.file_name}`,
                  `http://localhost:8000/uploads/order_files/2025/10/03/${file.file_name}`,
                  `http://localhost:8000/uploads/order_files/2025/09/${file.file_name}`,
                  `http://localhost:8000/uploads/order_files/2025/08/${file.file_name}`,
                ];
                
                console.log(`🔗 Trying direct media URLs for ${file.file_name}`);
                
                // Test each URL pattern
                for (const directUrl of urlPatterns) {
                  try {
                    console.log(`🔍 Testing URL: ${directUrl}`);
                    const testResponse = await fetch(directUrl, { method: 'HEAD' });
                    if (testResponse.ok) {
                      console.log(`✅ Direct media URL works for ${file.file_name}:`, directUrl);
                      return directUrl;
                    }
                  } catch (directError) {
                    console.log(`⚠️ URL failed: ${directUrl}`, directError);
                  }
                }
                
                console.log(`⚠️ All direct URLs failed for ${file.file_name}, trying API`);
                
                // Fallback to API endpoint
                const backendUrl = await getDesignFileUrl(orderId, file.file_id);
                if (backendUrl) {
                  console.log(`✅ Got backend URL for ${file.file_name}:`, backendUrl);
                  return backendUrl;
                }
              } catch (error) {
                console.warn(`⚠️ Failed to get backend URL for file ${file.file_name}:`, error);
                // Continue to other URL sources - this is expected for UI-only files
              }
            } else {
              console.log(`ℹ️ File ${file.file_name} has no valid backend ID (${file.file_id}), skipping backend URL fetch`);
            }
            
            // Handle localStorage/temporary files
            if (file.content) {
              // Convert base64 to blob URL
              const blob = new Blob([file.content], { type: file.mime_type });
              return URL.createObjectURL(blob);
            }
            
            // Has direct URL
            if (file.url) {
              console.log(`✅ Using direct URL for ${file.file_name}:`, file.url);
              return file.url;
            }
            
            // Handle blob objects
            if (file.blob) {
              return URL.createObjectURL(file.blob);
            }
            
            // For files without URLs, create a placeholder URL
            console.warn(`No valid file source found for ${file.file_name}, creating placeholder`);
            
            // Create a data URL with file information as fallback
            const placeholderContent = `
              <html>
                <head><title>${file.file_name}</title></head>
                <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                  <h2>📄 ${file.file_name}</h2>
                  <p><strong>Size:</strong> ${file.file_size ? `${Math.round(file.file_size / 1024)} KB` : 'Unknown'}</p>
                  <p><strong>Type:</strong> ${file.mime_type || 'Unknown'}</p>
                  <hr>
                  <p style="color: #666;">⚠️ File preview not available</p>
                  <p style="color: #666;">This file exists only as metadata in the order details.</p>
                  <p style="color: #666;">The actual file may need to be uploaded to the backend.</p>
                </body>
              </html>
            `;
            
            // Use encodeURIComponent to handle non-Latin1 characters safely
            try {
              return `data:text/html;base64,${btoa(unescape(encodeURIComponent(placeholderContent)))}`;
            } catch (btoaError) {
              console.error('btoa encoding failed, using fallback:', btoaError);
              // Fallback: return a simple text placeholder without base64 encoding
              return `data:text/plain;charset=utf-8,${encodeURIComponent('File preview unavailable: ' + file.file_name)}`;
            }
          } catch (error) {
            console.error(`Failed to load URL for file ${file.file_name}:`, error);
            return null;
          }
        })
      );
      
      setFileUrls(urls.filter(Boolean) as string[]);
    } catch (error) {
      console.error('Failed to load file URLs:', error);
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [files, orderId]);

  useEffect(() => {
    if (isOpen && files.length > 0) {
      loadFileUrls();
    } else {
      setFileUrls([]);
      setCurrentFileIndex(0);
      setError(null);
    }
  }, [isOpen, loadFileUrls]);

  // Cleanup blob URLs when modal closes
  useEffect(() => {
    return () => {
      fileUrls.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [fileUrls]);

  const handlePrevFile = () => {
    if (files.length === 0) return;
    setCurrentFileIndex(prev => prev === 0 ? files.length - 1 : prev - 1);
  };

  const handleNextFile = () => {
    if (files.length === 0) return;
    setCurrentFileIndex(prev => prev === files.length - 1 ? 0 : prev + 1);
  };

  const handleDownload = async (file: DesignFile) => {
    if (!file) return;
    
    setDownloadingFiles(prev => new Set(prev).add(file.file_name));
    console.log("🔽 Downloading file:", file.file_name);
    console.log("📄 File properties:", {
      file_id: file.file_id,
      hasContent: !!file.content,
      hasBlob: !!file.blob,
      hasUrl: !!file.url,
      mimeType: file.mime_type
    });
    
    try {
      // Handle different file sources for download
      if (file.content) {
        // Download localStorage/temporary files (base64 content)
        console.log("📦 Downloading from base64 content");
        downloadBase64File(file.content, file.file_name, file.mime_type);
      } else if (file.blob) {
        // Download blob files
        console.log("🗃️ Downloading from blob object");
        downloadBlobFile(file.blob, file.file_name);
      } else if (file.url) {
        // Download from direct URL
        console.log("🌐 Downloading from direct URL");
        downloadDirectFile(file.url, file.file_name);
      } else if (file.file_id && typeof file.file_id === 'number' && file.file_id > 0) {
        // Download backend files
        console.log("⚙️ Downloading from backend API, file_id:", file.file_id, "orderId:", orderId);
        try {
          await downloadDesignFile(orderId, file.file_id);
        } catch (error) {
          console.error("❌ Backend download failed, trying fallback methods:", error);
          // Fallback: try to create a download from file data if available
          if (file.file_name && file.mime_type) {
            console.log("🔄 Attempting fallback download...");
            // Create a simple text file with file info as fallback
            const fallbackContent = `File: ${file.file_name}\nSize: ${file.file_size || 'Unknown'} bytes\nType: ${file.mime_type}\n\nThis file could not be downloaded from the server.\nPlease contact your administrator.`;
            downloadBase64File(btoa(fallbackContent), `${file.file_name}.txt`, 'text/plain');
          } else {
            throw error;
          }
        }
      } else {
        console.error("❌ No valid file source available for download:", file);
        alert(`Cannot download "${file.file_name}". File source not available.`);
      }
    } catch (error) {
      console.error('💥 Download failed for', file.file_name, ':', error);
      alert(`Failed to download "${file.file_name}". Please try again.`);
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.file_name);
        return newSet;
      });
    }
  };

  // Helper function to download base64 files
  const downloadBase64File = (base64Content: string, fileName: string, mimeType: string) => {
    try {
      // Convert base64 to blob
      const byteCharacters = atob(base64Content);
      const byteArrays = new Uint8Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArrays[i] = byteCharacters.charCodeAt(i);
      }
      
      const blob = new Blob([byteArrays], { type: mimeType });
      downloadBlobFile(blob, fileName);
    } catch (error) {
      console.error('Failed to convert base64 to blob:', error);
      throw error;
    }
  };

  // Helper function to download blob files
  // Helper function to download direct URL files
  const downloadDirectFile = (url: string, fileName: string) => {
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.target = '_blank'; // Open in new tab as fallback
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download direct URL:', error);
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

    const downloadBlobFile = (blob: Blob, fileName: string) => {
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download blob:', error);
      throw error;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="w-8 h-8 text-green-600" />;
    }
    if (mimeType.includes('pdf')) {
      return <FileText className="w-8 h-8 text-red-600" />;
    }
    return <File className="w-8 h-8 text-blue-600" />;
  };

  const renderFilePreview = () => {
    const currentUrl = fileUrls[currentFileIndex];
    
    if (!currentUrl) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <AlertCircle className="w-8 h-8 mr-2" />
          No preview available
        </div>
      );
    }

    if (currentFile.mime_type.startsWith('image/')) {
      return (
        <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg p-6">
          <div className="text-center">
            <div className="text-green-600 mb-4">
              <svg className="w-16 h-16 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Image Preview</h3>
            <p className="text-sm text-gray-500 mb-4">
              Click the button below to view the image in a new tab.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => window.open(currentUrl, '_blank')}
                className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
              >
                View Image in New Tab
              </button>
              <p className="text-xs text-gray-400">
                File: {currentFile.file_name}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (currentFile.mime_type.includes('pdf')) {
      return (
        <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg p-6">
          <div className="text-center">
            <div className="text-blue-600 mb-4">
              <svg className="w-16 h-16 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">PDF Preview</h3>
            <p className="text-sm text-gray-500 mb-4">
              Click the button below to open the PDF in a new tab for viewing.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => window.open(currentUrl, '_blank')}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Open PDF in New Tab
              </button>
              <p className="text-xs text-gray-400">
                File: {currentFile.file_name}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          {getFileIcon(currentFile.mime_type)}
          <p className="mt-2 text-sm">{currentFile.file_name}</p>
          <p className="text-xs text-gray-400">Preview not available for this file type</p>
        </div>
      </div>
    );
  };

  if (!isOpen) {
    return null;
  }

  // Don't render if no files
  if (files.length === 0) {
    return null;
  }

  return (
    <Transition show={isOpen}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-6xl max-h-[90vh] transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all flex flex-col">
              {/* Header */}
              <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 flex justify-between items-center">
                Design Files Preview - {orderCode}
                <button
                  type="button"
                  className="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-2 py-1 text-sm font-medium text-gray-900 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  onClick={onClose}
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Title>

              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Loader className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                    <p className="text-gray-600">Loading files...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-600" />
                    <p className="text-red-600">{error}</p>
                    <button
                      onClick={loadFileUrls}
                      className="mt-2 text-blue-600 hover:text-blue-700 text-sm underline"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* File Navigation */}
                  {files.length > 1 && (
                    <div className="flex items-center justify-between mt-4 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          File {currentFileIndex + 1} of {files.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handlePrevFile}
                          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                          disabled={loading}
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={handleNextFile}
                          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                          disabled={loading}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* File Preview */}
                  <div className="flex-1 min-h-0">
                    <div className="h-full">
                      {renderFilePreview()}
                    </div>
                  </div>

                  {/* File Info and Actions */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        {currentFile ? (
                          <div className="flex items-center gap-3">
                            {getFileIcon(currentFile.mime_type)}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {currentFile.file_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(currentFile.file_size)} • {currentFile.mime_type}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <File className="w-8 h-8 text-gray-400" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                No file selected
                              </p>
                              <p className="text-xs text-gray-500">
                                Select a file to preview
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {currentFile && (
                          <button
                            onClick={() => handleDownload(currentFile)}
                            disabled={downloadingFiles.has(currentFile.file_name)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {downloadingFiles.has(currentFile.file_name) ? (
                            <>
                              <Loader className="w-4 h-4 mr-2 animate-spin" />
                              Downloading...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </>
                          )}
                        </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* File List */}
                  {files.length > 1 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-900 mb-2">All Files ({files.length})</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                        {files.map((file, index) => (
                          <div
                            key={file.file_id}
                            onClick={() => setCurrentFileIndex(index)}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                              index === currentFileIndex
                                ? 'bg-blue-50 border border-blue-200'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            {getFileIcon(file.mime_type)}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-900 truncate">
                                {file.file_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(file.file_size)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}