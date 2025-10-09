"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Save, Loader2, ArrowLeft } from "lucide-react";
import { BaseProduct, ConfiguredProduct, ProductAttribute } from "@/app/types/products";
import { getProductAttributes } from "@/app/lib/products";
import DesignUploadSection from "./DesignUploadSection";
import { OrderFile, uploadFileToBackend, UploadProgress } from "@/lib/backendFileUpload";

export interface ProductConfigModalProps {
  open: boolean;
  onClose: () => void;
  baseProduct: BaseProduct | null;
  onConfirm: (configured: ConfiguredProduct) => void;
  initialQty?: number;
  initialAttributes?: Record<string, string>;
  initialPrice?: number;
  editingProductId?: string;
  onBack?: () => void; // New prop for back button
  temporaryOrderId?: number; // New prop for temporary order ID for file uploads
}

export default function ProductConfigModal({
  open,
  onClose,
  baseProduct,
  onConfirm,
  initialQty = 1,
  initialAttributes = {},
  initialPrice,
  editingProductId,
  onBack,
  temporaryOrderId
}: ProductConfigModalProps) {
  
  // Memoize baseProductId to prevent unnecessary re-renders
  const baseProductId = useMemo(() => baseProduct?.id, [baseProduct?.id]);
  
  // Memoize initialAttributes string representation to check for actual changes
  const initialAttributesString = useMemo(() => 
    JSON.stringify(initialAttributes), [initialAttributes]
  );
  
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [isPriceManuallySet, setIsPriceManuallySet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Design upload state
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    id: number;
    file: File;
    name: string;
    size: number;
    type: string;
    uploadProgress: number;
    status: 'ready';
  }>>([]);
  const [readyDesign, setReadyDesign] = useState(false);
  const [needCustom, setNeedCustom] = useState(false);
  const [customText, setCustomText] = useState("");
  
  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [isUploading, setIsUploading] = useState(false);

  // Handle file upload to backend
  const handleFileUpload = useCallback(async (newFiles: File[]) => {
    if (newFiles.length === 0) {
      return;
    }

    // Store files locally for later upload when order is created
    const newLocalFiles = newFiles.map(file => ({
      id: Date.now() + Math.random(), // Temporary ID
      file: file,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadProgress: 100, // Mark as ready for upload
      status: 'ready' as const
    }));

    setUploadedFiles(prev => [...prev, ...newLocalFiles]);
    console.log(`✅ Added ${newFiles.length} files for later upload`);
  }, []);

  // Handle file changes - store files locally for later upload
  useEffect(() => {
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, [files, handleFileUpload]);

  // Price calculation helpers
  const toQty = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  };

  const baseUnitPrice = baseProduct?.defaultPrice || 0;
  
  const effectiveUnitPrice = useMemo(() => {
    // If price was manually set, use the manual price
    if (isPriceManuallySet) {
      return price;
    }
    
    // Otherwise calculate based on attributes
    const sumDelta = Object.entries(selectedAttributes).reduce((sum, [attrKey, optionValue]) => {
      if (!optionValue) return sum;
      const attr = attributes.find(a => a.key === attrKey);
      const option = attr?.options.find(o => o.value === optionValue);
      // Use priceDelta property, default to 0 if not present
      return sum + (option?.priceDelta ?? 0);
    }, 0);
    return Math.max(0, baseUnitPrice + sumDelta);
  }, [baseUnitPrice, selectedAttributes, attributes, isPriceManuallySet, price]);

  const finalPrice = useMemo(() => {
    return effectiveUnitPrice * toQty(quantity);
  }, [effectiveUnitPrice, quantity]);

  // Auto-update price when attributes change (only if not manually set)
  useEffect(() => {
    if (baseProduct && Object.keys(selectedAttributes).length > 0 && !isPriceManuallySet) {
      const newPrice = effectiveUnitPrice;
      setPrice(newPrice);
    }
  }, [effectiveUnitPrice, baseProductId, isPriceManuallySet]);

  // Load product attributes when baseProduct changes
  useEffect(() => {
    if (baseProduct && open) {
      setLoading(true);
      setError(null);
      
      getProductAttributes(baseProduct.id)
        .then((attrs) => {
          setAttributes(attrs);
          
          // Initialize selected attributes with first option if not set
          const initialSelections: Record<string, string> = {};
          attrs.forEach(attr => {
            if (initialAttributes && initialAttributes[attr.key]) {
              initialSelections[attr.key] = initialAttributes[attr.key];
            } else if (attr.options.length > 0) {
              initialSelections[attr.key] = attr.options[0].value;
            }
          });
          setSelectedAttributes(initialSelections);
          
          // Initialize price with default price or initial price
          const defaultPrice = baseProduct.defaultPrice || 0;
          setPrice(Number(initialPrice) || defaultPrice);
          setIsPriceManuallySet(Number(initialPrice) > 0); // If initialPrice is provided, mark as manually set
        })
        .catch((err) => {
          setError("Failed to load product attributes");
          console.error("Error loading attributes:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [baseProductId, open]); // Using memoized baseProductId

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setQuantity(initialQty ? initialQty.toString() : "");
      setPrice(Number(initialPrice) || 0);
      setIsPriceManuallySet(Number(initialPrice) > 0);
      setSelectedAttributes(initialAttributes || {});
      setError(null);
      
      // Load design data if editing existing product
      if (editingProductId && baseProduct) {
        // Custom requirements are now stored in the product configuration, not localStorage
        
        // Load design checkbox states from localStorage
        // Design preferences are now stored in the product configuration, not localStorage
      }
    } else {
      // Clear all state when modal closes
      setAttributes([]);
      setSelectedAttributes({});
      setQuantity("");
      setPrice(0);
      setIsPriceManuallySet(false);
      setFiles([]);
      setReadyDesign(false);
      setNeedCustom(false);
      setCustomText("");
      
      // Clear uploaded files state
      setUploadedFiles([]);
      setUploadProgress({});
    }
  }, [open, initialQty, initialPrice, editingProductId, baseProductId, initialAttributesString]); // Using memoized values to prevent infinite re-renders

  // Handle escape key and body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
      // Store original overflow style
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      
      return () => {
        document.removeEventListener("keydown", handleEscape);
        // Restore original overflow style
        document.body.style.overflow = originalOverflow;
      };
    } else {
      // Ensure scroll is restored when modal is closed
      document.body.style.overflow = "unset";
    }
  }, [open, onClose]);

  const handleAttributeChange = (key: string, value: string) => {
    setSelectedAttributes(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = () => {
    if (!baseProduct) return;

    // Validate required attributes
    const missingAttributes = attributes
      .filter(attr => !selectedAttributes[attr.key])
      .map(attr => attr.label);

    if (missingAttributes.length > 0) {
      setError(`Please select: ${missingAttributes.join(", ")}`);
      return;
    }

    const qtyNum = toQty(quantity);
    if (qtyNum < 1) {
      setError("Quantity must be at least 1");
      return;
    }

    if (price <= 0) {
      setError("Unit price must be greater than 0");
      return;
    }

    // Validate design files - now mandatory for all products
    if (uploadedFiles.length === 0) {
      setError("Design files are mandatory. Please upload at least one design file.");
      return;
    }

    // Generate unique ID for the configured product
    const productId = editingProductId || `${baseProduct.id}_${Date.now()}`;
    const configuredProduct: ConfiguredProduct = {
      id: productId,
      productId: baseProduct.id,
      name: baseProduct.name,
      imageUrl: baseProduct.imageUrl,
      quantity: qtyNum,
      price: price, // Use the current price (either manual or calculated)
      attributes: selectedAttributes,
      sku: `${baseProduct.id}_${Object.values(selectedAttributes).join('_')}`,
      customRequirements: needCustom ? customText : "", // Add custom requirements at product level
      design: {
        ready: readyDesign,
        needCustom: needCustom,
        customRequirements: needCustom ? customText : "",
        files: uploadedFiles.map(f => ({
          name: f.name,
          size: f.size,
          type: f.type,
          file: f.file // Include the actual File object for upload
        }))
      }
    };

    // Design data is now stored in the uploaded files, no need for localStorage

    onConfirm(configuredProduct);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Only close if clicking on the backdrop (not on the modal content)
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!open || !baseProduct) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }}
      onClick={handleOverlayClick}
    >
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {onBack && !editingProductId && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Back to search"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Configure {baseProduct.name}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {editingProductId ? "Edit product configuration" : "Select options and quantity"}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 mx-auto mb-4 text-gray-400 animate-spin" />
              <p className="text-gray-500">Loading product options...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-600 mb-4">{error}</div>
              <button
                onClick={() => {
                  setError(null);
                  if (baseProduct) {
                    setLoading(true);
                    getProductAttributes(baseProduct.id)
                      .then(setAttributes)
                      .catch(() => setError("Failed to load product attributes"))
                      .finally(() => setLoading(false));
                  }
                }}
                className="text-sm text-[#891F1A] hover:underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Existing Fields */}
              <div className="space-y-6">
                {/* Product Image with Name and Stock */}
                {baseProduct.imageUrl && (
                  <div className="flex items-start gap-4">
                    <img
                      src={baseProduct.imageUrl}
                      alt={baseProduct.name}
                      className="w-24 h-24 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 leading-tight mb-1">
                        {baseProduct.name}
                      </h3>
                      <div className="text-sm">
                        <span className="font-medium text-gray-600">Stock Available:</span> 
                        <span className={`ml-1 font-semibold ${
                          (baseProduct.stock || 0) > (baseProduct.stockThreshold || 0) 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {baseProduct.stock || 'N/A'}
                        </span>
                        {baseProduct.stockThreshold && (
                          <span className="text-xs text-gray-500 ml-1">
                            (Threshold: {baseProduct.stockThreshold})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Attributes */}
                {attributes.map((attribute) => (
                  <div key={attribute.key} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {attribute.label}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {attribute.options.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => handleAttributeChange(attribute.key, option.value)}
                          className={`
                            relative px-3 py-2 text-sm border rounded-lg transition-colors
                            ${selectedAttributes[attribute.key] === option.value
                              ? "bg-[#891F1A] text-white border-[#891F1A]"
                              : "bg-white text-gray-700 border-gray-300 hover:border-[#891F1A] hover:text-[#891F1A]"
                            }
                          `}
                        >
                          {option.label}
                          {option.priceDelta !== undefined && option.priceDelta !== 0 && (
                            <span className={`
                              absolute -top-3.5 -right-5 rounded px-1.5 py-0.5 text-xs font-medium border border-white shadow-sm z-10
                              ${option.priceDelta > 0 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                              }
                            `}>
                              {option.priceDelta > 0 ? `+AED ${option.priceDelta}` : `-AED ${Math.abs(option.priceDelta)}`}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Quantity */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Qty"
                    value={quantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow positive integers
                      const numericValue = value.replace(/\D/g, '');
                      setQuantity(numericValue);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#891F1A] focus:border-transparent"
                  />
                </div>

                {/* Price */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Unit Price (AED)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => {
                      const newPrice = parseFloat(e.target.value) || 0;
                      setPrice(newPrice);
                      setIsPriceManuallySet(true);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#891F1A] focus:border-transparent"
                  />
                </div>

                {/* Configuration Summary */}
                {baseProduct && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Configuration Summary</h4>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div>Quantity: {quantity || "0"}</div>
                      <div>Unit Price: AED {(Number(price) || 0).toFixed(2)}</div>
                      {attributes.map((attr) => {
                        const selectedValue = selectedAttributes[attr.key];
                        const selectedOption = attr.options.find(opt => opt.value === selectedValue);
                        if (selectedValue && selectedOption) {
                          return (
                            <div key={attr.key}>
                              {attr.label}: {selectedOption.label}
                            </div>
                          );
                        }
                        return null;
                      })}
                      <div className="font-bold">Final Price: AED {finalPrice.toFixed(2)}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Design Upload Section */}
              <div className="space-y-6">
                <DesignUploadSection
                  value={files}
                  onChange={setFiles}
                  readyDesign={readyDesign}
                  setReadyDesign={setReadyDesign}
                  needCustom={needCustom}
                  setNeedCustom={setNeedCustom}
                  customText={customText}
                  setCustomText={setCustomText}
                />
                
                {/* Upload Progress Display */}
                {isUploading && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Uploading Files...</h4>
                    {Object.values(uploadProgress).map((progress, index) => (
                      <div key={index} className="mb-2">
                        <div className="flex justify-between text-sm text-blue-800 mb-1">
                          <span>{progress.fileName}</span>
                          <span>{Math.round(progress.progress)}%</span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress.progress}%` }}
                          ></div>
                        </div>
                        {progress.error && (
                          <p className="text-xs text-red-600 mt-1">{progress.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Uploaded Files Display */}
                {uploadedFiles.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-green-900 mb-2">Uploaded Files ({uploadedFiles.length})</h4>
                    <div className="space-y-2">
                      {uploadedFiles.map((file) => (
                        <div key={file.id} className="flex items-center justify-between bg-white rounded-lg p-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-gray-700">{file.name}</span>
                            <span className="text-xs text-gray-500">
                              ({Math.round(file.size / 1024)} KB)
                            </span>
                          </div>
                          <span className="text-xs text-green-600">✓ Uploaded</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || attributes.length === 0}
            className="px-4 py-2 bg-[#891F1A] text-white rounded-lg hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {editingProductId ? "Update Product" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}