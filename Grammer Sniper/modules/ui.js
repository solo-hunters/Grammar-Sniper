/**
 * @copyright This code belongs to Solo Hunters Open Source Community
 */

// UI element creation and management functions
// Using global functions instead of imports

// Create and insert the logo element if it doesn't already exist
function createLogoElement() {
  let logo = document.querySelector('.text-helper-logo');
  if (logo) {
    return logo;
  }

  logo = document.createElement('div');
  logo.className = 'text-helper-logo';

  // Create image element for the logo
  const img = document.createElement('img');

  // Function to get the base URL for the extension
  const getExtensionBaseUrl = () => {
    try {
      // Try getting the URL through chrome.runtime
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        return chrome.runtime.getURL('images/logo.png');
      }
    } catch (e) {
      // Chrome runtime not available, using fallback
    }

    // Fallback to data URL for a simple icon
    return 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 20l-3-3h6l-3 3z"/>
        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    `);
  };

  img.src = getExtensionBaseUrl();

  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'contain';
  img.style.transition = 'transform 0.2s ease';

  // Debug image loading
  img.onerror = (e) => console.error('Failed to load logo image:', e, img.src);
  img.onload = () => {};

  logo.appendChild(img);

  // Add keyframes for the spinner animation if not already added
  if (!document.querySelector('#text-helper-spinner-style')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'text-helper-spinner-style';
    styleElement.textContent = `
      @keyframes text-helper-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styleElement);
  }

  // Set initial styles
  logo.style.display = 'flex';
  logo.style.opacity = '1';
  logo.style.position = 'absolute'; // Use absolute positioning instead of fixed
  logo.style.width = '24px';
  logo.style.height = '24px';
  logo.style.backgroundColor = '#ffffff';
  logo.style.borderRadius = '50%';
  logo.style.alignItems = 'center';
  logo.style.justifyContent = 'center';
  logo.style.cursor = 'pointer';
  logo.style.zIndex = '2147483647'; // Maximum z-index
  logo.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  logo.style.border = '1px solid #e0e0e0';
  logo.style.transition = 'transform 0.2s ease';
  logo.style.right = '5px'; // Default position when first created
  logo.style.bottom = '5px';

  // Add hover effect
  logo.addEventListener('mouseover', () => {
    if (!logo.dataset.isLoading) {
      logo.style.transform = 'scale(1.1)';
    }
  });

  logo.addEventListener('mouseout', () => {
    if (!logo.dataset.isLoading) {
      logo.style.transform = 'scale(1)';
    }
  });

  // Initially invisible until positioned
  logo.style.display = 'none';

  return logo;
}

// Create suggestions popup
function createSuggestionsPopup() {
  let popup = document.querySelector('.text-helper-popup');
  if (popup) {
    return popup;
  }

  popup = document.createElement('div');
  popup.className = 'text-helper-popup';
  popup.style.position = 'fixed';
  popup.style.backgroundColor = '#f8f9fa';
  popup.style.boxShadow = '0 4px 15px rgba(0,0,0,0.15)';
  popup.style.borderRadius = '8px';
  popup.style.padding = '0';
  popup.style.zIndex = '2147483647'; // Increased z-index to match logo
  popup.style.width = '300px';
  popup.style.maxHeight = '200px';
  popup.style.overflowY = 'auto';
  popup.style.display = 'none';
  popup.style.border = '1px solid #e8eaed';
  document.body.appendChild(popup);

  // Add resize handler to maintain popup position when window size changes
  const handleWindowResize = debounce(() => {
    if (popup.style.display === 'block') {
      // Find the associated logo
      const logoId = popup.dataset.ownerLogo;
      if (logoId) {
        const logo = document.querySelector(`.text-helper-logo[data-id="${logoId}"]`);
        if (logo) {
          // Find the input element associated with this logo
          const containerId = logo.dataset.id;
          const container = document.querySelector(`.text-helper-container[data-for="${containerId}"]`);
          if (container && container.parentElement) {
            // Get the element from the container's parent
            const inputs = container.parentElement.querySelectorAll('input[type="text"], input[type="search"], input[type="email"], textarea, [contenteditable="true"]');
            if (inputs.length > 0) {
              // Re-position the popup relative to the first matching input
              const positionPopupFunction = popup.dataset.positionFunction;
              if (typeof window[positionPopupFunction] === 'function') {
                window[positionPopupFunction](inputs[0], logo, popup);
              }
            }
          }
        }
      }
    }
  }, 100);

  window.addEventListener('resize', handleWindowResize);

  return popup;
}

// Show suggestions popup with options
async function showSuggestionsPopup(element, logo, suggestions, sentenceInfo) {
  const popup = createSuggestionsPopup();

  // Make sure the logo stays visible
  logo.style.display = 'flex';
  logo.style.opacity = '1';
  logo.style.visibility = 'visible';

  // Set popup visibility state
  logo.dataset.popupVisible = 'true';
  popup.dataset.ownerLogo = logo.dataset.id;

  // Store reference to the position function
  const positionFunctionName = 'positionPopup_' + logo.dataset.id;
  popup.dataset.positionFunction = positionFunctionName;
  window[positionFunctionName] = function(el, lg, pp) {
    positionPopup(false, el, lg, pp);
  };

  // Update popup styles to match the image
  popup.style.backgroundColor = '#ffffff';
  popup.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
  popup.style.borderRadius = '8px';
  popup.style.padding = '0';
  popup.style.width = '350px';
  popup.style.maxHeight = '400px';
  popup.style.overflowY = 'auto';
  popup.style.border = '1px solid #e0e0e0';
  popup.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  // If there's no text or the text is too short, show a more helpful message
  if (suggestions !== null && (!sentenceInfo.text.trim() || sentenceInfo.text.trim().length < 10)) {
    popup.innerHTML = `
      <div style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-weight: 500; color: #1a1a1a;">Grammar Check</span>
          <span style="background: #e8f0fe; color: #1967d2; padding: 2px 8px; border-radius: 4px; font-size: 12px;">Pro</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 8px; background: #f8f9fa; border-radius: 4px; min-height: 24px;">
          <span style="font-size: 16px;">📝</span>
          <span style="color: #5f6368; font-size: 13px;">Tone: Not enough text</span>
        </div>
      </div>
      <div style="padding: 12px 16px; color: #5f6368;">
        Please enter at least 10 characters to get grammar suggestions.
      </div>
    `;

    positionPopup(true);
    return;
  }

  // Show loading state
  popup.innerHTML = `
    <div style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-weight: 500; color: #1a1a1a;">Grammar Check</span>
        <span style="background: #e8f0fe; color: #1967d2; padding: 2px 8px; border-radius: 4px; font-size: 12px;">Pro</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; padding: 4px 8px; background: #ffffff; border-radius: 4px; min-height: 24px;">
        <span style="font-size: 16px;">🔄</span>
        <span style="color: #5f6368; font-size: 13px;">Analyzing tone...</span>
      </div>
    </div>
    <div style="padding: 12px 16px; display: flex; align-items: center; justify-content: center; height: 50px;">
      <div style="width: 24px; height: 24px; border: 2px solid #e0e0e0; border-top-color: #1967d2; border-radius: 50%; animation: text-helper-spin 0.8s linear infinite;"></div>
    </div>
  `;

  // Position and show the popup immediately with loading state
  positionPopup();

  // Get sentiment analysis
  let sentimentInfo = { sentiment: 'Analyzing...', emoji: '🔄' };
  if (sentenceInfo.text.trim().length >= 10) {
    sentimentInfo = await analyzeSentiment(sentenceInfo.text);
  }

  // Prepare the HTML content first before updating the popup
  let popupHTML = '';
  let suggestionsContainer = null;

  if (suggestions && suggestions.length > 0) {
    popupHTML = `
      <div style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-weight: 500; color: #1a1a1a;">Grammar Check</span>
          <span style="background: #e8f0fe; color: #1967d2; padding: 2px 8px; border-radius: 4px; font-size: 12px;">Pro</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 8px; background: #ffffff; border-radius: 4px; min-height: 24px;">
          <span style="font-size: 16px;">${sentimentInfo.emoji}</span>
          <span style="color: #5f6368; font-size: 13px;">Tone: ${sentimentInfo.sentiment}</span>
        </div>
      </div>
    `;

    suggestionsContainer = document.createElement('div');
    suggestionsContainer.style.padding = '8px 0';

    suggestions.forEach((suggestion, index) => {
      const item = document.createElement('div');
      item.style.padding = '8px 16px';
      item.style.cursor = 'pointer';
      item.style.color = '#1a1a1a';
      item.style.fontSize = '14px';
      item.style.lineHeight = '1.5';
      item.style.transition = 'background-color 0.2s ease';
      item.style.display = 'flex';
      item.style.alignItems = 'center';

      // Add icons for different suggestion types
      if (index === 0) {
        item.innerHTML = `
          <span style="color: #1967d2; margin-right: 8px; font-size: 12px;">✓</span>
          <span>${suggestion}</span>
        `;
      } else {
        item.innerHTML = `
          <span style="color: #5f6368; margin-right: 8px; font-size: 12px;">✦</span>
          <span>${suggestion}</span>
        `;
      }

      item.addEventListener('mouseover', () => {
        item.style.backgroundColor = '#f8f9fa';
      });

      item.addEventListener('mouseout', () => {
        item.style.backgroundColor = 'transparent';
      });

      item.addEventListener('click', () => {
        replaceSentence(element, suggestion, sentenceInfo);
        popup.style.display = 'none';
        logo.dataset.popupVisible = 'false';
      });

      suggestionsContainer.appendChild(item);
    });
  } else {
    popupHTML = `
      <div style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-weight: 500; color: #1a1a1a;">Grammar Check</span>
          <span style="background: #e8f0fe; color: #1967d2; padding: 2px 8px; border-radius: 4px; font-size: 12px;">Pro</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 8px; background: #ffffff; border-radius: 4px; min-height: 24px;">
          <span style="font-size: 16px;">${sentimentInfo.emoji}</span>
          <span style="color: #5f6368; font-size: 13px;">Tone: ${sentimentInfo.sentiment}</span>
        </div>
      </div>
      <div style="padding: 12px 16px; color: #5f6368;">
        Unable to generate suggestions at this time. Please try again.
      </div>
    `;
  }

  // Update the popup with all content at once
  popup.innerHTML = popupHTML;
  if (suggestionsContainer) {
    popup.appendChild(suggestionsContainer);
  }

  // Reposition the popup after content update
  positionPopup();

  // Function to position the popup near the cursor position
  function positionPopup(forceAbove = false, inputElement = element, logoElement = logo, popupElement = popup) {
    try {
      // Start with opacity 0 for smooth transitions
      popupElement.style.opacity = '0'; // Hide temporarily while positioning
      popupElement.style.display = 'block'; // Show to get dimensions

      // Handle case where there's no highlighted error element
      const highlightedError = document.querySelector('.grammar-error-highlight');
      
      // Get popup dimensions
      const popupRect = popupElement.getBoundingClientRect();
      const popupWidth = popupRect.width;
      const popupHeight = popupRect.height;
      
      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Get input element position relative to viewport
      const inputRect = inputElement.getBoundingClientRect();
      
      // Default positions - center horizontally relative to input and place below
      let top = inputRect.bottom + 10; // Default to below input with 10px gap
      let left = inputRect.left + (inputRect.width / 2) - (popupWidth / 2);
      
      // For highlighted error, position near the error
      if (highlightedError) {
        const errorRect = highlightedError.getBoundingClientRect();
        
        // Check if error element is in the viewport
        const isErrorInView = (
          errorRect.top >= 0 &&
          errorRect.left >= 0 &&
          errorRect.bottom <= viewportHeight &&
          errorRect.right <= viewportWidth
        );
        
        if (!isErrorInView) {
          // If error is not in view, scroll it into view before positioning the popup
          highlightedError.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Wait for scroll to complete before positioning
          setTimeout(() => {
            const updatedErrorRect = highlightedError.getBoundingClientRect();
            positionRelativeToTarget(updatedErrorRect);
          }, 300);
          return;
        } else {
          positionRelativeToTarget(errorRect);
        }
        
        function positionRelativeToTarget(targetRect) {
          // Try positions in order of preference: below, above, right, left
          
          // 1. Try below
          if (targetRect.bottom + popupHeight + 10 <= viewportHeight) {
            top = targetRect.bottom + 10;
            left = targetRect.left + (targetRect.width / 2) - (popupWidth / 2);
          } 
          // 2. Try above
          else if (targetRect.top - popupHeight - 10 >= 0) {
            top = targetRect.top - popupHeight - 10;
            left = targetRect.left + (targetRect.width / 2) - (popupWidth / 2);
          } 
          // 3. Try right
          else if (targetRect.right + popupWidth + 10 <= viewportWidth) {
            left = targetRect.right + 10;
            top = targetRect.top + (targetRect.height / 2) - (popupHeight / 2);
          } 
          // 4. Try left
          else if (targetRect.left - popupWidth - 10 >= 0) {
            left = targetRect.left - popupWidth - 10;
            top = targetRect.top + (targetRect.height / 2) - (popupHeight / 2);
          }
          // 5. Last resort - center in viewport
          else {
            top = Math.max(10, (viewportHeight - popupHeight) / 2);
            left = Math.max(10, (viewportWidth - popupWidth) / 2);
          }
        }
      }
      
      // Final checks to ensure popup is fully in viewport
      if (top < 10) {
        top = 10; // Minimum 10px from top
      } else if (top + popupHeight > viewportHeight - 10) {
        top = viewportHeight - popupHeight - 10; // Minimum 10px from bottom
      }
      
      if (left < 10) {
        left = 10; // Minimum 10px from left
      } else if (left + popupWidth > viewportWidth - 10) {
        left = viewportWidth - popupWidth - 10; // Minimum 10px from right
      }
      
      // Make sure the position values are integers to avoid subpixel rendering issues
      top = Math.round(top);
      left = Math.round(left);
      
      // Apply position
      popupElement.style.position = 'fixed'; // Use fixed positioning relative to viewport
      popupElement.style.top = `${top}px`;
      popupElement.style.left = `${left}px`;
      
      // Store the position values as data attributes for stability
      popupElement.dataset.positionTop = top;
      popupElement.dataset.positionLeft = left;
      
      // Check visibility once more
      const finalRect = popupElement.getBoundingClientRect();
      const isVisible = (
        finalRect.top >= 0 &&
        finalRect.left >= 0 &&
        finalRect.bottom <= viewportHeight &&
        finalRect.right <= viewportWidth
      );
      
      if (!isVisible) {
        // Final fallback if somehow still not visible - center in viewport
        popupElement.style.top = `${Math.max(10, (viewportHeight - popupHeight) / 2)}px`;
        popupElement.style.left = `${Math.max(10, (viewportWidth - popupWidth) / 2)}px`;
      }
      
      // Show the popup with a slight delay to allow positioning to complete
      setTimeout(() => {
        popupElement.style.opacity = '1';
      }, 50);
      
    } catch (error) {
      console.error('Error positioning popup:', error);
      // Fallback positioning - center in viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const popupRect = popupElement.getBoundingClientRect();
      const popupWidth = popupRect.width;
      const popupHeight = popupRect.height;
      
      const top = Math.max(10, (viewportHeight - popupHeight) / 2);
      const left = Math.max(10, (viewportWidth - popupWidth) / 2);
      
      popupElement.style.position = 'fixed'; // Use fixed positioning
      popupElement.style.top = `${top}px`;
      popupElement.style.left = `${left}px`;
      popupElement.style.opacity = '1';
    }
  }

  // Handle clicking outside
  const handleClickOutside = (event) => {
    if (!popup.contains(event.target) && !logo.contains(event.target)) {
      popup.style.display = 'none';
      logo.dataset.popupVisible = 'false';
      document.removeEventListener('click', handleClickOutside);
    }
  };

  // Add click handler with delay to prevent immediate closing
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside);
  }, 100);
}

// Show loading state on the logo
function showLogoLoading(logo, isLoading) {
  const img = logo.querySelector('img');

  if (isLoading) {
    // Start spinning the image
    img.style.animation = 'text-helper-spin 0.8s linear infinite';
    logo.dataset.isLoading = 'true';
  } else {
    // Stop spinning and restore normal state
    img.style.animation = 'none';
    logo.dataset.isLoading = 'false';
  }
}

// Position the logo inside the text box
function positionLogo(element, logo) {
  try {
    // Get element position relative to viewport
    const rect = element.getBoundingClientRect();

    // Create or get a container for the logo that's positioned relative to the input
    let container = document.querySelector(`.text-helper-container[data-for="${logo.dataset.id}"]`);
    if (!container) {
      container = document.createElement('div');
      container.className = 'text-helper-container';
      container.dataset.for = logo.dataset.id;
      container.style.position = 'absolute';
      container.style.pointerEvents = 'none'; // Let clicks go through to the underlying elements
      container.style.width = '0';
      container.style.height = '0';
      container.style.zIndex = '2147483646'; // Just below the logo's z-index
      document.body.appendChild(container);
    }

    // Position the container to match the input element's position
    container.style.top = `${window.scrollY + rect.top}px`;
    container.style.left = `${window.scrollX + rect.left}px`;
    container.style.width = `${rect.width}px`;
    container.style.height = `${rect.height}px`;

    // Move the logo to the container if it's not already there
    if (logo.parentElement !== container) {
      container.appendChild(logo);
    }

    const logoSize = 24; // Size of the logo
    const padding = 8; // Padding from the edge of the input

    // Determine if the input is large enough to position the logo at the bottom right
    // For smaller inputs, position just at the right side
    const isLargeInput = rect.height > 80; // Height threshold to decide if input is large

    // Position the logo at the right or bottom right based on input size
    logo.style.position = 'absolute';
    logo.style.right = `${padding}px`;

    if (isLargeInput) {
      // For larger inputs (like textareas), position at bottom right
      logo.style.bottom = `${padding}px`;
      logo.style.top = 'auto';
    } else {
      // For smaller inputs, center vertically on the right
      logo.style.top = `${(rect.height - logoSize) / 2}px`;
      logo.style.bottom = 'auto';
    }

    logo.style.transform = 'scale(1)';
    logo.style.pointerEvents = 'auto'; // Make sure the logo is clickable

    // Ensure the logo stays visible
    logo.style.display = 'flex';
    logo.style.opacity = '1';
    logo.style.visibility = 'visible';
    logo.style.zIndex = '2147483647'; // Maximum z-index

    // Add additional styles to ensure visibility
    logo.style.backgroundColor = '#ffffff';
    logo.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    logo.style.border = '1px solid #e0e0e0';
    logo.style.borderRadius = '50%';

    // Force the logo to be visible
    requestAnimationFrame(() => {
      logo.style.display = 'flex';
      logo.style.opacity = '1';
      logo.style.visibility = 'visible';
    });
  } catch (e) {
    console.error('Error positioning logo:', e);
  }
}

// Expose to global scope
window.createLogoElement = createLogoElement;
window.createSuggestionsPopup = createSuggestionsPopup;
window.showSuggestionsPopup = showSuggestionsPopup;
window.showLogoLoading = showLogoLoading;
window.positionLogo = positionLogo; 