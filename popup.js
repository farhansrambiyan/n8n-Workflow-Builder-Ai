document.addEventListener('DOMContentLoaded', () => {
    // Remove the style element that was overriding hint-text color
    
    // --- Element References (Same as before) ---
    const mainAiProviderSelect = document.getElementById('aiProvider');
    const promptTextarea = document.getElementById('prompt');
    const generateBtn = document.getElementById('generateBtn');
    const clearBtn = document.getElementById('clearBtn');
    const outputTextarea = document.getElementById('output');
    const copyJsonBtn = document.getElementById('copyJsonBtn');
    const statusMessage = document.getElementById('status');
    const copyMessage = document.getElementById('copy-message');
    const outputGroup = document.querySelector('.output-group');
    const noProviderEnabledMessage = document.getElementById('no-provider-enabled-message');
    const settingsStatusMessage = document.getElementById('settings-status');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const displayModeSelect = document.getElementById('displayMode');
    const historyItemsContainer = document.getElementById('history-items-container');
    const noHistoryMessage = document.getElementById('no-history-message');

    // Add a generation indicator element
    const generateSection = document.querySelector('#generate');
    const generationIndicator = document.createElement('div');
    generationIndicator.className = 'generation-background-indicator';
    generationIndicator.innerHTML = '<span class="status-text">Generation is running in the background...</span>';

    // Add a cancel button to the generation indicator
    const cancelGenerationBtn = document.createElement('button');
    cancelGenerationBtn.textContent = 'Cancel';
    cancelGenerationBtn.className = 'cancel-generation-btn';
    cancelGenerationBtn.style.marginLeft = '15px';
    cancelGenerationBtn.style.padding = '5px 10px';
    cancelGenerationBtn.style.backgroundColor = '#b71c1c';
    cancelGenerationBtn.style.color = 'white';
    cancelGenerationBtn.style.border = 'none';
    cancelGenerationBtn.style.borderRadius = '4px';
    cancelGenerationBtn.style.cursor = 'pointer';
    cancelGenerationBtn.addEventListener('click', cancelGeneration);
    generationIndicator.appendChild(cancelGenerationBtn);

    generateSection.appendChild(generationIndicator);

    // Check if we're in a side panel
    const isInSidePanel = chrome.sidePanel !== undefined && window.innerWidth < 600;
    
    // Apply side panel class to body if needed
    if (isInSidePanel) {
        document.body.classList.add('in-side-panel');
    }

    // --- Provider Configuration ---
    const PROVIDER_CONFIG = {
        openai: {
            label: "OpenAI (GPT)", apiKeyInput: document.getElementById('openaiKey'), modelSelect: document.getElementById('openaiModelSelect'),
            toggleInput: document.querySelector('.provider-toggle[data-provider-id="openai"]'), detailsContainer: document.querySelector('.settings-provider-container[data-provider-id="openai"]'),
            fetchModelsFn: fetchOpenAIModels, defaultModelIdSuggestion: 'gpt-4o-mini',
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
            label: "Google Gemini", apiKeyInput: document.getElementById('geminiKey'), modelSelect: document.getElementById('geminiModelSelect'),
            toggleInput: document.querySelector('.provider-toggle[data-provider-id="gemini"]'), detailsContainer: document.querySelector('.settings-provider-container[data-provider-id="gemini"]'),
            fetchModelsFn: fetchGeminiModels, defaultModelIdSuggestion: 'gemini-1.5-flash-latest',
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
            label: "Mistral AI", apiKeyInput: document.getElementById('mistralApiKey'), modelSelect: document.getElementById('mistralModelSelect'),
            toggleInput: document.querySelector('.provider-toggle[data-provider-id="mistral"]'), detailsContainer: document.querySelector('.settings-provider-container[data-provider-id="mistral"]'),
            fetchModelsFn: fetchMistralModels, defaultModelIdSuggestion: 'mistral-small-latest',
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
                    temperature: 0.2
                }) 
            }),
            parseResponse: (data) => data.choices?.[0]?.message?.content?.trim()
        },
        claude: {
            label: "Anthropic (Claude)", apiKeyInput: document.getElementById('claudeApiKey'), modelSelect: document.getElementById('claudeModelSelect'),
            toggleInput: document.querySelector('.provider-toggle[data-provider-id="claude"]'), detailsContainer: document.querySelector('.settings-provider-container[data-provider-id="claude"]'),
            fetchModelsFn: fetchClaudeModels, defaultModelIdSuggestion: 'claude-3-5-sonnet-20240620',
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
            label: "OpenRouter", apiKeyInput: document.getElementById('openrouterApiKey'), modelSelect: document.getElementById('openrouterModelSelect'),
            toggleInput: document.querySelector('.provider-toggle[data-provider-id="openrouter"]'), detailsContainer: document.querySelector('.settings-provider-container[data-provider-id="openrouter"]'),
            fetchModelsFn: fetchOpenRouterModels, defaultModelIdSuggestion: 'mistralai/mistral-7b-instruct',
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
            label: "Grok (x.ai)", apiKeyInput: document.getElementById('groqApiKey'), modelSelect: document.getElementById('groqModelSelect'),
            toggleInput: document.querySelector('.provider-toggle[data-provider-id="groq"]'), detailsContainer: document.querySelector('.settings-provider-container[data-provider-id="groq"]'),
            fetchModelsFn: fetchGrokModels, defaultModelIdSuggestion: 'grok-3-latest',
            getApiDetails: (apiKey, model, systemPrompt, userPrompt) => ({ 
                url: 'https://api.x.ai/v1/chat/completions', 
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
                    temperature: 0.3,
                    stream: false
                }) 
            }),
            parseResponse: (data) => data.choices?.[0]?.message?.content?.trim()
        },
        groq: {
            label: "Groq", apiKeyInput: document.getElementById('realGroqApiKey'), modelSelect: document.getElementById('realGroqModelSelect'),
            toggleInput: document.querySelector('.provider-toggle[data-provider-id="realgroq"]'), detailsContainer: document.querySelector('.settings-provider-container[data-provider-id="realgroq"]'),
            fetchModelsFn: fetchRealGroqModels, defaultModelIdSuggestion: 'llama3-70b-8192',
            getApiDetails: (apiKey, model, systemPrompt, userPrompt) => ({ 
                url: 'https://api.groq.com/openai/v1/chat/completions', 
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
        }
    };

    // --- System Prompt (Ensure this is your full, correct prompt) ---
    const SYSTEM_PROMPT = `Prompt Here`;

    // --- Initialize ---
    checkDisplayMode();
    loadAndApplySettings();
    setupEventListeners();
    checkBackgroundGeneration();

    // Check if we need to redirect based on display mode preference
    function checkDisplayMode() {
        chrome.storage.local.get(['displayMode'], (data) => {
            // If we're in a popup but preference is sidepanel, open in sidepanel
            if (!isInSidePanel && data.displayMode === 'sidepanel') {
                try {
                    chrome.sidePanel.open();
                } catch (e) {
                    console.error('Failed to open side panel:', e);
                    // If sidepanel fails to open, continue with popup
                }
            }
        });
    }

    // --- Settings Logic (Auto-Saving) ---
    function loadAndApplySettings() {
        const storageKeys = ['selectedAiProviderOnGenerateTab', 'displayMode', 'claudeAuthMethod'];
        for (const id in PROVIDER_CONFIG) {
            storageKeys.push(`${id}ApiKey`, `${id}SelectedModel`, `${id}IsEnabled`);
        }

        chrome.storage.local.get(storageKeys, (data) => {
            for (const id in PROVIDER_CONFIG) {
                const config = PROVIDER_CONFIG[id];
                const isEnabled = data[`${id}IsEnabled`] === undefined ? false : data[`${id}IsEnabled`];
                
                config.toggleInput.checked = isEnabled;
                config.detailsContainer.classList.toggle('active', isEnabled);

                if (data[`${id}ApiKey`]) {
                    config.apiKeyInput.value = data[`${id}ApiKey`];
                }
                
                if (isEnabled && config.apiKeyInput.value.trim()) {
                    config.fetchModelsFn(config.apiKeyInput.value.trim(), data[`${id}SelectedModel`]);
                } else if (isEnabled && !config.apiKeyInput.value.trim()) {
                    config.modelSelect.innerHTML = '<option value="" disabled selected>Enter API Key...</option>';
                    config.modelSelect.disabled = true;
                } else { 
                    config.modelSelect.innerHTML = '<option value="" disabled selected>Enable provider...</option>';
                    config.modelSelect.disabled = true;
                }
            }
            
            // Load display mode selection
            if (data.displayMode) {
                displayModeSelect.value = data.displayMode;
            }
            
            // Apply saved Claude auth method if available
            if (data.claudeAuthMethod) {
                updateClaudeAuthMethod(data.claudeAuthMethod);
                console.log('Applied saved Claude auth method:', data.claudeAuthMethod);
            }
            
            populateMainProviderDropdown(data);
            if (data.selectedAiProviderOnGenerateTab && mainAiProviderSelect.querySelector(`option[value="${data.selectedAiProviderOnGenerateTab}"]`)) {
                mainAiProviderSelect.value = data.selectedAiProviderOnGenerateTab;
            }
        });
    }
    
    let saveTimeout;
    function scheduleSaveSettings(showSavedMessage = true) {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            performSaveSettings(showSavedMessage);
        }, 750); 
    }

    function performSaveSettings(showSavedMessage = true) {
        const settingsToSave = { 
            selectedAiProviderOnGenerateTab: mainAiProviderSelect.value,
            displayMode: displayModeSelect.value 
        };
        
        for (const id in PROVIDER_CONFIG) {
            const config = PROVIDER_CONFIG[id];
            const isEnabled = config.toggleInput.checked;
            settingsToSave[`${id}IsEnabled`] = isEnabled;

            if (isEnabled) {
                const apiKey = config.apiKeyInput.value.trim();
                settingsToSave[`${id}ApiKey`] = apiKey;
                settingsToSave[`${id}SelectedModel`] = config.modelSelect.value;
            } else {
                settingsToSave[`${id}ApiKey`] = ""; 
                settingsToSave[`${id}SelectedModel`] = "";
            }
        }

        chrome.storage.local.set(settingsToSave, () => {
            if (showSavedMessage) {
                displayStatus('Settings auto-saved!', 'success', settingsStatusMessage);
            }
            populateMainProviderDropdown(settingsToSave);
        });
    }

    function populateMainProviderDropdown(currentSettings) {
        const previouslySelectedProviderInGenerateTab = currentSettings.selectedAiProviderOnGenerateTab || mainAiProviderSelect.value;
        mainAiProviderSelect.innerHTML = ''; 
        let enabledProvidersCount = 0;
        let firstEnabledProviderId = null;

        for (const id in PROVIDER_CONFIG) {
            if (currentSettings[`${id}IsEnabled`]) { 
                const option = document.createElement('option');
                option.value = id;
                option.textContent = PROVIDER_CONFIG[id].label;
                mainAiProviderSelect.appendChild(option);
                enabledProvidersCount++;
                if (!firstEnabledProviderId) firstEnabledProviderId = id;
            }
        }

        if (enabledProvidersCount === 0) {
            mainAiProviderSelect.innerHTML = '<option value="" disabled selected>No providers enabled</option>';
            mainAiProviderSelect.disabled = true;
            generateBtn.disabled = true;
            noProviderEnabledMessage.style.display = 'block';
        } else {
            mainAiProviderSelect.disabled = false;
            generateBtn.disabled = false;
            noProviderEnabledMessage.style.display = 'none';
            if (previouslySelectedProviderInGenerateTab && mainAiProviderSelect.querySelector(`option[value="${previouslySelectedProviderInGenerateTab}"]`)) {
                mainAiProviderSelect.value = previouslySelectedProviderInGenerateTab;
            } else if (firstEnabledProviderId) {
                mainAiProviderSelect.value = firstEnabledProviderId;
            }
        }
    }

    // --- Generic Model Fetching Helper ---
    async function fetchAndPopulateDynamicModels(apiKey, modelsUrl, authHeaderProvider, selectElement, modelParser, defaultModelIdSuggestion, previouslySelectedModel) {
        if (!apiKey) { 
            selectElement.innerHTML = '<option value="" disabled selected>Enter API Key...</option>'; 
            selectElement.disabled = true; 
            return; 
        }
        selectElement.disabled = true; 
        selectElement.innerHTML = '<option value="" disabled selected>Loading models...</option>';
        try {
            // Create headers object
            const headers = authHeaderProvider(apiKey);
            
            // Debug log for Mistral specifically (will only show in console)
            if (modelsUrl.includes('mistral.ai')) {
                console.log('Fetching Mistral models with API key format:', 
                    apiKey ? `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}` : 'empty');
            }
            
            const response = await fetch(modelsUrl, { 
                method: 'GET', 
                headers: headers
            });
            
            if (!response.ok) { 
                let errorMsg = `HTTP ${response.status}`; 
                try { 
                    const errorData = await response.json(); 
                    errorMsg = errorData.message || errorData.error?.message || errorData.error || errorMsg; 
                    
                    // Special handling for Mistral API to provide more context
                    if (modelsUrl.includes('mistral.ai')) {
                        console.error('Mistral API error details:', errorData);
                        if (response.status === 401) {
                            errorMsg = 'Unauthorized: Please check your Mistral API key is valid and correctly formatted (no extra spaces)';
                        }
                    }
                    
                    // Special handling for Groq API errors
                    if (modelsUrl.includes('api.groq.com')) {
                        console.error('Groq API error details:', errorData);
                        if (response.status === 401) {
                            // Check if it's an x.ai key
                            if (apiKey && apiKey.startsWith('xai-')) {
                                errorMsg = 'Unauthorized: x.ai API key detected but you are trying to access the Groq API. Please use a standard Groq API key instead.';
                            } else {
                                errorMsg = 'Unauthorized: Please check your Groq API key is valid and correctly formatted';
                            }
                        }
                    }
                    
                    // Special handling for x.ai API errors
                    if (modelsUrl.includes('api.x.ai')) {
                        console.error('x.ai API error details:', errorData);
                        if (response.status === 401) {
                            errorMsg = 'Unauthorized: Please check your x.ai API key is valid and correctly formatted (should start with "xai-")';
                        } else if (response.status === 404) {
                            errorMsg = 'API endpoint not found. The x.ai API might have changed or may not support model listing. Using default models.';
                            
                            // Fallback to hardcoded list
                            setTimeout(() => {
                                const selectEl = document.getElementById('groqModelSelect');
                                if (selectEl) {
                                    const xaiModels = [
                                        {id: 'grok-3-latest', name: 'Grok-3 (Latest)'},
                                        {id: 'grok-2', name: 'Grok-2'}
                                    ];
                                    
                                    populateModelSelect(selectEl, xaiModels, 'grok-3-latest', null);
                                }
                            }, 500);
                        }
                    }
                } catch (e) {
                    // If we can't parse the error JSON, use the status text
                    errorMsg = `${errorMsg}: ${response.statusText || 'Unknown error'}`;
                } 
                
                // Handle rate limiting explicitly
                if (response.status === 429) {
                    errorMsg = 'Rate limit exceeded. Please try again later.';
                }
                
                throw new Error(errorMsg); 
            }
            const data = await response.json(); 
            const models = modelParser(data); 
            selectElement.innerHTML = '';

            if (models?.length > 0) {
                models.forEach(model => { 
                    const option = document.createElement('option'); 
                    option.value = model.id; 
                    option.textContent = model.name; 
                    selectElement.appendChild(option); 
                });
                selectElement.disabled = false;
                if (previouslySelectedModel && selectElement.querySelector(`option[value="${previouslySelectedModel}"]`)) {
                    selectElement.value = previouslySelectedModel;
                } else { 
                    const suggestedDefaultOption = models.find(model => model.id === defaultModelIdSuggestion);
                    if (suggestedDefaultOption) {
                        selectElement.value = suggestedDefaultOption.id;
                    } else if (models[0]) { 
                        selectElement.value = models[0].id; 
                    }
                }
            } else {
                selectElement.innerHTML = '<option value="" disabled selected>No compatible models found by API.</option>';
            }
        } catch (error) {
            console.error(`Models fetch error for ${selectElement.id}:`, error); 
            selectElement.innerHTML = '<option value="" disabled selected>Load failed: ' + (error.message || 'Unknown error') + '</option>'; 
            displayStatus(`Models load error: ${error.message}`, 'error', settingsStatusMessage);
        }
    }
    
    // --- Provider-Specific Model Fetchers ---
    function fetchOpenAIModels(apiKey, selectedModel) { 
        fetchAndPopulateDynamicModels(apiKey, 'https://api.openai.com/v1/models', 
            (key) => ({'Authorization': `Bearer ${key}`}), 
            PROVIDER_CONFIG.openai.modelSelect, 
            (data) => { 
                if (!data.data) return [];
                return data.data
                    .filter(m => { 
                        const idLower = m.id.toLowerCase();
                        if (idLower.includes('embed') || idLower.includes('image') || idLower.includes('audio') || idLower.includes('whisper') || idLower.startsWith('ft:') || idLower.endsWith('-001') || idLower.includes('davinci-002') || idLower.includes('babbage-002') || idLower === 'gpt-3.5-turbo-instruct') {
                            return false; 
                        }
                        return true; 
                    })
                    .map(m => ({id: m.id, name: m.id}))
                    .sort((a,b) => a.name.localeCompare(b.name));
            },
            PROVIDER_CONFIG.openai.defaultModelIdSuggestion, 
            selectedModel
        ); 
    }

    async function fetchGeminiModels(apiKey, previouslySelectedModel) {
        fetchAndPopulateDynamicModels(apiKey, `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            () => ({}), 
            PROVIDER_CONFIG.gemini.modelSelect,
            (data) => { 
                if (!data.models || data.models.length === 0) return [];
                return data.models.filter(model => 
                    model.supportedGenerationMethods && model.supportedGenerationMethods.includes("generateContent")
                ).map(model => ({
                    id: model.name.replace("models/", ""), 
                    name: model.displayName || model.name.replace("models/", "") 
                })).sort((a, b) => a.name.localeCompare(b.name));
            },
            PROVIDER_CONFIG.gemini.defaultModelIdSuggestion,
            previouslySelectedModel
        );
    }

    function fetchMistralModels(apiKey, selectedModel) { 
        fetchAndPopulateDynamicModels(apiKey, 'https://api.mistral.ai/v1/models', 
            (key) => ({
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            }), 
            PROVIDER_CONFIG.mistral.modelSelect, 
            (data) => { 
                 if (!data.data) return [];
                 return data.data
                    .filter(m => !m.id.toLowerCase().includes('embed'))
                    .map(m => ({id: m.id, name: m.id}))
                    .sort((a,b) => a.name.localeCompare(b.name));
            },
            PROVIDER_CONFIG.mistral.defaultModelIdSuggestion, 
            selectedModel
        ); 
    }
    
    function fetchClaudeModels(apiKey, selectedModel) {
        console.log('Fetching Claude models...');
        
        const selectEl = PROVIDER_CONFIG.claude.modelSelect;
        selectEl.innerHTML = '<option value="" disabled selected>Loading models...</option>';
        selectEl.disabled = true;
        
        if (!apiKey) {
            selectEl.innerHTML = '<option value="" disabled selected>Enter API Key...</option>';
            selectEl.disabled = true;
            return;
        }
        
        // Clean the API key
        const cleanedApiKey = apiKey.trim();
        
        // Add a diagnostic note about the key format
        console.log('Claude API key format: ' + 
            (cleanedApiKey.startsWith('sk-ant-') ? 'Standard sk-ant format' : 
             cleanedApiKey.startsWith('sk-') ? 'Standard sk format' : 
             'Unknown format'));
        
        // Attempt to fetch models using the API
        fetch('https://api.anthropic.com/v1/models', {
            method: 'GET',
            headers: {
                'x-api-key': cleanedApiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`API Error (${response.status}): ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Claude models API response:', data);
            
            if (data.models && data.models.length > 0) {
                // Filter out non-Claude models (if any)
                const claudeModels = data.models
                    .filter(model => model.id.includes('claude'))
                    .map(model => ({ 
                        id: model.id, 
                        name: model.display_name || model.id
                    }));
                
                if (claudeModels.length > 0) {
                    // Populate select with models from API
                    selectEl.innerHTML = '';
                    claudeModels.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model.id;
                        option.textContent = model.name;
                        selectEl.appendChild(option);
                    });
                    
                    selectEl.disabled = false;
                    
                    if (selectedModel && claudeModels.some(m => m.id === selectedModel)) {
                        selectEl.value = selectedModel;
                    } else {
                        // Default to a recent Claude model
                        const preferredModel = claudeModels.find(m => m.id === 'claude-3-5-sonnet-20240620') ||
                                             claudeModels.find(m => m.id.includes('claude-3')) ||
                                             claudeModels[0];
                        selectEl.value = preferredModel.id;
                    }
                    
                    console.log('Successfully loaded Claude models from API');
                    return;
                }
            }
            
            // Fallback to hardcoded models if API doesn't return useful results
            throw new Error('No compatible Claude models found in API response');
        })
        .catch(error => {
            console.warn('Error fetching Claude models from API:', error);
            console.log('Falling back to hardcoded Claude models');
            
            // Use hardcoded list of Claude models as fallback
            const claudeModels = [
                {id: 'claude-3-opus-20240229', name: 'Claude 3 Opus'},
                {id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet'},
                {id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku'},
                {id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet'},
                {id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet'}
            ];
            
            selectEl.innerHTML = '';
            claudeModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                selectEl.appendChild(option);
            });
            
            selectEl.disabled = false;
            
            if (selectedModel && claudeModels.some(m => m.id === selectedModel)) {
                selectEl.value = selectedModel;
            } else {
                // Default to 3.5 Sonnet
                selectEl.value = 'claude-3-5-sonnet-20240620';
            }
        });
    }

    function fetchOpenRouterModels(apiKey, selectedModel) { 
        fetchAndPopulateDynamicModels(apiKey, 'https://openrouter.ai/api/v1/models', 
            (key) => ({'Authorization': `Bearer ${key}`, 'HTTP-Referer': "https://github.com/farhansrambiyan/n8n-Workflow-Builder-Ai", 'X-Title': "n8n Workflow Builder Ai (Beta)"}), 
            PROVIDER_CONFIG.openrouter.modelSelect, 
            (data) => { 
                if (!data.data) return [];
                return data.data
                    .map(m => ({id: m.id, name: m.name || m.id })) // OpenRouter provides good names generally
                    .sort((a,b) => (a.name || a.id).localeCompare(b.name || b.id));
            },
            PROVIDER_CONFIG.openrouter.defaultModelIdSuggestion, 
            selectedModel
        ); 
    }

    // Function to update Claude authentication method based on testing
    function updateClaudeAuthMethod(method) {
        console.log(`Updating Claude auth method to: ${method}`);
        
        if (method === 'x-api-key') {
            PROVIDER_CONFIG.claude.getApiDetails = (apiKey, model, systemPrompt, userPrompt) => {
                const cleanedApiKey = apiKey.trim();
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
            };
        } else {
            PROVIDER_CONFIG.claude.getApiDetails = (apiKey, model, systemPrompt, userPrompt) => {
                const cleanedApiKey = apiKey.trim();
                return {
                    url: 'https://api.anthropic.com/v1/messages',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Authorization': `Bearer ${cleanedApiKey}`,
                        'anthropic-version': '2023-06-01'
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
            };
        }
        
        // Save the auth method preference
        chrome.storage.local.set({ claudeAuthMethod: method });
        console.log('Saved Claude auth method preference:', method);
    }

    function fetchGrokModels(apiKey, selectedModel) { 
        // Clean the API key to remove any whitespace
        const cleanedApiKey = apiKey.trim();
        
        // Check if using x.ai key (starts with xai-)
        const isXaiKey = cleanedApiKey.startsWith('xai-');
        console.log('Using x.ai formatted API key:', isXaiKey);
        
        // Use correct API endpoint for x.ai
        const apiEndpoint = 'https://api.x.ai/v1/models';
        
        console.log('Using API endpoint:', apiEndpoint);
        
        // Always use Bearer prefix for Authorization
        const authHeaders = {
            'Authorization': `Bearer ${cleanedApiKey}`,
            'Content-Type': 'application/json'
        };
        
        const selectEl = PROVIDER_CONFIG.grok.modelSelect;
        selectEl.innerHTML = '<option value="" disabled selected>Loading models...</option>';
        selectEl.disabled = true;
        
        // Try fetching models from API first
        fetch(apiEndpoint, {
            method: 'GET',
            headers: authHeaders
        })
        .then(response => {
            console.log('x.ai models API status:', response.status);
            if (!response.ok) {
                throw new Error(`API Error (${response.status}): ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('x.ai models data:', data);
            
            // Extract models from the response
            const models = data.data || [];
            
            if (models.length > 0) {
                // Filter models if needed and prepare for display
                const grokModels = models
                    .filter(m => !m.id.toLowerCase().includes('whisper'))
                    .map(m => ({id: m.id, name: m.id}))
                    .sort((a, b) => a.name.localeCompare(b.name));
                
                // Populate the select element
                populateModelSelect(selectEl, grokModels, 'grok-3-latest', selectedModel);
            } else {
                throw new Error('No models returned from API');
            }
        })
        .catch(error => {
            console.error('Error fetching x.ai models:', error);
            
            // Fall back to hardcoded models if API fails
            console.log('Falling back to default x.ai models');
            const xaiModels = [
                {id: 'grok-3-latest', name: 'Grok-3 (Latest)'},
                {id: 'grok-2', name: 'Grok-2'}
            ];
            
            populateModelSelect(selectEl, xaiModels, 'grok-3-latest', selectedModel);
            
            // Show a warning if there was an error
            displayStatus(`Error loading models: ${error.message}. Using default models.`, 'warning', settingsStatusMessage, 4000);
        });
    }

    function fetchRealGroqModels(apiKey, selectedModel) { 
        // Clean the API key to remove any whitespace
        const cleanedApiKey = apiKey.trim();
        
        // Fix: Use the correct Groq models endpoint instead of chat completions
        const apiEndpoint = 'https://api.groq.com/openai/v1/models';
        
        console.log('Using Groq models API endpoint:', apiEndpoint);
        
        // Authorization headers
        const authHeaders = {
            'Authorization': `Bearer ${cleanedApiKey}`,
            'Content-Type': 'application/json'
        };
        
        // Fetch Groq models
        fetchAndPopulateDynamicModels(cleanedApiKey, apiEndpoint, 
            () => authHeaders, 
            PROVIDER_CONFIG.groq.modelSelect, 
            (data) => { 
                console.log('Groq models data:', data);
                
                // Try multiple approaches to extract models from the response
                let models = [];
                
                // First check data.data (standard OpenAI format)
                if (data.data && Array.isArray(data.data)) {
                    models = data.data;
                    console.log('Found models in data.data:', models.length);
                } 
                // Check if data itself is an array of models
                else if (Array.isArray(data)) {
                    models = data;
                    console.log('Found models in root array:', models.length);
                }
                // Check if data.models exists (some API format)
                else if (data.models && Array.isArray(data.models)) {
                    models = data.models;
                    console.log('Found models in data.models:', models.length);
                }
                // If we have data.object="list" and data.data is missing, check other properties
                else if (data.object === 'list') {
                    // Search for any array property that might contain models
                    const arrayProps = Object.keys(data).filter(key => Array.isArray(data[key]));
                    if (arrayProps.length > 0) {
                        // Use the first array property found
                        models = data[arrayProps[0]];
                        console.log(`Found models in data.${arrayProps[0]}:`, models.length);
                    }
                }
                
                // Process the models if we found any
                if (models.length > 0) {
                    return models
                        .filter(m => {
                            // Filter out non-model entries or embedding models
                            if (!m.id) return false;
                            return !m.id.toLowerCase().includes('whisper') && 
                                   !m.id.toLowerCase().includes('embed');
                        })
                        .map(m => ({
                            id: m.id, 
                            name: m.display_name || m.name || m.id
                        }))
                        .sort((a, b) => a.name.localeCompare(b.name));
                }
                
                // If no models found, log helpful error but don't provide fallbacks
                console.error('No models found in API response', data);
                return [];
            },
            PROVIDER_CONFIG.groq.defaultModelIdSuggestion, 
            selectedModel
        );
    }

    // Helper function to populate model select
    function populateModelSelect(selectEl, models, defaultModel, selectedModel) {
        selectEl.innerHTML = '';
        
        if (models.length > 0) {
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                selectEl.appendChild(option);
            });
            
            selectEl.disabled = false;
            
            if (selectedModel && selectEl.querySelector(`option[value="${selectedModel}"]`)) {
                selectEl.value = selectedModel;
            } else if (defaultModel && selectEl.querySelector(`option[value="${defaultModel}"]`)) {
                selectEl.value = defaultModel;
            } else {
                selectEl.value = models[0].id;
            }
        } else {
            selectEl.innerHTML = '<option value="" disabled selected>No compatible models found.</option>';
            selectEl.disabled = true;
        }
    }

    // --- History Management ---
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
            
            chrome.storage.local.set({ generationHistory: history }, () => {
                // If we're currently on the history tab, update the view
                if (document.querySelector('.tab-button[data-tab="history"]').classList.contains('active')) {
                    loadHistoryItems();
                }
            });
        });
    }
    
    function loadHistoryItems() {
        chrome.storage.local.get(['generationHistory'], (data) => {
            const history = data.generationHistory || [];
            
            if (history.length === 0) {
                historyItemsContainer.innerHTML = '';
                noHistoryMessage.style.display = 'block';
                return;
            }
            
            noHistoryMessage.style.display = 'none';
            historyItemsContainer.innerHTML = '';
            
            history.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.dataset.id = item.id;
                
                // Format the date
                const date = new Date(item.timestamp);
                const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
                
                // Create a title from the first line or first 50 chars of the prompt
                const title = item.prompt.split('\n')[0].substring(0, 50) + (item.prompt.length > 50 ? '...' : '');
                
                historyItem.innerHTML = `
                    <div class="history-item-header">
                        <div class="history-item-title">${title}</div>
                        <div class="history-item-date">${formattedDate}</div>
                        <div class="history-item-actions">
                            <button class="history-action-button copy" title="Copy JSON">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                            <button class="history-action-button delete" title="Delete from history">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="history-item-prompt custom-scrollbar">${item.prompt.replace(/\n/g, '<br>')}</div>
                    <div class="history-item-json custom-scrollbar">${formatJsonForDisplay(item.json)}</div>
                `;
                
                historyItemsContainer.appendChild(historyItem);
                
                // Add event listeners for action buttons
                const copyBtn = historyItem.querySelector('.history-action-button.copy');
                const deleteBtn = historyItem.querySelector('.history-action-button.delete');
                
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(item.json)
                        .then(() => {
                            displayStatus('JSON copied from history!', 'success', copyMessage, 2000);
                        })
                        .catch(err => {
                            console.error('Failed to copy JSON from history: ', err);
                            displayStatus('Failed to copy JSON to clipboard.', 'error', copyMessage);
                        });
                });
                
                deleteBtn.addEventListener('click', () => {
                    deleteHistoryItem(item.id);
                });
            });
        });
    }
    
    function deleteHistoryItem(id) {
        chrome.storage.local.get(['generationHistory'], (data) => {
            let history = data.generationHistory || [];
            
            // Filter out the item with the given ID
            history = history.filter(item => item.id !== id);
            
            chrome.storage.local.set({ generationHistory: history }, () => {
                loadHistoryItems(); // Reload the history view
            });
        });
    }
    
    function formatJsonForDisplay(jsonString) {
        try {
            // Try to parse and pretty-print the JSON
            const formattedJson = JSON.stringify(JSON.parse(jsonString), null, 2);
            // Escape HTML and add syntax highlighting (basic version)
            return formattedJson
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
                    let cls = 'json-number';
                    if (/^"/.test(match)) {
                        if (/:$/.test(match)) {
                            cls = 'json-key';
                        } else {
                            cls = 'json-string';
                        }
                    } else if (/true|false/.test(match)) {
                        cls = 'json-boolean';
                    } else if (/null/.test(match)) {
                        cls = 'json-null';
                    }
                    return '<span class="' + cls + '">' + match + '</span>';
                })
                .replace(/\n/g, '<br>')
                .replace(/\s{2}/g, '&nbsp;&nbsp;');
        } catch (e) {
            // If parsing fails, just return the raw string
            return jsonString
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');
        }
    }

    // --- Generate Button Logic ---
    generateBtn.addEventListener('click', async () => {
        const providerId = mainAiProviderSelect.value;
        const userPrompt = promptTextarea.value.trim();

        if (!providerId) { 
            displayStatus('Please select an enabled AI Provider from the dropdown.', 'error', statusMessage); 
            return; 
        }
        if (!userPrompt) { 
            displayStatus('Please enter a description for the workflow or node.', 'error', statusMessage); 
            return; 
        }
        
        setLoadingState(true);
        const providerConf = PROVIDER_CONFIG[providerId];

        try {
            const storedData = await new Promise(resolve => 
                chrome.storage.local.get([`${providerId}ApiKey`, `${providerId}SelectedModel`], resolve)
            );
            const apiKey = storedData[`${providerId}ApiKey`];
            const model = storedData[`${providerId}SelectedModel`];

            if (!apiKey || !model) {
                throw new Error(`${providerConf.label} API key or model is not configured, or the provider is not enabled. Please check Settings.`);
            }

            // Reset generationComplete flag to ensure events fire correctly for this new generation
            chrome.storage.local.set({ generationComplete: false }, () => {
                // Start the background generation process
                chrome.runtime.sendMessage({
                    action: 'startBackgroundGeneration',
                    providerId,
                    apiKey,
                    model,
                    userPrompt,
                    systemPrompt: SYSTEM_PROMPT
                }, (response) => {
                    if (chrome.runtime.lastError || !response || !response.success) {
                        displayStatus(`Error: ${chrome.runtime.lastError?.message || 'Failed to start generation'}`, 'error', statusMessage);
                        setLoadingState(false);
                    } else {
                        // Show background processing indicator
                        generationIndicator.style.display = 'block';
                    }
                });
            });
        } catch (error) {
            console.error(`Error during generation setup with ${providerId}:`, error);
            displayStatus(`Generation Error: ${error.message}`, 'error', statusMessage);
            outputGroup.style.display = 'none';
            setLoadingState(false);
        }
    });
    
    // --- UI Helper Functions ---
    function displayGeneratedJson(jsonString) {
        try { 
            // Enhanced markdown code block removal
            let cleanedJson = jsonString;
            
            // First, check if the response is wrapped in markdown code blocks
            if (cleanedJson.includes('```json') || cleanedJson.includes('```')) {
                // Remove opening code block marker with or without language specifier
                cleanedJson = cleanedJson.replace(/^```(?:json)?\s*/i, '');
                // Remove closing code block marker
                cleanedJson = cleanedJson.replace(/\s*```$/i, '');
                console.log('Removed markdown code block formatting from AI response');
            }
            
            // Check if we need to fix Mistral-specific issues
            const currentProvider = mainAiProviderSelect.value;
            if (currentProvider === 'mistral') {
                try {
                    // Parse the JSON and fix Mistral's common issues
                    const jsonObj = JSON.parse(cleanedJson);
                    const fixedJsonObj = fixMistralJsonStructure(jsonObj);
                    cleanedJson = JSON.stringify(fixedJsonObj);
                    console.log('Applied Mistral-specific JSON structure fixes');
                } catch (parseError) {
                    console.warn('Failed to parse and fix Mistral JSON:', parseError);
                    // Continue with the original JSON if parsing fails
                }
            }
            
            // Try to parse and pretty-print the JSON
            outputTextarea.value = cleanedJson; 
        } catch (e) { 
            console.warn("Output is not valid JSON:", e, "\nRaw output from AI:", jsonString); 
            outputTextarea.value = jsonString; 
            displayStatus('AI returned content that may not be perfectly valid JSON. Check the output.', 'warning', statusMessage); 
        }
        outputGroup.style.display = 'block';
        updateClearButtonVisibility();
    }

    // Helper function to fix common Mistral JSON structure issues
    function fixMistralJsonStructure(jsonObj) {
        // If this is a workflow object
        if (jsonObj && typeof jsonObj === 'object') {
            // Fix nodes array if it exists but isn't an array
            if ('nodes' in jsonObj && !Array.isArray(jsonObj.nodes)) {
                if (jsonObj.nodes === null) {
                    jsonObj.nodes = [];
                } else if (typeof jsonObj.nodes === 'object') {
                    // Convert object to array if it's an object
                    jsonObj.nodes = Object.values(jsonObj.nodes);
                }
            }
            
            // Process each node for common property issues
            if (Array.isArray(jsonObj.nodes)) {
                jsonObj.nodes.forEach(node => {
                    if (node && typeof node === 'object') {
                        // Fix parameters that should be arrays
                        if (node.parameters && typeof node.parameters === 'object') {
                            // Common n8n properties that should always be arrays
                            const shouldBeArrays = ['options', 'fields', 'rules', 'values', 'items', 'propertyValues'];
                            
                            for (const key in node.parameters) {
                                if (shouldBeArrays.includes(key) && node.parameters[key] !== undefined) {
                                    if (node.parameters[key] === null || !Array.isArray(node.parameters[key])) {
                                        if (node.parameters[key] === null) {
                                            node.parameters[key] = [];
                                        } else if (typeof node.parameters[key] === 'object') {
                                            // Convert object to array
                                            node.parameters[key] = Object.values(node.parameters[key]);
                                        } else {
                                            // Wrap single value in array
                                            node.parameters[key] = [node.parameters[key]];
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Ensure 'position' is an array of two numbers
                        if (node.position !== undefined && !Array.isArray(node.position)) {
                            node.position = [0, 0]; // Default position
                        }
                    }
                });
            }
            
            // Fix connections structure if it exists
            if ('connections' in jsonObj && jsonObj.connections) {
                for (const sourceNode in jsonObj.connections) {
                    if (jsonObj.connections[sourceNode].main && !Array.isArray(jsonObj.connections[sourceNode].main)) {
                        if (jsonObj.connections[sourceNode].main === null) {
                            jsonObj.connections[sourceNode].main = [];
                        } else if (typeof jsonObj.connections[sourceNode].main === 'object') {
                            // Convert a single connection object to array
                            jsonObj.connections[sourceNode].main = [jsonObj.connections[sourceNode].main];
                        }
                    }
                }
            }
        }
        
        return jsonObj;
    }

    function setLoadingState(isLoading) {
        generateBtn.disabled = isLoading; 
        generateBtn.textContent = isLoading ? 'Generating...' : 'Generate';
        if (isLoading) { 
            statusMessage.textContent = 'Generating JSON, please wait... Generation speed depends on your API.';
            statusMessage.className = 'status-message'; 
            outputTextarea.value = ''; 
            outputGroup.style.display = 'none'; 
            copyMessage.style.display = 'none';
        }
    }

    function displayStatus(message, type, element, autoClearDelay = 4000) {
        element.textContent = message; 
        element.className = `status-message ${type || ''}`;
        // Clear existing timeouts for this specific element to prevent premature clearing if status updates quickly
        if (element.statusClearTimeout) {
            clearTimeout(element.statusClearTimeout);
        }
        if ((type === 'success' || type === 'warning') && (element === statusMessage || element === copyMessage)) {
            element.statusClearTimeout = setTimeout(() => { 
                if (element.textContent === message) { 
                    element.textContent = ''; 
                    if (element === copyMessage) {
                        element.style.display = 'none'; 
                        element.className = 'status-message'; 
                    }
                }
            }, autoClearDelay);
        }
        if (element === copyMessage && type !== '' && message !== '') { 
            copyMessage.style.display = 'block';
        } else if (element === copyMessage && message === '') {
            copyMessage.style.display = 'none';
        }
    }
    
    // Updates the visibility of the clear button based on content
    function updateClearButtonVisibility() {
        const hasPrompt = promptTextarea.value.trim() !== '';
        const hasOutput = outputTextarea.value.trim() !== '';
        clearBtn.style.display = (hasPrompt || hasOutput) ? 'block' : 'none';
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        for (const id in PROVIDER_CONFIG) {
            const config = PROVIDER_CONFIG[id];

            config.toggleInput.addEventListener('change', (event) => {
                const isEnabled = event.target.checked;
                config.detailsContainer.classList.toggle('active', isEnabled);
                if (isEnabled) {
                    if (config.apiKeyInput.value.trim()) {
                        const currentSelectedModel = config.modelSelect.value || undefined; 
                        config.fetchModelsFn(config.apiKeyInput.value.trim(), currentSelectedModel);
                    } else {
                        config.modelSelect.innerHTML = '<option value="" disabled selected>Enter API Key...</option>';
                        config.modelSelect.disabled = true;
                    }
                } else {
                    config.modelSelect.innerHTML = '<option value="" disabled selected>Enable provider...</option>';
                    config.modelSelect.disabled = true;
                }
                scheduleSaveSettings(); 
            });

            config.apiKeyInput.addEventListener('blur', () => {
                if (config.toggleInput.checked && config.apiKeyInput.value.trim()) {
                    const currentSelectedModel = config.modelSelect.value || undefined;
                    config.fetchModelsFn(config.apiKeyInput.value.trim(), currentSelectedModel);
                } else if (config.toggleInput.checked && !config.apiKeyInput.value.trim()){
                     config.modelSelect.innerHTML = '<option value="" disabled selected>Enter API Key...</option>';
                     config.modelSelect.disabled = true;
                }
                scheduleSaveSettings(false); 
            });
            config.apiKeyInput.addEventListener('input', () => { 
                scheduleSaveSettings(false); 
            });

            config.modelSelect.addEventListener('change', () => {
                scheduleSaveSettings(false); 
            });
        }

        // Display mode change handler
        displayModeSelect.addEventListener('change', () => {
            scheduleSaveSettings();
        });

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active')); 
                button.classList.add('active');
                const targetTab = button.getAttribute('data-tab');
                tabContents.forEach(content => content.classList.toggle('active', content.id === targetTab));
                
                if (targetTab === 'generate') {
                    loadAndApplySettings();
                    // Check if generation is in progress and update button state
                    chrome.storage.local.get(['generationInProgress'], (data) => {
                        if (data.generationInProgress) {
                            setLoadingState(true);
                            generationIndicator.style.display = 'block';
                        }
                    });
                } else if (targetTab === 'history') {
                    loadHistoryItems();
                }
            });
        });
        if (!document.querySelector('.tab-button.active')) {
             const defaultGenerateTabButton = document.querySelector('.tab-button[data-tab="generate"]');
             if (defaultGenerateTabButton) defaultGenerateTabButton.classList.add('active');
             const defaultGenerateTabContent = document.getElementById('generate');
             if (defaultGenerateTabContent) defaultGenerateTabContent.classList.add('active');
        }

        copyJsonBtn.addEventListener('click', () => {
            if (!outputTextarea.value) return;
            navigator.clipboard.writeText(outputTextarea.value)
                .then(() => displayStatus('JSON copied!', 'success', copyMessage, 2000))
                .catch(err => { 
                    console.error('Failed to copy JSON: ', err); 
                    displayStatus('Failed to copy JSON to clipboard.', 'error', copyMessage); 
                });
        });
        
        // Clear button functionality
        clearBtn.addEventListener('click', () => {
            // Clear UI elements
            promptTextarea.value = '';
            outputTextarea.value = '';
            outputGroup.style.display = 'none';
            statusMessage.textContent = '';
            copyMessage.style.display = 'none';
            generationIndicator.style.display = 'none';
            
            // Clear stored data
            chrome.runtime.sendMessage({
                action: 'clearGenerationData'
            });
            
            // Update clear button visibility
            updateClearButtonVisibility();
        });
        
        // Update clear button visibility when entering or clearing the prompt
        promptTextarea.addEventListener('input', updateClearButtonVisibility);
        
        // Listen for storage changes to update the UI accordingly
        chrome.storage.onChanged.addListener((changes) => {
            // If generation completed while popup is open
            if (changes.generationComplete && changes.generationComplete.newValue === true) {
                console.log('Generation complete detected in UI');
                chrome.storage.local.get(['generatedJson', 'generationError', 'currentPrompt'], (data) => {
                    console.log('Retrieved generation results:', {
                        hasJson: !!data.generatedJson, 
                        hasError: !!data.generationError,
                        jsonLength: data.generatedJson ? data.generatedJson.length : 0
                    });
                    
                    if (data.generatedJson) {
                        try {
                            displayGeneratedJson(data.generatedJson);
                            setLoadingState(false);
                            
                            // Save to history if generation was successful
                            if (data.currentPrompt && data.generatedJson) {
                                saveToHistory(data.currentPrompt, data.generatedJson, mainAiProviderSelect.value);
                            }
                            
                            // Special handling for truncated responses
                            if (data.generatedJson.includes('[Response was truncated due to size limits]')) {
                                displayStatus('JSON generated successfully but was truncated due to large size. Some content may be missing.', 'warning', statusMessage);
                            } else {
                                displayStatus('JSON generated successfully!', 'success', statusMessage);
                            }
                        } catch (err) {
                            console.error('Error displaying generation result:', err);
                            setLoadingState(false);
                            outputGroup.style.display = 'none';
                            displayStatus(`Error displaying result: ${err.message}. The response may be too large.`, 'error', statusMessage);
                        }
                    } else if (data.generationError) {
                        setLoadingState(false);
                        outputGroup.style.display = 'none';
                        displayStatus(`Generation Error: ${data.generationError}`, 'error', statusMessage);
                    } else {
                        // Handle the case where we have neither JSON nor error
                        setLoadingState(false);
                        outputGroup.style.display = 'none';
                        displayStatus('Generation completed but no output was returned. This may be due to a very large response or server timeout.', 'error', statusMessage);
                    }
                });
                generationIndicator.style.display = 'none';
            }
            
            // If generation status changed
            if (changes.generationInProgress) {
                if (changes.generationInProgress.newValue === true) {
                    setLoadingState(true);
                    generationIndicator.style.display = 'block';
                } else {
                    generationIndicator.style.display = 'none';
                }
            }
            
            // If there's a status update
            if (changes.generationStatus) {
                console.log('Generation status update:', changes.generationStatus.newValue);
                const statusTextElement = generationIndicator.querySelector('.status-text');
                if (statusTextElement && changes.generationStatus.newValue) {
                    statusTextElement.textContent = changes.generationStatus.newValue;
                }
            }
        });
        
        mainAiProviderSelect.addEventListener('change', () => {
            chrome.storage.local.set({ selectedAiProviderOnGenerateTab: mainAiProviderSelect.value });
        });

        // Add key validation for Mistral specifically
        const mistralApiKeyInput = document.getElementById('mistralApiKey');
        if (mistralApiKeyInput) {
            mistralApiKeyInput.addEventListener('blur', function() {
                // Trim whitespace from Mistral API key to prevent common errors
                if (this.value) {
                    const trimmedValue = this.value.trim();
                    if (trimmedValue !== this.value) {
                        this.value = trimmedValue;
                        displayStatus('Mistral API key whitespace trimmed to prevent authorization errors', 'warning', settingsStatusMessage, 3000);
                        
                        // Also trigger save when we fix the format
                        scheduleSaveSettings();
                    }
                }
            });
        }
        
        // Add key validation for Groq specifically
        const groqApiKeyInput = document.getElementById('groqApiKey');
        if (groqApiKeyInput) {
            groqApiKeyInput.addEventListener('blur', function() {
                // Trim whitespace from Groq API key to prevent common errors
                if (this.value) {
                    const trimmedValue = this.value.trim();
                    if (trimmedValue !== this.value) {
                        this.value = trimmedValue;
                        displayStatus('Groq API key whitespace trimmed to prevent authorization errors', 'warning', settingsStatusMessage, 3000);
                        
                        // Also trigger save when we fix the format
                        scheduleSaveSettings();
                    }
                }
            });
        }

        // Add key validation for Real Groq specifically
        const realGroqApiKeyInput = document.getElementById('realGroqApiKey');
        if (realGroqApiKeyInput) {
            realGroqApiKeyInput.addEventListener('blur', function() {
                // Trim whitespace from Groq API key to prevent common errors
                if (this.value) {
                    const trimmedValue = this.value.trim();
                    if (trimmedValue !== this.value) {
                        this.value = trimmedValue;
                        displayStatus('Groq API key whitespace trimmed to prevent authorization errors', 'warning', settingsStatusMessage, 3000);
                        
                        // Also trigger save when we fix the format
                        scheduleSaveSettings();
                    }
                }
            });
        }

        // Add key validation for Claude specifically
        const claudeApiKeyInput = document.getElementById('claudeApiKey');
        if (claudeApiKeyInput) {
            // Add a helpful note about Claude API key format
            const noteElement = document.createElement('small');
            noteElement.className = 'helper-text';
            noteElement.textContent = "Claude API keys start with 'sk-ant-'";
            noteElement.style.color = '#666';
            noteElement.style.fontStyle = 'italic';
            noteElement.style.marginLeft = '5px';
            
            // Insert the note after the input field
            claudeApiKeyInput.parentNode.insertBefore(noteElement, claudeApiKeyInput.nextSibling);
            
            // Add validation on blur
            claudeApiKeyInput.addEventListener('blur', function() {
                // Trim whitespace from Claude API key
                if (this.value) {
                    const trimmedValue = this.value.trim();
                    if (trimmedValue !== this.value) {
                        this.value = trimmedValue;
                        displayStatus('Claude API key whitespace trimmed', 'warning', settingsStatusMessage, 2000);
                        scheduleSaveSettings();
                    }
                    
                    // Show warning if format is incorrect
                    if (trimmedValue && !trimmedValue.startsWith('sk-ant-')) {
                        noteElement.textContent = "Warning: Claude API keys should start with 'sk-ant-'";
                        noteElement.style.color = '#c93838';
                    } else {
                        noteElement.textContent = "Claude API keys start with 'sk-ant-'";
                        noteElement.style.color = '#666';
                    }
                }
            });
        }
    }

    // Check for any background generation tasks or results
    function checkBackgroundGeneration() {
        chrome.storage.local.get([
            'currentPrompt', 
            'generatedJson', 
            'generationError', 
            'generationComplete', 
            'generationInProgress'
        ], (data) => {
            // Restore prompt if available
            if (data.currentPrompt) {
                promptTextarea.value = data.currentPrompt;
                updateClearButtonVisibility();
            }
            
            // If generation is still in progress
            if (data.generationInProgress) {
                setLoadingState(true);
                generationIndicator.style.display = 'block';
            }
            
            // If generation completed
            if (data.generationComplete) {
                if (data.generatedJson) {
                    displayGeneratedJson(data.generatedJson);
                    setLoadingState(false);
                    displayStatus('JSON generated successfully!', 'success', statusMessage);
                } else if (data.generationError) {
                    setLoadingState(false);
                    outputGroup.style.display = 'none';
                    displayStatus(`Generation Error: ${data.generationError}`, 'error', statusMessage);
                }
            }
        });
    }

    // Add a function to cancel ongoing generation
    function cancelGeneration() {
        if (confirm('Are you sure you want to cancel the current generation?')) {
            console.log('Cancelling generation by user request');
            chrome.storage.local.set({
                generationInProgress: false,
                generationComplete: true,
                generationError: 'Generation was cancelled by user request.'
            });
            displayStatus('Generation cancelled.', 'warning', statusMessage);
            generationIndicator.style.display = 'none';
            setLoadingState(false);
        }
    }
});
