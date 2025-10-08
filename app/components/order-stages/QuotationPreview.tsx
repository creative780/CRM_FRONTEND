"use client";

import { useRef, useState, useEffect } from "react";
import { Plus, Minus, X } from "lucide-react";
import { toast } from "react-hot-toast";
import ProductSearchModal from "../modals/ProductSearchModal";
import ProductConfigModal from "../modals/ProductConfigModal";
import { BaseProduct, ConfiguredProduct } from "../../types/products";
import { isProduction, getApiBaseUrl } from "@/lib/env";

// No longer using html2pdf library

interface QuotationPreviewProps {
  formData: any;
  onProductsChange?: (products: any[]) => void;
  isEditable?: boolean;
}

export default function QuotationPreview({ 
  formData, 
  onProductsChange,
  isEditable = false 
}: QuotationPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  // Removed isPDFReady state as we're no longer using html2pdf
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showProductConfig, setShowProductConfig] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [pendingBaseProduct, setPendingBaseProduct] = useState<BaseProduct | null>(null);
  const [pendingInitialQty, setPendingInitialQty] = useState<number | undefined>(undefined);
  const [showShareModal, setShowShareModal] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);

  // No longer loading html2pdf library - using native browser print API instead

  const handleDownloadPDF = () => {
    if (!printRef.current) {
      toast.error("Printable content not found.");
      return;
    }

    try {
      toast.loading("Preparing PDF...", { id: "pdf-generation" });
      
      // Create a new window with the content
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error("Please allow popups to download PDF");
        return;
      }

      // Get the content and perform careful cleanup
      let content = printRef.current.innerHTML;
      
      // Remove all interactive elements (buttons, inputs, etc.) but preserve the data
      content = content.replace(/<button[^>]*>.*?<\/button>/gi, '');
      content = content.replace(/<input[^>]*value="([^"]*)"[^>]*>/gi, '$1'); // Replace inputs with their values
      content = content.replace(/<select[^>]*>.*?<\/select>/gi, '');
      content = content.replace(/<textarea[^>]*>.*?<\/textarea>/gi, '');
      
      // Remove interactive attributes but preserve styling
      content = content.replace(/\s(onclick|onchange|oninput|onfocus|onblur|onmouseover|onmouseout)="[^"]*"/gi, '');
      content = content.replace(/\s(role|tabindex|aria-[^=]*)=[^>\s]*/gi, '');
      
      // Replace problematic color functions in HTML content with proper colors
      content = content.replace(/oklch\([^)]*\)/gi, '#891F1A'); // Use brand color instead of black
      content = content.replace(/lab\([^)]*\)/gi, '#891F1A');
      content = content.replace(/lch\([^)]*\)/gi, '#891F1A');
      
      // Add wrapper classes to ensure side-by-side layout
      content = content.replace(
        /<div class="grid grid-cols-3 gap-6 mt-4">/g,
        '<div class="terms-totals-wrapper">'
      );
      
      // Ensure the structure is correct for terms section
      content = content.replace(
        /<div class="col-span-2 border border-gray-400">/g,
        '<div class="terms-section border border-gray-400">'
      );
      
      // Wrap the totals section
      content = content.replace(
        /<div class="border border-gray-400">\s*<table class="w-full text-xs">/g,
        '<div class="totals-section border border-gray-400"><table class="w-full text-xs financial-summary">'
      );
      
      // Replace html2pdf__ignore with no-print
      const cleanContent = content.replace(/html2pdf__ignore/g, 'no-print');
      
      // Get and clean stylesheets more carefully
      let allStyles = '';
      try {
        allStyles = Array.from(document.styleSheets)
          .map(sheet => {
            try {
              return Array.from(sheet.cssRules)
                .map(rule => rule.cssText)
                .join('');
            } catch (e) {
              console.warn("Could not read stylesheet:", e);
              return '';
            }
          })
          .join('');
        
        // Replace problematic color functions with proper brand colors
        allStyles = allStyles.replace(/oklch\([^)]*\)/gi, '#891F1A');
        allStyles = allStyles.replace(/lab\([^)]*\)/gi, '#891F1A');
        allStyles = allStyles.replace(/lch\([^)]*\)/gi, '#891F1A');
        
        // Only remove problematic CSS rules, keep essential ones
        allStyles = allStyles.replace(/@keyframes[^{]*\{[^}]*\}/gi, '');
        
      } catch (e) {
        console.warn("Error processing stylesheets:", e);
        allStyles = '';
      }
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Quotation - ${formData.orderId || formData.orderCode || 'Creative Connect'}</title>
            <style>
              /* Reset and base styles */
              * { box-sizing: border-box; }
              body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 16px; 
                color: #000; 
                background: #fff;
                font-size: 10px;
                line-height: 1.2;
              }
              
              /* Hide interactive elements */
              .no-print, button, input, select, textarea { 
                display: none !important; 
              }
              
              /* Main container */
              .quotation-container {
                background: white;
                padding: 12px;
                border: 1px solid #d1d5db;
                max-width: 100%;
                margin: 0 auto;
              }
              
              /* Header styles */
              .text-center {
                text-align: center;
                margin-bottom: 8px;
              }
              .text-xl {
                font-size: 16px;
                font-weight: bold;
                color: #891F1A;
                text-transform: uppercase;
                margin-bottom: 2px;
              }
              .text-xs {
                font-size: 9px;
                color: #374151;
                margin-bottom: 2px;
              }
              .flex {
                display: flex;
              }
              .justify-center {
                justify-content: center;
              }
              .gap-6 {
                gap: 12px;
              }
              .mt-1 {
                margin-top: 2px;
              }
              
              /* Grid layouts */
              .grid {
                display: grid !important;
              }
              .grid-cols-2 {
                grid-template-columns: 1fr 1fr !important;
              }
              .grid-cols-3 {
                display: grid !important;
                grid-template-columns: 2fr 1fr !important;
                gap: 12px !important;
              }
              .gap-6 {
                gap: 12px !important;
              }
              .mt-6 {
                margin-top: 12px;
              }
              .mt-4 {
                margin-top: 8px;
              }
              .col-span-2 {
                grid-column: span 2 !important;
              }
              
              /* Enhanced Grid Layout for Terms & Totals */
              .terms-totals-wrapper {
                display: grid !important;
                grid-template-columns: 2fr 1fr !important;
                gap: 12px !important;
                width: 100% !important;
                margin-top: 8px !important;
              }
              
              .terms-section {
                grid-column: 1 !important;
                width: 100% !important;
              }
              
              .totals-section {
                grid-column: 2 !important;
                width: 100% !important;
              }
              
              /* Force grid layout for the specific container */
              .grid.grid-cols-3 {
                display: grid !important;
                grid-template-columns: 2fr 1fr !important;
                gap: 12px !important;
                width: 100% !important;
              }
              
              /* Ensure no flexbox interference */
              .flex {
                display: block !important;
              }
              
              /* Force side-by-side layout in all contexts */
              .terms-totals-container {
                display: grid !important;
                grid-template-columns: 2fr 1fr !important;
                gap: 12px !important;
                margin-top: 8px;
              }
              
              /* Force side-by-side layout in print */
              @media print {
                .terms-totals-wrapper {
                  display: grid !important;
                  grid-template-columns: 2fr 1fr !important;
                  gap: 12px !important;
                  page-break-inside: avoid !important;
                }
                
                .terms-section {
                  grid-column: 1 !important;
                  width: 100% !important;
                }
                
                .totals-section {
                  grid-column: 2 !important;
                  width: 100% !important;
                }
                
                .grid.grid-cols-3 {
                  display: grid !important;
                  grid-template-columns: 2fr 1fr !important;
                  gap: 12px !important;
                }
                
                .terms-totals-container {
                  display: grid !important;
                  grid-template-columns: 2fr 1fr !important;
                  gap: 12px !important;
                  page-break-inside: avoid;
                }
                
                /* Prevent any layout breaking */
                .col-span-2 {
                  grid-column: 1 !important;
                }
              }
              
              /* Section styles */
              .border {
                border: 1px solid #d1d5db;
              }
              .border-gray-300 {
                border-color: #d1d5db;
              }
              .border-gray-400 {
                border-color: #9ca3af;
              }
              .bg-\\[\\#891F1A\\] {
                background-color: #891F1A;
              }
              .text-white {
                color: white;
              }
              .px-4 {
                padding-left: 8px;
                padding-right: 8px;
              }
              .py-1 {
                padding-top: 2px;
                padding-bottom: 2px;
              }
              .font-bold {
                font-weight: bold;
              }
              .text-sm {
                font-size: 10px;
              }
              .p-3 {
                padding: 6px;
              }
              .space-y-1 > * + * {
                margin-top: 2px;
              }
              .text-xs {
                font-size: 9px;
              }
              
              /* Table styles */
              table {
                border-collapse: collapse;
                width: 100%;
                margin: 8px 0;
                font-size: 9px;
                background: white;
              }
              th, td {
                border: 1px solid #9ca3af;
                padding: 4px;
                text-align: left;
                background: white;
                color: #000;
              }
              th {
                background-color: #891F1A !important;
                color: white !important;
                font-weight: bold;
              }
              td {
                background-color: white !important;
                color: #000 !important;
              }
              .text-center {
                text-align: center;
              }
              .text-right {
                text-align: right;
              }
              .bg-gray-50 {
                background-color: #f9fafb !important;
              }
              
              /* Ensure no black overlays - override any problematic styles */
              td {
                background-color: white !important;
                color: #000 !important;
              }
              th {
                background-color: #891F1A !important;
                color: white !important;
              }
              .bg-gray-50 {
                background-color: #f9fafb !important;
              }
              
              /* Totals table */
              .w-full {
                width: 100%;
              }
              .px-3 {
                padding-left: 6px;
                padding-right: 6px;
              }
              .py-1 {
                padding-top: 2px;
                padding-bottom: 2px;
              }
              .font-medium {
                font-weight: 500;
              }
              .border-b {
                border-bottom: 1px solid #d1d5db;
              }
              .border-gray-300 {
                border-color: #d1d5af;
              }
              .font-semibold {
                font-weight: 600;
              }
              
              /* Financial summary table - clean single border */
              .financial-summary {
                width: 100%;
                border-collapse: collapse;
                border-top: 1px solid #000;
                border-left: 1px solid #000;
                border-right: 1px solid #000;
                border-bottom: 1px solid #000;
                background: white;
                font-size: 9px;
              }
              
              /* All table cells with consistent styling */
              .financial-summary td {
                padding: 4px 8px;
                border-top: 1px solid #000;
                border-left: 1px solid #000;
                border-bottom: 1px solid #000;
                border-right: 1px solid #000;
                font-size: 9px;
                background: white !important;
                color: #000 !important;
                vertical-align: middle;
              }
              
              /* Remove right border from last column */
              .financial-summary td:last-child {
                border-right: none;
              }
              
              /* First column - labels */
              .financial-summary td:first-child {
                text-align: left;
                font-weight: normal;
                width: 60%;
              }
              
              /* Second column - values */
              .financial-summary td:last-child {
                text-align: right;
                font-weight: normal;
                width: 40%;
              }
              
              /* Total row - special styling */
              .financial-summary .total-row td {
                background-color: #891F1A !important;
                color: white !important;
                font-weight: bold;
                border-top: 1px solid #000;
                border-left: 1px solid #000;
                border-bottom: 1px solid #000;
                border-right: 1px solid #000;
              }
              
              /* Remove right border from last column in total row */
              .financial-summary .total-row td:last-child {
                border-right: none;
              }
              
              /* Remaining row - bold text */
              .financial-summary .remaining-row td {
                font-weight: bold;
                background: white !important;
                color: #000 !important;
                border-top: 1px solid #000;
                border-left: 1px solid #000;
                border-bottom: none;
                border-right: 1px solid #000;
              }
              
              /* Remove right border from last column in remaining row */
              .financial-summary .remaining-row td:last-child {
                border-right: none;
              }
              
              /* Remove border from last row */
              .financial-summary tr:last-child td {
                border-bottom: none;
              }
              
              /* Ensure all rows have consistent background */
              .financial-summary tr {
                background: white !important;
              }
              
              /* Override for total row */
              .financial-summary tr.total-row {
                background: #891F1A !important;
              }
              
              /* Ensure no visual separation between rows */
              .financial-summary tr:not(.total-row):not(.remaining-row) {
                background: white !important;
              }
              
              /* Consistent font styling */
              .financial-summary .font-medium {
                font-weight: 500 !important;
              }
              .financial-summary .font-bold {
                font-weight: bold !important;
              }
              .financial-summary .font-semibold {
                font-weight: 600 !important;
              }
              
              /* Remove container border to prevent double border */
              .totals-section {
                border: none !important;
                background: transparent !important;
                padding: 0 !important;
              }
              
              /* Terms section */
              .leading-relaxed {
                line-height: 1.3;
              }
              .uppercase {
                text-transform: uppercase;
              }
              
              /* Print styles */
              @media print {
                body { 
                  margin: 0; 
                  padding: 8px;
                  font-size: 9px;
                }
                .no-print, button, input, select, textarea { 
                  display: none !important; 
                }
                .quotation-container {
                  padding: 8px;
                  border: none;
                  max-width: none;
                }
                
                /* Ensure grid layouts work in print */
                .grid-cols-3 {
                  display: grid !important;
                  grid-template-columns: 2fr 1fr !important;
                  gap: 12px !important;
                }
                
                /* Prevent page breaks within sections */
                .border {
                  page-break-inside: avoid;
                }
                
                /* Force side-by-side layout in print */
                .terms-totals-wrapper {
                  display: grid !important;
                  grid-template-columns: 2fr 1fr !important;
                  gap: 12px !important;
                  page-break-inside: avoid !important;
                }
                
                .terms-section {
                  grid-column: 1 !important;
                  width: 100% !important;
                }
                
                .totals-section {
                  grid-column: 2 !important;
                  width: 100% !important;
                }
                
                @page { 
                  margin: 0.25in; 
                  size: A4;
                }
              }
              
              /* Additional styles from the original component */
              ${allStyles}
            </style>
          </head>
          <body>
            <div class="quotation-container">
              ${cleanContent}
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.onafterprint = function() {
                    window.close();
                  };
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      
      printWindow.document.close();
      toast.success("PDF print dialog opened! Use 'Save as PDF' in the print dialog.", { id: "pdf-generation" });
      
    } catch (error) {
      console.error("Print failed:", error);
      toast.error("Failed to open print dialog. Please try again.", { id: "pdf-generation" });
    }
  };

  const handleShare = () => {
    const currentUrl = window.location.href;
    const shareText = `Check out this quotation from Creative Connect: ${currentUrl}`;
    
    setShowShareModal(true);
    setPdfBlob(null); // No PDF, just URL sharing
  };

  // Parse cost fields
  const labour = parseFloat(formData.labourCost) || 0;
  const finishing = parseFloat(formData.finishingCost) || 0;
  const paper = parseFloat(formData.paperCost) || 0;
  const machine = parseFloat(formData.machineCost) || 0;
  const design = parseFloat(formData.designCost) || 0;
  const delivery = parseFloat(formData.deleiveryCost) || 0;
  const otherCharges = parseFloat(formData.otherCharges) || 0;
  const discount = parseFloat(formData.discount) || 0;
  const advancePaid = parseFloat(formData.advancePaid) || 0;

  // Use actual order items instead of hardcoded data
  const selectedProducts: any[] = formData.products || formData.items || [];

  const productLines = selectedProducts.map((p) => {
    // Handle multiple price field names (unitPrice, unit_price, price, unitCost, cost)
    const unitPrice = parseFloat(p.unitPrice || p.unit_price || p.price || p.unitCost || p.cost || "");
    const quantity = parseInt(p.quantity || "");
    
    return {
      id: p.id || Math.random().toString(),
      name: p.name || '',
      quantity: quantity,
      unitPrice: unitPrice,
      lineTotal: quantity * unitPrice,
    };
  });

  const productSubtotal = productLines.reduce((sum, p) => sum + p.lineTotal, 0);
  const otherSubtotal = labour + finishing + paper + machine + design + delivery + otherCharges;
  const subtotal = productSubtotal + otherSubtotal;
  const vat = Math.round((subtotal - discount) * 0.05);
  const total = subtotal - discount + vat;
  const remaining = total - advancePaid;

  // Create rows with empty slots
  const rows = [...productLines];
  while (rows.length < 17) {
    rows.push({ 
      id: `empty-${rows.length}`, 
      name: "", 
      quantity: 0, 
      unitPrice: 0, 
      lineTotal: 0 
    });
  }

  // Helper function to get the correct field value with fallbacks
  const getFieldValue = (primary: string, fallback: string, defaultValue: string = "") => {
    return formData[primary] || formData[fallback] || defaultValue;
  };

  // Get current logged-in user's username
  const getCurrentUsername = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_username") || "Unknown User";
    }
    return "Unknown User";
  };

  // Product management functions
  const handleAddProduct = (rowIndex: number) => {
    setEditingRowIndex(rowIndex);
    setShowProductSearch(true);
  };

  const handleEditProduct = (rowIndex: number) => {
    if (rowIndex >= selectedProducts.length) return;
    
    const productToEdit = selectedProducts[rowIndex];
    
    // Create a BaseProduct object from the existing product
    const baseProduct: BaseProduct = {
      id: productToEdit.productId || productToEdit.id,
      name: productToEdit.name,
      imageUrl: productToEdit.imageUrl || '',
      defaultPrice: productToEdit.unitPrice || 0
    };
    
    // Save custom requirements to localStorage so modal can retrieve them
    if (productToEdit.customRequirements) {
      const storageKey = `orderLifecycle_customRequirements_${productToEdit.id}`;
      localStorage.setItem(storageKey, productToEdit.customRequirements);
    }
    
    setEditingRowIndex(rowIndex);
    setPendingBaseProduct(baseProduct);
    setPendingInitialQty(productToEdit.quantity);
    setShowProductConfig(true);
  };

  const handleProductSelected = (product: BaseProduct, quantity: number = 1) => {
    if (editingRowIndex === null) return;

    // Set the pending product and open config modal
    setPendingBaseProduct(product);
    setPendingInitialQty(quantity);
    setShowProductSearch(false);
    setShowProductConfig(true);
  };

  const handleProductConfigured = (configured: ConfiguredProduct) => {
    if (editingRowIndex === null) return;

    const newProduct = {
      id: configured.id,
      name: configured.name,
      quantity: configured.quantity,
      unitPrice: configured.price,
      lineTotal: configured.quantity * configured.price,
      attributes: configured.attributes,
      sku: configured.sku,
      imageUrl: configured.imageUrl, // Preserve the image URL
      customRequirements: configured.design?.customRequirements || "", // Preserve custom requirements
    };

    // Update the products array
    const updatedProducts = [...selectedProducts];
    if (editingRowIndex < selectedProducts.length) {
      // Replace existing product
      updatedProducts[editingRowIndex] = newProduct;
    } else {
      // Add new product
      updatedProducts.push(newProduct);
    }

    // Update form data
    if (onProductsChange) {
      onProductsChange(updatedProducts);
    }

    // Reset state
    setShowProductConfig(false);
    setPendingBaseProduct(null);
    setPendingInitialQty(undefined);
    setEditingRowIndex(null);
  };

  const resetPendingProduct = () => {
    setPendingBaseProduct(null);
    setPendingInitialQty(undefined);
    setEditingRowIndex(null);
  };

  const handleRemoveProduct = (rowIndex: number) => {
    if (rowIndex >= selectedProducts.length) return;

    const updatedProducts = selectedProducts.filter((_, index) => index !== rowIndex);
    
    if (onProductsChange) {
      onProductsChange(updatedProducts);
    }
  };

  const handleQuantityChange = (rowIndex: number, newQuantity: number) => {
    if (rowIndex >= selectedProducts.length || newQuantity < 0) return;

    const updatedProducts = [...selectedProducts];
    updatedProducts[rowIndex] = {
      ...updatedProducts[rowIndex],
      quantity: newQuantity,
      lineTotal: newQuantity * (updatedProducts[rowIndex].unitPrice || updatedProducts[rowIndex].unit_price || updatedProducts[rowIndex].price || 0)
    };

    if (onProductsChange) {
      onProductsChange(updatedProducts);
    }
  };

  const handleUnitPriceChange = (rowIndex: number, newPrice: number) => {
    if (rowIndex >= selectedProducts.length || newPrice < 0) return;

    const updatedProducts = [...selectedProducts];
    const quantity = updatedProducts[rowIndex].quantity || "";
    updatedProducts[rowIndex] = {
      ...updatedProducts[rowIndex],
      unitPrice: newPrice,
      lineTotal: quantity * newPrice
    };

    if (onProductsChange) {
      onProductsChange(updatedProducts);
    }
  };

  const handlePlatformShare = (platform: string) => {
    const currentUrl = window.location.href;
    const shareText = `Check out this quotation from Creative Connect: ${currentUrl}`;
    
    const shareUrls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=Quotation from Creative Connect`,
      email: `mailto:?subject=Quotation from Creative Connect&body=Please check this quotation: ${encodeURIComponent(currentUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(currentUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=Check out this quotation from Creative Connect&url=${encodeURIComponent(currentUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`
    };
    
    if (platform === 'download') {
      // Use the print approach for download
      handleDownloadPDF();
      return;
    }
    
    window.open(shareUrls[platform], '_blank');
    toast.success(`Opening ${platform}...`);
    setShowShareModal(false);
  };

  return (
    <>
      {/* Product Search Modal */}
      <ProductSearchModal
        open={showProductSearch}
        onClose={() => {
          setShowProductSearch(false);
          setEditingRowIndex(null);
        }}
        onPickBaseProduct={handleProductSelected}
      />

      {/* Product Config Modal */}
      <ProductConfigModal
        open={showProductConfig}
        onClose={() => {
          setShowProductConfig(false);
          resetPendingProduct();
        }}
        baseProduct={pendingBaseProduct}
        onConfirm={handleProductConfigured}
        initialQty={pendingInitialQty}
        initialAttributes={editingRowIndex !== null && editingRowIndex < selectedProducts.length ? selectedProducts[editingRowIndex].attributes : {}}
        initialPrice={editingRowIndex !== null && editingRowIndex < selectedProducts.length ? selectedProducts[editingRowIndex].unitPrice : 0}
        editingProductId={editingRowIndex !== null && editingRowIndex < selectedProducts.length ? selectedProducts[editingRowIndex].id : undefined}
        onBack={() => {
          setShowProductConfig(false);
          setShowProductSearch(true);
        }}
      />

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 backdrop-blur-overlay flex items-center justify-center z-50 html2pdf__ignore">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-[#891F1A]">Share Quotation</h3>
            <p className="text-sm text-gray-600 mb-4">
              Choose a platform to share this quotation page:
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handlePlatformShare('whatsapp')}
                disabled={uploading}
                className="flex items-center gap-2 p-3 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                📱 WhatsApp
              </button>
              <button
                onClick={() => handlePlatformShare('telegram')}
                disabled={uploading}
                className="flex items-center gap-2 p-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                ✈️ Telegram
              </button>
              <button
                onClick={() => handlePlatformShare('email')}
                disabled={uploading}
                className="flex items-center gap-2 p-3 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                📧 Email
              </button>
              <button
                onClick={() => handlePlatformShare('linkedin')}
                disabled={uploading}
                className="flex items-center gap-2 p-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                💼 LinkedIn
              </button>
              <button
                onClick={() => handlePlatformShare('twitter')}
                disabled={uploading}
                className="flex items-center gap-2 p-3 bg-sky-500 text-white rounded hover:bg-sky-600 disabled:opacity-50 transition-colors"
              >
                🐦 Twitter
              </button>
              <button
                onClick={() => handlePlatformShare('facebook')}
                disabled={uploading}
                className="flex items-center gap-2 p-3 bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-50 transition-colors"
              >
                📘 Facebook
              </button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => handlePlatformShare('download')}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 p-3 bg-[#891F1A] text-white rounded hover:bg-[#6e1714] disabled:opacity-50 transition-colors"
              >
                📥 Print/Save as PDF
              </button>
            </div>
            
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                disabled={uploading}
              >
                Cancel
              </button>
            </div>
            
            {uploading && (
              <div className="mt-4 text-center">
                <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#891F1A]"></div>
                  Preparing PDF...
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Printable Content */}
      <div
        ref={printRef}
        className="bg-white p-8 rounded-md text-sm text-black font-sans border border-gray-300 max-w-5xl mx-auto"
      >
        {/* HEADER */}
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-[#891F1A] uppercase">Creative Connect Advertising L.L.C.</h1>
          <p className="text-xs text-gray-700">Shop No. 7, Al Madani Bldg, Al Nakhal Road, Deira-Dubai</p>
          <div className="flex justify-center gap-6 text-xs mt-1">
            <span>📞 04 325 9806</span>
            <span>✉️ ccaddxb@gmail.com</span>
            <span>🌐 www.creativeprints.ae</span>
          </div>
        </div>

        {/* CUSTOMER & PROJECT INFO */}
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div className="border border-gray-300">
            <div className="bg-[#891F1A] text-white px-4 py-1 font-bold text-sm">Customer</div>
            <div className="p-3 space-y-1 text-xs">
              <p><strong>Name:</strong> {getFieldValue("clientName", "client_name", "John Doe")}</p>
              <p><strong>Company:</strong> {getFieldValue("companyName", "clientCompany", "ABC Corp")}</p>
              <p><strong>Phone:</strong> {getFieldValue("phone", "clientPhone", "+971-5xxxxxxxx")}</p>
              <p><strong>Location:</strong> {getFieldValue("clientLocation", "address", "Dubai")}</p>
              <p><strong>TRN:</strong> {getFieldValue("trn", "trn", "1003 62033100003")}</p>
            </div>
          </div>

          <div className="border border-gray-300">
            <div className="bg-[#891F1A] text-white px-4 py-1 font-bold text-sm">Project Description</div>
            <div className="p-3 space-y-1 text-xs">
              <p><strong>Project:</strong> {getFieldValue("projectDescription", "specifications", "N/A")}</p>
              <p><strong>Date:</strong> {getFieldValue("date", "created_at", "2025-08-05")}</p>
              <p><strong>Sales Person:</strong> {getFieldValue("salesPerson", "created_by", getCurrentUsername())}</p>
              <p><strong>Invoice:</strong> {getFieldValue("orderId", "order_code", "INV-00123")}</p>
            </div>
          </div>
        </div>

        {/* PRODUCTS TABLE */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border border-gray-400 text-xs text-left">
            <thead className="bg-[#891F1A] text-white">
              <tr>
                <th className="border border-gray-400 px-2 py-1">Sr. No.</th>
                <th className="border border-gray-400 px-2 py-1">Description</th>
                <th className="border border-gray-400 px-2 py-1 text-center">Quantity</th>
                <th className="border border-gray-400 px-2 py-1 text-right">Unit Price</th>
                <th className="border border-gray-400 px-2 py-1 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, index) => {
                const isEmpty = !item.name;
                const isFirstEmpty = isEmpty && index === selectedProducts.length;
                
                return (
                  <tr key={index} className={isEmpty ? "bg-gray-50" : ""}>
                    <td className="border border-gray-400 px-2 py-1 relative">
                      <div className="flex items-center justify-between">
                        <span>{index + 1}</span>
                        {isEditable && isFirstEmpty && (
                          <button
                            onClick={() => handleAddProduct(index)}
                            className="w-4 h-4 bg-green-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-green-600 html2pdf__ignore ml-1"
                            title="Add Product"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {isEditable && !isEmpty ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditProduct(index)}
                            className="flex-1 text-left hover:underline cursor-pointer"
                            title="Click to edit product"
                          >
                            {item.name}
                          </button>
                          <button
                            onClick={() => handleRemoveProduct(index)}
                            className="w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 html2pdf__ignore"
                            title="Remove Product"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        item.name
                      )}
                    </td>
                    <td className="border border-gray-400 px-2 py-1 text-center">
                      {isEditable && !isEmpty ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleQuantityChange(index, (item.quantity as number) - 1)}
                            className="w-5 h-5 bg-gray-200 text-gray-700 rounded flex items-center justify-center text-xs hover:bg-gray-300 html2pdf__ignore"
                            title="Decrease Quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 0)}
                            className="w-12 text-center border border-gray-300 rounded px-1 py-0.5 text-xs html2pdf__ignore"
                            min="0"
                          />
                          <button
                            onClick={() => handleQuantityChange(index, (item.quantity as number) + 1)}
                            className="w-5 h-5 bg-gray-200 text-gray-700 rounded flex items-center justify-center text-xs hover:bg-gray-300 html2pdf__ignore"
                            title="Increase Quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        isEmpty ? "" : item.quantity
                      )}
                    </td>
                    <td className="border border-gray-400 px-2 py-1 text-right">
                      {isEditable && !isEmpty ? (
                        <input
                          type="number"
                          value={typeof item.unitPrice === 'number' ? item.unitPrice.toFixed(2) : item.unitPrice}
                          onChange={(e) => handleUnitPriceChange(index, parseFloat(e.target.value) || 0)}
                          className="w-20 text-right border border-gray-300 rounded px-1 py-0.5 text-xs html2pdf__ignore"
                          min="0"
                          step="0.01"
                        />
                      ) : (
                        isEmpty ? "" : (typeof item.unitPrice === 'number' ? item.unitPrice.toFixed(2) : (item.unitPrice || ""))
                      )}
                    </td>
                    <td className="border border-gray-400 px-2 py-1 text-right">
                      {isEmpty ? "" : (typeof item.lineTotal === 'number' ? item.lineTotal.toFixed(2) : (item.lineTotal || ""))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* TERMS & TOTALS */}
        <div className="grid grid-cols-3 gap-6 mt-4">
          <div className="col-span-2 border border-gray-400">
            <div className="bg-[#891F1A] text-white px-4 py-1 font-bold text-sm">Terms & Conditions</div>
            <div className="p-3 text-xs space-y-1 leading-relaxed">
              <p>Please check all numbers & spelling. Once approved, the file will go for printing and corrections cannot be made.</p>
              <p>1. Accuracy of color and cutting will be 85% to 90%.</p>
              <p>2. Design, spelling, logos, phone numbers, email, etc., must be approved.</p>
              <p>3. Material, sizes, and mock-ups must be confirmed.</p>
              <p>4. Production time starts only after mock-up approval.</p>
              <p>5. No refunds after payment.</p>
              <p className="font-bold text-[#891F1A] uppercase">
                Once approved, Creative Connect is not responsible for any printing mistakes.
              </p>
            </div>
          </div>

          <div className="border border-gray-400">
            <table className="w-full text-xs">
              <tbody>
                {[
                  { label: "Subtotal", value: subtotal, border: true },
                  { label: "Discount", value: discount, border: true },
                  { label: "VAT 5%", value: vat, border: true },
                  { label: "Advance Paid", value: advancePaid, border: true },
                  { label: "Total", value: total, rowClass: "bg-[#891F1A] text-white font-bold" },
                  { label: "Remaining", value: remaining, rowClass: "font-semibold" },
                ].map(({ label, value, border = false, rowClass = "" }) => (
                  <tr key={label} className={rowClass}>
                    <td
                      className={`px-3 py-1 font-medium${border ? " border-b border-gray-300" : ""}`}
                    >
                      {label}
                    </td>
                    <td
                      className={`px-3 py-1 text-right${border ? " border-b border-gray-300" : ""}`}
                    >
                      {value.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* BANK DETAILS */}
        <div className="mt-6 border border-gray-400">
          <div className="bg-[#891F1A] text-white px-4 py-1 font-bold text-sm">Company Bank Details</div>
          <div className="p-3 text-xs space-y-1">
            <p><strong>Company Name:</strong> Creative Connect Advertising L.L.C</p>
            <p><strong>Account Number:</strong> 019101090493</p>
            <p><strong>IBAN:</strong> AE480330000019101090493</p>
            <p><strong>Swift Code:</strong> BOMLAEAD</p>
            <p><strong>Branch:</strong> Mashreq NEO (099)</p>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center items-center text-sm html2pdf__ignore">
          <button
            className="bg-[#891F1A] hover:bg-[#6e1714] text-white px-4 py-2 rounded shadow transition"
            onClick={handleShare}
          >
            Share to Social Platforms
          </button>

          <button
            className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded shadow transition"
            onClick={() => handleDownloadPDF()}
          >
            Print/Save as PDF
          </button>
        </div>
      </div>
    </>
  );
}