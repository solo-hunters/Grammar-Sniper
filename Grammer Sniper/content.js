/**
 * @copyright This code belongs to Solo Hunters Open Source Community
 */

// Function to check if we're on a disabled domain
function isDisabledDomain() {
  const disabledDomains = [
    'docs.google.com',
    'sheets.google.com',
    'drive.google.com',
    'mail.google.com',
    'translate.google.com',
    'github.com',
    'gitlab.com',
    'bitbucket.org',
    'atlassian.net',
    'discord.com',
    'slack.com',
    'outlook.live.com',
    'outlook.office.com',
    'outlook.office365.com'
    // These domains already have their own grammar checking or are known to be incompatible
  ];
  
  const currentHost = window.location.hostname;
  return disabledDomains.some(domain => {
    // Check for exact match or subdomain
    return currentHost === domain || currentHost.endsWith('.' + domain);
  });
}

// All required functions are now available in the global scope
// through the manifest.js file loading order

// More robust initialization that handles potential context invalidation
function startExtension() {
  try {
    // Check if we should run on this domain
    if (isDisabledDomain()) {
      console.log("Grammar Sniper is disabled on this domain.");
      return;
    }
    
    // Try to load API key with better error handling
    loadApiKey()
      .then(apiKeyLoaded => {
        if (apiKeyLoaded) {
          console.log("API key loaded successfully, initializing extension...");
          try {
            // Initialize with proper error boundaries
            const result = initialize();
            console.log("Initialization result:", result ? "Success" : "Failed");
          } catch (initError) {
            console.error("Error during initialization:", initError);
            // Continue with minimal functionality
            processEditableElements();
          }
        } else {
          console.warn('API Key not found. Some functionality may be limited. Please set the API key in the extension popup.');
          // Still try to initialize with limited functionality
          processEditableElements();
        }
      })
      .catch(error => {
        console.error("Error loading API key:", error);
        // Still try to initialize with limited functionality
        processEditableElements();
      });
  } catch (e) {
    console.error("Critical error starting extension:", e);
  }
}

// Start the extension
startExtension();

// Listen for API key updates from the popup with better error handling
try {
  // Only set up listeners if chrome runtime is available and valid
  if (chrome && chrome.runtime && chrome.runtime.id) {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      try {
        if (request.type === 'API_KEY_UPDATED') {
          // Store the active model type first
          if (request.activeModel) {
            localStorage.setItem('activeModel', request.activeModel);
            console.log(`Active model updated to: ${request.activeModel}`);
          }
          
          // Use the new reinitialization function
          const success = reinitializeWithNewKey(request.apiKey);
          
          sendResponse({ 
            success: success, 
            message: success ? 'API key updated and extension reinitialized' : 'API key updated but reinitialization failed'
          });
          
          return true; // Required to use sendResponse asynchronously
        } else if (request.type === 'GRAMMAR_SETTINGS_UPDATED') {
          // Update detailed grammar checking setting
          const detailedGrammarCheckEnabled = request.detailedGrammarCheckEnabled;
          localStorage.setItem('detailedGrammarCheckEnabled', detailedGrammarCheckEnabled);
          
          // Apply setting to all editable elements
          try {
            const editableElements = findEditableElements(document);
            editableElements.forEach(element => {
              // Clear existing detailed highlights if disabled
              if (!detailedGrammarCheckEnabled) {
                const container = element.parentElement?.querySelector(`.detailed-grammar-container[data-for="${element.id || ''}"]`);
                if (container) {
                  container.innerHTML = '';
                }
              } else if (typeof initDetailedGrammarCheck === 'function') {
                // Initialize detailed grammar checking for this element
                initDetailedGrammarCheck(element);
              }
            });
          } catch (elemError) {
            console.error("Error updating grammar settings for elements:", elemError);
          }
          
          // Send response
          sendResponse({ success: true, message: 'Grammar settings updated successfully' });
          return true;
        }
      } catch (msgError) {
        console.error("Error handling message:", msgError);
        sendResponse({ success: false, error: msgError.message });
      }
      return true; // Keep the messaging channel open for other messages
    });
    
    console.log("Message listeners successfully initialized");
  } else {
    console.warn("Chrome runtime not available, message listeners not initialized");
  }
} catch (setupError) {
  console.error("Failed to set up message listeners:", setupError);
}

// Helper function to get the active model
function getActiveModel() {
  return localStorage.getItem('activeModel') || 'gemini'; // Default to gemini if not set
}

// Setup individual input element
// This function attaches the logo and its associated event listeners to an editable element.
function setupInputElement(element) {
  // Validate element
  if (!element || !element.isConnected) {
    console.warn('Cannot setup disconnected or invalid element');
    return null;
  }
  
  // Prevent setting up the same element multiple times
  if (element.dataset.helperSetup === 'true') {
    return getExistingLogoForElement(element);
  }
  
  try {
    // Enhanced element type detection
    const nodeName = element.nodeName.toLowerCase();
    const isContentEditable = element.isContentEditable || element.getAttribute('contenteditable') === 'true' || element.getAttribute('contenteditable') === '';
    const isTextInput = nodeName === 'input' && 
      (element.type === 'text' || element.type === 'search' || element.type === 'email' || element.type === 'url');
    const isTextArea = nodeName === 'textarea';
    const isRoleTextbox = element.getAttribute('role') === 'textbox';
    const isAriaMultiline = element.getAttribute('aria-multiline') === 'true';
    
    // Check for common editor frameworks
    const isCommonEditor = element.classList.contains('ql-editor') || 
                          element.classList.contains('CodeMirror') ||
                          element.classList.contains('cm-content') ||
                          element.classList.contains('ProseMirror') ||
                          element.classList.contains('fr-element') ||
                          element.classList.contains('note-editable') ||
                          element.classList.contains('medium-editor-element') ||
                          element.classList.contains('public-DraftEditor-content') ||
                          element.classList.contains('cke_editable') ||
                          element.classList.contains('mce-content-body') ||
                          element.classList.contains('editor') ||
                          element.classList.contains('text-editor') ||
                          element.classList.contains('rich-text-editor') ||
                          element.classList.contains('wysiwyg-editor');
    
    // Check for editor attributes
    const hasEditorAttributes = element.hasAttribute('data-gramm') ||
                              element.hasAttribute('data-medium-editor-element') ||
                              element.hasAttribute('data-editor') ||
                              element.hasAttribute('data-rich-text') ||
                              element.hasAttribute('data-slate-editor') ||
                              element.hasAttribute('data-lexical-editor');
    
    const isEditableElement = isContentEditable || isTextInput || isTextArea || 
                            isRoleTextbox || isAriaMultiline || isCommonEditor || hasEditorAttributes;
    
    if (!isEditableElement) {
      return null;
    }
    
    // Skip search boxes, address bars and utility inputs where grammar checking is not appropriate
    const isSearchBox = (element.type === 'search') || 
                       (element.getAttribute('aria-label')?.toLowerCase().includes('search')) ||
                       (element.getAttribute('placeholder')?.toLowerCase().includes('search')) ||
                       (element.getAttribute('name')?.toLowerCase().includes('search')) ||
                       (element.id?.toLowerCase().includes('search')) ||
                       (element.classList.contains('search-input')) ||
                       (element.classList.contains('searchbox')) ||
                       (element.classList.contains('search-field')) ||
                       (element.closest('form[role="search"]')) ||
                       (element.closest('[aria-label*="search" i]'));
                       
    const isAddressBar = (element.id?.toLowerCase().includes('url')) || 
                        (element.getAttribute('type') === 'url') ||
                        (element.getAttribute('aria-label')?.toLowerCase().includes('address')) ||
                        (element.classList.contains('url-input')) ||
                        (element.classList.contains('address-bar'));
                        
    const isUtilityInput = isSearchBox || isAddressBar || 
                          (element.getAttribute('autocomplete') === 'off' && element.getAttribute('type') !== 'text') ||
                          (element.classList.contains('command-input')) ||
                          (element.getAttribute('role') === 'combobox');
    
    if (isUtilityInput) {
      return null;
    }
    
    // Mark as set up
    element.dataset.helperSetup = 'true';
  } catch (error) {
    console.error('Error checking element type:', error);
    return null;
  }
    
  // Assign a unique ID to the element if it doesn't have one
  if (!element.id) {
    element.id = 'helper-el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  }

  try {
    // Initialize grammar checking for this element
    initGrammarCheck(element);
    
    // Also initialize detailed grammar checking if enabled in settings
    const detailedGrammarCheckEnabled = localStorage.getItem('detailedGrammarCheckEnabled') === 'true';
    if (detailedGrammarCheckEnabled && typeof initDetailedGrammarCheck === 'function') {
      initDetailedGrammarCheck(element);
    }

    const logo = createLogoElement(); // Get logo from ui.js
    // Assign a unique ID for associating the logo with its container and potential popups
    logo.dataset.id = `helper-${Math.random().toString(36).substring(2, 9)}`;
    logo.dataset.forElement = element.id;
    
    // Intersection observer to show/hide logo based on element visibility
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          showLogo(); // Show logo if element is visible
        } else {
          hideLogo(); // Hide logo if element is not visible
        }
      });
    }, { threshold: 0.1 }); // Trigger when 10% of the element is visible
    
    // Store observer reference for cleanup
    element._logoVisibilityObserver = observer;
    observer.observe(element);
    
    // Function to display and position the logo
    const showLogo = () => {
      // Only show if the element is still connected to the DOM
      if (!element.isConnected) {
        return;
      }
      
      // Only show if the element has focus or the user is interacting with the logo/popup
      if (document.activeElement === element || logo.dataset.isClicked === 'true' || logo.dataset.popupVisible === 'true') {
        positionLogo(element, logo); // Position logo using ui.js function
        logo.style.display = 'flex';
        logo.style.opacity = '1';
        logo.style.visibility = 'visible';
        
        // Ensure its container (used for positioning) is also visible
        const container = document.querySelector(`.text-helper-container[data-for="${logo.dataset.id}"]`);
        if (container) {
          container.style.display = 'block'; // Might need adjustment based on how positionLogo works now
        }
      }
    };

    // Function to hide the logo
    const hideLogo = () => {
      // Only hide if not currently interacting with logo/popup
      if (logo.dataset.popupVisible !== 'true' && 
          logo.dataset.isClicked !== 'true' &&
          logo.dataset.isHovered !== 'true') {
        
        logo.style.opacity = '0';
        // Use setTimeout to allow fade-out transition and prevent hiding if interaction starts
        setTimeout(() => {
          if (logo.dataset.popupVisible !== 'true' && 
              logo.dataset.isClicked !== 'true' &&
              logo.dataset.isHovered !== 'true') {
            logo.style.display = 'none';
            // Hide container as well
            const container = document.querySelector(`.text-helper-container[data-for="${logo.dataset.id}"]`);
            if (container) {
              container.style.display = 'none';
            }
          }
        }, 300);
      }
    };

    // --- Event Listeners for Element ---

    // Reposition logo on input/text change (debounced)
    const handleInput = debounce(() => {
      if (element.isConnected) {
        showLogo();
      }
    }, 150); // Debounce to avoid excessive checks

    // Reposition on keyboard navigation within the element
    const handleKeyUp = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
        if (element.isConnected) {
          showLogo();
        }
      }
    };

    // Reposition on mouse click (which changes cursor position)
    const handleMouseUp = () => {
      if (element.isConnected) {
        showLogo();
      }
    };

    // Store function references for cleanup
    element._logoEventHandlers = {
      input: handleInput,
      keyup: handleKeyUp,
      mouseup: handleMouseUp,
      focus: showLogo,
      click: showLogo,
      blur: () => {
        // Delay hiding on blur to allow clicking the logo/popup
        setTimeout(() => {
          if (logo.dataset.isClicked !== 'true' && logo.dataset.popupVisible !== 'true') {
            hideLogo();
          }
        }, 300);
      }
    };

    // Add all event listeners
    element.addEventListener('input', handleInput);
    element.addEventListener('keyup', handleKeyUp);
    element.addEventListener('mouseup', handleMouseUp); 
    element.addEventListener('focus', showLogo); // Show logo on focus
    element.addEventListener('click', showLogo); // Also show on click

    element.addEventListener('blur', element._logoEventHandlers.blur);

    // --- Event Listeners for Scrolling/Resizing ---
    
    // Function to reposition logo (debounced) - used for scroll/resize
    const repositionLogo = debounce(() => {
      // Only reposition if the element is still connected to the DOM
      if (element.isConnected) {
        requestAnimationFrame(showLogo); // Use rAF for smoother positioning
      } else {
        // Cleanup if element is removed
        cleanupElementLogoHandlers(element);
      }
    }, 50);

    // Store for cleanup
    element._logoRepositionHandler = repositionLogo;

    // Attach scroll listeners to the element's scrollable parents
    element._logoScrollParents = [];
    let parent = element.parentElement;
    while (parent) {
      // Check if parent is scrollable (simplified check)
      if (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth) {
        parent.addEventListener('scroll', repositionLogo);
        element._logoScrollParents.push(parent);
      }
      if (parent === document.body) break; // Stop at body
      parent = parent.parentElement;
    }
    
    // Attach listeners to window scroll and resize
    window.addEventListener('scroll', repositionLogo, true); // Use capture phase for scroll
    window.addEventListener('resize', repositionLogo);

    // Initial positioning attempt
    showLogo();
    
    // --- Event Listeners for Logo Interaction ---

    // Prevent focus shift when clicking logo
    logo.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      logo.dataset.isClicked = 'true'; // Mark as clicked
    });
    
    // Handle logo click to fetch and show suggestions
    logo.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Check if element is still valid
      if (!element.isConnected) {
        console.log('Element disconnected, cannot show suggestions');
        cleanupElementLogoHandlers(element);
        return;
      }
      
      console.log('Logo clicked for element:', element.tagName, element.id || '');
      
      // Ensure logo stays visible during processing
      logo.style.display = 'flex';
      logo.style.opacity = '1';
      logo.style.visibility = 'visible';
      
      showLogoLoading(logo, true); // Show loading state via ui.js

      try {
        const contentInfo = getInputContent(element); // Get content via dom.js
        console.log('Current content info:', contentInfo);

        // Only proceed if there's enough text
        if (contentInfo.text.trim() && contentInfo.text.trim().length >= 10) {
          const suggestions = await getGrammarSuggestions(contentInfo.text); // API call via api.js
          // Show suggestions popup via ui.js
          // Note: showSuggestionsPopup now internally handles API calls and DOM replacements via imports
          await showSuggestionsPopup(element, logo, suggestions, contentInfo);
        } else {
          // Show popup indicating not enough text
          await showSuggestionsPopup(element, logo, null, contentInfo);
        }
      } catch (error) {
        console.error('Error getting/showing suggestions:', error);
        // Show error state in popup
        try {
          const contentInfo = getInputContent(element); // Get content again for context
          await showSuggestionsPopup(element, logo, [], contentInfo); // Pass empty array for error state
        } catch (innerError) {
          console.error('Error showing error state popup:', innerError);
        }
      } finally {
        showLogoLoading(logo, false); // Hide loading state via ui.js
      }
      
      // Reset clicked state after a short delay
      setTimeout(() => {
        logo.dataset.isClicked = 'false';
      }, 500); // Adjust delay as needed
    });
    
    // Handle mouse entering the logo area
    logo.addEventListener('mouseenter', () => {
      logo.dataset.isHovered = 'true';
      // Ensure visibility and apply hover effect (scaling handled in ui.js createLogoElement)
      logo.style.display = 'flex';
      logo.style.opacity = '1';
      logo.style.visibility = 'visible';
      // Hover effect (e.g., scaling) is managed within createLogoElement styles/listeners
    });
    
    // Handle mouse leaving the logo area
    logo.addEventListener('mouseleave', () => {
      logo.dataset.isHovered = 'false';
      // Only hide if element isn't focused and popup isn't open
      if (document.activeElement !== element && logo.dataset.popupVisible !== 'true') {
        // Delay hiding to allow moving mouse to popup or clicking
        setTimeout(() => {
          if (logo.dataset.isHovered !== 'true' && logo.dataset.isClicked !== 'true' && logo.dataset.popupVisible !== 'true') {
            hideLogo();
          }
        }, 500);
      }
    });
    
    // Add cleanup logic when the element is removed from the DOM
    const elementObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((removedNode) => {
          if (removedNode === element) {
            console.log('Element removed, cleaning up listeners and logo:', element.tagName, element.id || '');
            cleanupElementLogoHandlers(element, logo, observer, elementObserver);
          }
        });
      });
    });

    // Store for cleanup
    element._logoMutationObserver = elementObserver;

    if (element.parentElement) {
      elementObserver.observe(element.parentElement, { childList: true });
    }

    console.log(`Setup complete for element: ${element.tagName}#${element.id || '[no id]'}`);
    return logo; // Return the logo element if needed elsewhere
  } catch (error) {
    console.error('Error setting up input element:', error);
    element.dataset.helperSetup = 'false'; // Reset so we can try again later
    return null;
  }
}

// Helper function to get existing logo for an element that's already set up
function getExistingLogoForElement(element) {
  if (!element || !element.id) return null;
  
  const existingLogo = document.querySelector(`.text-helper-logo[data-for-element="${element.id}"]`);
  return existingLogo;
}

// Helper function to clean up all event handlers and observers
function cleanupElementLogoHandlers(element, logo, intersectionObserver, mutationObserver) {
  if (!element) return;
  
  // Clean up event listeners
  if (element._logoEventHandlers) {
    Object.entries(element._logoEventHandlers).forEach(([event, handler]) => {
      element.removeEventListener(event, handler);
    });
    delete element._logoEventHandlers;
  }
  
  // Clean up reposition handler from window and scroll parents
  if (element._logoRepositionHandler) {
    window.removeEventListener('scroll', element._logoRepositionHandler, true);
    window.removeEventListener('resize', element._logoRepositionHandler);
    
    // Clean up scroll parent listeners
    if (element._logoScrollParents) {
      element._logoScrollParents.forEach(parent => {
        parent.removeEventListener('scroll', element._logoRepositionHandler);
      });
      delete element._logoScrollParents;
    }
    
    delete element._logoRepositionHandler;
  }
  
  // Disconnect observers
  if (intersectionObserver) {
    intersectionObserver.disconnect();
  } else if (element._logoVisibilityObserver) {
    element._logoVisibilityObserver.disconnect();
    delete element._logoVisibilityObserver;
  }
  
  if (mutationObserver) {
    mutationObserver.disconnect();
  } else if (element._logoMutationObserver) {
    element._logoMutationObserver.disconnect();
    delete element._logoMutationObserver;
  }
  
  // Remove logo if provided
  if (logo && logo.parentElement) {
    logo.remove();
  } else if (element.id) {
    // Try to find and remove the logo by element id
    const associatedLogo = document.querySelector(`.text-helper-logo[data-for-element="${element.id}"]`);
    if (associatedLogo) {
      associatedLogo.remove();
    }
  }
  
  // Remove container if it exists
  const container = document.querySelector(`.text-helper-container[data-for-element="${element.id}"]`);
  if (container) container.remove();
  
  // Reset element state
  element.dataset.helperSetup = 'false';
}

function findEditableElements(root) {
  try {
    // Validate root parameter
    if (!root || !root.querySelectorAll) {
      console.warn('Invalid root element for findEditableElements');
      return document.querySelectorAll('input[type="text"], textarea');
    }
    
    // Use the enhanced findEditableElements from dom.js if available
    if (typeof window.findEditableElements === 'function') {
      try {
        return window.findEditableElements(root);
      } catch (domError) {
        console.warn('Error using dom.js findEditableElements:', domError);
        // Continue with fallback
      }
    }
    
    // Split the selector into smaller chunks to avoid potential regex issues
    // Basic inputs and contenteditable
    const basicSelectors = [
      'input[type="text"]', 
      'input[type="search"]', 
      'input[type="email"]', 
      'input[type="url"]', 
      'textarea',
      '[contenteditable="true"]',
      '[contenteditable=""]',
      '[role="textbox"]'
    ];
    
    // Common editor frameworks
    const editorFrameworkSelectors = [
      '.ql-editor',
      '.CodeMirror',
      '.cm-content',
      '.cm-line',
      '.monaco-editor .view-line',
      '.cke_editable',
      '.mce-content-body',
      '.public-DraftEditor-content',
      '.ProseMirror',
      '.fr-element',
      '.note-editable',
      '.medium-editor-element',
      'trix-editor',
      '.wysiwyg-editor'
    ];
    
    // Common editor attributes
    const editorAttributeSelectors = [
      '[data-gramm]',
      '[data-medium-editor-element]',
      '[data-editor]',
      '[data-rich-text="true"]',
      '[data-slate-editor="true"]',
      '[data-slate-object="block"]',
      '[data-lexical-editor="true"]',
      '[data-block-editor-block-type]'
    ];
    
    // Generic editor classes
    const genericEditorSelectors = [
      'div.editor',
      'div.text-editor',
      'div.rich-text-editor',
      'div.document-editor',
      'div[role="textbox"]',
      'div[aria-multiline="true"]'
    ];
    
    // Combine all selectors with a safer approach
    let allElements = new Set();
    
    // Function to safely query and add elements
    const safeQueryAndAdd = (selectors) => {
      selectors.forEach(selector => {
        try {
          const elements = root.querySelectorAll(selector);
          elements.forEach(el => allElements.add(el));
        } catch (selectorError) {
          console.warn(`Error with selector '${selector}':`, selectorError);
        }
      });
    };
    
    // Query each group separately
    safeQueryAndAdd(basicSelectors);
    safeQueryAndAdd(editorFrameworkSelectors);
    safeQueryAndAdd(editorAttributeSelectors);
    safeQueryAndAdd(genericEditorSelectors);
    
    // Convert Set to Array
    const elementsArray = Array.from(allElements);
    
    // Filter for visible elements
    const visibleElements = elementsArray.filter(el => {
      if (!el.isConnected) return false;
      
      try {
        // Check if element is visible
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return false;
        }
        
        // Check if element has reasonable size
        const rect = el.getBoundingClientRect();
        if (rect.width < 30 || rect.height < 20) {
          return false;
        }
        
        return true;
      } catch (e) {
        return false;
      }
    });
    
    console.log(`Found ${visibleElements.length} editable elements`);
    return visibleElements;
  } catch (error) {
    console.error('Error finding editable elements:', error);
    // Return empty array as fallback
    return [];
  }
}

// Initialize the extension: find editable elements and set them up.
function initialize() {
  try {
    console.log('Initializing Grammar Sniper extension...');
    
    // Check if we're in an iframe
    if (window !== window.top) {
      console.log('Running in iframe, adjusting behavior...');
      // Add a small delay to ensure parent frame loads first
      setTimeout(processEditableElements, 1000);
    } else {
      // Process editable elements immediately in main frame
      processEditableElements();
    }
    
    // Check for Shadow DOM elements that might contain editable elements
    processShadowDomElements();
    
    // Set up a mutation observer to detect dynamically added elements
    const observer = new MutationObserver((mutations) => {
      // Rate limiting to prevent performance issues
      if (!observer._throttled) {
        observer._throttled = true;
        setTimeout(() => {
          processEditableElements();
          processShadowDomElements(); // Also check for new shadow DOM elements
          observer._throttled = false;
        }, 1000); // Check only once per second maximum
      }
    });
    
    // Observe the entire document for new nodes
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Add grammar settings toggle to popup (if applicable)
    addGrammarSettingsToPopup();
    
    // Add event listener for when iframe content becomes available
    document.querySelectorAll('iframe').forEach(iframe => {
      if (!iframe._processed) {
        iframe._processed = true;
        handleIframe(iframe);
      }
    });
    
    // Set up a resize observer to handle responsive editors
    setupResizeObserver();
    
    console.log('Grammar Sniper extension initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing Grammar Sniper extension:', error);
    return false;
  }
}

// Function to process Shadow DOM elements
function processShadowDomElements() {
  try {
    // Find all elements that might have Shadow DOM
    const potentialShadowHosts = document.querySelectorAll('*');
    
    for (const host of potentialShadowHosts) {
      // Skip if already processed
      if (host._shadowProcessed) continue;
      
      // Check if element has shadow root
      const shadowRoot = host.shadowRoot;
      if (!shadowRoot) continue;
      
      // Mark as processed
      host._shadowProcessed = true;
      console.log('Found Shadow DOM:', host.tagName);
      
      // Find editable elements in shadow DOM
      const shadowEditables = findEditableElements(shadowRoot);
      console.log(`Found ${shadowEditables.length} editable elements in Shadow DOM`);
      
      // Process each editable element
      shadowEditables.forEach(el => {
        if (el.isConnected && !el.dataset.helperSetup) {
          setupInputElement(el);
        }
      });
      
      // Set up observer for shadow DOM changes
      const shadowObserver = new MutationObserver(() => {
        if (!shadowObserver._throttled) {
          shadowObserver._throttled = true;
          setTimeout(() => {
            const newElements = findEditableElements(shadowRoot);
            newElements.forEach(el => {
              if (el.isConnected && !el.dataset.helperSetup) {
                setupInputElement(el);
              }
            });
            shadowObserver._throttled = false;
          }, 1000);
        }
      });
      
      // Observe the shadow DOM
      shadowObserver.observe(shadowRoot, {
        childList: true,
        subtree: true
      });
      
      // Store observer reference for cleanup
      host._shadowObserver = shadowObserver;
    }
  } catch (error) {
    console.error('Error processing Shadow DOM elements:', error);
  }
}

// Function to set up a resize observer for responsive editors
function setupResizeObserver() {
  try {
    if (typeof ResizeObserver === 'undefined') {
      console.log('ResizeObserver not supported in this browser');
      return;
    }
    
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const element = entry.target;
        
        // Skip if not an editable element with our setup
        if (!element.dataset || !element.dataset.helperSetup) continue;
        
        // Reposition logo if it exists
        const logo = document.querySelector(`.text-helper-logo[data-for-element="${element.id || ''}"]`);
        if (logo && typeof positionLogo === 'function') {
          positionLogo(element, logo);
        }
        
        // Reposition grammar highlights if they exist
        const container = element.parentElement?.querySelector(`.grammar-highlight-container[data-for="${element.id || ''}"]`);
        if (container) {
          // Update container size
          const elementPosition = element.getBoundingClientRect();
          container.style.width = `${elementPosition.width}px`;
          container.style.height = `${elementPosition.height}px`;
        }
      }
    });
    
    // Observe all editable elements
    const editableElements = document.querySelectorAll('[data-helper-setup="true"]');
    editableElements.forEach(element => {
      resizeObserver.observe(element);
    });
    
    // Store observer globally for future elements
    window._grammarSniperResizeObserver = resizeObserver;
  } catch (error) {
    console.error('Error setting up resize observer:', error);
  }
}

// Function to add grammar settings toggle to the popup
function addGrammarSettingsToPopup() {
  // Check if the popup exists
  const popupBody = document.querySelector('.popup-body');
  if (!popupBody) return; // Not in popup context
  
  // Create section for grammar settings
  const settingsSection = document.createElement('div');
  settingsSection.className = 'settings-section';
  settingsSection.style.marginTop = '20px';
  settingsSection.style.padding = '15px';
  settingsSection.style.backgroundColor = '#f5f5f5';
  settingsSection.style.borderRadius = '8px';
  
  // Add heading
  const heading = document.createElement('h3');
  heading.textContent = 'Grammar Check Settings';
  heading.style.marginTop = '0';
  heading.style.marginBottom = '15px';
  settingsSection.appendChild(heading);
  
  // Create toggle for detailed grammar check
  const toggleContainer = document.createElement('div');
  toggleContainer.style.display = 'flex';
  toggleContainer.style.alignItems = 'center';
  toggleContainer.style.justifyContent = 'space-between';
  toggleContainer.style.marginBottom = '10px';
  
  const toggleLabel = document.createElement('label');
  toggleLabel.textContent = 'Detailed Grammar Check';
  toggleLabel.style.fontWeight = 'bold';
  toggleLabel.style.fontSize = '14px';
  
  const toggleWrapper = document.createElement('label');
  toggleWrapper.className = 'switch';
  toggleWrapper.style.position = 'relative';
  toggleWrapper.style.display = 'inline-block';
  toggleWrapper.style.width = '60px';
  toggleWrapper.style.height = '34px';
  
  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.id = 'detailed-grammar-toggle';
  
  // Check storage for current setting
  const detailedGrammarCheckEnabled = localStorage.getItem('detailedGrammarCheckEnabled') === 'true';
  toggleInput.checked = detailedGrammarCheckEnabled;
  
  const toggleSlider = document.createElement('span');
  toggleSlider.className = 'slider round';
  toggleSlider.style.position = 'absolute';
  toggleSlider.style.cursor = 'pointer';
  toggleSlider.style.top = '0';
  toggleSlider.style.left = '0';
  toggleSlider.style.right = '0';
  toggleSlider.style.bottom = '0';
  toggleSlider.style.backgroundColor = '#ccc';
  toggleSlider.style.transition = '0.4s';
  toggleSlider.style.borderRadius = '34px';
  
  // Add the before pseudo-element style as a real element
  const sliderButton = document.createElement('span');
  sliderButton.style.position = 'absolute';
  sliderButton.style.content = '""';
  sliderButton.style.height = '26px';
  sliderButton.style.width = '26px';
  sliderButton.style.left = '4px';
  sliderButton.style.bottom = '4px';
  sliderButton.style.backgroundColor = 'white';
  sliderButton.style.transition = '0.4s';
  sliderButton.style.borderRadius = '50%';
  sliderButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
  
  // Position the button based on checked state
  if (toggleInput.checked) {
    sliderButton.style.transform = 'translateX(26px)';
    toggleSlider.style.backgroundColor = '#4CAF50';
  }
  
  toggleSlider.appendChild(sliderButton);
  toggleWrapper.appendChild(toggleInput);
  toggleWrapper.appendChild(toggleSlider);
  
  toggleContainer.appendChild(toggleLabel);
  toggleContainer.appendChild(toggleWrapper);
  
  settingsSection.appendChild(toggleContainer);
  
  // Add event listener to the toggle
  toggleInput.addEventListener('change', () => {
    const isChecked = toggleInput.checked;
    localStorage.setItem('detailedGrammarCheckEnabled', isChecked);
    
    // Update visual style
    if (isChecked) {
      sliderButton.style.transform = 'translateX(26px)';
      toggleSlider.style.backgroundColor = '#4CAF50';
    } else {
      sliderButton.style.transform = 'translateX(0)';
      toggleSlider.style.backgroundColor = '#ccc';
    }
    
    // Send message to content script
    chrome.runtime.sendMessage({
      type: 'GRAMMAR_SETTINGS_UPDATED',
      detailedGrammarCheckEnabled: isChecked
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);
      } else if (response && response.success) {
        console.log('Grammar settings updated successfully');
      }
    });
  });
  
  // Add settings section to popup
  popupBody.appendChild(settingsSection);
}

// The initialize() function is called within the loadApiKey().then() block
// ensuring it only runs after the API key is confirmed to be loaded.

// Function to find any editable elements and handle them
function processEditableElements() {
  console.log('Processing editable elements on the page...');
  
  // Find all current editable elements
  const editableElements = findEditableElements(document);
  console.log(`Found ${editableElements.length} editable elements`);
  
  // Setup each element that hasn't been processed yet
  let count = 0;
  editableElements.forEach(element => {
    if (!element.dataset.helperSetup) {
      const logo = setupInputElement(element);
      if (logo) count++;
    }
  });
  
  console.log(`Successfully processed ${count} new elements`);
  
  // Check for iframes that haven't been processed
  document.querySelectorAll('iframe').forEach(iframe => {
    if (!iframe._processed) {
      iframe._processed = true;
      handleIframe(iframe);
    }
  });
  
  return count;
}

// Ensure we start the process at the right time
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', processEditableElements);
} else {
  processEditableElements();
}

// Use a MutationObserver to watch for new editable elements
const observer = new MutationObserver((mutations) => {
  let foundNewElements = false;
  
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if the node itself is editable
          if (node.matches && node.matches('textarea, input[type="text"], input[type="email"], [contenteditable="true"], [role="textbox"]')) {
            console.log('Editable element added:', node);
            if (node.dataset.helperSetup !== 'true' && typeof setupInputElement === 'function') {
              setupInputElement(node);
              foundNewElements = true;
            }
          }
          
          // Check for editable elements within the added node
          if (node.querySelectorAll) {
            const editors = node.querySelectorAll('textarea, input[type="text"], input[type="email"], [contenteditable="true"], [role="textbox"]');
            if (editors.length > 0) {
              console.log(`Found ${editors.length} new editable elements in added node`);
              editors.forEach(editor => {
                if (editor.isConnected && editor.dataset.helperSetup !== 'true' && typeof setupInputElement === 'function') {
                  setupInputElement(editor);
                  foundNewElements = true;
                }
              });
            }
          }
        }
      });
    }
  });
  
  // If we found new elements, we can assume the page is now loaded enough to try a full scan
  if (foundNewElements && typeof initialize === 'function') {
    console.log('New elements added, running full initialization');
    // Run the full initialization which will find all editable elements
    initialize();
  }
});

// Start observing the body for added nodes
observer.observe(document.body, { childList: true, subtree: true });

// Function to handle iframe content
function handleIframe(iframe) {
  // Skip iframes without src or with empty src
  if (!iframe.src || iframe.src === '' || iframe.src === 'about:blank') {
    console.log('Skipping iframe with empty or no src attribute');
    return;
  }

  // Check if iframe is accessible (same-origin)
  try {
    // Try to access iframe content
    let canAccess = false;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      canAccess = !!doc;
    } catch (accessErr) {
      canAccess = false;
    }
    
    if (!canAccess) {
      console.log('Cannot access cross-origin iframe:', iframe.src);
      return; // Skip inaccessible iframes
    }

    // Setup iframe content when it's loaded
    const setupIframeContent = () => {
      console.log('Setting up content for iframe:', iframe.src);
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc || !doc.body) {
          console.log('Iframe document or body not ready:', iframe.src);
          return;
        }
        
        // Inject necessary scripts into the iframe to ensure functionality
        try {
          // Check if we need to inject our scripts
          if (!doc.querySelector('#grammar-sniper-injected')) {
            // Create a marker to avoid double injection
            const marker = doc.createElement('div');
            marker.id = 'grammar-sniper-injected';
            marker.style.display = 'none';
            doc.body.appendChild(marker);
            
            // Inject our utility functions
            const scriptModules = [
              'utils.js',
              'config.js',
              'api.js',
              'dom.js',
              'ui.js',
              'grammarCheck.js'
            ];
            
            // Create a script element for each module
            scriptModules.forEach(module => {
              const script = doc.createElement('script');
              script.src = chrome.runtime.getURL(`modules/${module}`);
              script.onload = () => {
                console.log(`Injected ${module} into iframe`);
              };
              doc.head.appendChild(script);
            });
          }
        } catch (injectionError) {
          console.error('Error injecting scripts into iframe:', injectionError);
        }

        // Find and setup editable elements within the iframe
        const iframeElements = findEditableElements(doc);
        console.log(`Found ${iframeElements.length} editable elements in iframe.`);
        iframeElements.forEach(el => {
          if (el.isConnected && el.parentElement) {
            setupInputElement(el);
          }
        });
        
        // Setup observer for dynamically added elements in iframe
        const iframeObserver = new MutationObserver(() => {
          if (!iframeObserver._throttled) {
            iframeObserver._throttled = true;
            setTimeout(() => {
              const newElements = findEditableElements(doc);
              newElements.forEach(el => {
                if (el.isConnected && !el.dataset.helperSetup) {
                  setupInputElement(el);
                }
              });
              iframeObserver._throttled = false;
            }, 1000);
          }
        });
        
        // Observe the iframe's document body
        iframeObserver.observe(doc.body, {
          childList: true,
          subtree: true
        });
        
        // Store observer reference for cleanup
        iframe._observer = iframeObserver;
        
        // Also look for nested iframes
        doc.querySelectorAll('iframe').forEach(nestedIframe => {
          if (!nestedIframe._processed) {
            nestedIframe._processed = true;
            handleIframe(nestedIframe);
          }
        });
      } catch (e) {
        console.log('Error setting up iframe content:', e);
      }
    };

    // Setup on load or immediately if already loaded
    if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
      setupIframeContent();
    } else {
      iframe.addEventListener('load', setupIframeContent, { once: true });
    }
  } catch (e) {
    console.log('Cannot access iframe (cross-origin):', iframe.src);
  }
}

// Function to reinitialize when API key is updated
function reinitializeWithNewKey(apiKey) {
  // First update the API key
  try {
    if (typeof updateApiKey === 'function') {
      updateApiKey(apiKey);
      console.log('API key updated, reinitializing extension...');
    }
    
    // Re-run grammar checking on any elements already setup
    const elements = document.querySelectorAll('[data-grammar-check-enabled="true"]');
    console.log(`Rerunning grammar check on ${elements.length} already setup elements`);
    
    elements.forEach(element => {
      if (element._grammarCheckFunction) {
        // Trigger the debounced grammar check function for this element
        element._grammarCheckFunction();
      }
      
      // Also re-run detailed grammar check if enabled
      const detailedGrammarCheckEnabled = localStorage.getItem('detailedGrammarCheckEnabled') === 'true';
      if (detailedGrammarCheckEnabled && typeof initDetailedGrammarCheck === 'function') {
        initDetailedGrammarCheck(element);
      }
    });
    
    return true;
  } catch (error) {
    console.error('Error reinitializing with new key:', error);
    return false;
  }
}

