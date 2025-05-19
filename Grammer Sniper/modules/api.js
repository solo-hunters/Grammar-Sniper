/**
 * @copyright This code belongs to Solo Hunters Open Source Community
 */

// API interaction functions
// Removed import statement - we'll use globals

// Helper function to get API key with retries
async function getApiKeyWithRetry(maxRetries = 3, retryDelay = 1000) {
  let apiKey = '';
  let attempts = 0;
  
  while (attempts < maxRetries) {
    if (typeof window.GrammarSniperConfig !== 'undefined' && typeof window.GrammarSniperConfig.getApiKey === 'function') {
      apiKey = window.GrammarSniperConfig.getApiKey();
      if (apiKey) {
        return apiKey;
      }
    }
    
    // If we have a global API key variable, use that
    if (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY) {
      return GEMINI_API_KEY;
    }
    
    // Wait before retrying
    if (attempts < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    attempts++;
  }
  
  return '';
}

// Call Gemini API to get grammar suggestions
async function getGrammarSuggestions(text) {
  try {
    console.log('Getting grammar suggestions for text:', text);

    // Get API key with retries
    const apiKey = await getApiKeyWithRetry();

    if (!apiKey) {
      // Return friendly message instead of throwing an error
      console.warn('API key not set. Please set your Google API key in the extension popup.');
      return ['No API key set. Please set your API key in the extension settings.'];
    }

    const prompt = `Review and correct any grammar, spelling, or style issues in the following text. Then provide 3 alternative ways to express the same content more clearly and professionally.

Original text: "${text}"

Format your response EXACTLY as follows - a numbered list of 4 items without quotes, markdown, or any explanations:
1. [grammatically corrected version]
2. [professional alternative 1]
3. [clear alternative 2]
4. [impactful alternative 3]

IMPORTANT:
- Do NOT include quotes, explanations, or labels in your response
- Do NOT include trailing periods like "They proceeded down the street."
- Do NOT include any formatting or markdown
- Just provide the plain text alternatives
- Each suggestion should be grammatically complete
- Never explain what you changed or why`;

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ]
    };

    // Get API URL from config or construct it
    let apiUrl = '';
    if (typeof window.GrammarSniperConfig !== 'undefined' && typeof window.GrammarSniperConfig.getApiUrl === 'function') {
      apiUrl = window.GrammarSniperConfig.getApiUrl();
    } else {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    }

    console.log('Sending API request');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    console.log('Received API response with status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    console.log('Parsed API response data:', data);

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No candidates returned from API');
    }

    let suggestionsText = data.candidates[0].content.parts[0].text;
    console.log('Raw suggestions text:', suggestionsText);

    // Parse numbered list from response and clean up the suggestions
    const suggestionLines = suggestionsText.split('\n')
      .filter(line => line.match(/^\d+\.\s/))
      .map(line => {
        // Remove the number and initial space
        line = line.replace(/^\d+\.\s/, '');
        // Remove any markdown formatting
        line = line.replace(/\*\*/g, '');
        // Remove any labels like "Grammatically corrected version:" or similar
        line = line.replace(/^(?:Grammatically corrected version:|Alternative version \d+:|[^:]+:)\s*/i, '');
        // Remove explanatory text in parentheses
        line = line.replace(/\s*\([^)]+\)/g, '');
        // Remove square brackets
        line = line.replace(/[\[\]]/g, '');
        // Remove any text after periods followed by explanatory text
        line = line.replace(/\.\s+(?:[A-Z][^.]*|This[^.]*|Here[^.]*|The[^.]*)$/i, '.');
        // Remove any quotes around the text
        line = line.replace(/^["']|["']$/g, '');
        // Clean up any remaining whitespace and ensure proper punctuation
        line = line.trim().replace(/\s+/g, ' ');
        // Ensure the line ends with proper punctuation
        if (!/[.!?]$/.test(line)) {
          line = line + '.';
        }
        return line;
      })
      // Filter out any empty lines or lines that are too short
      .filter(line => line.length > 0);

    console.log('Parsed and cleaned suggestion lines:', suggestionLines);

    return suggestionLines;
  } catch (error) {
    console.error('Error getting grammar suggestions:', error);
    throw error;
  }
}

// Analyze text sentiment using Gemini API
async function analyzeSentiment(text) {
  try {
    // Get API key with retries
    const apiKey = await getApiKeyWithRetry();

    if (!apiKey) {
      // Return default sentiment instead of throwing an error
      console.warn('API key not set. Using default sentiment.');
      return {
        sentiment: 'Neutral',
        emoji: '😐'
      };
    }

    const prompt = `Analyze the sentiment/tone of the following text and categorize it as exactly one of these options: Confident, Friendly, Formal, Casual, Optimistic, Neutral, Tentative, Concerned, Joyful, or Forceful. Also provide a matching emoji.

Text: "${text}"

Format your response exactly like this example:
Sentiment: Confident
Emoji: 💪

Only return those two lines, nothing else.`;

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ]
    };

    // Get API URL from config or construct it
    let apiUrl = '';
    if (typeof window.GrammarSniperConfig !== 'undefined' && typeof window.GrammarSniperConfig.getApiUrl === 'function') {
      apiUrl = window.GrammarSniperConfig.getApiUrl();
    } else {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No sentiment analysis returned');
    }

    const result = data.candidates[0].content.parts[0].text;
    const sentimentMatch = result.match(/Sentiment: (.*)/);
    const emojiMatch = result.match(/Emoji: (.*)/);

    return {
      sentiment: sentimentMatch ? sentimentMatch[1].trim() : 'Neutral',
      emoji: emojiMatch ? emojiMatch[1].trim() : '😐'
    };
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return {
      sentiment: 'Neutral',
      emoji: '😐'
    };
  }
}

// Check grammar and return mistakes in the requested format
async function checkGrammarWithDetails(text) {
  try {
    console.log('Checking grammar with detailed response for text:', text);

    // Get API key with retries
    const apiKey = await getApiKeyWithRetry();

    if (!apiKey) {
      console.warn('API key not set. Skipping detailed grammar check.');
      return { words_with_mistakes: [] };
    }

    const prompt = `Act as a professional grammar checker. Analyze the following text for grammar, spelling, style, and word choice errors. Pay special attention to character positions.

Text to analyze: "${text}"

Format your response using this exact JSON structure, with no additional text:
{
  "words_with_mistakes": [
    {
      "text": "incorrect text",
      "suggestion": "corrected text",
      "mistake_type": "grammar|spelling|style|word choice",
      "start_index": 0,
      "end_index": 0
    }
  ]
}

IMPORTANT RULES for start_index and end_index:
1. Count characters from 0, including spaces and punctuation
2. start_index should be the exact position where the incorrect word/phrase begins
3. end_index should be the position after the last character of the incorrect word/phrase
4. Double-check that text[start_index:end_index] exactly matches the incorrect text
5. Verify indices by ensuring end_index - start_index equals the length of the incorrect text

Example: For "They was walking", if "was" is incorrect:
- start_index would be 5 (position of 'w' in "was")
- end_index would be 8 (position after 's' in "was")

Return an empty words_with_mistakes array if no issues are found.
Give 3-5 errors maximum to avoid overwhelming the user.`;

    // Get API URL from config or use hardcoded pattern with the key
    let apiUrl = '';
    if (typeof window.GrammarSniperConfig !== 'undefined' && typeof window.GrammarSniperConfig.getApiUrl === 'function') {
      apiUrl = window.GrammarSniperConfig.getApiUrl();
    } else {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    }

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ]
    };

    console.log('Sending API request to:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    console.log('Received API response with status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    console.log('Parsed API response data:', data);

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No candidates returned from API');
    }

    // Parse the JSON response
    const responseText = data.candidates[0].content.parts[0].text;
    // Extract just the JSON part (in case there's any extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      // Ensure the result has the expected structure
      if (!result.words_with_mistakes || !Array.isArray(result.words_with_mistakes)) {
        console.error('Invalid response structure:', result);
        return { words_with_mistakes: [] };
      }

      // Validate and fix indices if necessary
      result.words_with_mistakes = result.words_with_mistakes.map(mistake => {
        // Ensure indices are within bounds
        mistake.start_index = Math.max(0, Math.min(mistake.start_index, text.length - 1));
        mistake.end_index = Math.max(mistake.start_index + 1, Math.min(mistake.end_index, text.length));
        
        // Verify that the indices match the text
        const extractedText = text.substring(mistake.start_index, mistake.end_index);
        if (extractedText.trim() !== mistake.text.trim()) {
          // Try to find the correct position
          const position = text.indexOf(mistake.text);
          if (position !== -1) {
            mistake.start_index = position;
            mistake.end_index = position + mistake.text.length;
          }
        }
        
        return mistake;
      });
      
      return result;
    } else {
      throw new Error('Could not extract JSON from response');
    }
  } catch (error) {
    console.error('Error checking grammar with details:', error);
    return { words_with_mistakes: [] };
  }
}

// Expose to global scope
window.getGrammarSuggestions = getGrammarSuggestions;
window.analyzeSentiment = analyzeSentiment;
window.checkGrammarWithDetails = checkGrammarWithDetails; 