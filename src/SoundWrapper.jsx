import React from 'react';
import { playMenuHoverSound } from './soundUtils';


export default function SoundWrapper({ children, className = "", onClick }) {
  const handleMouseEnter = () => {
    playMenuHoverSound();
  };

  return (
    <div 
      className={className} 
      onMouseEnter={handleMouseEnter} 
      onClick={onClick}
      style={{ display: 'inline-block', cursor: 'pointer' }}
    >
      {children}
    </div>
  );
}