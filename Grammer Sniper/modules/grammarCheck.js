/**
 * @copyright This code belongs to Solo Hunters Open Source Community
 */

// Grammar checking functionality

// A cache to store already checked text
const grammarCheckCache = new Map();
// A cache expiry time (30 minutes)
const CACHE_EXPIRY_MS = 30 * 60 * 1000;

// Improved helper functions for text node finding

// Walk the DOM to find the text node at a specific character position
function findTextNodeAtPosition(element, position) {
  // Validate parameters
  if (!element || position < 0) {
    console.warn('Invalid parameters for findTextNodeAtPosition');
    return null;
  }
  
  // Start walking the DOM from the element
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let node;
  let currentLength = 0;
  let foundNode = null;
  let foundOffset = 0;
  
  // Walk through all text nodes
  while ((node = walker.nextNode())) {
    // Skip empty text nodes
    if (!node.nodeValue || node.nodeValue.trim() === '') continue;
    
    const nodeLength = node.nodeValue.length;
    
    // Check if this node contains our position
    if (currentLength <= position && position < currentLength + nodeLength) {
      foundNode = node;
      foundOffset = position - currentLength;
      break;
    }
    
    // Accumulate text length as we go
    currentLength += nodeLength;
  }
  
  // Return the text node and offset if found
  if (foundNode) {
    return {
      node: foundNode,
      offset: foundOffset
    };
  }
  
  // Return the last text node as a fallback (if any exist)
  if (currentLength > 0) {
    console.warn('Position exceeds text length, returning last text node');
    return {
      node: node, // last node from the while loop
      offset: 0
    };
  }
  
  return null;
}

// Function to get the global position (character offset) of a text node within its parent element
function getTextNodePosition(element, textNode) {
  if (!element || !textNode) {
    console.warn('Invalid parameters for getTextNodePosition');
    return 0;
  }
  
  // Walk the DOM from the element
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let node;
  let currentLength = 0;
  
  // Walk through all text nodes until we find the target one
  while ((node = walker.nextNode()) && node !== textNode) {
    // Skip empty text nodes
    if (!node.nodeValue || node.nodeValue.trim() === '') continue;
    
    currentLength += node.nodeValue.length;
  }
  
  return currentLength;
}

// Function to check grammar and return errors
async function checkGrammar(text) {
  // Handle null, undefined or empty text
  if (!text || text.trim().length < 10) {
    console.log('Text is too short for grammar check');
    return [];
  }

  // Return from cache if available and not expired
  const cachedResult = grammarCheckCache.get(text);
  if (cachedResult && (Date.now() - cachedResult.timestamp < CACHE_EXPIRY_MS)) {
    console.log('Using cached grammar check result');
    return cachedResult.errors;
  }

  try {
    console.log('Checking grammar for text:', text);

    // Use the detailed grammar check instead of batch processing
    const detailedResult = await checkGrammarWithDetails(text);
    
    // Validate the detailed result structure
    if (!detailedResult || !detailedResult.words_with_mistakes || !Array.isArray(detailedResult.words_with_mistakes)) {
      console.warn('Invalid grammar check result structure');
      return [];
    }
    
    // Convert the detailed format to the format expected by the existing UI
    const errors = detailedResult.words_with_mistakes.map(mistake => {
      // Validate each mistake object
      if (!mistake || typeof mistake !== 'object' || 
          typeof mistake.text !== 'string' || 
          typeof mistake.suggestion !== 'string' ||
          typeof mistake.start_index !== 'number' ||
          typeof mistake.end_index !== 'number' ||
          mistake.start_index < 0 || 
          mistake.end_index <= mistake.start_index) {
        console.warn('Invalid mistake object:', mistake);
        return null;
      }
      
      return {
        error: mistake.text,
        suggestion: mistake.suggestion,
        type: mistake.mistake_type || 'grammar',
        startPos: mistake.start_index,
        endPos: mistake.end_index
      };
    }).filter(Boolean); // Remove any null entries
    
    // Cache the validated result with timestamp
    grammarCheckCache.set(text, {
      errors: errors,
      timestamp: Date.now()
    });

    return errors;
  } catch (error) {
    console.error('Error checking grammar:', error);
    return []; // Return empty array on error
  }
}

// Function to apply grammar highlighting to an element
function applyGrammarHighlighting(element, errors) {
  if (!element || !errors || errors.length === 0) return;
  
  // Enhanced check for element's parent element and connection to DOM
  if (!element.isConnected) {
    console.warn('Element is disconnected from DOM, cannot apply grammar highlighting');
    return;
  }
  
  if (!element.parentElement) {
    console.warn('Element has no parent, cannot apply grammar highlighting');
    return;
  }

  // Check if element already has highlighting container
  let container = element.parentElement.querySelector(`.grammar-highlight-container[data-for="${element.id || ''}"]`);
  
  if (!container) {
    // Create container for highlighting
    container = document.createElement('div');
    container.className = 'grammar-highlight-container';
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.right = '0';
    container.style.bottom = '0';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '1';
    container.style.overflow = 'hidden';
    
    // Add a unique identifier for this container to link it to the element
    if (!element.id) {
      element.id = 'grammarcheck-el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    }
    container.dataset.for = element.id;
    
    // Position container over the element
    const elementPosition = element.getBoundingClientRect();
    container.style.width = `${elementPosition.width}px`;
    container.style.height = `${elementPosition.height}px`;
    
    // Make sure element's parent has position for absolute positioning
    if (getComputedStyle(element.parentElement).position === 'static') {
      element.parentElement.style.position = 'relative';
    }
    
    element.parentElement.appendChild(container);
  } else {
    // Clear existing highlights
    container.innerHTML = '';
    
    // Update container size in case the element size changed
    const elementPosition = element.getBoundingClientRect();
    container.style.width = `${elementPosition.width}px`;
    container.style.height = `${elementPosition.height}px`;
  }
  
  // Get element text content
  const text = element.value || element.textContent || '';
  if (!text || text.length === 0) {
    console.log('Element has no text content, skipping highlighting');
    return;
  }
  
  console.log('Applying highlights for text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  
  // Create highlights for each error
  errors.forEach(error => {
    // Stringent validation for error positions
    if (!error || typeof error !== 'object') {
      console.warn('Invalid error object:', error);
      return;
    }
    
    if (error.startPos === undefined || error.endPos === undefined || 
        typeof error.startPos !== 'number' || typeof error.endPos !== 'number' ||
        error.startPos < 0 || error.endPos > text.length || 
        error.startPos >= error.endPos) {
      console.warn('Invalid error positions:', error);
      return; // Skip this error
    }

    // Get the exact error text from the original content
    const errorText = text.substring(error.startPos, error.endPos);
    if (!errorText || errorText.length === 0) {
      console.warn('Empty error text at positions', error.startPos, error.endPos);
      return;
    }
    
    console.log('Highlighting error:', errorText, 'at positions', error.startPos, error.endPos);

    // Create highlight element
    const highlight = document.createElement('div');
    highlight.className = 'grammar-error-highlight';
    highlight.dataset.error = errorText;
    highlight.dataset.suggestion = error.suggestion || '';
    highlight.dataset.startPos = error.startPos;
    highlight.dataset.endPos = error.endPos;
    highlight.dataset.type = error.type || 'grammar';
    
    // Create a unique ID for this highlight
    highlight.id = 'highlight-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    
    // Enhanced highlight styling for better visibility
    highlight.style.position = 'absolute';
    highlight.style.backgroundColor = 'rgba(255, 0, 0, 0.15)'; // More visible red background
    highlight.style.borderBottom = '2px wavy #ff0000'; // Wavy red underline
    highlight.style.mixBlendMode = 'multiply'; // Better color blending
    highlight.style.zIndex = '2';
    highlight.style.pointerEvents = 'auto';
    highlight.style.cursor = 'pointer';
    highlight.style.borderRadius = '2px'; // Slightly rounded corners
    highlight.style.transition = 'background-color 0.2s ease'; // Smooth hover effect
    
    // Add hover effect
    highlight.addEventListener('mouseenter', () => {
      highlight.style.backgroundColor = 'rgba(255, 0, 0, 0.25)'; // Darker on hover
    });
    
    highlight.addEventListener('mouseleave', () => {
      highlight.style.backgroundColor = 'rgba(255, 0, 0, 0.15)'; // Back to normal
    });
    
    try {
      // Different positioning strategies based on element type
      if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA') {
        positionHighlightForInputElement(highlight, element, error, text);
      } else if (element.isContentEditable) {
        positionHighlightForContentEditable(highlight, element, error, container);
      } else {
        // Fallback for other element types
        highlight.style.left = '0px';
        highlight.style.top = '0px';
        highlight.style.width = '100%';
        highlight.style.height = '20px';
      }
    } catch (e) {
      console.error('Error positioning highlight:', e);
      return; // Skip this highlight if positioning fails
    }
    
    // Add click handler to show suggestion popup
    highlight.addEventListener('click', (e) => {
      e.stopPropagation();
      showGrammarSuggestionPopup(highlight, element);
    });
    
    container.appendChild(highlight);
  });

  // Function to position highlight for input and textarea elements
  function positionHighlightForInputElement(highlight, element, error, text) {
    // Create a hidden div to measure text dimensions
    const measureEl = document.createElement('div');
    measureEl.style.position = 'absolute';
    measureEl.style.visibility = 'hidden';
    measureEl.style.whiteSpace = element.nodeName === 'TEXTAREA' ? 'pre-wrap' : 'pre';
    measureEl.style.wordWrap = 'break-word';
    measureEl.style.overflow = 'hidden';
    measureEl.style.width = `${element.clientWidth}px`;
    
    // Copy all computed styles from the element for more accurate measurement
    const elementStyle = window.getComputedStyle(element);
    const importantStyles = [
      'font-family', 'font-size', 'font-weight', 'letter-spacing', 'font-style',
      'text-transform', 'line-height', 'text-indent', 'word-spacing',
      'padding-left', 'padding-right', 'padding-top', 'padding-bottom', 
      'box-sizing', 'border-width', 'direction', 'text-align'
    ];
    
    importantStyles.forEach(style => {
      measureEl.style[style] = elementStyle.getPropertyValue(style);
    });
    
    // Add to document to get accurate measurements
    document.body.appendChild(measureEl);
    
    // Get text before the mistake
    const beforeText = text.substring(0, error.startPos);
    const mistakeText = text.substring(error.startPos, error.endPos);
    
    // Better positioning for different element types
    if (element.nodeName === 'TEXTAREA') {
      // For multi-line elements, we need to handle line breaks
      const lines = beforeText.split('\n');
      const lastLine = lines[lines.length - 1];
      
      // Calculate line height and vertical position
      const lineHeight = parseInt(elementStyle.lineHeight) || parseInt(elementStyle.fontSize) * 1.2;
      const verticalOffset = (lines.length - 1) * lineHeight;
      
      // Create and measure span for the last line before mistake
      measureEl.innerHTML = '';
      const lastLineSpan = document.createElement('span');
      lastLineSpan.textContent = lastLine;
      measureEl.appendChild(lastLineSpan);
      
      // Get horizontal position
      const horizontalOffset = lastLineSpan.offsetWidth;
      
      // Measure mistake text
      measureEl.innerHTML = '';
      const mistakeSpan = document.createElement('span');
      mistakeSpan.textContent = mistakeText;
      measureEl.appendChild(mistakeSpan);
      const mistakeWidth = Math.max(mistakeSpan.offsetWidth, 10); // Ensure minimum width
      
      // Calculate scroll and padding adjustments
      const scrollLeft = parseInt(element.scrollLeft || 0);
      const scrollTop = parseInt(element.scrollTop || 0);
      const paddingLeft = parseInt(elementStyle.paddingLeft) || 0;
      const paddingTop = parseInt(elementStyle.paddingTop) || 0;
      
      // Apply position
      highlight.style.left = `${horizontalOffset + paddingLeft - scrollLeft}px`;
      highlight.style.top = `${verticalOffset + paddingTop - scrollTop}px`;
      highlight.style.width = `${mistakeWidth}px`;
      highlight.style.height = `${lineHeight}px`;
    } else {
      // For single-line elements
      measureEl.innerHTML = '';
      
      // Create and measure span for text before mistake
      const beforeSpan = document.createElement('span');
      beforeSpan.textContent = beforeText;
      measureEl.appendChild(beforeSpan);
      
      // Create and measure span for mistake text
      const mistakeSpan = document.createElement('span');
      mistakeSpan.textContent = mistakeText;
      mistakeSpan.style.position = 'relative'; // Ensure proper measurement
      
      // Get positions and dimensions
      const beforeWidth = beforeSpan.offsetWidth;
      
      // Clear and add mistake span to measure
      measureEl.innerHTML = '';
      measureEl.appendChild(mistakeSpan);
      const mistakeWidth = Math.max(mistakeSpan.offsetWidth, 10); // Ensure minimum width
      
      // Calculate scroll and padding adjustments
      const scrollLeft = parseInt(element.scrollLeft || 0);
      const scrollTop = parseInt(element.scrollTop || 0);
      const paddingLeft = parseInt(elementStyle.paddingLeft) || 0;
      const paddingTop = parseInt(elementStyle.paddingTop) || 0;
      const paddingBottom = parseInt(elementStyle.paddingBottom) || 0;
      
      // Calculate element height
      const elementHeight = element.clientHeight - (paddingTop + paddingBottom);
      
      // Apply position
      highlight.style.left = `${beforeWidth + paddingLeft - scrollLeft}px`;
      highlight.style.top = `${paddingTop}px`;
      highlight.style.width = `${mistakeWidth}px`;
      highlight.style.height = `${elementHeight}px`;
    }
    
    // Clean up
    document.body.removeChild(measureEl);
  }

  // Helper function for positioning highlight in contenteditable elements
  function positionHighlightForContentEditable(highlight, element, error, container) {
    try {
      // Validate inputs
      if (!highlight || !element || !error || !container) {
        console.warn('Invalid parameters for positioning contenteditable highlight');
        throw new Error('Missing required parameters');
      }

      // Validate error positions
      if (typeof error.startPos !== 'number' || typeof error.endPos !== 'number' ||
          error.startPos < 0 || error.endPos <= error.startPos) {
        console.warn('Invalid error positions:', error.startPos, error.endPos);
        throw new Error('Invalid error positions');
      }

      // Find the text node containing the error
      const textNodeInfo = findTextNodeAtPosition(element, error.startPos);
      
      if (!textNodeInfo || !textNodeInfo.node) {
        console.warn('No text node found at position', error.startPos);
        throw new Error('Text node not found');
      }

      const textNode = textNodeInfo.node;
      
      // Validate text node
      if (!textNode.nodeValue || textNode.nodeValue.trim() === '') {
        console.warn('Empty text node found');
        throw new Error('Empty text node');
      }

      const textNodeStartPos = getTextNodePosition(element, textNode);
      const relativeStart = Math.max(0, Math.min(error.startPos - textNodeStartPos, textNode.nodeValue.length));
      const relativeEnd = Math.max(relativeStart, Math.min(error.endPos - textNodeStartPos, textNode.nodeValue.length));
      
      // Create range for precise positioning
      const range = document.createRange();
      range.setStart(textNode, relativeStart);
      range.setEnd(textNode, relativeEnd);
      
      // Store original error text in the highlight for reference
      highlight.dataset.originalText = range.toString();
      
      // Get exact dimensions with better precision
      const rects = range.getClientRects();
      
      // Use the first rect or create a combined rect if there are multiple (for multi-line errors)
      let rect;
      if (!rects || rects.length === 0) {
        console.warn('No client rects found for range, using fallback');
        rect = range.getBoundingClientRect(); // Fallback
      } else if (rects.length === 1) {
        rect = rects[0];
      } else {
        // For multi-line errors, use the first and last rect to create a containing rect
        const firstRect = rects[0];
        const lastRect = rects[rects.length - 1];
        
        rect = {
          left: firstRect.left,
          top: firstRect.top,
          right: lastRect.right,
          bottom: lastRect.bottom,
          width: lastRect.right - firstRect.left,
          height: lastRect.bottom - firstRect.top
        };
      }
      
      // Validate container
      const containerRect = container.getBoundingClientRect();
      if (!containerRect) {
        console.warn('Invalid container rectangle');
        throw new Error('Invalid container');
      }
      
      // Calculate element scroll position
      const scrollLeft = element.scrollLeft || 0;
      const scrollTop = element.scrollTop || 0;
      
      // Calculate positioning with better precision
      let left = rect.left - containerRect.left;
      let top = rect.top - containerRect.top;
      let width = Math.max(rect.width, 10); // Ensure minimum width
      let height = rect.height;
      
      // Set position and dimensions
      highlight.style.left = `${left}px`;
      highlight.style.top = `${top}px`;
      highlight.style.width = `${width}px`;
      highlight.style.height = `${height}px`;
      
      // Make the highlight more visible
      highlight.style.backgroundColor = 'rgba(255, 0, 0, 0.15)';
      highlight.style.borderBottom = '2px wavy #ff0000';
      highlight.style.mixBlendMode = 'multiply';
      
      // Ensure highlight stays within the container bounds
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // Verify the highlight is visible and within bounds
      if (left < 0 || 
          top < 0 || 
          left + width > containerWidth || 
          top + height > containerHeight) {
        
        console.log('Adjusting highlight position to stay within bounds');
        
        // Adjust to ensure visibility
        if (left < 0) left = 0;
        if (top < 0) top = 0;
        if (left + width > containerWidth) width = containerWidth - left;
        if (top + height > containerHeight) height = containerHeight - top;
        
        highlight.style.left = `${left}px`;
        highlight.style.top = `${top}px`;
        highlight.style.width = `${width}px`;
        highlight.style.height = `${height}px`;
      }
    } catch (e) {
      console.error('Error positioning contenteditable highlight:', e);
      
      // More robust fallback positioning
      try {
        // Attempt to get a rough estimate of the error position
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        // Estimate position based on the error's start position relative to the element
        const estimatedTop = Math.max(0, (error.startPos / element.textContent.length) * elementRect.height);
        
        highlight.style.left = '0px';
        highlight.style.top = `${estimatedTop}px`;
        highlight.style.width = '100%';
        highlight.style.height = '2px';
        highlight.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
        highlight.style.borderBottom = '2px wavy #ff0000';
      } catch (fallbackError) {
        console.error('Fallback positioning failed:', fallbackError);
        
        // Absolute last resort - place at the top of the container
        highlight.style.left = '0px';
        highlight.style.top = '0px';
        highlight.style.width = '100%';
        highlight.style.height = '2px';
        highlight.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
        highlight.style.borderBottom = '2px wavy #ff0000';
      }
    }
  }
}

// Function to show grammar suggestion popup
function showGrammarSuggestionPopup(highlight, element) {
  // Early return if highlight or element is not valid
  if (!highlight || !element) {
    console.warn('Invalid highlight or element for popup');
    return;
  }

  const error = highlight.dataset.error || '';
  const suggestion = highlight.dataset.suggestion || '';
  const type = highlight.dataset.type || 'grammar';
  const startPos = parseInt(highlight.dataset.startPos) || 0;
  const endPos = parseInt(highlight.dataset.endPos) || 0;
  
  // Use the original text from the highlight if available
  const originalText = highlight.dataset.originalText || error;
  
  // Create popup
  let popup = document.querySelector('.grammar-suggestion-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.className = 'grammar-suggestion-popup';
    popup.style.position = 'absolute';
    popup.style.zIndex = '2147483647';
    popup.style.backgroundColor = '#ffffff';
    popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    popup.style.borderRadius = '4px';
    popup.style.padding = '8px 12px';
    popup.style.fontSize = '14px';
    popup.style.maxWidth = '300px';
    popup.style.border = '1px solid #e0e0e0';
    popup.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    document.body.appendChild(popup);
  }
  
  // Store reference to the highlight and element for event handlers
  popup.dataset.associatedHighlightId = highlight.id || '';
  if (!highlight.id) {
    highlight.id = 'grammar-highlight-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    popup.dataset.associatedHighlightId = highlight.id;
  }
  
  // Position popup near the highlight
  try {
    const highlightRect = highlight.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Show the popup before positioning to get its dimensions
    popup.style.opacity = '0';
    popup.style.display = 'block';
    
    // Create content
    popup.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-weight: 500; color: #1a1a1a;">${type.charAt(0).toUpperCase() + type.slice(1)} Issue</span>
        <button class="grammar-dismiss-btn" style="background: none; border: none; cursor: pointer; color: #5f6368; font-size: 16px;">×</button>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="color: #d93025; text-decoration: line-through;">${originalText}</span>
        <span style="color: #1e8e3e;">→</span>
        <span style="color: #1e8e3e;">${suggestion}</span>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <button class="grammar-apply-btn" style="background-color: #1a73e8; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer;">Apply</button>
        <button class="grammar-ignore-btn" style="background-color: transparent; border: 1px solid #dadce0; padding: 4px 12px; border-radius: 4px; cursor: pointer;">Ignore</button>
      </div>
    `;
    
    // Get popup dimensions after content is added
    const popupRect = popup.getBoundingClientRect();
    const popupWidth = popupRect.width;
    const popupHeight = popupRect.height;
    
    // Position popup - try different positions in this order: below, above, right, left
    let top, left;
    
    // Try below
    if (highlightRect.bottom + popupHeight + 10 <= viewportHeight) {
      top = highlightRect.bottom + window.scrollY + 5;
      left = highlightRect.left + window.scrollX + (highlightRect.width / 2) - (popupWidth / 2);
    } 
    // Try above
    else if (highlightRect.top - popupHeight - 10 >= 0) {
      top = highlightRect.top + window.scrollY - popupHeight - 5;
      left = highlightRect.left + window.scrollX + (highlightRect.width / 2) - (popupWidth / 2);
    }
    // Try right
    else if (highlightRect.right + popupWidth + 10 <= viewportWidth) {
      left = highlightRect.right + window.scrollX + 5;
      top = highlightRect.top + window.scrollY + (highlightRect.height / 2) - (popupHeight / 2);
    }
    // Try left
    else if (highlightRect.left - popupWidth - 10 >= 0) {
      left = highlightRect.left + window.scrollX - popupWidth - 5;
      top = highlightRect.top + window.scrollY + (highlightRect.height / 2) - (popupHeight / 2);
    }
    // Default - center in viewport
    else {
      top = window.scrollY + (viewportHeight / 2) - (popupHeight / 2);
      left = window.scrollX + (viewportWidth / 2) - (popupWidth / 2);
    }
    
    // Ensure popup is within viewport bounds
    if (left < window.scrollX + 10) {
      left = window.scrollX + 10;
    } else if (left + popupWidth > window.scrollX + viewportWidth - 10) {
      left = window.scrollX + viewportWidth - popupWidth - 10;
    }
    
    if (top < window.scrollY + 10) {
      top = window.scrollY + 10;
    } else if (top + popupHeight > window.scrollY + viewportHeight - 10) {
      top = window.scrollY + viewportHeight - popupHeight - 10;
    }
    
    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;
    
    // Make popup visible
    requestAnimationFrame(() => {
      popup.style.opacity = '1';
    });
  } catch (e) {
    console.error('Error positioning popup:', e);
    // Fallback positioning
    popup.style.left = '20px';
    popup.style.top = '20px';
    popup.style.opacity = '1';
  }
  
  // Add event listeners
  const dismissBtn = popup.querySelector('.grammar-dismiss-btn');
  const applyBtn = popup.querySelector('.grammar-apply-btn');
  const ignoreBtn = popup.querySelector('.grammar-ignore-btn');
  
  // Remove existing event listeners if any
  if (dismissBtn) {
    const newDismissBtn = dismissBtn.cloneNode(true);
    dismissBtn.parentNode.replaceChild(newDismissBtn, dismissBtn);
    newDismissBtn.addEventListener('click', () => {
      popup.style.display = 'none';
    });
  }
  
  if (applyBtn) {
    const newApplyBtn = applyBtn.cloneNode(true);
    applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
    newApplyBtn.addEventListener('click', () => {
      // Store the current positions before applying the suggestion
      const currentStartPos = startPos;
      const currentEndPos = endPos;
      
      // Apply the suggestion
      applySuggestion(element, suggestion, currentStartPos, currentEndPos);
      popup.style.display = 'none';
      
      // Remove the highlight
      if (highlight && highlight.parentElement) {
        highlight.remove();
      }
      
      // Focus back on the element
      element.focus();
    });
  }
  
  if (ignoreBtn) {
    const newIgnoreBtn = ignoreBtn.cloneNode(true);
    ignoreBtn.parentNode.replaceChild(newIgnoreBtn, ignoreBtn);
    newIgnoreBtn.addEventListener('click', () => {
      popup.style.display = 'none';
      
      // Get the position data from the highlight
      const currentStartPos = parseInt(highlight.dataset.startPos) || 0;
      const currentEndPos = parseInt(highlight.dataset.endPos) || 0;
      
      // Clear grammar highlights for the range
      clearGrammarHighlightsForRange(element, currentStartPos, currentEndPos);
      
      // Remove the highlight itself
      if (highlight && highlight.parentElement) {
        highlight.remove();
      }
    });
  }
  
  // Click outside to close
  const handleClickOutside = (e) => {
    if (!popup.contains(e.target) && !highlight.contains(e.target)) {
      popup.style.display = 'none';
      document.removeEventListener('click', handleClickOutside);
    }
  };
  
  // Add the event listener with a slight delay to prevent immediate closing
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside);
  }, 100);
}

// Function to apply a suggestion
function applySuggestion(element, suggestion, startPos, endPos) {
  if (!element || typeof suggestion !== 'string') {
    console.error('Invalid element or suggestion');
    return false;
  }
  
  if (typeof startPos !== 'number' || typeof endPos !== 'number') {
    console.error('Invalid text positions');
    return false;
  }
  
  // Ensure the element is still connected to the DOM
  if (!element.isConnected) {
    console.error('Element is no longer in the DOM');
    return false;
  }

  try {
    const fullText = element.isContentEditable 
      ? element.textContent || element.innerText 
      : element.value || '';
    
    if (!fullText) {
      console.error('Element has no text content');
      return false;
    }
    
    // Ensure positions are valid
    if (startPos < 0 || endPos > fullText.length || startPos >= endPos) {
      console.error('Invalid text positions for replacement');
      return false;
    }
    
    const textToReplace = fullText.substring(startPos, endPos);
    console.log('Replacing text:', textToReplace, 'with:', suggestion);

    // Apply the replacement based on element type
    if (element.isContentEditable) {
      // For contenteditable elements
      const range = document.createRange();
      const selection = window.getSelection();
      
      // Find text node containing the error
      const textNode = findTextNodeAtPosition(element, startPos);
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const textNodeStartPos = getTextNodePosition(element, textNode);
        const relativeStart = Math.max(0, Math.min(startPos - textNodeStartPos, textNode.nodeValue.length));
        const relativeEnd = Math.max(relativeStart, Math.min(endPos - textNodeStartPos, textNode.nodeValue.length));
        
        // Verify we're replacing what we expect
        const nodeTextToReplace = textNode.nodeValue.substring(relativeStart, relativeEnd);
        console.log('Node text to replace:', nodeTextToReplace);
        
        // Safety check for content
        if (nodeTextToReplace.length === 0) {
          console.warn('Empty node text to replace, using fallback method');
          // Use fallback method
          const text = element.textContent || '';
          const safeStart = Math.max(0, Math.min(startPos, text.length));
          const safeEnd = Math.max(safeStart, Math.min(endPos, text.length));
          
          element.textContent = text.substring(0, safeStart) + suggestion + text.substring(safeEnd);
          
          // IMPORTANT: Remove the highlight after applying the suggestion
          clearGrammarHighlightsForRange(element, startPos, endPos);
          
          // Recheck grammar after a short delay
          setTimeout(() => {
            checkAndReapplyGrammarHighlighting(element);
          }, 100);
          
          return true;
        }
        
        range.setStart(textNode, relativeStart);
        range.setEnd(textNode, relativeEnd);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Replace selected text
        document.execCommand('insertText', false, suggestion);
        
        // IMPORTANT: Remove the highlight after applying the suggestion
        clearGrammarHighlightsForRange(element, startPos, endPos);
        
        // Recheck grammar after a short delay
        setTimeout(() => {
          checkAndReapplyGrammarHighlighting(element);
        }, 100);
        
        return true;
      } else {
        console.warn('Could not find text node at position, using fallback replacement method');
        
        // Fallback method for contenteditable elements
        const text = element.textContent || '';
        const safeStart = Math.max(0, Math.min(startPos, text.length));
        const safeEnd = Math.max(safeStart, Math.min(endPos, text.length));
        
        element.textContent = text.substring(0, safeStart) + suggestion + text.substring(safeEnd);
        
        // IMPORTANT: Remove the highlight after applying the suggestion
        clearGrammarHighlightsForRange(element, startPos, endPos);
        
        // Recheck grammar after a short delay
        setTimeout(() => {
          checkAndReapplyGrammarHighlighting(element);
        }, 100);
        
        return true;
      }
    } else {
      // For input/textarea elements
      const beforeText = fullText.substring(0, startPos);
      const afterText = fullText.substring(endPos);
      
      // Apply the change
      element.value = beforeText + suggestion + afterText;
      
      // Set cursor position after the inserted text
      try {
        element.selectionStart = startPos + suggestion.length;
        element.selectionEnd = startPos + suggestion.length;
        element.focus();
      } catch (e) {
        console.warn('Could not set cursor position:', e);
      }
      
      // IMPORTANT: Remove the highlight after applying the suggestion
      clearGrammarHighlightsForRange(element, startPos, endPos);
      
      // Trigger input event to update any listeners
      element.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Recheck grammar after a short delay
      setTimeout(() => {
        checkAndReapplyGrammarHighlighting(element);
      }, 100);
      
      return true;
    }
  } catch (error) {
    console.error('Error applying suggestion:', error);
    return false;
  }
}

// Helper function to clear grammar highlights for a specific text range
function clearGrammarHighlightsForRange(element, startPos, endPos) {
  if (!element || !element.parentElement) return;
  
  // Find the container
  const container = element.parentElement.querySelector(`.grammar-highlight-container[data-for="${element.id || ''}"]`);
  if (!container) return;
  
  // Find all highlights that overlap with the range
  const highlights = container.querySelectorAll('.grammar-error-highlight');
  highlights.forEach(highlight => {
    const highlightStart = parseInt(highlight.dataset.startPos);
    const highlightEnd = parseInt(highlight.dataset.endPos);
    
    // Check if this highlight overlaps with our range
    if (!isNaN(highlightStart) && !isNaN(highlightEnd) &&
        ((highlightStart <= endPos && highlightEnd >= startPos) || 
         (startPos <= highlightEnd && endPos >= highlightStart))) {
      // Remove the overlapping highlight
      highlight.remove();
    }
  });
}

// Helper function to recheck grammar after applying a suggestion
function checkAndReapplyGrammarHighlighting(element) {
  if (!element || !element.isConnected) return;
  
  const text = element.value || element.textContent || '';
  
  // Only proceed if there's enough text
  if (text.trim().length < 10) return;
  
  // Re-check grammar and update highlights
  checkGrammar(text).then(errors => {
    if (errors.length > 0) {
      applyGrammarHighlighting(element, errors);
    } else {
      // Clear all highlights if no errors found
      const container = element.parentElement?.querySelector(`.grammar-highlight-container[data-for="${element.id || ''}"]`);
      if (container) {
        container.innerHTML = '';
      }
    }
  }).catch(error => {
    console.error('Error rechecking grammar:', error);
  });
}

// Function to initialize grammar checking for an element
function initGrammarCheck(element) {
  // Enhanced validation for element
  if (!element) {
    console.warn('Cannot initialize grammar check: element is null or undefined');
    return false;
  }

  if (!element.isConnected) {
    console.warn('Cannot initialize grammar check: element is not connected to DOM');
    return false;
  }

  // Ensure element has a parent
  if (!element.parentElement) {
    console.warn('Cannot initialize grammar check: element has no parent');
    return false;
  }

  // Skip if already initialized
  if (element.dataset.grammarCheckEnabled === 'true') {
    console.log('Grammar check already initialized for element');
    return true;
  }

  // Create style for grammar highlights if not exists
  if (!document.getElementById('grammar-check-styles')) {
    const style = document.createElement('style');
    style.id = 'grammar-check-styles';
    style.textContent = `
      .grammar-error-highlight {
        pointer-events: auto;
        background-color: rgba(217, 48, 37, 0.05);
        border-bottom: 2px solid #d93025;
        transition: background-color 0.2s ease;
      }
      .grammar-error-highlight:hover {
        background-color: rgba(217, 48, 37, 0.15) !important;
      }
      .grammar-highlight-container {
        pointer-events: none;
        z-index: 1000;
      }
      .detailed-grammar-highlight {
        pointer-events: auto;
        background-color: rgba(217, 48, 37, 0.05);
        border-bottom: 2px solid #d93025;
        transition: background-color 0.2s ease;
      }
      .detailed-grammar-highlight:hover {
        background-color: rgba(217, 48, 37, 0.15) !important;
      }
      .detailed-grammar-container {
        pointer-events: none;
        z-index: 1000;
      }
      .grammar-suggestion-popup,
      .detailed-grammar-popup {
        z-index: 2147483647;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        border-radius: 4px;
        background-color: white;
        transition: opacity 0.2s ease;
      }
    `;
    document.head.appendChild(style);
  }

  // Enhanced element type detection
  const nodeName = element.nodeName.toLowerCase();
  const isContentEditable = element.isContentEditable;
  const isTextInput = nodeName === 'input' && 
    (element.type === 'text' || element.type === 'search' || element.type === 'email' || element.type === 'url');
  const isTextArea = nodeName === 'textarea';
  const isRoleTextbox = element.getAttribute('role') === 'textbox';
  const isAriaMultiline = element.getAttribute('aria-multiline') === 'true';
  const isCommonEditor = element.classList.contains('ql-editor') || 
                        element.classList.contains('CodeMirror') ||
                        element.classList.contains('editor') ||
                        element.classList.contains('text-editor') ||
                        element.classList.contains('rich-text-editor');

  const isEditableElement = isContentEditable || isTextInput || isTextArea || 
                          isRoleTextbox || isAriaMultiline || isCommonEditor;

  if (!isEditableElement) {
    console.log('Element is not suitable for grammar checking:', nodeName);
    return false;
  }

  // Ensure element has an ID
  if (!element.id) {
    element.id = 'grammarcheck-el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  }

  // Create container for highlighting if it doesn't exist
  let container = element.parentElement.querySelector(`.grammar-highlight-container[data-for="${element.id}"]`);
  if (!container) {
    container = document.createElement('div');
    container.className = 'grammar-highlight-container';
    container.dataset.for = element.id;
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.right = '0';
    container.style.bottom = '0';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '1000';
    container.style.overflow = 'hidden';
    
    // Make sure parent has position for absolute positioning
    if (getComputedStyle(element.parentElement).position === 'static') {
      element.parentElement.style.position = 'relative';
    }
    
    element.parentElement.appendChild(container);
  }

  // Mark as initialized
  element.dataset.grammarCheckEnabled = 'true';

  // Setup event listeners with debouncing
  const debouncedCheck = debounce(async () => {
    const text = element.value || element.textContent || '';
    if (text.trim().length >= 10) {
      try {
        // Check if we have an API key before proceeding
        let hasApiKey = false;
        if (typeof window.GrammarSniperConfig !== 'undefined' && typeof window.GrammarSniperConfig.getApiKey === 'function') {
          hasApiKey = !!window.GrammarSniperConfig.getApiKey();
        }
        
        if (!hasApiKey) {
          console.log('API key not available yet, will check grammar when key is set');
          // Don't show an error, just wait for key to be set
          return;
        }
        
        const errors = await checkGrammar(text);
        if (element.isConnected) { // Recheck connection before applying
          applyGrammarHighlighting(element, errors);
        }
      } catch (error) {
        console.error('Error during grammar check:', error);
        // Clear any previous highlights if there's an error
        if (element.isConnected && element.parentElement) {
          const container = element.parentElement.querySelector(`.grammar-highlight-container[data-for="${element.id}"]`);
          if (container) {
            container.innerHTML = '';
          }
        }
      }
    }
  }, 1000);

  // Store the debounced function for cleanup
  element._grammarCheckFunction = debouncedCheck;

  // Add event listeners
  element.addEventListener('input', debouncedCheck);
  element.addEventListener('change', debouncedCheck);
  element.addEventListener('blur', debouncedCheck);

  // Initial check if element has content
  const initialText = element.value || element.textContent || '';
  if (initialText.trim().length >= 10) {
    debouncedCheck();
  }

  return true;
}

// Helper to set up cleanup when element is removed from DOM
function setupElementCleanup(element) {
  if (!element || !element.parentNode) return;
  
  // Setup MutationObserver to detect when element is removed
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        if (node === element) {
          console.log('Element removed from DOM, cleaning up grammar check:', element.id);
          cleanupElementGrammarCheck(element);
          observer.disconnect();
        }
      });
    });
  });
  
  observer.observe(element.parentNode, { childList: true });
  
  // Store observer reference for potential manual cleanup
  element._grammarCheckObserver = observer;
}

// Helper to clean up grammar check resources for an element
function cleanupElementGrammarCheck(element) {
  if (!element) return;
  
  // Remove event listeners if function reference is stored
  if (element._grammarCheckFunction) {
    element.removeEventListener('input', element._grammarCheckFunction);
    element.removeEventListener('change', element._grammarCheckFunction);
    element.removeEventListener('blur', element._grammarCheckFunction);
    delete element._grammarCheckFunction;
  }
  
  // Disconnect observer if exists
  if (element._grammarCheckObserver) {
    element._grammarCheckObserver.disconnect();
    delete element._grammarCheckObserver;
  }
  
  // Clean up container position event listeners
  if (element._grammarContainerEvents) {
    if (element._grammarContainerEvents.scroll) {
      window.removeEventListener('scroll', element._grammarContainerEvents.scroll);
    }
    if (element._grammarContainerEvents.resize) {
      window.removeEventListener('resize', element._grammarContainerEvents.resize);
    }
    delete element._grammarContainerEvents;
  }
  
  // Remove highlight container
  if (element.parentElement) {
    const container = element.parentElement.querySelector(
      `.grammar-highlight-container[data-for="${element.id || ''}"]`
    );
    if (container) {
      container.remove();
    }
    
    // Also clean up detailed grammar container if it exists
    const detailedContainer = element.parentElement.querySelector(
      `.detailed-grammar-container[data-for="${element.id || ''}"]`
    );
    if (detailedContainer) {
      detailedContainer.remove();
    }
  }
  
  // Clean up any popups related to this element
  const popups = document.querySelectorAll('.grammar-suggestion-popup, .detailed-grammar-popup');
  popups.forEach(popup => {
    if (popup.dataset.forElement === element.id) {
      popup.remove();
    }
  });
  
  // Reset data attribute
  element.dataset.grammarCheckEnabled = 'false';
  
  console.log('Grammar check resources cleaned up for element:', element.id);
}

// Function to check grammar with detailed response in words_with_mistakes format
async function checkGrammarDetailed(text) {
  // Handle null, undefined or empty text
  if (!text || text.trim().length < 10) {
    console.log('Text is too short for detailed grammar check');
    return { words_with_mistakes: [] };
  }

  try {
    console.log('Checking grammar with detailed format for text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
    
    // Check for API key availability
    let hasApiKey = false;
    if (typeof window.GrammarSniperConfig !== 'undefined' && typeof window.GrammarSniperConfig.getApiKey === 'function') {
      hasApiKey = !!window.GrammarSniperConfig.getApiKey();
    }
    
    if (!hasApiKey) {
      console.log('No API key available, skipping detailed grammar check');
      return { words_with_mistakes: [] };
    }

    // Call the API function for detailed grammar checking
    const result = await checkGrammarWithDetails(text);
    
    // Validate result structure
    if (!result || !result.words_with_mistakes || !Array.isArray(result.words_with_mistakes)) {
      console.error('Invalid result structure from detailed grammar check:', result);
      return { words_with_mistakes: [] };
    }
    
    return result;
  } catch (error) {
    console.error('Error checking grammar with detailed format:', error);
    return { words_with_mistakes: [] }; // Return empty result on error
  }
}

// Function to apply detailed grammar highlighting to an element
function applyDetailedGrammarHighlighting(element, wordsWithMistakes) {
  if (!element || !wordsWithMistakes || wordsWithMistakes.length === 0) return;
  
  // Enhanced check for element's parent element and connection to DOM
  if (!element.isConnected) {
    console.warn('Element is disconnected from DOM, cannot apply detailed grammar highlighting');
    return;
  }
  
  if (!element.parentElement) {
    console.warn('Element has no parent, cannot apply detailed grammar highlighting');
    return;
  }

  // Check if element already has highlighting container
  let container = element.parentElement.querySelector(`.detailed-grammar-container[data-for="${element.id || ''}"]`);
  
  if (!container) {
    // Create container for highlighting
    container = document.createElement('div');
    container.className = 'detailed-grammar-container';
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.right = '0';
    container.style.bottom = '0';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '1';
    container.style.overflow = 'hidden';
    
    // Add a unique identifier for this container to link it to the element
    if (!element.id) {
      element.id = 'detailedgrammar-el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    }
    container.dataset.for = element.id;
    
    // Position container over the element
    const elementPosition = element.getBoundingClientRect();
    container.style.width = `${elementPosition.width}px`;
    container.style.height = `${elementPosition.height}px`;
    
    // Make sure element's parent has position for absolute positioning
    if (getComputedStyle(element.parentElement).position === 'static') {
      element.parentElement.style.position = 'relative';
    }
    
    element.parentElement.appendChild(container);
  } else {
    // Clear existing highlights
    container.innerHTML = '';
    
    // Update container size in case the element size changed
    const elementPosition = element.getBoundingClientRect();
    container.style.width = `${elementPosition.width}px`;
    container.style.height = `${elementPosition.height}px`;
  }
  
  // Get element text content
  const text = element.value || element.textContent || '';
  if (!text || text.length === 0) {
    console.log('Element has no text content, skipping detailed highlighting');
    return;
  }
  
  console.log('Applying detailed highlights for text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  
  // Create highlights for each error
  wordsWithMistakes.forEach(mistake => {
    // Validate mistake data
    if (!mistake || typeof mistake !== 'object') {
      console.warn('Invalid mistake object:', mistake);
      return;
    }
    
    if (typeof mistake.start_index !== 'number' || typeof mistake.end_index !== 'number' ||
        mistake.start_index < 0 || mistake.end_index > text.length || 
        mistake.start_index >= mistake.end_index) {
      console.warn('Invalid mistake positions:', mistake);
      return; // Skip this mistake
    }

    // Get the exact mistake text from the original content
    const mistakeText = text.substring(mistake.start_index, mistake.end_index);
    if (!mistakeText || mistakeText.length === 0) {
      console.warn('Empty mistake text at positions', mistake.start_index, mistake.end_index);
      return;
    }
    
    console.log('Highlighting mistake:', mistakeText, 'at positions', mistake.start_index, mistake.end_index);

    // Create highlight element
    const highlight = document.createElement('div');
    highlight.className = 'detailed-grammar-highlight';
    highlight.dataset.text = mistakeText;
    highlight.dataset.suggestion = mistake.suggestion || '';
    highlight.dataset.startIndex = mistake.start_index;
    highlight.dataset.endIndex = mistake.end_index;
    highlight.dataset.mistakeType = mistake.mistake_type || 'grammar';
    
    // Create a unique ID for this highlight
    highlight.id = 'detailed-highlight-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    
    // Enhanced highlight styling for better visibility
    highlight.style.position = 'absolute';
    highlight.style.backgroundColor = 'rgba(255, 0, 0, 0.15)'; // More visible red background
    highlight.style.borderBottom = '2px wavy #ff0000'; // Wavy red underline
    highlight.style.mixBlendMode = 'multiply'; // Better color blending
    highlight.style.zIndex = '2';
    highlight.style.pointerEvents = 'auto';
    highlight.style.cursor = 'pointer';
    highlight.style.borderRadius = '2px'; // Slightly rounded corners
    highlight.style.transition = 'background-color 0.2s ease'; // Smooth hover effect
    
    // Add hover effect
    highlight.addEventListener('mouseenter', () => {
      highlight.style.backgroundColor = 'rgba(255, 0, 0, 0.25)'; // Darker on hover
    });
    
    highlight.addEventListener('mouseleave', () => {
      highlight.style.backgroundColor = 'rgba(255, 0, 0, 0.15)'; // Back to normal
    });
    
    try {
      // Different positioning strategies based on element type
      if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA') {
        positionDetailedHighlightForInputElement(highlight, element, mistake, text);
      } else if (element.isContentEditable) {
        positionDetailedHighlightForContentEditable(highlight, element, mistake, container);
      } else {
        // Fallback for other element types
        highlight.style.left = '0px';
        highlight.style.top = '0px';
        highlight.style.width = '100%';
        highlight.style.height = '20px';
      }
    } catch (e) {
      console.error('Error positioning detailed highlight:', e);
      return; // Skip this highlight if positioning fails
    }
    
    // Add click handler to show suggestion popup
    highlight.addEventListener('click', (e) => {
      e.stopPropagation();
      showDetailedGrammarSuggestionPopup(highlight, element);
    });
    
    container.appendChild(highlight);
  });
}

// Function to position detailed highlight for input and textarea elements
function positionDetailedHighlightForInputElement(highlight, element, mistake, text) {
  // Create a hidden div to measure text dimensions
  const measureEl = document.createElement('div');
  measureEl.style.position = 'absolute';
  measureEl.style.visibility = 'hidden';
  measureEl.style.whiteSpace = element.nodeName === 'TEXTAREA' ? 'pre-wrap' : 'pre';
  measureEl.style.wordWrap = 'break-word';
  measureEl.style.overflow = 'hidden';
  measureEl.style.width = `${element.clientWidth}px`;
  
  // Copy all computed styles from the element for more accurate measurement
  const elementStyle = window.getComputedStyle(element);
  const importantStyles = [
    'font-family', 'font-size', 'font-weight', 'letter-spacing', 'font-style',
    'text-transform', 'line-height', 'text-indent', 'word-spacing',
    'padding-left', 'padding-right', 'padding-top', 'padding-bottom', 
    'box-sizing', 'border-width', 'direction', 'text-align'
  ];
  
  importantStyles.forEach(style => {
    measureEl.style[style] = elementStyle.getPropertyValue(style);
  });
  
  // Add to document to get accurate measurements
  document.body.appendChild(measureEl);
  
  // Get text before the mistake
  const beforeText = text.substring(0, mistake.start_index);
  const mistakeText = text.substring(mistake.start_index, mistake.end_index);
  
  // Better positioning for different element types
  if (element.nodeName === 'TEXTAREA') {
    // For multi-line elements, we need to handle line breaks
    const lines = beforeText.split('\n');
    const lastLine = lines[lines.length - 1];
    
    // Calculate line height and vertical position
    const lineHeight = parseInt(elementStyle.lineHeight) || parseInt(elementStyle.fontSize) * 1.2;
    const verticalOffset = (lines.length - 1) * lineHeight;
    
    // Create and measure span for the last line before mistake
    measureEl.innerHTML = '';
    const lastLineSpan = document.createElement('span');
    lastLineSpan.textContent = lastLine;
    measureEl.appendChild(lastLineSpan);
    
    // Get horizontal position
    const horizontalOffset = lastLineSpan.offsetWidth;
    
    // Measure mistake text
    measureEl.innerHTML = '';
    const mistakeSpan = document.createElement('span');
    mistakeSpan.textContent = mistakeText;
    measureEl.appendChild(mistakeSpan);
    const mistakeWidth = Math.max(mistakeSpan.offsetWidth, 10); // Ensure minimum width
    
    // Calculate scroll and padding adjustments
    const scrollLeft = parseInt(element.scrollLeft || 0);
    const scrollTop = parseInt(element.scrollTop || 0);
    const paddingLeft = parseInt(elementStyle.paddingLeft) || 0;
    const paddingTop = parseInt(elementStyle.paddingTop) || 0;
    
    // Apply position
    highlight.style.left = `${horizontalOffset + paddingLeft - scrollLeft}px`;
    highlight.style.top = `${verticalOffset + paddingTop - scrollTop}px`;
    highlight.style.width = `${mistakeWidth}px`;
    highlight.style.height = `${lineHeight}px`;
  } else {
    // For single-line elements
    measureEl.innerHTML = '';
    
    // Create and measure span for text before mistake
    const beforeSpan = document.createElement('span');
    beforeSpan.textContent = beforeText;
    measureEl.appendChild(beforeSpan);
    
    // Create and measure span for mistake text
    const mistakeSpan = document.createElement('span');
    mistakeSpan.textContent = mistakeText;
    mistakeSpan.style.position = 'relative'; // Ensure proper measurement
    
    // Get positions and dimensions
    const beforeWidth = beforeSpan.offsetWidth;
    
    // Clear and add mistake span to measure
    measureEl.innerHTML = '';
    measureEl.appendChild(mistakeSpan);
    const mistakeWidth = Math.max(mistakeSpan.offsetWidth, 10); // Ensure minimum width
    
    // Calculate scroll and padding adjustments
    const scrollLeft = parseInt(element.scrollLeft || 0);
    const scrollTop = parseInt(element.scrollTop || 0);
    const paddingLeft = parseInt(elementStyle.paddingLeft) || 0;
    const paddingTop = parseInt(elementStyle.paddingTop) || 0;
    const paddingBottom = parseInt(elementStyle.paddingBottom) || 0;
    
    // Calculate element height
    const elementHeight = element.clientHeight - (paddingTop + paddingBottom);
    
    // Apply position
    highlight.style.left = `${beforeWidth + paddingLeft - scrollLeft}px`;
    highlight.style.top = `${paddingTop}px`;
    highlight.style.width = `${mistakeWidth}px`;
    highlight.style.height = `${elementHeight}px`;
  }
  
  // Clean up
  document.body.removeChild(measureEl);
}

// Function to position detailed highlight for contentEditable elements
function positionDetailedHighlightForContentEditable(highlight, element, mistake, container) {
  try {
    const range = document.createRange();
    const text = element.textContent || '';
    
    // Find text node that contains the start position
    const startNodeInfo = findTextNodeAtPosition(element, mistake.start_index);
    if (!startNodeInfo) {
        console.warn('Could not find text node for start position', mistake.start_index);
        throw new Error('Start text node not found');
    }
    
    // Find text node that contains the end position
    const endNodeInfo = findTextNodeAtPosition(element, mistake.end_index);
    if (!endNodeInfo) {
        console.warn('Could not find text node for end position', mistake.end_index);
        throw new Error('End text node not found');
    }
    
    // Set the range to span from start to end
    try {
      range.setStart(startNodeInfo.node, startNodeInfo.offset);
      range.setEnd(endNodeInfo.node, endNodeInfo.offset);
    } catch (rangeError) {
      console.error('Error setting range:', rangeError);
      throw new Error('Could not set range properly');
    }
    
    // Store the text being highlighted for reference
    highlight.dataset.originalText = range.toString();
    
    // Get the bounding client rects of the range for more accurate positioning
    const rects = range.getClientRects();
    
    // Handle the positioning based on the number of rects (text fragments)
    if (rects.length === 0) {
      console.warn('No client rects found for range, using fallback');
      
      // Fallback to getBoundingClientRect if no rects
      const fallbackRect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      highlight.style.left = `${fallbackRect.left - containerRect.left}px`;
      highlight.style.top = `${fallbackRect.top - containerRect.top}px`;
      highlight.style.width = `${Math.max(fallbackRect.width, 10)}px`;
      highlight.style.height = `${fallbackRect.height}px`;
    }
    else if (rects.length === 1) {
      // Single line case - straightforward positioning
      const rect = rects[0];
      const containerRect = container.getBoundingClientRect();
      
      highlight.style.left = `${rect.left - containerRect.left}px`;
      highlight.style.top = `${rect.top - containerRect.top}px`;
      highlight.style.width = `${Math.max(rect.width, 10)}px`;
      highlight.style.height = `${rect.height}px`;
    }
    else {
      // Multi-line case - create a wrapper for all fragments
      // Use first and last rect to determine boundaries
      const firstRect = rects[0];
      const lastRect = rects[rects.length - 1];
      const containerRect = container.getBoundingClientRect();
      
      // Create a covering highlight that encompasses all text fragments
      const left = firstRect.left - containerRect.left;
      const top = firstRect.top - containerRect.top;
      const right = Math.max(...Array.from(rects).map(r => r.right)) - containerRect.left;
      const bottom = lastRect.bottom - containerRect.top;
      
      highlight.style.left = `${left}px`;
      highlight.style.top = `${top}px`;
      highlight.style.width = `${right - left}px`;
      highlight.style.height = `${bottom - top}px`;
    }
    
    // Ensure the highlight is within container bounds
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const highlightLeft = parseFloat(highlight.style.left);
    const highlightTop = parseFloat(highlight.style.top);
    const highlightWidth = parseFloat(highlight.style.width);
    const highlightHeight = parseFloat(highlight.style.height);
    
    // Adjust if outside bounds
    if (highlightLeft < 0) {
      highlight.style.left = '0px';
      highlight.style.width = `${Math.min(highlightWidth + highlightLeft, containerWidth)}px`;
    }
    if (highlightTop < 0) {
      highlight.style.top = '0px';
      highlight.style.height = `${Math.min(highlightHeight + highlightTop, containerHeight)}px`;
    }
    if (highlightLeft + highlightWidth > containerWidth) {
      highlight.style.width = `${containerWidth - highlightLeft}px`;
    }
    if (highlightTop + highlightHeight > containerHeight) {
      highlight.style.height = `${containerHeight - highlightTop}px`;
    }
    
    // Apply standard styling
    highlight.style.backgroundColor = 'rgba(217, 48, 37, 0.05)';
    highlight.style.borderBottom = '2px solid #d93025';
  } 
  catch (error) {
    console.error('Error positioning detailed contenteditable highlight:', error);
    
    // Apply a fallback highlight at the start of the element
    highlight.style.left = '0px';
    highlight.style.top = '0px';
    highlight.style.width = '100%';
    highlight.style.height = '2px';
    highlight.style.backgroundColor = 'rgba(217, 48, 37, 0.2)';
    highlight.style.borderBottom = '2px solid #d93025';
  }
}

// Function to show detailed grammar suggestion popup
function showDetailedGrammarSuggestionPopup(highlight, element) {
  // Remove any existing popup
  const existingPopup = document.querySelector('.detailed-grammar-popup');
  if (existingPopup) {
    existingPopup.remove();
  }
  
  // Create popup container
  const popup = document.createElement('div');
  popup.className = 'detailed-grammar-popup';
  popup.style.position = 'absolute';
  popup.style.zIndex = '9999';
  popup.style.background = 'white';
  popup.style.border = '1px solid #ccc';
  popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  popup.style.borderRadius = '4px';
  popup.style.padding = '10px';
  popup.style.maxWidth = '300px';
  popup.style.wordWrap = 'break-word';
  
  // Get mistake info from highlight
  const mistakeText = highlight.dataset.text || '';
  const suggestion = highlight.dataset.suggestion || '';
  const mistakeType = highlight.dataset.mistakeType || 'grammar';
  const startIndex = parseInt(highlight.dataset.startIndex);
  const endIndex = parseInt(highlight.dataset.endIndex);
  
  // Create type indicator
  const typeIndicator = document.createElement('div');
  typeIndicator.className = 'detailed-grammar-type';
  typeIndicator.style.fontSize = '12px';
  typeIndicator.style.fontWeight = 'bold';
  typeIndicator.style.color = '#555';
  typeIndicator.style.textTransform = 'capitalize';
  typeIndicator.textContent = mistakeType;
  popup.appendChild(typeIndicator);
  
  // Create mistake text
  const mistakeElement = document.createElement('div');
  mistakeElement.className = 'detailed-grammar-mistake';
  mistakeElement.style.fontSize = '14px';
  mistakeElement.style.marginTop = '5px';
  mistakeElement.style.marginBottom = '5px';
  mistakeElement.style.textDecoration = 'line-through';
  mistakeElement.style.color = '#d93025';
  mistakeElement.textContent = mistakeText;
  popup.appendChild(mistakeElement);
  
  // Create suggestion
  const suggestionElement = document.createElement('div');
  suggestionElement.className = 'detailed-grammar-suggestion';
  suggestionElement.style.fontSize = '14px';
  suggestionElement.style.marginBottom = '10px';
  suggestionElement.style.color = '#0f9d58';
  suggestionElement.textContent = suggestion;
  popup.appendChild(suggestionElement);
  
  // Create replace button
  const replaceButton = document.createElement('button');
  replaceButton.className = 'detailed-grammar-replace-btn';
  replaceButton.style.background = '#1a73e8';
  replaceButton.style.color = 'white';
  replaceButton.style.border = 'none';
  replaceButton.style.padding = '5px 10px';
  replaceButton.style.borderRadius = '4px';
  replaceButton.style.cursor = 'pointer';
  replaceButton.style.marginRight = '5px';
  replaceButton.textContent = 'Replace';
  replaceButton.addEventListener('click', () => {
    applyDetailedSuggestion(element, suggestion, startIndex, endIndex);
    popup.remove();
  });
  popup.appendChild(replaceButton);
  
  // Create ignore button
  const ignoreButton = document.createElement('button');
  ignoreButton.className = 'detailed-grammar-ignore-btn';
  ignoreButton.style.background = '#f1f3f4';
  ignoreButton.style.color = '#1a73e8';
  ignoreButton.style.border = 'none';
  ignoreButton.style.padding = '5px 10px';
  ignoreButton.style.borderRadius = '4px';
  ignoreButton.style.cursor = 'pointer';
  ignoreButton.textContent = 'Ignore';
  ignoreButton.addEventListener('click', () => {
    // Get the position data from the highlight
    const currentStartIndex = parseInt(highlight.dataset.startIndex) || 0;
    const currentEndIndex = parseInt(highlight.dataset.endIndex) || 0;
    
    // Clear detailed grammar highlights for the range
    clearDetailedGrammarHighlightsForRange(element, currentStartIndex, currentEndIndex);
    
    // Remove the popup
    popup.remove();
    
    // Remove the highlight if it still exists
    if (highlight && highlight.parentElement) {
      highlight.remove();
    }
  });
  popup.appendChild(ignoreButton);
  
  // Position popup near the highlight
  const highlightRect = highlight.getBoundingClientRect();
  popup.style.left = `${highlightRect.left}px`;
  popup.style.top = `${highlightRect.bottom + window.scrollY + 5}px`;
  
  // Adjust position if popup goes out of viewport
  document.body.appendChild(popup);
  const popupRect = popup.getBoundingClientRect();
  
  if (popupRect.right > window.innerWidth) {
    popup.style.left = `${window.innerWidth - popupRect.width - 10}px`;
  }
  
  if (popupRect.bottom > window.innerHeight) {
    popup.style.top = `${highlightRect.top + window.scrollY - popupRect.height - 5}px`;
  }
  
  // Add click outside handler
  const handleClickOutside = (e) => {
    if (!popup.contains(e.target) && e.target !== highlight) {
      popup.remove();
      document.removeEventListener('click', handleClickOutside);
    }
  };
  
  // Slight delay to prevent immediate closing
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside);
  }, 100);
}

// Function to apply a detailed suggestion to an element
function applyDetailedSuggestion(element, suggestion, startIndex, endIndex) {
  try {
    console.log(`Applying detailed suggestion: '${suggestion}' at positions ${startIndex}-${endIndex}`);
    
    // Validate inputs
    if (!element || !element.isConnected) {
      console.error('Element is not valid or disconnected from DOM');
      return false;
    }
    
    if (typeof suggestion !== 'string' || suggestion.length === 0) {
      console.error('Invalid suggestion');
      return false;
    }
    
    if (typeof startIndex !== 'number' || typeof endIndex !== 'number' || 
        startIndex < 0 || startIndex >= endIndex) {
      console.error('Invalid text indices');
      return false;
    }
    
    // Apply suggestion based on element type
    if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA') {
      // For standard inputs
      const text = element.value || '';
      
      // Ensure indices are within bounds
      if (endIndex > text.length) {
        console.warn('End index exceeds text length, adjusting');
        endIndex = Math.min(endIndex, text.length);
      }
      
      // Apply the suggestion
      element.value = text.substring(0, startIndex) + suggestion + text.substring(endIndex);
      
      // Set cursor position after the inserted text
      try {
        element.selectionStart = startIndex + suggestion.length;
        element.selectionEnd = startIndex + suggestion.length;
        element.focus();
      } catch (e) {
        console.warn('Could not set cursor position:', e);
      }
      
      // Trigger input event
      element.dispatchEvent(new Event('input', { bubbles: true }));
    } 
    else if (element.isContentEditable) {
      // For contentEditable elements
      const selection = window.getSelection();
      const range = document.createRange();
      
      // Find nodes at the positions
      const startNodeInfo = findTextNodeAtPosition(element, startIndex);
      const endNodeInfo = findTextNodeAtPosition(element, endIndex);
      
      if (!startNodeInfo || !endNodeInfo) {
        console.error('Could not find text nodes for replacement');
        return false;
      }
      
      // Set range to cover the text to replace
      range.setStart(startNodeInfo.node, startNodeInfo.offset);
      range.setEnd(endNodeInfo.node, endNodeInfo.offset);
      
      // Delete the content and insert new text
      range.deleteContents();
      const textNode = document.createTextNode(suggestion);
      range.insertNode(textNode);
      
      // Set selection after the inserted text
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      // For other elements
      element.textContent = element.textContent.substring(0, startIndex) + 
                           suggestion + 
                           element.textContent.substring(endIndex);
    }
    
    // Clear existing highlights for the corrected text
    clearDetailedGrammarHighlightsForRange(element, startIndex, endIndex);
    
    // Re-check grammar after applying the suggestion
    // This will properly update coordinates for remaining mistakes
    setTimeout(() => {
      initDetailedGrammarCheck(element);
    }, 100);
    
    return true;
  } catch (error) {
    console.error('Error applying detailed suggestion:', error);
    return false;
  }
}

// Helper function to clear detailed grammar highlights for a specific text range
function clearDetailedGrammarHighlightsForRange(element, startIndex, endIndex) {
  if (!element || !element.parentElement) return;
  
  // Find the container
  const container = element.parentElement.querySelector(`.detailed-grammar-container[data-for="${element.id || ''}"]`);
  if (!container) return;
  
  // Find all highlights that overlap with the range
  const highlights = container.querySelectorAll('.detailed-grammar-highlight');
  highlights.forEach(highlight => {
    const highlightStart = parseInt(highlight.dataset.startIndex);
    const highlightEnd = parseInt(highlight.dataset.endIndex);
    
    // Check if this highlight overlaps with our range
    if (!isNaN(highlightStart) && !isNaN(highlightEnd) &&
        ((highlightStart <= endIndex && highlightEnd >= startIndex) || 
         (startIndex <= highlightEnd && endIndex >= highlightStart))) {
      // Remove the overlapping highlight
      highlight.remove();
    }
  });
}

// Function to initialize detailed grammar checking for an element
function initDetailedGrammarCheck(element) {
  if (!element) return;
  
  // Only proceed if element is still in the DOM
  if (!element.isConnected) {
    console.warn('Element is disconnected from DOM, skipping detailed grammar check');
    return;
  }
  
  // Skip search boxes, address bars and utility inputs where grammar checking is not appropriate
  const nodeName = element.nodeName.toLowerCase();
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
    console.log('Skipping detailed grammar check for search/utility input:', element.id || element.className || nodeName);
    return;
  }
  
  // Get text from element
  const text = element.value || element.textContent || '';
  if (!text || text.length < 10) {
    console.log('Text is too short for detailed grammar check, skipping');
    return;
  }
  
  // Clear any existing grammar highlights
  const container = element.parentElement?.querySelector(`.detailed-grammar-container[data-for="${element.id || ''}"]`);
  if (container) {
    container.innerHTML = '';
  }
  
  // Check if we have an API key before proceeding
  let hasApiKey = false;
  if (typeof window.GrammarSniperConfig !== 'undefined' && typeof window.GrammarSniperConfig.getApiKey === 'function') {
    hasApiKey = !!window.GrammarSniperConfig.getApiKey();
  }
  
  if (!hasApiKey) {
    console.log('API key not available yet, skipping detailed grammar check');
    return;
  }
  
  // Check grammar and apply highlighting
  checkGrammarDetailed(text).then(result => {
    if (result && result.words_with_mistakes && result.words_with_mistakes.length > 0) {
      applyDetailedGrammarHighlighting(element, result.words_with_mistakes);
    }
  }).catch(error => {
    console.error('Error during detailed grammar check init:', error);
  });
  
  // Set up event listeners for changes to the element
  // Use debounce to avoid checking too frequently
  const setupDebounce = () => {
    // Remove existing handler if any
    element.__detailedGrammarCheckTimer && clearTimeout(element.__detailedGrammarCheckTimer);
    
    // Set up new debounced handler
    element.__detailedGrammarCheckTimer = setTimeout(() => {
      initDetailedGrammarCheck(element);
    }, 1500); // Check 1.5 seconds after typing stops
  };
  
  // Add event listeners if not already added
  if (!element.__detailedGrammarCheckListenersAdded) {
    element.addEventListener('input', setupDebounce);
    element.addEventListener('change', setupDebounce);
    
    // Mark as added
    element.__detailedGrammarCheckListenersAdded = true;
    
    // Setup cleanup when element is removed from DOM
    setupElementCleanup(element);
  }
}

// Expose functions to global scope
window.checkGrammar = checkGrammar;
window.applyGrammarHighlighting = applyGrammarHighlighting;
window.initGrammarCheck = initGrammarCheck;
window.cleanupElementGrammarCheck = cleanupElementGrammarCheck;
window.checkGrammarDetailed = checkGrammarDetailed;
window.applyDetailedGrammarHighlighting = applyDetailedGrammarHighlighting;
window.initDetailedGrammarCheck = initDetailedGrammarCheck; 