/**
 * @copyright This code belongs to Solo Hunters Open Source Community
 */

// API Configuration with Shadow DOM and Improved State Management

const CONFIG_NAMESPACE = 'grammar-sniper';
let GEMINI_API_KEY = '';
let GEMINI_API_URL = '';

// Create isolated container using Shadow DOM
const createIsolatedContainer = () => {
  const container = document.createElement('div');
  container.id = `${CONFIG_NAMESPACE}-container`;
  const shadow = container.attachShadow({ mode: 'closed' });
  
  // Add isolated styles
  const style = document.createElement('style');
  style.textContent = `
    .${CONFIG_NAMESPACE}-underline {
      border-bottom: 2px wavy red;
      position: relative;
    }
    .${CONFIG_NAMESPACE}-overlay {
      position: absolute;
      pointer-events: none;
      z-index: 9999;
    }
  `;
  shadow.appendChild(style);
  document.body.appendChild(container);
  return shadow;
};

function updateApiKey(newKey) {
  try {
    if (!newKey) {
      throw new Error('Invalid API key provided');
    }
    GEMINI_API_KEY = newKey;
    GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    console.log(`[${CONFIG_NAMESPACE}] API configuration updated successfully`);
    return true;
  } catch (error) {
    console.error(`[${CONFIG_NAMESPACE}] Error updating API key:`, error.message);
    return false;
  }
}

// Function to load the API key with improved error handling and retry logic
function loadApiKey() {
  return new Promise((resolve, reject) => {
    let retryCount = 0;
    const maxRetries = 3;
    
    function tryLoadApiKey() {
      try {
        // First check if chrome.runtime is available
        if (!chrome || !chrome.runtime || !chrome.storage) {
          console.warn(`[${CONFIG_NAMESPACE}] Chrome APIs not available`);
          resolve(false);
          return;
        }
        
        // Check for extension context validity
        if (chrome.runtime.id === undefined) {
          console.warn(`[${CONFIG_NAMESPACE}] Extension context invalidated`);
          resolve(false);
          return;
        }
        
        // Try to load the API key from storage with timeout
        const timeoutId = setTimeout(() => {
          console.warn(`[${CONFIG_NAMESPACE}] API key loading timed out`);
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`[${CONFIG_NAMESPACE}] Retrying API key load (attempt ${retryCount}/${maxRetries})`);
            tryLoadApiKey();
          } else {
            resolve(false);
          }
        }, 5000); // 5 second timeout
        
        chrome.storage.sync.get(['googleApiKey'], function(result) {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            console.error(`[${CONFIG_NAMESPACE}] Chrome runtime error:`, chrome.runtime.lastError);
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`[${CONFIG_NAMESPACE}] Retrying API key load (attempt ${retryCount}/${maxRetries})`);
              setTimeout(tryLoadApiKey, 1000); // Wait 1 second before retry
              return;
            }
            resolve(false);
            return;
          }
          
          if (result && result.googleApiKey) {
            try {
              const success = updateApiKey(result.googleApiKey);
              if (success) {
                // Double check that the key was actually set
                const currentKey = GEMINI_API_KEY;
                if (currentKey && currentKey === result.googleApiKey) {
                  console.log(`[${CONFIG_NAMESPACE}] API key loaded and verified`);
                  resolve(true);
                } else {
                  console.warn(`[${CONFIG_NAMESPACE}] API key verification failed`);
                  if (retryCount < maxRetries) {
                    retryCount++;
                    console.log(`[${CONFIG_NAMESPACE}] Retrying API key load (attempt ${retryCount}/${maxRetries})`);
                    setTimeout(tryLoadApiKey, 1000);
                    return;
                  }
                  resolve(false);
                }
              } else {
                console.warn(`[${CONFIG_NAMESPACE}] Failed to update API key`);
                if (retryCount < maxRetries) {
                  retryCount++;
                  console.log(`[${CONFIG_NAMESPACE}] Retrying API key load (attempt ${retryCount}/${maxRetries})`);
                  setTimeout(tryLoadApiKey, 1000);
                  return;
                }
                resolve(false);
              }
            } catch (updateError) {
              console.error(`[${CONFIG_NAMESPACE}] Error updating API key:`, updateError);
              if (retryCount < maxRetries) {
                retryCount++;
                console.log(`[${CONFIG_NAMESPACE}] Retrying API key load (attempt ${retryCount}/${maxRetries})`);
                setTimeout(tryLoadApiKey, 1000);
                return;
              }
              resolve(false);
            }
          } else {
            console.warn(`[${CONFIG_NAMESPACE}] No API key found in storage`);
            resolve(false);
          }
        });
      } catch (error) {
        console.error(`[${CONFIG_NAMESPACE}] Critical error loading API key:`, error);
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`[${CONFIG_NAMESPACE}] Retrying API key load (attempt ${retryCount}/${maxRetries})`);
          setTimeout(tryLoadApiKey, 1000);
          return;
        }
        resolve(false);
      }
    }
    
    // Start the initial attempt
    tryLoadApiKey();
  });
}

// Initialize isolated container
const shadowRoot = createIsolatedContainer();

// State management object with controlled access
const ConfigState = {
  getApiKey: () => GEMINI_API_KEY,
  getApiUrl: () => GEMINI_API_URL,
  updateApiKey,
  loadApiKey
};

// Expose minimal interface to global scope
window.GrammarSniperConfig = ConfigState;

// Function to position underline correctly
function positionUnderline(wordElement) {
  const rect = wordElement.getBoundingClientRect();
  const underline = document.createElement('div');
  underline.className = `${CONFIG_NAMESPACE}-underline`;
  underline.style.position = 'absolute';
  underline.style.left = `${rect.left}px`;
  underline.style.top = `${rect.bottom}px`;
  underline.style.width = `${rect.width}px`;
  underline.style.height = '2px';
  shadowRoot.appendChild(underline);
}

// Function to observe changes and reposition underline
function observeTextChanges(targetNode) {
  const observer = new MutationObserver(() => {
    // Reposition underline on text change
    const words = targetNode.querySelectorAll('span.incorrect-word');
    words.forEach(word => positionUnderline(word));
  });

  observer.observe(targetNode, { childList: true, subtree: true });
}

document.addEventListener('DOMContentLoaded', function() {
  // Initialize for all editor containers
  const editorContainers = document.querySelectorAll('.editor-container');
  if (editorContainers.length > 0) {
    editorContainers.forEach(container => {
      const editor = container.querySelector('textarea, [contenteditable="true"]');
      if (editor) {
        observeTextChanges(editor);
      }
    });
  }
}); 