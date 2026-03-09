import React from 'react';

export function ReactUsed({ children, onClick }) {
  return (
    <div className="react-used" onClick={onClick}>
      {children}
    </div>
  );
}

export default ReactUsed;
