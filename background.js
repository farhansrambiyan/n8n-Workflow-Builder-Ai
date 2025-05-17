// On extension install or update, check user preference
chrome.runtime.onInstalled.addListener(() => {
  updateExtensionBehavior();
});

// Also check at startup
chrome.runtime.onStartup.addListener(() => {
  updateExtensionBehavior();
});

// Update extension behavior based on user preference
function updateExtensionBehavior() {
  chrome.storage.local.get(['displayMode'], (data) => {
    if (data.displayMode === 'sidepanel') {
      // If user prefers side panel, disable popup
      chrome.action.setPopup({ popup: '' });
      // Set side panel to open on action click
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } else {
      // If user prefers popup or has no preference, use default popup
      chrome.action.setPopup({ popup: 'popup.html' });
      // Don't open side panel on action click
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    }
  });
}

// Listen for storage changes to update behavior immediately
chrome.storage.onChanged.addListener((changes) => {
  if (changes.displayMode) {
    updateExtensionBehavior();
  }
  
  // Update badge when generation status changes
  if (changes.generationInProgress) {
    if (changes.generationInProgress.newValue === true) {
      chrome.action.setBadgeText({ text: '...' });
      chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
    } else {
      // Only clear badge if not showing success or error
      if (!changes.generationComplete) {
        chrome.action.setBadgeText({ text: '' });
      }
    }
  }
  
  // Handle generation completion separately
  if (changes.generationComplete && changes.generationComplete.newValue === true) {
    chrome.storage.local.get(['generatedJson', 'generationError'], (data) => {
      if (data.generatedJson && !data.generationError) {
        // Success indicator
        chrome.action.setBadgeText({ text: '✓' });
        chrome.action.setBadgeBackgroundColor({ color: '#22C55E' });
        
        // Clear badge after 3 seconds
        setTimeout(() => {
          chrome.action.setBadgeText({ text: '' });
        }, 3000);
      } else if (data.generationError) {
        // Error indicator
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
        
        // Clear badge after 5 seconds
        setTimeout(() => {
          chrome.action.setBadgeText({ text: '' });
        }, 5000);
      }
    });
  }
});

// Handle action click when popup is disabled
chrome.action.onClicked.addListener((tab) => {
  // This will only be triggered when popup is disabled (in side panel mode)
  chrome.sidePanel.open({ tabId: tab.id });
});

// Message handler for background processing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  // Add a new message handler for direct Claude API testing
  if (message.action === 'directClaudeTest') {
    console.log('Running direct Claude API test...');
    
    const exactKey = message.apiKey; // Use exactly as provided
    
    // First try the x-api-key method (recommended by Anthropic)
    fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': exactKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      }
    })
    .then(response => {
      console.log(`Direct Claude API test status: ${response.status}`);
      
      if (!response.ok) {
        return response.text().then(text => {
          console.log('Error response body:', text);
          throw new Error(`API Error (${response.status}): ${text || response.statusText || 'Unknown error'}`);
        });
      }
      
      return response.json();
    })
    .then(data => {
      console.log('Direct test successful! Models found:', data.models?.length || 0);
      
      if (data.models && data.models.length > 0) {
        // Store auth method preference
        chrome.storage.local.set({ claudeAuthMethod: 'x-api-key' });
        
        // Send success response
        sendResponse({
          success: true,
          message: 'API key verified successfully with x-api-key method',
          models: data.models.map(m => m.id),
          authMethod: 'x-api-key'
        });
      } else {
        throw new Error('No models found in response');
      }
    })
    .catch(error => {
      console.error('Direct test error:', error);
      
      // Try Bearer token method as fallback
      fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${exactKey}`,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        }
      })
      .then(response => {
        console.log(`Direct Bearer test status: ${response.status}`);
        
        if (!response.ok) {
          return response.text().then(text => {
            console.log('Bearer error response body:', text);
            throw new Error(`API Error (${response.status}): ${text || response.statusText || 'Unknown error'}`);
          });
        }
        
        return response.json();
      })
      .then(data => {
        console.log('Bearer method successful! Models found:', data.models?.length || 0);
        
        if (data.models && data.models.length > 0) {
          // Store auth method preference
          chrome.storage.local.set({ claudeAuthMethod: 'bearer' });
          
          // Send success response
          sendResponse({
            success: true,
            message: 'API key verified successfully with Bearer method',
            models: data.models.map(m => m.id),
            authMethod: 'bearer'
          });
        } else {
          throw new Error('No models found in Bearer response');
        }
      })
      .catch(bearerError => {
        console.error('Bearer method failed:', bearerError);
        
        // Both methods failed
        sendResponse({
          success: false,
          message: `Both authentication methods failed. First error: ${error.message}, Bearer error: ${bearerError.message}`,
          error: error.message,
          bearerError: bearerError.message
        });
      });
    });
    
    return true; // Important: keeps the message channel open for async response
  }
  
  // Handle background generation request
  if (message.action === 'startBackgroundGeneration') {
    // Set generation in progress flag
    chrome.storage.local.set({ generationInProgress: true });
    
    const { providerId, apiKey, model, userPrompt, systemPrompt } = message;
    
    // Store prompt information regardless of success
    chrome.storage.local.set({ 
      currentPrompt: userPrompt
    });

    // *** IMPORTANT: Send response immediately to avoid the message channel closing timeout ***
    sendResponse({ success: true, message: 'Generation started in background' });
    
    // Special handling for Claude to ensure consistency with direct test
    if (providerId === 'claude') {
      // Use the exact same API handling that worked in the direct test
      console.log('Starting Claude generation with consistent authentication');
      
      // Get the successful authentication method
      chrome.storage.local.get(['claudeAuthMethod'], (data) => {
        const authMethod = data.claudeAuthMethod || 'x-api-key'; // Default to x-api-key if not set
        console.log('Using auth method from direct test:', authMethod);
        
        // Clean API key to be exactly as provided
        const exactKey = apiKey;
        const timeoutDuration = 120000; // 2 minutes
        
        // Prepare headers using the same method that worked in direct test
        const headers = {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        };
        
        if (authMethod === 'x-api-key') {
          headers['x-api-key'] = exactKey;
        } else {
          headers['Authorization'] = `Bearer ${exactKey}`;
        }
        
        // Add debug log before making API request in the Claude special handling section
        console.log('Claude generation request to:', 'https://api.anthropic.com/v1/messages');
        console.log('Claude generation headers:', headers);
        console.log('Claude generation model:', model);
        
        // Prepare request body
        const body = JSON.stringify({
          model: model,
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: systemPrompt + "\n\n===USER REQUEST===\n" + userPrompt + "\n\nRemember: Return ONLY valid JSON without any markdown code blocks or formatting."
            }
          ],
          temperature: 0.2
        });
        
        // Set up better timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.log('Claude request aborted due to timeout');
        }, timeoutDuration);
        
        // Set up status update interval for long-running requests
        const startTime = Date.now();
        const statusUpdateInterval = setInterval(() => {
          console.log('Claude generation still in progress...');
          chrome.storage.local.set({ 
            generationStatus: `Still waiting for Claude API response... (${Math.floor((Date.now() - startTime)/1000)}s elapsed)`
          });
        }, 10000);
        
        // Set a maximum overall timeout for the generation process
        const maxGenerationTime = 180000; // 3 minutes maximum for all providers
        const generationTimeoutId = setTimeout(() => {
          console.error('Maximum generation time exceeded, aborting...');
          clearInterval(statusUpdateInterval);
          chrome.storage.local.set({
            generationError: 'Generation timed out after 3 minutes. The Claude API might be overloaded.',
            generationComplete: true,
            generationInProgress: false
          });
          
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Generation Timeout',
            message: 'Generation with Claude timed out after 3 minutes. Please try again later.'
          });
        }, maxGenerationTime);
        
        // Create a function wrapper for retry logic
        const makeClaudeRequest = () => {
          return fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: headers,
            body: body,
            signal: controller.signal
          })
          .then(response => {
            console.log('Claude generation response status:', response.status);
            
            if (!response.ok) {
              return response.text().then(text => {
                try {
                  const errorData = JSON.parse(text);
                  if (errorData.error && errorData.error.toLowerCase().includes('overloaded')) {
                    throw new Error('Overloaded');
                  }
                  throw new Error(`Claude API Error: ${errorData.error?.message || errorData.error || `Status ${response.status}`}`);
                } catch (e) {
                  if (e.message === 'Overloaded') {
                    throw e; // Rethrow overloaded error for retry
                  }
                  if (e instanceof SyntaxError) {
                    // Not JSON, just use the text
                    if (text.toLowerCase().includes('overloaded')) {
                      throw new Error('Overloaded');
                    }
                    throw new Error(`Claude API Error (${response.status}): ${text || response.statusText || 'Unknown error'}`);
                  }
                  throw e; // Re-throw if it's our custom error
                }
              });
            }
            
            return response.json();
          })
          .catch(error => {
            // Handle AbortController timeout
            if (error.name === 'AbortError') {
              throw new Error(`Claude API request timed out after ${timeoutDuration/1000} seconds. The service might be overloaded.`);
            }
            
            throw error; // Re-throw other errors
          });
        };
        
        // Use the retry logic with our Claude API request
        retryWithExponentialBackoff(makeClaudeRequest, 3)
        .then(data => {
          clearTimeout(timeoutId);
          clearTimeout(generationTimeoutId);
          clearInterval(statusUpdateInterval);
          
          console.log('Claude generation response keys:', Object.keys(data));
          
          // Extract content from the response
          if (data.content && Array.isArray(data.content)) {
            // Extract text from content blocks
            const textBlocks = data.content.filter(block => block.type === 'text');
            if (textBlocks.length > 0) {
              const generatedText = textBlocks.map(block => block.text).join('\n').trim();
              
              // Store the successful result
              chrome.storage.local.set({
                generatedJson: generatedText,
                generationError: null,
                generationComplete: true,
                generationInProgress: false
              });
              
              // Save to history
              saveToHistory(userPrompt, generatedText, providerId);
              
              // Show success notification
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'n8n Workflow Builder AI',
                message: 'Claude generation complete!'
              });
              
              return;
            }
          }
          
          throw new Error('Unexpected response format from Claude API');
        })
        .catch(error => {
          clearTimeout(timeoutId);
          clearTimeout(generationTimeoutId);
          clearInterval(statusUpdateInterval);
          
          console.error('Claude generation error:', error);
          
          // Store the error
          chrome.storage.local.set({
            generationError: error.message,
            generationComplete: true,
            generationInProgress: false
          });
          
          // Show error notification
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Generation Error',
            message: error.message.substring(0, 100) + (error.message.length > 100 ? '...' : '')
          });
        });

        // No need to use sendResponse here as we've already responded earlier
      });
      
      return false; // Return false since we already sent the response
    }
    
    // Only reach this code for non-Claude providers
    // Get provider configuration for other providers
    let providerConfig = getProviderConfig(providerId);
    
    if (!providerConfig) {
      // We've already sent the response at the beginning
      chrome.storage.local.set({ 
        generationInProgress: false,
        generationError: 'Invalid provider',
        generationComplete: true
      });
      return false;
    }
    
    // Prepare API request details
    const { url, headers, body } = providerConfig.getApiDetails(apiKey, model, systemPrompt, userPrompt);
    
    // Call the API with appropriate timeout based on provider
    const timeoutDuration = providerId === 'grok' ? 300000 : 120000; // 5 minutes for x.ai, 2 minutes for others
    console.log(`Using timeout of ${timeoutDuration/1000} seconds for ${providerId}`);
    
    // Add CORS header to Claude API calls
    const finalHeaders = providerId === 'claude' ? 
      { ...headers, 'anthropic-dangerous-direct-browser-access': 'true' } : 
      headers;
    
    // Debug log for Claude API calls
    if (providerId === 'claude') {
      console.log('Claude API (main path) headers:', finalHeaders);
      console.log('CORS header present:', finalHeaders['anthropic-dangerous-direct-browser-access'] === 'true');
    }
    
    // Set up better timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.log(`${providerId} request aborted due to timeout`);
    }, timeoutDuration);

    // Set up status update interval for long-running requests
    const startTime = Date.now();
    const statusUpdateInterval = setInterval(() => {
      console.log(`${providerId} generation still in progress...`);
      chrome.storage.local.set({ 
        generationStatus: `Still waiting for ${providerConfig.label} response... (${Math.floor((Date.now() - startTime)/1000)}s elapsed)`
      });
    }, 10000);

    // Set a maximum overall timeout for the generation process
    const maxGenerationTime = 180000; // 3 minutes maximum for all providers
    const generationTimeoutId = setTimeout(() => {
      console.error('Maximum generation time exceeded, aborting...');
      clearInterval(statusUpdateInterval);
      chrome.storage.local.set({
        generationError: `Generation timed out after 3 minutes. The ${providerConfig.label} API might be overloaded.`,
        generationComplete: true,
        generationInProgress: false
      });
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Generation Timeout',
        message: `Generation with ${providerConfig.label} timed out after 3 minutes. Please try again later.`
      });
    }, maxGenerationTime);
    
    fetch(url, { 
      method: 'POST', 
      headers: finalHeaders, 
      body,
      signal: controller.signal
    })
    .then(response => {
      clearTimeout(timeoutId);
      clearInterval(statusUpdateInterval);
      
      if (!response.ok) {
        return response.json().then(errorData => {
          // Special handling for Claude API errors
          if (providerId === 'claude') {
            console.error('Claude API error:', response.status);
            
            // Check if the error is related to CORS header
            if (errorData.error && (
              errorData.error.includes('CORS') || 
              errorData.error.includes('anthropic-dangerous-direct-browser-access')
            )) {
              throw new Error(`CORS Error: Claude API requires the 'anthropic-dangerous-direct-browser-access' header. Please try again.`);
            }
            
            throw new Error(`Claude API Error: ${errorData.error || `Status ${response.status}`}`);
          }
          
          // Special handling for x.ai API errors
          if (providerId === 'grok') {
            console.error('x.ai API error details:', errorData);
            // Add more details to the error message
            throw new Error(`x.ai API Error: ${errorData.error?.message || errorData.message || errorData.error || `API Error (${response.status})`}`);
          }
          throw new Error(errorData.error?.message || errorData.message || errorData.error || `API Error (${response.status})`);
        }).catch(e => {
          // If we can't parse the error JSON or we get a structured error object
          if (e.error && typeof e.error === 'object' && e.error.message) {
            throw new Error(e.error.message);
          }
          
          if (providerId === 'claude') {
            // Check if the error message contains CORS related text
            if (e.message && (
              e.message.includes('CORS') || 
              e.message.includes('anthropic-dangerous-direct-browser-access')
            )) {
              throw new Error(`CORS Error: Claude API requires the 'anthropic-dangerous-direct-browser-access' header. Please try again.`);
            }
            
            throw new Error(`Claude API Error: ${e.message || response.statusText || 'Unknown error'}`);
          } else if (providerId === 'grok') {
            throw new Error(`x.ai API Error (${response.status}): ${response.statusText}`);
          }
          throw new Error(`API Error (${response.status}): ${response.statusText}`);
        });
      }
      return response.json();
    })
    .then(data => {
      // Log the response structure for x.ai
      if (providerId === 'grok') {
        console.log('x.ai API response keys:', Object.keys(data));
        // Safely log response structure without revealing content
        if (data.choices) {
          console.log('x.ai response contains choices:', data.choices.length);
        } else {
          console.warn('x.ai response has no choices array:', data);
        }
      }
      
      const generatedJson = providerConfig.parseResponse(data);
      
      if (!generatedJson) {
        throw new Error(`No content generated by ${providerConfig.label}`);
      }
      
      // Check if the response is actually JSON
      try {
        let cleanedJson = generatedJson;
        
        // Remove markdown code blocks if present
        if (cleanedJson.includes('```json') || cleanedJson.includes('```')) {
          cleanedJson = cleanedJson.replace(/^```(?:json)?\s*/i, '');
          cleanedJson = cleanedJson.replace(/\s*```$/i, '');
        }
        
        // Special handling for Mistral responses
        if (providerId === 'mistral') {
          // For Mistral, just use the cleaned response without strict JSON validation
          // Attempt to fix common JSON issues with Mistral responses
          try {
            // Try to parse and fix, but if it fails, just use the cleaned text
            const jsonObj = JSON.parse(cleanedJson);
            cleanedJson = JSON.stringify(jsonObj, null, 2);
          } catch (parseError) {
            console.warn('Could not parse Mistral JSON response, using as-is:', parseError);
            // Continue with the cleaned text without validation
          }
          
          // Store the result without strict validation for Mistral
          chrome.storage.local.set({ 
            generatedJson: cleanedJson,
            generationError: null,
            generationComplete: true,
            generationInProgress: false
          });
          
          // Save to history
          saveToHistory(userPrompt, cleanedJson, providerId);
          
          // Show notification
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'n8n Workflow Builder AI',
            message: 'JSON generation complete!'
          });
          
          return; // Exit early for Mistral
        }
        
        // Special handling for Claude responses
        if (providerId === 'claude') {
          console.log('Processing Claude response');
          
          try {
            // Remove markdown code blocks if present
            if (cleanedJson.includes('```')) {
              cleanedJson = cleanedJson.replace(/```(?:json)?/g, '').trim();
            }
            
            // Try to parse and format
            const jsonObj = JSON.parse(cleanedJson);
            cleanedJson = JSON.stringify(jsonObj, null, 2);
          } catch (parseError) {
            console.warn('Could not parse Claude JSON response, using as-is');
          }
          
          // Store the result without additional validation
          chrome.storage.local.set({ 
            generatedJson: cleanedJson,
            generationError: null,
            generationComplete: true,
            generationInProgress: false
          });
          
          // Save to history
          saveToHistory(userPrompt, cleanedJson, providerId);
          
          // Show notification
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'n8n Workflow Builder AI',
            message: 'JSON generation complete!'
          });
          
          return; // Exit early
        }
        
        // Special handling for x.ai/Grok responses - similar to Mistral
        if (providerId === 'grok') {
          // For x.ai, do more thorough JSON processing
          try {
            // Log the original content for debugging
            console.log('Original x.ai response length:', cleanedJson.length);
            
            // Additional cleanup for x.ai responses
            cleanedJson = cleanXaiJsonResponse(cleanedJson);
            
            // Try to parse and fix, but if it fails, just use the cleaned text
            try {
              const jsonObj = JSON.parse(cleanedJson);
              cleanedJson = JSON.stringify(jsonObj, null, 2);
              console.log('Successfully parsed x.ai JSON response');
            } catch (parseError) {
              console.warn('Could not parse x.ai/Grok JSON response, using cleaned text:', parseError);
              // Continue with the cleaned text without strict validation
            }
          } catch (cleanupError) {
            console.error('Error during x.ai response cleanup:', cleanupError);
            // Continue with the original response if cleanup fails
          }
          
          console.log('Storing x.ai/Grok response without strict validation');
          
          // Store the result without strict validation for x.ai
          chrome.storage.local.set({ 
            generatedJson: cleanedJson,
            generationError: null,
            generationComplete: true,
            generationInProgress: false
          });
          
          // Add debugging to check if storage completed successfully
          console.log('x.ai generation saved to storage, completion flag set to true');
          
          // Save to history
          saveToHistory(userPrompt, cleanedJson, providerId);
          
          // Show notification
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'n8n Workflow Builder AI',
            message: 'JSON generation complete!'
          });
          
          return; // Exit early for x.ai/Grok
        }
        
        // For other providers, continue with strict JSON validation
        // Parse and format the JSON to ensure validity
        const formattedJson = JSON.stringify(JSON.parse(cleanedJson), null, 2);
        
        // Store the result
        chrome.storage.local.set({ 
          generatedJson: formattedJson,
          generationError: null,
          generationComplete: true,
          generationInProgress: false
        });
        
        // Save to history
        saveToHistory(userPrompt, formattedJson, providerId);
        
        // Show notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'n8n Workflow Builder AI',
          message: 'JSON generation complete!'
        });
        
        // Badge updates are now handled by the storage change listener
      } catch (e) {
        throw new Error(`Invalid JSON response: ${e.message}`);
      }
    })
    .catch(error => {
      clearTimeout(timeoutId);
      clearTimeout(generationTimeoutId);
      clearInterval(statusUpdateInterval);
      
      console.error('Generation error:', error);
      
      // Handle timeout errors specifically
      let errorMessage = error.message;
      if (error.name === 'AbortError') {
        console.error('Request timed out:', error);
        errorMessage = `The request timed out after ${timeoutDuration/1000} seconds. The service might be overloaded.`;
      }
      
      // Special handling for overloaded errors
      else if (error.message && error.message.toLowerCase().includes('overloaded')) {
        console.error('API overloaded:', error);
        errorMessage = `The AI service is currently overloaded with requests. Please wait a few minutes and try again later.`;
      }
      
      // Special handling for x.ai errors
      else if (providerId === 'grok') {
        console.error('x.ai/Grok error details:', error);
        
        // Check for common x.ai error patterns
        if (error.message.includes('Invalid API Key')) {
          errorMessage = 'Invalid x.ai API Key: Please make sure your key starts with "xai-" and is complete. ' +
            'Note that Grok 3/x.ai is a paid service - verify your account has active subscription or sufficient credits.';
        } else if (error.message.includes('not found') || error.message.includes('404')) {
          errorMessage = 'x.ai API Error: The model or endpoint was not found. Try using "grok-3-latest" as the model.';
        } else if (error.message.includes('Rate limit')) {
          errorMessage = 'x.ai API Rate Limit: Your account has exceeded its request quota. Please try again later.';
        } else if (error.message.includes('missing choices')) {
          errorMessage = 'x.ai API Error: Response format issue. Please verify your account status and API key validity.';
        } else if (error.message.includes('missing content')) {
          errorMessage = 'x.ai API Error: Response content issue. Please verify your API key has proper access to the model.';
        } else if (error.message.includes('context length')) {
          errorMessage = 'x.ai API Error: The workflow is too large for x.ai to handle. Try simplifying your prompt or use a different provider.';
        }
        
        // Log additional diagnostic info
        console.error('x.ai error handled as:', errorMessage);
      }
      
      // Store the error
      chrome.storage.local.set({ 
        generationError: errorMessage,
        generationComplete: true,
        generationInProgress: false
      });
      
      // Show error notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Generation Error',
        message: errorMessage.substring(0, 100) + (errorMessage.length > 100 ? '...' : '')
      });
      
      // Badge updates are now handled by the storage change listener
    });
    
    return false; // Return false since we already sent the response
  }
  
  // Handle clear data request
  if (message.action === 'clearGenerationData') {
    chrome.storage.local.set({ 
      currentPrompt: '',
      generatedJson: '',
      generationError: null,
      generationComplete: false,
      generationInProgress: false
    });
    sendResponse({ success: true });
    return true;
  }
});

// Helper function to get provider configuration
function getProviderConfig(providerId) {
  const PROVIDER_CONFIG = {
    openai: {
      label: "OpenAI (GPT)",
      getApiDetails: (apiKey, model, systemPrompt, userPrompt) => ({ 
        url: 'https://api.openai.com/v1/chat/completions', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${apiKey}` 
        }, 
        body: JSON.stringify({ 
          model: model, 
          messages: [
            { role: 'system', content: systemPrompt }, 
            { role: 'user', content: userPrompt }
          ], 
          temperature: 0.3
        }) 
      }),
      parseResponse: (data) => data.choices?.[0]?.message?.content?.trim()
    },
    gemini: {
      label: "Google Gemini",
      getApiDetails: (apiKey, model, systemPrompt, userPrompt) => ({ 
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, 
        headers: { 
          'Content-Type': 'application/json' 
        }, 
        body: JSON.stringify({ 
          contents: [
            { 
              role: "user", 
              parts: [{ text: systemPrompt + "\n\n===USER REQUEST===\n" + userPrompt + "\n\nRemember: Return ONLY valid JSON without any markdown code blocks or formatting." }] 
            }
          ],
          generationConfig: {
            temperature: 0.3
          }
        }) 
      }),
      parseResponse: (data) => {
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!textResponse) return null;
        // Additional safety for Gemini: try to extract JSON if wrapped in backticks
        if (textResponse.includes('```')) {
          const match = textResponse.match(/```(?:json)?([\s\S]*?)```/);
          return match ? match[1].trim() : textResponse;
        }
        return textResponse;
      }
    },
    mistral: {
      label: "Mistral AI",
      getApiDetails: (apiKey, model, systemPrompt, userPrompt) => ({ 
        url: 'https://api.mistral.ai/v1/chat/completions', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${apiKey}` 
        }, 
        body: JSON.stringify({ 
          model: model, 
          messages: [
            { role: 'system', content: systemPrompt }, 
            { role: 'user', content: userPrompt }
          ], 
          temperature: 0.3
        }) 
      }),
      parseResponse: (data) => data.choices?.[0]?.message?.content?.trim()
    },
    claude: {
      label: "Anthropic (Claude)",
      getApiDetails: (apiKey, model, systemPrompt, userPrompt) => {
        // Clean API key
        const cleanedApiKey = apiKey.trim();
        
        // Updated to use the correct endpoint and headers per Anthropic documentation
        return {
          url: 'https://api.anthropic.com/v1/messages',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': cleanedApiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 4096,
            messages: [
              {
                role: 'user',
                content: systemPrompt + "\n\n===USER REQUEST===\n" + userPrompt + "\n\nRemember: Return ONLY valid JSON without any markdown code blocks or formatting."
              }
            ],
            temperature: 0.2
          })
        };
      },
      parseResponse: (data) => {
        console.log('Claude API response type:', typeof data);
        console.log('Claude API response keys:', Object.keys(data));
        
        // Handle error if present
        if (data.error) {
          throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
        }
        
        // Updated to match the new Messages API response format
        if (data.content && Array.isArray(data.content)) {
          // Extract text from content blocks
          const textBlocks = data.content.filter(block => block.type === 'text');
          if (textBlocks.length > 0) {
            return textBlocks.map(block => block.text).join('\n').trim();
          }
        }
        
        // Fallbacks for older API versions
        if (data.completion) {
          return data.completion.trim();
        }
        
        throw new Error('Unexpected response format from Claude API');
      }
    },
    openrouter: {
      label: "OpenRouter",
      getApiDetails: (apiKey, model, systemPrompt, userPrompt) => ({ 
        url: 'https://openrouter.ai/api/v1/chat/completions', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${apiKey}`, 
          'HTTP-Referer': "https://github.com/farhansrambiyan/n8n-Workflow-Builder-Ai", 
          'X-Title': "n8n Workflow Builder Ai (Beta)" 
        }, 
        body: JSON.stringify({ 
          model: model, 
          messages: [
            { role: 'system', content: systemPrompt }, 
            { role: 'user', content: userPrompt }
          ], 
          temperature: 0.3
        }) 
      }),
      parseResponse: (data) => data.choices?.[0]?.message?.content?.trim()
    },
    grok: {
      label: "Grok (x.ai)",
      getApiDetails: (apiKey, model, systemPrompt, userPrompt) => {
        // Ensure API key is properly formatted (trim any whitespace)
        const cleanedApiKey = apiKey.trim();
        
        // Log key details for debugging
        console.log('Using x.ai formatted API key');
        console.log('x.ai API key length:', cleanedApiKey.length);
        
        // Log first and last few characters for verification (safe to log)
        console.log('Key format:', `${cleanedApiKey.substring(0, 6)}...${cleanedApiKey.substring(cleanedApiKey.length - 4)}`);
        
        // Prepare headers - EXACT FORMAT from documentation
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanedApiKey}`
        };
        
        // Use x.ai API endpoint for chat completions
        const apiUrl = 'https://api.x.ai/v1/chat/completions';
        
        console.log('Using API endpoint:', apiUrl);
        
        // Enhance the user prompt with specific JSON formatting instructions for x.ai
        const enhancedUserPrompt = `${userPrompt}

CRITICAL JSON FORMATTING INSTRUCTIONS:
1. The output MUST be a valid JSON object with NO additional text, markdown, or explanations
2. Do NOT wrap the JSON in code blocks or backticks, return the raw JSON directly
3. Make sure each opening bracket has a closing bracket, especially with nested objects
4. Ensure all quotes are properly escaped within strings
5. Make sure there are no trailing commas in arrays or objects
6. Validate your output is well-formed JSON before responding`;
        
        // Prepare request body for chat completions
        const requestBody = {
          messages: [
            { 
              role: 'system', 
              content: systemPrompt + "\n\nIt is EXTREMELY important that you return a fully valid, well-structured JSON object. Check your output carefully before responding." 
            }, 
            { 
              role: 'user', 
              content: enhancedUserPrompt 
            }
          ],
          model: model,
          stream: false,
          temperature: 0.1, // Lower temperature for more deterministic output
          max_tokens: 16000, // Max token limit for large workflows
          top_p: 0.1 // Lower for more deterministic JSON output
        };
        
        // Log the request (without sensitive data)
        console.log('Request to:', apiUrl);
        console.log('Model:', model);
        console.log('Headers:', Object.keys(headers));
        
        return { 
          url: apiUrl, 
          headers: headers, 
          body: JSON.stringify(requestBody) 
        };
      },
      parseResponse: (data) => {
        // Enhanced error checking for x.ai
        console.log('x.ai response structure:', Object.keys(data));
        
        // Check for error in response
        if (data.error) {
          console.error('x.ai error detected:', data.error);
          throw new Error(`x.ai API Error: ${data.error?.message || data.error}`);
        }
        
        // Check for choices array
        if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
          console.error('x.ai response missing choices array or empty choices:', data);
          throw new Error('Invalid x.ai response format: missing choices array');
        }
        
        // Get the content from the standard OpenAI-like format
        const content = data.choices[0]?.message?.content;
        if (!content) {
          console.error('x.ai response missing content in expected location:', data.choices[0]);
          throw new Error('Invalid x.ai response format: missing content');
        }
        
        // Check if content is very short or potentially incomplete
        if (content.trim().length < 50) {
          console.warn('x.ai response content is suspiciously short:', content);
          // We don't throw here but log it as a warning
        }
        
        // Log finishing reason for debugging
        if (data.choices[0].finish_reason) {
          console.log('x.ai finish reason:', data.choices[0].finish_reason);
          
          // If it stopped because it hit the token limit, warn about potential truncation
          if (data.choices[0].finish_reason === 'length') {
            console.warn('x.ai response was truncated due to token limit');
          }
        }
        
        return content.trim();
      }
    },
    groq: {
      label: "Groq",
      getApiDetails: (apiKey, model, systemPrompt, userPrompt) => {
        // Ensure API key is properly formatted (trim any whitespace)
        const cleanedApiKey = apiKey.trim();
        
        // Prepare headers
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanedApiKey}`
        };
        
        // Use Groq API endpoint
        const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        
        console.log('Using Groq API endpoint:', apiUrl);
        
        // Prepare request body
        const requestBody = {
          messages: [
            { 
              role: 'system', 
              content: systemPrompt 
            }, 
            { 
              role: 'user', 
              content: userPrompt 
            }
          ],
          model: model,
          temperature: 0.3
        };
        
        // Log the request (without sensitive data)
        console.log('Request to:', apiUrl);
        console.log('Model:', model);
        console.log('Headers:', Object.keys(headers));
        
        return { 
          url: apiUrl, 
          headers: headers, 
          body: JSON.stringify(requestBody) 
        };
      },
      parseResponse: (data) => data.choices?.[0]?.message?.content?.trim()
    }
  };
  
  return PROVIDER_CONFIG[providerId];
}

// Helper function to save to history
function saveToHistory(promptText, jsonOutput, provider) {
  chrome.storage.local.get(['generationHistory'], (data) => {
    let history = data.generationHistory || [];
    
    // Add new item at the beginning of the array
    history.unshift({
      id: Date.now(), // Use timestamp as ID
      prompt: promptText,
      json: jsonOutput,
      provider: provider,
      timestamp: new Date().toISOString()
    });
    
    // Limit history to 20 items
    if (history.length > 20) {
      history = history.slice(0, 20);
    }
    
    chrome.storage.local.set({ generationHistory: history });
  });
}

// Helper function to clean up x.ai JSON responses
function cleanXaiJsonResponse(response) {
  // Log the start and end of the response
  if (response.length > 200) {
    console.log('Response start:', response.substring(0, 100));
    console.log('Response end:', response.substring(response.length - 100));
  }
  
  // Remove any text before the first opening brace
  let cleaned = response;
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace > 0) {
    console.log('Removing content before first brace:', cleaned.substring(0, firstBrace));
    cleaned = cleaned.substring(firstBrace);
  }
  
  // Remove any text after the last closing brace
  const lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace !== -1 && lastBrace < cleaned.length - 1) {
    console.log('Removing content after last brace:', cleaned.substring(lastBrace + 1));
    cleaned = cleaned.substring(0, lastBrace + 1);
  }
  
  // Remove markdown code blocks
  if (cleaned.includes('```')) {
    console.log('Removing markdown code blocks');
    cleaned = cleaned.replace(/```(?:json)?\s*/g, '').replace(/\s*```/g, '');
  }
  
  // Remove common explanatory text patterns
  const explanationPatterns = [
    /^Here's the JSON for your workflow:[\s\n]*/i,
    /^Here is the JSON:[\s\n]*/i,
    /^Here's the n8n workflow JSON:[\s\n]*/i,
    /^The generated JSON:[\s\n]*/i,
    /[\s\n]*This JSON can be imported into n8n\.[\s\n]*$/i,
    /[\s\n]*You can import this JSON into n8n\.[\s\n]*$/i
  ];
  
  for (const pattern of explanationPatterns) {
    if (pattern.test(cleaned)) {
      console.log('Removing explanatory text matching pattern:', pattern);
      cleaned = cleaned.replace(pattern, '');
    }
  }
  
  return cleaned.trim();
}

// Add a retry helper function at the end of the file
function retryWithExponentialBackoff(fetchFn, maxRetries = 3) {
  return new Promise(async (resolve, reject) => {
    let retryCount = 0;
    let lastError = null;

    while (retryCount < maxRetries) {
      try {
        // Wait with exponential backoff before retrying
        if (retryCount > 0) {
          const delayMs = Math.min(2000 * Math.pow(2, retryCount - 1), 10000);
          console.log(`Retry ${retryCount}/${maxRetries} for Claude API request after ${delayMs}ms delay...`);
          await new Promise(r => setTimeout(r, delayMs));
        }

        const response = await fetchFn();
        return resolve(response);
      } catch (error) {
        lastError = error;
        
        // Only retry on "Overloaded" errors
        if (error.message && error.message.includes('Overloaded')) {
          console.log(`Claude API overloaded, will retry (${retryCount + 1}/${maxRetries})`);
          retryCount++;
        } else {
          // Don't retry on other errors
          return reject(error);
        }
      }
    }

    // If we've exhausted retries, reject with the last error
    reject(new Error(`Claude API still overloaded after ${maxRetries} retries. Please try again later.`));
  });
} 
