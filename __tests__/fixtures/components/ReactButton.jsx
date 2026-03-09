import React from 'react';

export function ReactButton({ onClick, children }) {
  return (
    <button className="react-button" onClick={onClick}>
      {children}
    </button>
  );
}

export default ReactButton;
