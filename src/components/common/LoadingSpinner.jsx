import React from 'react';

const LoadingSpinner = ({ size = 'default', text = 'Yuklanmoqda...' }) => {
  const sizeClasses = {
    small: 'w-6 h-6 border-2',
    default: 'w-10 h-10 border-3',
    large: 'w-16 h-16 border-4'
  };

  return (
    <div className="flex flex-col items-center justify-center p-10">
      <div className={`${sizeClasses[size]} border-blue-600 border-t-transparent rounded-full animate-spin`}></div>
      {text && <p className="mt-4 text-gray-500 font-medium">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;