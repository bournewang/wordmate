import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'tiny' | 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'white';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  color = 'primary',
  className = ''
}) => {
  return (
    <div className={`loading-spinner ${size} ${color} ${className}`}>
      <div className="spinner-ring">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
  );
};
