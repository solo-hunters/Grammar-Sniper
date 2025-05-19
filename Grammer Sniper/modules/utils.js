/**
 * @copyright This code belongs to Solo Hunters Open Source Community
 */

// Utility functions

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Expose to global scope
window.debounce = debounce; 