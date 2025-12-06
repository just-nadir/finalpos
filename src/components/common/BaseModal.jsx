import React from 'react';
import { X } from 'lucide-react';

const BaseModal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'default', // 'small', 'default', 'large'
  showCloseButton = true 
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    small: 'w-[350px]',
    default: 'w-[500px]',
    large: 'w-[700px]'
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] animate-in fade-in duration-200">
      <div className={`bg-white ${sizeClasses[size]} rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto`}>
        {showCloseButton && (
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        )}
        
        {title && (
          <h2 className="text-xl font-bold text-gray-800 mb-6 pr-8">{title}</h2>
        )}
        
        <div className="modal-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default BaseModal;s