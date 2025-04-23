/**
 * popup.js
 *
 * Handles the user interface logic for the n8n Workflow Builder AI Chrome Extension popup.
 * - Manages tab switching (Generate/Settings).
 * - Handles API key input and saving to chrome.storage.local.
 * - Fetches available AI models from OpenAI and Gemini APIs based on saved keys.
 * - Populates model selection dropdowns.
 * - Takes user prompts and selected provider/model to generate n8n JSON via AI API calls.
 * - Displays generated JSON and handles copying to clipboard.
 * - Shows status and error messages to the user.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const aiProviderSelect = document.getElementById('aiProvider');
    const promptTextarea = document.getElementById('prompt');
    const generateBtn = document.getElementById('generateBtn');
    const outputTextarea = document.getElementById('output');
    const statusElement = document.getElementById('status'); // Status for generation tab
    const copyJsonBtn = document.getElementById('copyJsonBtn');
    const copyMessageElement = document.getElementById('copy-message'); // Status for copy action

    const settingsTabBtn = document.querySelector('.tab-button[data-tab="settings"]');
    const generateTabBtn = document.querySelector('.tab-button[data-tab="generate"]');
    const settingsTabContent = document.getElementById('settings');
    const generateTabContent = document.getElementById('generate');

    const openaiKeyInput = document.getElementById('openaiKey');
    const geminiKeyInput = document.getElementById('geminiKey');
    const openaiModelSelect = document.getElementById('openaiModelSelect');
    const geminiModelSelect = document.getElementById('geminiModelSelect');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const settingsStatusElement = document.getElementById('settings-status'); // Status for settings tab

    // --- API Configuration ---
    const API_ENDPOINTS = {
        // For generating content
        openai: 'https://api.openai.com/v1/chat/completions',
        gemini: 'https://generativelanguage.googleapis.com/v1beta/models/', // Base URL, model appended for generation

        // For listing available models
        openai_models: 'https://api.openai.com/v1/models',
        gemini_models: 'https://generativelanguage.googleapis.com/v1beta/models',
    };

    // --- Helper Functions ---

    /**
     * Sets status messages in the UI.
     * @param {string} message - The message to display.
     * @param {boolean} [isError=false] - True if the message is an error.
     * @param {HTMLElement} [element=statusElement] - The DOM element to update.
     */
    function setStatus(message, isError = false, element = statusElement) {
        element.textContent = message;
        element.className = `status-message ${isError ? 'error' : 'success'}`;
        // Ensure the status element is visible if it has content
        element.style.display = message ? 'block' : 'none';
    }

    /**
     * Clears status messages from a UI element.
     * @param {HTMLElement} [element=statusElement] - The DOM element to clear.
     */
    function clearStatus(element = statusElement) {
        element.textContent = '';
        element.className = 'status-message';
        element.style.display = 'none'; // Hide the element when cleared
    }

    /**
     * Shows the copy confirmation message temporarily.
     * @param {string} message - The message to display (e.g., "Copied!").
     * @param {boolean} [isError=false] - True if indicating a copy failure.
     */
    function showCopyMessage(message, isError = false) {
        copyMessageElement.textContent = message;
        copyMessageElement.className = `status-message ${isError ? 'error' : ''}`; // Only add 'error' class if needed
        copyMessageElement.style.display = 'block';
        // Hide after a few seconds
        setTimeout(() => {
            copyMessageElement.style.display = 'none';
            copyMessageElement.className = 'status-message'; // Reset class
        }, 3500);
    }

    /**
     * Fetches the list of available models from the specified AI provider's API.
     * @param {'openai' | 'gemini'} provider - The AI provider ('openai' or 'gemini').
     * @param {string} apiKey - The API key for the provider.
     * @returns {Promise<string[]>} A promise that resolves to an array of model ID strings, or an empty array on failure.
     */
    async function fetchModels(provider, apiKey) {
        // Clear previous status specifically for settings tab
        clearStatus(settingsStatusElement);
        console.log(`Attempting to fetch models for ${provider}...`);

        const selectElement = provider === 'openai' ? openaiModelSelect : geminiModelSelect;

        // Reset and disable select while fetching
        selectElement.disabled = true;
        selectElement.innerHTML = '<option value="" disabled selected>Loading models...</option>';

        // Don't attempt fetch if API key is missing
        if (!apiKey) {
            console.log(`No API key provided for ${provider}. Aborting fetch.`);
            // Set appropriate message based on provider
            selectElement.innerHTML = `<option value="" disabled selected>Enter ${provider === 'openai' ? 'OpenAI' : 'Gemini'} API Key...</option>`;
            return []; // Return empty, not an error state here
        }

        let url = '';
        let headers = {};
        let models = []; // Initialize empty array for models

        try {
            // --- OpenAI Fetch Logic ---
            if (provider === 'openai') {
                // Basic validation for OpenAI key format
                if (!apiKey.startsWith('sk-')) {
                    throw new Error('Invalid OpenAI Key format (must start with sk-).');
                }
                url = API_ENDPOINTS.openai_models;
                headers = { 'Authorization': `Bearer ${apiKey}` };
                console.log(`Fetching OpenAI models from: ${url}`);

                const response = await fetch(url, { method: 'GET', headers: headers });
                console.log(`OpenAI models API response status: ${response.status} ${response.statusText}`);

                // Check if the response status indicates an error
                if (!response.ok) {
                    let errorMsg = `OpenAI API Error (${response.status}): ${response.statusText}`;
                    try {
                        // Attempt to parse error details from the response body
                        const errorData = await response.json();
                        console.error("OpenAI API Error Response Body:", errorData);
                        errorMsg += ` - ${errorData?.error?.message || 'Unknown error details'}`;
                    } catch (e) {
                        // If parsing fails, log the error but use the status text
                        console.error("Failed to parse OpenAI error response body:", e);
                    }
                    throw new Error(errorMsg); // Throw error to be caught below
                }

                // Parse the successful response
                const data = await response.json();
                console.log("OpenAI models API Success Response Body:", data);

                // Validate the structure of the successful response
                if (!data || !data.data || !Array.isArray(data.data)) {
                     throw new Error("Unexpected response structure from OpenAI /v1/models API.");
                }

                // Extract model IDs, filter for common chat/completion models, and sort
                models = data.data
                    .map(model => model.id)
                    // Basic filter: include models containing 'gpt' or older completion models
                    // This might need adjustment based on desired model types
                    .filter(id => id.includes('gpt') || id.includes('text-davinci') || id.includes('instruct'))
                    .sort(); // Sort alphabetically

            // --- Gemini Fetch Logic ---
            } else if (provider === 'gemini') {
                // Basic validation for Gemini key length
                if (apiKey.length < 30) { // Gemini keys are typically quite long
                     throw new Error('Invalid Gemini Key format (seems too short).');
                }
                // API key is passed as a query parameter for Gemini model listing
                url = `${API_ENDPOINTS.gemini_models}?key=${apiKey}`;
                console.log(`Fetching Gemini models from: ${url}`);

                // Gemini model listing doesn't usually require specific headers
                const response = await fetch(url, { method: 'GET' });
                console.log(`Gemini models API response status: ${response.status} ${response.statusText}`);

                // Check if the response status indicates an error
                if (!response.ok) {
                    let errorMsg = `Gemini API Error (${response.status}): ${response.statusText}`;
                    try {
                        // Attempt to parse error details from the response body
                        const errorData = await response.json();
                        console.error("Gemini API Error Response Body:", errorData);
                        // Gemini error structure might be { error: { message: '...', status: '...' } }
                        errorMsg += ` - ${errorData?.error?.message || 'Unknown error details'}`;
                    } catch (e) {
                        // If parsing fails, log the error but use the status text
                        console.error("Failed to parse Gemini error response body:", e);
                    }
                    throw new Error(errorMsg); // Throw error to be caught below
                }

                // Parse the successful response
                const data = await response.json();
                console.log("Gemini models API Success Response Body:", data);

                // Validate the structure of the successful response
                 if (!data || !data.models || !Array.isArray(data.models)) {
                     throw new Error("Unexpected response structure from Gemini models API.");
                 }

                // Extract model names, remove the "models/" prefix, and sort
                // Initially, list most models. Consider filtering later if needed.
                models = data.models
                   .map(model => model.name.replace(/^models\//, '')) // Clean up names
                   .sort(); // Sort alphabetically

                 // Example of adding filtering later if necessary:
                 // models = data.models
                 //    .filter(model => model.supportedGenerationMethods?.includes('generateContent')) // Filter for generation models
                 //    .map(model => model.name.replace(/^models\//, ''))
                 //    .sort();

            } else {
                // Should not happen with current UI, but good practice
                throw new Error("Unknown AI provider specified.");
            }

            // Log success and the number of models found
            console.log(`Successfully fetched ${models.length} models for ${provider}:`, models);
            // If the API returned an empty list despite a valid key
            if (models.length === 0) {
                 setStatus(`No models found for ${provider}. The API key might be valid but have no associated models, or the API returned an empty list.`, true, settingsStatusElement);
            }
            return models; // Return the array of model IDs

        } catch (error) {
            // Catch any error thrown during the process (validation, fetch, parsing)
            console.error(`Error fetching ${provider} models:`, error);
            // Display the specific error message in the settings status area
            setStatus(`Error fetching ${provider} models: ${error.message}`, true, settingsStatusElement);
            // Reset dropdown to indicate error state clearly
             selectElement.innerHTML = `<option value="" disabled selected>Error loading models</option>`;
            selectElement.disabled = true; // Keep disabled on error
            return []; // Return empty array to signify failure
        }
    }

    /**
     * Populates a <select> dropdown element with AI model options.
     * @param {HTMLSelectElement} selectElement - The dropdown element to populate.
     * @param {string[]} models - An array of model ID strings.
     * @param {string | null} savedModel - The ID of the model that was previously saved/selected, or null.
     */
    function populateModelSelect(selectElement, models, savedModel) {
        const providerName = selectElement.id.includes('openai') ? 'OpenAI' : 'Gemini';
        console.log(`Populating ${providerName} models dropdown. Received ${models?.length ?? 0} models. Previously saved model: ${savedModel || 'None'}`);

        // Clear any existing options from the dropdown (very important!)
        selectElement.innerHTML = '';

        // Handle cases where no models were found or an error occurred during fetch
        if (!models || models.length === 0) {
            selectElement.disabled = true;
            // Check if the select element already has a message (e.g., "Loading...", "Error...", "Enter API Key...")
            // If not, provide a default "No models found" message.
            if (!selectElement.firstChild) {
                const defaultOption = document.createElement('option');
                defaultOption.value = "";
                defaultOption.textContent = `No models found for ${providerName}`;
                defaultOption.disabled = true;
                defaultOption.selected = true;
                selectElement.appendChild(defaultOption);
            }
             console.log(`${providerName} select dropdown disabled, no models to populate or error occurred.`);
            return; // Exit the function
        }

        // If we have models, ensure the dropdown is enabled
        selectElement.disabled = false;
        console.log(`${providerName} select dropdown enabled.`);

        // Add the default, non-selectable "Select a model" option
        const defaultOption = document.createElement('option');
        defaultOption.value = ""; // No value, so it's not accidentally saved
        defaultOption.textContent = "Select a model";
        defaultOption.disabled = true;
        defaultOption.selected = true; // Select this by default
        selectElement.appendChild(defaultOption);

        let savedModelFound = false; // Flag to track if the saved model exists in the new list

        // Iterate over the fetched model IDs and create an <option> for each
        models.forEach(modelId => {
            const option = document.createElement('option');
            option.value = modelId; // The value of the option is the model ID
            option.textContent = modelId; // The displayed text is also the model ID
            selectElement.appendChild(option);

            // If this model matches the previously saved model, select it
            if (modelId === savedModel) {
                option.selected = true;
                savedModelFound = true;
                defaultOption.selected = false; // Crucially, unselect the default option
                 console.log(`Found and selected previously saved model: ${savedModel}`);
            }
        });

        // If a model was saved previously but is NOT in the new list, inform the user.
        if (savedModel && !savedModelFound) {
            console.warn(`Previously saved model '${savedModel}' for ${providerName} was not found in the newly fetched list. User needs to re-select.`);
            // Optionally, provide feedback in the UI (can be subtle)
            setStatus(`Note: Previously saved ${providerName} model '${savedModel}' is no longer available. Please select a new one.`, false, settingsStatusElement);
             // In this case, the default "Select a model" option remains selected.
        } else if (!savedModel) {
             console.log(`No previously saved model for ${providerName}, leaving "Select a model" as default.`);
        }
    }

    /**
     * Loads settings (API keys, selected provider, selected models) from chrome.storage.local
     * and triggers fetching of models based on the loaded keys.
     */
    async function loadSettings() {
        console.log("Loading settings from chrome.storage.local...");
        chrome.storage.local.get(
            ['openaiKey', 'geminiKey', 'selectedProvider', 'openaiModel', 'geminiModel'],
            async (result) => {
                console.log("Loaded settings data:", result);

                // Destructure results for easier access
                const { openaiKey, geminiKey, selectedProvider, openaiModel, geminiModel } = result;

                // Populate the API key input fields
                openaiKeyInput.value = openaiKey || '';
                geminiKeyInput.value = geminiKey || '';

                // --- Fetch and Populate Models ---
                // Fetch models based on the loaded keys. Await ensures fetching completes
                // before we try to populate the dropdowns with the potentially saved selection.

                let fetchedOpenAIModels = [];
                if (openaiKey) {
                    // Only fetch if a key exists
                    fetchedOpenAIModels = await fetchModels('openai', openaiKey);
                } else {
                    // If no key, set the default message and disable
                     openaiModelSelect.disabled = true;
                     openaiModelSelect.innerHTML = '<option value="" disabled selected>Enter API Key to load models...</option>';
                }
                // Populate the dropdown using fetched models and the saved model selection
                populateModelSelect(openaiModelSelect, fetchedOpenAIModels, openaiModel);

                let fetchedGeminiModels = [];
                if (geminiKey) {
                    // Only fetch if a key exists
                    fetchedGeminiModels = await fetchModels('gemini', geminiKey);
                } else {
                    // If no key, set the default message and disable
                     geminiModelSelect.disabled = true;
                     geminiModelSelect.innerHTML = '<option value="" disabled selected>Enter API Key to load models...</option>';
                }
                 // Populate the dropdown using fetched models and the saved model selection
                 populateModelSelect(geminiModelSelect, fetchedGeminiModels, geminiModel);

                // Set the main AI Provider dropdown selection
                if (selectedProvider) {
                    aiProviderSelect.value = selectedProvider;
                }
                 console.log("Settings load and initial model fetch complete.");
            }
        );
    }

    /**
     * Generates the system prompt instructing the AI on how to format the n8n JSON.
     * @returns {string} The system prompt text.
     */
    function getSystemPrompt() {
        return `You are an expert n8n workflow builder. Your task is to generate JSON code representing an n8n workflow or a single n8n node based on the user's description.

RULES:
1.  **Output ONLY the raw JSON code.** Do NOT include any explanations, introductions, markdown formatting (like \`\`\`json), or any text outside the JSON structure.
2.  **Workflow JSON:** If the user asks for a workflow, the JSON must be an object containing 'nodes' (an array) and 'connections' (an object). Ensure node positions (position property) are reasonable (e.g., [800, 300], [1000, 300], [1200, 300]). Include placeholder credentials where necessary (e.g., "credentialName").
3.  **Single Node JSON:** If the user asks for a specific node, output ONLY the JSON for that single node object. Do not wrap it in 'nodes' or 'connections'.
4.  **Accuracy:** Try to use correct node types (e.g., 'n8n-nodes-base.httpRequest', 'n8n-nodes-base.googleSheets', 'n8n-nodes-base.webhook') and parameter names based on n8n documentation. If unsure, make a reasonable guess for placeholders.
5.  **Placeholders:** Use descriptive placeholders for values that the user needs to fill in (e.g., "{{ $json.body.someValue }}", "YOUR_SHEET_ID", "YOUR_EMAIL_ADDRESS"). Do not hardcode example data unless specifically requested.
6.  **Connections:** For workflows, ensure the 'connections' object correctly links the nodes based on the described flow. The structure is {"OutputNodeName": {"main": [{"node": "InputNodeName", "type": "main"}]}}. Ensure node names in connections match the 'name' property in the nodes array. Use standard n8n connection types like 'main'.
7.  **Simplicity:** Start with the simplest valid structure that meets the request. Add complexity only if explicitly asked.
8.  **Focus:** Generate JSON compatible with n8n version 1.x.
9.  **NO EXTRA TEXT:** Absolutely no text before or after the JSON block. The entire output must be parseable JSON. Ensure correct JSON syntax (commas, braces, brackets).
10. **For API integrations without specific nodes, use 'n8n-nodes-base.httpRequest' as the node type. Provide a basic HTTP request structure with placeholders for URL, method, and headers. Do not include authentication details unless specified by the user.
11. **For data manipulation, use code node and For triggers, use webhook/cron nodes
12. **For ai agent node use '@n8n/n8n-nodes-langchain.agent' and for tools use '@n8n/n8n-nodes-langchain.tools' node type and also for llm tool for ai agent use (example: Gemini): '@n8n/n8n-nodes-langchain.lmChatGoogleGemini' and if we using the llms for '@n8n/n8n-nodes-langchain.agent' we should use '@n8n/n8n-nodes-langchain.lmChatGoogleGemini' as a sub node as chat model, for detailed understanding check n8n documentation.
13. **use '@n8n/n8n-nodes-langchain.agent' for generating emails and other ai functions always if not mentioned any other node type.
14. **AI Agent Node Logic:
    When the user requests an AI-powered action (like generating an email, summarizing text, answering a question, etc.), always use the '@n8n/n8n-nodes-langchain.agent' node.
    Attach at least one chat model sub-node (e.g., '@n8n/n8n-nodes-langchain.lmChatGoogleGemini' or '@n8n/n8n-nodes-langchain.lmChatOpenAI') as a child of the AI Agent node to function as the LLM.
    If external tools are needed (e.g., web scraping, searching, or other API integrations), add '@n8n/n8n-nodes-langchain.tools' nodes as sub-nodes and connect them to the AI Agent node.
    For every AI Agent node, ensure the prompt is set either by taking input from the previous node (e.g., 'chatInput') or by defining it explicitly in the prompt field.
    If the workflow involves chat or conversation, optionally add a memory sub-node to the AI Agent node to maintain context between messages.
    Always ensure the AI Agent node is properly connected to its sub-nodes (chat model, tools, memory) and that these are included in the 'nodes' array and referenced in the 'connections' object.
    For workflows using the AI Agent, the structure should clearly show the AI Agent node, its required sub-nodes, and how they interact with the rest of the workflow.
    Use the 'Tools Agent' configuration unless otherwise specified, as this is the default and recommended setting in n8n v1.82+.`;
    }


    // --- Event Listeners ---

    // Tab Switching Logic
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            // Get the target tab ID from the button's data attribute
            const tabId = button.dataset.tab;

            // Remove 'active' class from all tab buttons and content panes
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            // Add 'active' class to the clicked button and corresponding content pane
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            // Clear status messages when switching tabs
            clearStatus(statusElement); // Clear generate tab status
            clearStatus(settingsStatusElement); // Clear settings tab status
            copyMessageElement.style.display = 'none'; // Hide copy message
        });
    });

    // "Generate n8n JSON" Button Click Handler
    generateBtn.addEventListener('click', async () => {
        console.log("Generate button clicked.");
        // Get current values from the UI
        const provider = aiProviderSelect.value;
        const prompt = promptTextarea.value.trim();

        // Clear previous statuses and output
        clearStatus(statusElement);
        copyMessageElement.style.display = 'none'; // Hide previous copy message
        outputTextarea.value = ''; // Clear previous JSON output
        copyJsonBtn.disabled = true; // Disable copy button until generation succeeds

        // Basic validation: Check if prompt is empty
        if (!prompt) {
            setStatus('Please enter a description for the node or workflow.', true, statusElement);
            return;
        }

        // Disable button and show generating status
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';
        setStatus('Generating JSON, please wait...', false, statusElement);

        // Retrieve necessary API key and selected model from storage
        chrome.storage.local.get([`${provider}Key`, `${provider}Model`], async (result) => {
            const apiKey = result[`${provider}Key`];
            const model = result[`${provider}Model`]; // Get the selected model for the chosen provider
             console.log(`Using provider: ${provider}, model: ${model}, API key present: ${!!apiKey}`);

            // --- Input Validation ---
            if (!apiKey) {
                setStatus(`API key for ${provider} is not set. Please set it in the Settings tab.`, true, statusElement);
                generateBtn.disabled = false; // Re-enable button
                generateBtn.textContent = 'Generate n8n JSON';
                return;
            }
             if (!model) {
                setStatus(`Model for ${provider} is not selected or invalid. Please select one in the Settings tab.`, true, statusElement);
                generateBtn.disabled = false; // Re-enable button
                 generateBtn.textContent = 'Generate n8n JSON';
                return;
            }
            // --- End Validation ---

            const systemMessage = getSystemPrompt();
            let requestBody, headers;
            let apiUrl = ''; // API URL will be determined by provider

            try {
                // --- Prepare API Request based on Provider ---
                if (provider === 'openai') {
                    apiUrl = API_ENDPOINTS.openai; // Chat completions endpoint
                    headers = {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    };
                    requestBody = JSON.stringify({
                        model: model, // Use the selected model
                        messages: [
                            { role: "system", content: systemMessage },
                            { role: "user", content: prompt }
                        ],
                        temperature: 0.2, // Lower temperature for more deterministic JSON output
                        // Request JSON output format if supported (newer GPT models)
                         response_format: { type: "json_object" },
                    });
                     console.log("Prepared OpenAI request to:", apiUrl, "with body:", requestBody);

                } else if (provider === 'gemini') {
                    // Use the specific model for the generation endpoint URL
                    apiUrl = `${API_ENDPOINTS.gemini}${model}:generateContent?key=${apiKey}`;
                    headers = {
                        'Content-Type': 'application/json'
                    };
                    // Gemini API requires a different request structure
                    requestBody = JSON.stringify({
                        contents: [
                            // Combine system prompt and user prompt for Gemini
                            { role: "user", parts: [{ text: systemMessage + "\n\nUser Request:\n" + prompt }] }
                        ],
                         generationConfig: {
                             // Attempt to enforce JSON output (might depend on model version)
                             responseMimeType: "application/json",
                             temperature: 0.2, // Lower temperature
                         }
                    });
                     console.log("Prepared Gemini request to:", apiUrl, "with body:", requestBody);

                 } else {
                     // Should not happen with the current UI
                     throw new Error("Invalid AI provider selected.");
                 }

                // --- Make the API Call ---
                console.log(`Sending API request to ${provider}...`);
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: headers,
                    body: requestBody
                });
                 console.log(`API response status: ${response.status} ${response.statusText}`);

                // Handle API errors (non-2xx status codes)
                if (!response.ok) {
                     const errorText = await response.text(); // Get raw error text for logging
                     console.error(`API Error Response Text (${response.status}):`, errorText);
                     let errorMessage = `API request failed: ${response.status} ${response.statusText}.`;
                     try {
                         // Attempt to parse JSON error for more details
                         const errorData = JSON.parse(errorText);
                         errorMessage += ` ${errorData?.error?.message || 'No details available.'}`;
                     } catch (e) {
                         // If error response is not JSON, append truncated raw text
                         errorMessage += ` Response: ${errorText.substring(0, 150)}...`;
                     }
                    throw new Error(errorMessage); // Throw error to be caught below
                }

                // Parse the successful JSON response
                const data = await response.json();
                 console.log("API Success Response Body:", data);

                // --- Extract and Process AI's Response ---
                let jsonOutput = '';
                if (provider === 'openai') {
                    // Extract content from OpenAI's response structure
                    jsonOutput = data.choices?.[0]?.message?.content;
                } else if (provider === 'gemini') {
                    // Check for safety blocks or other finish reasons in Gemini
                     if (data.candidates?.[0]?.finishReason && data.candidates?.[0]?.finishReason !== 'STOP') {
                         const reason = data.candidates?.[0]?.finishReason;
                         const safetyRatings = data.promptFeedback?.safetyRatings || data.candidates?.[0]?.safetyRatings;
                          console.warn("Gemini response potentially blocked:", reason, safetyRatings);
                         throw new Error(`Generation stopped by Gemini due to ${reason}. Check API documentation or prompt safety.`);
                     }
                    // Extract text content from Gemini's response structure
                    jsonOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
                }

                // Check if we actually got content back
                if (!jsonOutput) {
                    console.error("Unexpected API response structure or empty content:", data);
                    throw new Error("Received empty or unexpected content from the AI API.");
                }

                // --- Validate and Display JSON Output ---
                 console.log("Raw JSON output from AI:", jsonOutput);
                 try {
                     // Attempt to clean potential markdown fences and parse the JSON
                     const cleanedJson = jsonOutput
                        .replace(/^```json\s*/, '') // Remove leading ```json
                        .replace(/```\s*$/, '')     // Remove trailing ```
                        .trim();                    // Trim whitespace
                     const parsedJson = JSON.parse(cleanedJson); // Validate if it's valid JSON

                     // Pretty-print the valid JSON in the output textarea
                     outputTextarea.value = JSON.stringify(parsedJson, null, 2);
                     setStatus('JSON generated successfully!', false, statusElement);
                      copyJsonBtn.disabled = false; // Enable the copy button now
                      console.log("Successfully parsed and displayed JSON.");
                 } catch (e) {
                     // If JSON parsing fails, show the raw output and warn the user
                     console.error("Failed to parse JSON from AI response:", e);
                     outputTextarea.value = jsonOutput; // Display raw output for debugging
                     setStatus('Generated content, but it might not be valid JSON. Please review the output carefully.', true, statusElement);
                      copyJsonBtn.disabled = false; // Still allow copying the raw output
                 }

            } catch (error) {
                // Catch any errors during the API call or processing
                console.error('Error during JSON generation process:', error);
                setStatus(`Error: ${error.message}`, true, statusElement);
                // Ensure copy button remains disabled on failure
                copyJsonBtn.disabled = true;
            } finally {
                // Always re-enable the generate button and restore its text
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate n8n JSON';
                 console.log("Generation process finished.");
            }
        });
    });


    // "Copy Generated JSON" Button Click Handler
    copyJsonBtn.addEventListener('click', () => {
        const jsonToCopy = outputTextarea.value;
        // Don't attempt to copy if the textarea is empty
        if (!jsonToCopy) {
            console.warn("Copy button clicked, but output area is empty.");
            return;
        }

        // Use the Clipboard API to write text
        navigator.clipboard.writeText(jsonToCopy)
            .then(() => {
                // Show success message using the helper function
                showCopyMessage('Copied! Switch to n8n & press Ctrl+V / Cmd+V');
                console.log('JSON copied successfully to clipboard.');
            })
            .catch(err => {
                 // Show error message using the helper function
                showCopyMessage('Failed to copy JSON to clipboard!', true);
                console.error('Failed to copy JSON to clipboard:', err);
            });
    });

    // "Save Settings" Button Click Handler
    saveSettingsBtn.addEventListener('click', () => {
        // Clear previous settings status message
        clearStatus(settingsStatusElement);

        // Get current values from settings inputs
        const openaiKey = openaiKeyInput.value.trim();
        const geminiKey = geminiKeyInput.value.trim();
        const selectedProvider = aiProviderSelect.value; // Save the selected provider in the generate tab
        const openaiModel = openaiModelSelect.value; // Get selected model value
        const geminiModel = geminiModelSelect.value; // Get selected model value

        console.log("Attempting to save settings:", {
            openaiKeyProvided: !!openaiKey, // Log boolean presence, not the key itself
            geminiKeyProvided: !!geminiKey,   // Log boolean presence, not the key itself
            selectedProvider,
            openaiModel,
            geminiModel
        });

        // --- Validation ---
        // Prevent saving if a key is present but no model is selected (and models were loaded)
        let validationError = false;
        if (openaiKey && !openaiModelSelect.disabled && !openaiModel) {
            setStatus('Please select an OpenAI model before saving.', true, settingsStatusElement);
            validationError = true;
        }
        // Check Gemini only if no OpenAI error was found yet
        if (!validationError && geminiKey && !geminiModelSelect.disabled && !geminiModel) {
             setStatus('Please select a Gemini model before saving.', true, settingsStatusElement);
             validationError = true;
        }

        // If validation failed, stop the save process
        if (validationError) {
             console.log("Save prevented due to missing model selection.");
             // Optionally hide the validation error message after a delay
             // setTimeout(() => clearStatus(settingsStatusElement), 4000);
             return;
        }
        // --- End Validation ---

        // Save the settings to chrome.storage.local
        chrome.storage.local.set({
            openaiKey: openaiKey,
            geminiKey: geminiKey,
            selectedProvider: selectedProvider,
            openaiModel: openaiModel,
            geminiModel: geminiModel
        }, () => {
            // Check for potential storage errors (though `set` rarely errors like `get`)
            if (chrome.runtime.lastError) {
                 console.error("Error saving settings to chrome.storage:", chrome.runtime.lastError);
                 setStatus(`Error saving settings: ${chrome.runtime.lastError.message}`, true, settingsStatusElement);
            } else {
                 console.log("Settings saved successfully to chrome.storage.");
                setStatus('Settings saved successfully!', false, settingsStatusElement);
                // Hide the success message after a brief period
                setTimeout(() => clearStatus(settingsStatusElement), 3000);
            }
        });
    });

    // --- API Key Input Change Listeners ---
    // Use the 'change' event, which fires when the input loses focus after its value was modified.
    // This avoids excessive API calls while the user is typing.

    openaiKeyInput.addEventListener('change', async (event) => {
        const key = event.target.value.trim();
         console.log("OpenAI key input 'change' event fired. New key presence:", !!key);
        // Fetch models using the potentially new key. Await ensures fetch finishes before populate.
        const models = await fetchModels('openai', key);
        // Populate the dropdown. Pass null for savedModel to force re-selection if the key changed.
        populateModelSelect(openaiModelSelect, models, null);
    });

    geminiKeyInput.addEventListener('change', async (event) => {
        const key = event.target.value.trim();
         console.log("Gemini key input 'change' event fired. New key presence:", !!key);
        // Fetch models using the potentially new key.
        const models = await fetchModels('gemini', key);
        // Populate the dropdown. Pass null for savedModel to force re-selection.
        populateModelSelect(geminiModelSelect, models, null);
    });

    // --- Initial Load ---
    // Load saved settings and trigger initial model fetching when the popup opens.
    loadSettings();
    // Ensure the copy button is disabled initially until JSON is generated.
    copyJsonBtn.disabled = true;

    console.log("n8n Workflow Builder AI popup initialized.");
}); // End DOMContentLoaded
