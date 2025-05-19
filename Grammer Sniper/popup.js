/**
 * @copyright This code belongs to Solo Hunters Open Source Community
 */

// This file can be used to add functionality to the popup

document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('saveKey');
  const statusDiv = document.getElementById('status');
  
  // Accordion elements
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  const modelToggles = {
    gemini: document.getElementById('geminiToggle'),
    claude: document.getElementById('claudeToggle'),
    openai: document.getElementById('openaiToggle'),
    groq: document.getElementById('groqToggle')
  };

  // Set up accordion functionality
  accordionHeaders.forEach(header => {
    header.addEventListener('click', function() {
      const content = this.nextElementSibling;
      const isActive = content.classList.contains('active');
      
      // Toggle the current accordion
      content.classList.toggle('active');
      this.classList.toggle('active');
    });
  });

  // Handle model toggle switches - ensure only one is active at a time
  Object.entries(modelToggles).forEach(([model, toggle]) => {
    if (toggle) {
      toggle.addEventListener('change', function() {
        if (this.checked) {
          // Uncheck all other toggles
          Object.entries(modelToggles).forEach(([otherModel, otherToggle]) => {
            if (otherModel !== model && otherToggle) {
              otherToggle.checked = false;
            }
          });
          
          // Show success message
          showStatus(`${model.charAt(0).toUpperCase() + model.slice(1)} selected as active model`, 'success');
        } else {
          // Prevent unchecking the last active toggle
          const anyOtherChecked = Object.values(modelToggles).some(t => t && t !== this && t.checked);
          if (!anyOtherChecked) {
            this.checked = true;
            showStatus('At least one model must be active', 'error');
          }
        }
        
        // Save active model to storage
        saveActiveModel(model);
      });
    }
  });

  // Load saved API key if it exists
  chrome.storage.sync.get(['googleApiKey', 'activeModel'], function(result) {
    if (result.googleApiKey) {
      apiKeyInput.value = result.googleApiKey;
      showStatus('API key loaded', 'success');
    }
    
    // Set active model toggle based on saved preference
    if (result.activeModel && modelToggles[result.activeModel]) {
      // Uncheck all toggles first
      Object.values(modelToggles).forEach(toggle => {
        if (toggle) toggle.checked = false;
      });
      
      // Check the saved active model
      if (modelToggles[result.activeModel]) {
        modelToggles[result.activeModel].checked = true;
      } else {
        // Default to Gemini if saved model doesn't exist
        modelToggles.gemini.checked = true;
      }
    }
  });

  // Save API key when button is clicked
  saveButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    // Get the active model
    let activeModel = 'gemini'; // Default
    Object.entries(modelToggles).forEach(([model, toggle]) => {
      if (toggle && toggle.checked) {
        activeModel = model;
      }
    });
    
    // Save API key with active model context
    const dataToSave = {
      googleApiKey: apiKey,
      activeModel: activeModel
    };
    
    chrome.storage.sync.set(dataToSave, function() {
      showStatus('API key saved successfully', 'success');
      
      // Attempt to notify content script that API key has been updated
      notifyContentScripts(apiKey, activeModel);
    });
  });

  // Function to save active model selection
  function saveActiveModel(model) {
    chrome.storage.sync.get(['activeModel'], function(result) {
      if (result.activeModel !== model) {
        chrome.storage.sync.set({ activeModel: model }, function() {
          console.log(`Active model set to ${model}`);
        });
      }
    });
  }
  
  // Function to notify all content scripts in active tabs about the API key update
  function notifyContentScripts(apiKey, activeModel) {
    // Query for all tabs
    chrome.tabs.query({}, function(tabs) {
      if (chrome.runtime.lastError) {
        console.error("Error querying tabs:", chrome.runtime.lastError);
        return;
      }
      
      if (tabs.length === 0) {
        console.log("No tabs found to send message to");
        return;
      }
      
      // Send message to each tab
      let messagesSent = 0;
      tabs.forEach(function(tab) {
        // Skip chrome:// urls as they can't run content scripts
        if (tab.url && tab.url.startsWith("chrome://")) {
          return;
        }
        
        try {
          chrome.tabs.sendMessage(
            tab.id, 
            { 
              type: 'API_KEY_UPDATED', 
              apiKey: apiKey,
              activeModel: activeModel
            },
            function(response) {
              if (chrome.runtime.lastError) {
                // This error is expected for tabs without our content script
                console.log(`Message to tab ${tab.id} failed: ${chrome.runtime.lastError.message}`);
              } else if (response) {
                console.log(`Message to tab ${tab.id} succeeded:`, response);
                messagesSent++;
              }
            }
          );
        } catch (error) {
          console.error(`Error sending message to tab ${tab.id}:`, error);
        }
      });
      
      console.log(`Attempted to send message to ${tabs.length} tabs`);
    });
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type} visible`;
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 3000);
  }
}); 