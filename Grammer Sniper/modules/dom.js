/**
 * @copyright This code belongs to Solo Hunters Open Source Community
 */

// DOM manipulation and interaction functions

// Get entire content from input/contenteditable element
function getInputContent(element) {
  // Handle null or undefined element
  if (!element) {
    console.warn('Cannot get content from null/undefined element');
    return { text: '', startPos: 0, endPos: 0 };
  }
  
  // Handle disconnected element
  if (!element.isConnected) {
    console.warn('Cannot get content from disconnected element');
    return { text: '', startPos: 0, endPos: 0 };
  }
  
  let text = '';
  
  try {
    // Handle different types of editors
    if (element.value !== undefined) {
      // Standard input/textarea elements
      text = element.value;
    } else if (element.textContent !== undefined) {
      // Contenteditable and most custom editors
      text = element.textContent;
    } else if (element.innerText !== undefined) {
      // Fallback to innerText
      text = element.innerText;
    }
    
    // Check for specific editor frameworks
    // CodeMirror
    if (!text && element.classList.contains('CodeMirror')) {
      const cmInstance = element.CodeMirror;
      if (cmInstance && typeof cmInstance.getValue === 'function') {
        text = cmInstance.getValue();
      }
    }
    
    // Monaco Editor
    if (!text && element.classList.contains('monaco-editor')) {
      const model = element._modelData?.model;
      if (model && typeof model.getValue === 'function') {
        text = model.getValue();
      }
    }
    
    // CKEditor
    if (!text && window.CKEDITOR) {
      for (const id in window.CKEDITOR.instances) {
        const editor = window.CKEDITOR.instances[id];
        if (editor.container && editor.container.$ === element) {
          text = editor.getData();
          break;
        }
      }
    }
    
    // TinyMCE
    if (!text && window.tinymce) {
      const editors = window.tinymce.editors || [];
      for (const editor of editors) {
        if (editor.getContainer() === element) {
          text = editor.getContent();
          break;
        }
      }
    }
    
    // Handle empty text case
    if (!text || !text.trim()) {
      return {
        text: '',
        startPos: 0,
        endPos: 0
      };
    }
    
    return {
      text: text.trim(),
      startPos: 0,
      endPos: text.length
    };
  } catch (error) {
    console.error('Error getting input content:', error);
    return { text: '', startPos: 0, endPos: 0 };
  }
}

// Replace the current sentence in the element with the selected suggestion
function replaceSentence(element, suggestion, sentenceInfo) {
  // Check for element connection to DOM
  if (!element || !element.isConnected) {
    console.error('Element is disconnected or invalid, cannot replace sentence');
    return false;
  }
  
  // Ensure we have valid position information
  if (!sentenceInfo || typeof sentenceInfo.startPos !== 'number' || typeof sentenceInfo.endPos !== 'number') {
    console.error('Invalid sentence information for replacement:', sentenceInfo);
    return false;
  }
  
  // Make a copy of sentenceInfo to avoid modifying the original
  const posInfo = {
    startPos: sentenceInfo.startPos,
    endPos: sentenceInfo.endPos,
    text: sentenceInfo.text
  };
  
  // Validate positions are within bounds
  if (posInfo.startPos < 0 || posInfo.endPos < posInfo.startPos) {
    console.error('Invalid text positions:', posInfo.startPos, posInfo.endPos);
    return false;
  }

  // Check if suggestion is valid
  if (typeof suggestion !== 'string') {
    console.error('Invalid suggestion for replacement:', suggestion);
    return false;
  }

  // Get the current full text with enhanced editor support
  let currentFullText = '';
  let isCustomEditor = false;
  
  // Detect editor type
  const nodeName = element.nodeName.toLowerCase();
  const isContentEditable = element.isContentEditable || element.getAttribute('contenteditable') === 'true' || element.getAttribute('contenteditable') === '';
  const isTextInput = nodeName === 'input' && ['text', 'search', 'email', 'url'].includes(element.type);
  const isTextArea = nodeName === 'textarea';
  
  // Check for common editor frameworks
  const isQuillEditor = element.classList.contains('ql-editor');
  const isCodeMirror = element.classList.contains('CodeMirror') || element.classList.contains('cm-content');
  const isMonacoEditor = element.classList.contains('monaco-editor') || element.closest('.monaco-editor');
  const isProseMirror = element.classList.contains('ProseMirror');
  const isDraftEditor = element.classList.contains('public-DraftEditor-content');
  
  // Get text based on editor type
  try {
    if (isTextInput || isTextArea) {
      // Standard form elements
      currentFullText = element.value || '';
    } else if (isContentEditable) {
      // Contenteditable elements
      currentFullText = element.textContent || element.innerText || '';
    } else if (isQuillEditor && window.Quill) {
      // Quill editor
      isCustomEditor = true;
      const quillInstance = Quill.find(element);
      if (quillInstance) {
        currentFullText = quillInstance.getText() || element.textContent || '';
      } else {
        currentFullText = element.textContent || '';
      }
    } else if (isCodeMirror) {
      // CodeMirror editor
      isCustomEditor = true;
      const cmInstance = element.CodeMirror;
      if (cmInstance && typeof cmInstance.getValue === 'function') {
        currentFullText = cmInstance.getValue();
      } else {
        currentFullText = element.textContent || '';
      }
    } else if (isMonacoEditor && window.monaco) {
      // Monaco editor
      isCustomEditor = true;
      const model = element._modelData?.model;
      if (model && typeof model.getValue === 'function') {
        currentFullText = model.getValue();
      } else {
        currentFullText = element.textContent || '';
      }
    } else {
      // Default fallback
      currentFullText = element.value || element.textContent || element.innerText || '';
    }
  } catch (textError) {
    console.warn('Error getting text content:', textError);
    currentFullText = element.value || element.textContent || element.innerText || '';
  }
  
  if (!currentFullText) {
    console.error('Element has no text content');
    return false;
  }
  
  // Make sure positions are within bounds of the current text
  if (posInfo.endPos > currentFullText.length) {
    console.warn('End position exceeds text length, adjusting:', posInfo.endPos, '→', currentFullText.length);
    posInfo.endPos = currentFullText.length;
  }

  // Verify that the text at the specified positions matches what we expect
  // This helps ensure we're replacing the correct text
  const textToReplace = currentFullText.substring(posInfo.startPos, posInfo.endPos);
  
  // If the text doesn't match exactly, try to find the correct position
  if (posInfo.text && textToReplace !== posInfo.text) {
    console.warn('Text mismatch. Expected:', posInfo.text, 'Found:', textToReplace);
    
    // Try to find the exact text in the content
    const exactIndex = currentFullText.indexOf(posInfo.text);
    if (exactIndex >= 0) {
      console.log('Found exact text at position:', exactIndex);
      // Update positions to match the found text
      posInfo.startPos = exactIndex;
      posInfo.endPos = exactIndex + posInfo.text.length;
      console.log('Updated positions:', posInfo.startPos, posInfo.endPos);
    } else {
      // If we can't find the exact match, try to find a similar text
      console.warn('Could not find exact match, trying fuzzy match');
      
      // Try to find the suggestion instead as a fallback
      if (suggestion) {
        const suggestionIndex = currentFullText.indexOf(suggestion);
        if (suggestionIndex >= 0) {
          console.log('Found suggestion in text at position:', suggestionIndex);
          // Just use the suggestion text as-is at its current position
          posInfo.startPos = suggestionIndex;
          posInfo.endPos = suggestionIndex + suggestion.length;
          console.log('Using suggestion position:', posInfo.startPos, posInfo.endPos);
          // In this case we're replacing the suggestion with itself, which is a no-op
          // but we'll proceed to make sure any surrounding UI is updated
        } else {
          // Try fuzzy matching - look for similar text
          const fuzzyMatch = findFuzzyMatch(currentFullText, posInfo.text);
          if (fuzzyMatch.found) {
            console.log('Found fuzzy match at position:', fuzzyMatch.startPos);
            posInfo.startPos = fuzzyMatch.startPos;
            posInfo.endPos = fuzzyMatch.endPos;
          } else {
            console.error('Could not find the text to replace safely');
            return false;
          }
        }
      } else {
        console.error('Could not find the text to replace safely and no suggestion to use');
        return false;
      }
    }
  }
  
  // Final validation of the updated positions
  if (posInfo.startPos < 0 || posInfo.endPos > currentFullText.length || posInfo.startPos >= posInfo.endPos) {
    console.error('Invalid final positions after adjustment:', posInfo.startPos, posInfo.endPos);
    return false;
  }
  
  console.log('Replacing text:', currentFullText.substring(posInfo.startPos, posInfo.endPos), 'with:', suggestion, 'at positions:', posInfo.startPos, posInfo.endPos);

  // Trim any leading/trailing spaces from the suggestion while preserving internal spaces
  const trimmedSuggestion = suggestion.replace(/^\s+|\s+$/g, '');
  
  try {
    // Apply the replacement based on the element type
    if (isCustomEditor) {
      // Handle specialized editors
      if (isQuillEditor && window.Quill) {
        const quillInstance = Quill.find(element);
        if (quillInstance) {
          quillInstance.deleteText(posInfo.startPos, posInfo.endPos - posInfo.startPos);
          quillInstance.insertText(posInfo.startPos, trimmedSuggestion);
          return true;
        }
      } else if (isCodeMirror) {
        const cmInstance = element.CodeMirror;
        if (cmInstance && typeof cmInstance.replaceRange === 'function') {
          // Convert flat position to line/ch format
          const fromPos = cmInstance.posFromIndex(posInfo.startPos);
          const toPos = cmInstance.posFromIndex(posInfo.endPos);
          cmInstance.replaceRange(trimmedSuggestion, fromPos, toPos);
          return true;
        }
      } else if (isMonacoEditor && window.monaco) {
        const model = element._modelData?.model;
        if (model && typeof model.pushEditOperations === 'function') {
          const startPos = model.getPositionAt(posInfo.startPos);
          const endPos = model.getPositionAt(posInfo.endPos);
          model.pushEditOperations(
            [],
            [{
              range: new monaco.Range(
                startPos.lineNumber,
                startPos.column,
                endPos.lineNumber,
                endPos.column
              ),
              text: trimmedSuggestion
            }],
            () => null
          );
          return true;
        }
      }
      
      // Fallback for custom editors if specific handling failed
      if (isContentEditable) {
        // Try contenteditable approach
        const beforeText = currentFullText.substring(0, posInfo.startPos);
        const afterText = currentFullText.substring(posInfo.endPos);
        element.textContent = beforeText + trimmedSuggestion + afterText;
        return true;
      } else {
        console.warn('Could not apply specialized editor replacement, using generic approach');
      }
    }
    
    if (element.isContentEditable) {
      // For contenteditable elements, use execCommand for better undo support
      const range = document.createRange();
      const selection = window.getSelection();
      
      // Try to find the text node containing our text
      const textNode = findTextNodeAtPosition(element, posInfo.startPos);
      
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        // Calculate relative positions within the text node
        const textNodeStartPos = getTextNodePosition(element, textNode);
        const relativeStart = posInfo.startPos - textNodeStartPos;
        const relativeEnd = posInfo.endPos - textNodeStartPos;
        
        if (relativeStart >= 0 && relativeEnd <= textNode.nodeValue.length) {
          // Verify the text node content before replacement
          const nodeTextToReplace = textNode.nodeValue.substring(relativeStart, relativeEnd);
          console.log('Node text to replace:', nodeTextToReplace);
          
          // Set selection to the text we want to replace
          range.setStart(textNode, relativeStart);
          range.setEnd(textNode, relativeEnd);
          selection.removeAllRanges();
          selection.addRange(range);
          
          // Replace with our suggestion
          document.execCommand('insertText', false, trimmedSuggestion);
          return true;
        } else {
          console.warn('Relative positions outside text node bounds, using fallback');
        }
      }
      
      // Fallback if we couldn't use the DOM selection
      const beforeText = currentFullText.substring(0, posInfo.startPos);
      const afterText = currentFullText.substring(posInfo.endPos);
      element.textContent = beforeText + trimmedSuggestion + afterText;
      
    } else if (isTextInput || isTextArea) {
      // For input/textarea elements
      const beforeText = currentFullText.substring(0, posInfo.startPos);
      const afterText = currentFullText.substring(posInfo.endPos);
      
      element.value = beforeText + trimmedSuggestion + afterText;
      
      // Set cursor position after the inserted text
      try {
        element.selectionStart = posInfo.startPos + trimmedSuggestion.length;
        element.selectionEnd = posInfo.startPos + trimmedSuggestion.length;
        element.focus();
      } catch (e) {
        console.warn('Could not set selection:', e);
      }
    } else {
      // Generic fallback for any other element type
      const beforeText = currentFullText.substring(0, posInfo.startPos);
      const afterText = currentFullText.substring(posInfo.endPos);
      
      if (element.value !== undefined) {
        element.value = beforeText + trimmedSuggestion + afterText;
      } else {
        element.textContent = beforeText + trimmedSuggestion + afterText;
      }
    }
    
    // Trigger input event to notify any listeners (like React)
    try {
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      console.warn('Could not dispatch events:', e);
    }
    
    return true;
  } catch (error) {
    console.error('Error during text replacement:', error);
    return false;
  }
}

// Helper function to find fuzzy matches when exact matching fails
function findFuzzyMatch(text, searchText) {
  if (!text || !searchText) {
    return { found: false };
  }
  
  // Try to find a partial match
  const words = searchText.split(/\s+/);
  if (words.length > 1) {
    // Try matching just the first few words
    for (let i = words.length - 1; i >= 2; i--) {
      const partialPhrase = words.slice(0, i).join(' ');
      const partialIndex = text.indexOf(partialPhrase);
      if (partialIndex >= 0) {
        // Find a reasonable end position
        let endPos = partialIndex + partialPhrase.length;
        // Try to extend to include more of the original phrase
        const nextWord = words[i];
        if (nextWord) {
          const nextWordIndex = text.indexOf(nextWord, endPos);
          if (nextWordIndex >= 0 && nextWordIndex - endPos < 20) { // Within reasonable distance
            endPos = nextWordIndex + nextWord.length;
          }
        }
        return {
          found: true,
          startPos: partialIndex,
          endPos: endPos
        };
      }
    }
    
    // Try matching just the first word with some context
    const firstWord = words[0];
    const firstWordIndex = text.indexOf(firstWord);
    if (firstWordIndex >= 0) {
      // Get some context after the word
      const remainingText = text.substring(firstWordIndex + firstWord.length);
      const contextLength = Math.min(remainingText.length, 50); // Reasonable context length
      return {
        found: true,
        startPos: firstWordIndex,
        endPos: firstWordIndex + firstWord.length + contextLength
      };
    }
  }
  
  return { found: false };
}

// Get caret position for contenteditable elements
function getCaretPosition(element) {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const clonedRange = range.cloneRange();
    clonedRange.selectNodeContents(element);
    clonedRange.setEnd(range.endContainer, range.endOffset);
    return clonedRange.toString().length;
  }
  return 0;
}

// Function to find all regular input fields and contenteditable elements.
function findEditableElements(doc = document) {
  // Select all valid input fields and textareas directly
  const inputs = Array.from(doc.querySelectorAll(
    'input:not([type="password"]):not([type="number"]):not([type="date"]):not([type="month"]):not([type="week"]):not([type="time"]):not([type="datetime-local"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="image"]):not([type="submit"]):not([type="reset"]):not([type="button"]):not([type="hidden"]):not([type="color"]), textarea'
  ));
  
  // Get contenteditable elements with expanded selector
  const editableElements = Array.from(doc.querySelectorAll(
    '[contenteditable="true"], ' +
    '[contenteditable=""], ' +  // Some editors use empty contenteditable
    '[role="textbox"], ' +
    '[aria-multiline="true"]'
  ));
  
  // Find common editor frameworks by class names
  const editorFrameworks = Array.from(doc.querySelectorAll(
    // Quill editor
    '.ql-editor, ' +
    // CodeMirror
    '.CodeMirror, .cm-content, .cm-line, ' +
    // Monaco (VS Code)
    '.monaco-editor .view-line, ' +
    // CKEditor
    '.cke_editable, ' +
    // TinyMCE
    '.mce-content-body, ' +
    // Draft.js
    '.public-DraftEditor-content, ' +
    // Lexical
    '.lexical-rich-text-input div[contenteditable="true"], ' +
    // Slate.js
    '[data-slate-editor="true"], ' +
    // Froala
    '.fr-element, ' +
    // Summernote
    '.note-editable, ' +
    // Generic editor classes
    '.editor, .text-editor, .rich-text-editor, .document-editor, ' +
    // Medium editor
    '.medium-editor-element, ' +
    // Prosemirror
    '.ProseMirror, ' +
    // Trix editor
    'trix-editor, ' +
    // Common WYSIWYG editors
    '.wysiwyg-editor, ' +
    // Notion-like editors
    '[data-block-editor-block-type]'
  ));
  
  // Find elements with common editor attributes
  const editorAttributes = Array.from(doc.querySelectorAll(
    '[data-gramm], ' +  // Grammarly's attribute
    '[data-medium-editor-element], ' +
    '[data-editor], ' +
    '[data-rich-text="true"], ' +
    '[data-slate-object="block"], ' +
    '[data-lexical-editor="true"]'
  ));
  
  // Find elements with aria labels that suggest they're editors
  const ariaEditors = Array.from(doc.querySelectorAll(
    '[aria-label*="editor" i], ' +
    '[aria-label*="composer" i], ' +
    '[aria-label*="message" i], ' +
    '[aria-label*="input" i], ' +
    '[aria-label*="text" i], ' +
    '[aria-label*="write" i], ' +
    '[aria-label*="type" i]'
  ));
  
  // Combine all potential editable elements
  const allEditableElements = [
    ...inputs,
    ...editableElements,
    ...editorFrameworks,
    ...editorAttributes,
    ...ariaEditors
  ];
  
  // Remove duplicates
  const uniqueElements = Array.from(new Set(allEditableElements));
  
  // Check if elements are visible and reasonably sized
  const visibleElements = uniqueElements.filter(el => {
    if (!el.isConnected) return false;
    
    try {
      // Check if element is visible
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      
      // Check if element has reasonable size (at least 30x20 pixels)
      // Reduced from 50x20 to catch more small editors
      const rect = el.getBoundingClientRect();
      if (rect.width < 30 || rect.height < 20) {
        return false;
      }
      
      return true;
    } catch (e) {
      console.warn('Error checking element visibility:', e);
      return false;
    }
  });
  
  console.log('Found editable elements:', visibleElements.length);
  return visibleElements;
}

// Expose to global scope
window.getInputContent = getInputContent;
window.replaceSentence = replaceSentence;
window.getCaretPosition = getCaretPosition;
window.findEditableElements = findEditableElements; 