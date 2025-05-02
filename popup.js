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
 * - Remembers the last selected AI provider. // ADDED
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
    const outputGroupElement = document.querySelector('.output-group'); // Get the output group container

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
        openai: 'https://api.openai.com/v1/chat/completions',
        gemini: 'https://generativelanguage.googleapis.com/v1beta/models/',
        openai_models: 'https://api.openai.com/v1/models',
        gemini_models: 'https://generativelanguage.googleapis.com/v1beta/models',
    };

    // --- Helper Functions ---
    function setStatus(message, isError = false, element = statusElement) {
        element.textContent = message;
        element.className = `status-message ${isError ? 'error' : 'success'}`;
        element.style.display = message ? 'block' : 'none';
    }

    function clearStatus(element = statusElement) {
        element.textContent = '';
        element.className = 'status-message';
        element.style.display = 'none';
    }

    function showCopyMessage(message, isError = false) {
        copyMessageElement.textContent = message;
        copyMessageElement.className = `status-message ${isError ? 'error' : ''}`;
        copyMessageElement.style.display = 'block';
        setTimeout(() => {
            copyMessageElement.style.display = 'none';
            copyMessageElement.className = 'status-message';
        }, 3500);
    }

    async function fetchModels(provider, apiKey) {
        clearStatus(settingsStatusElement);
        console.log(`Attempting to fetch models for ${provider}...`);
        const selectElement = provider === 'openai' ? openaiModelSelect : geminiModelSelect;
        selectElement.disabled = true;
        selectElement.innerHTML = '<option value="" disabled selected>Loading models...</option>';

        if (!apiKey) {
            console.log(`No API key provided for ${provider}. Aborting fetch.`);
            selectElement.innerHTML = `<option value="" disabled selected>Enter ${provider === 'openai' ? 'OpenAI' : 'Gemini'} API Key...</option>`;
            return [];
        }

        let url = '';
        let headers = {};
        let models = [];

        try {
            if (provider === 'openai') {
                if (!apiKey.startsWith('sk-')) {
                    throw new Error('Invalid OpenAI Key format (must start with sk-).');
                }
                url = API_ENDPOINTS.openai_models;
                headers = { 'Authorization': `Bearer ${apiKey}` };
                console.log(`Fetching OpenAI models from: ${url}`);
                const response = await fetch(url, { method: 'GET', headers: headers });
                console.log(`OpenAI models API response status: ${response.status} ${response.statusText}`);
                if (!response.ok) {
                    let errorMsg = `OpenAI API Error (${response.status}): ${response.statusText}`;
                    try {
                        const errorData = await response.json();
                        console.error("OpenAI API Error Response Body:", errorData);
                        errorMsg += ` - ${errorData?.error?.message || 'Unknown error details'}`;
                    } catch (e) { console.error("Failed to parse OpenAI error response body:", e); }
                    throw new Error(errorMsg);
                }
                const data = await response.json();
                console.log("OpenAI models API Success Response Body:", data);
                if (!data || !data.data || !Array.isArray(data.data)) {
                     throw new Error("Unexpected response structure from OpenAI /v1/models API.");
                }
                models = data.data
                    .map(model => model.id)
                    .filter(id => id.includes('gpt') || id.includes('text-davinci') || id.includes('instruct'))
                    .sort();

            } else if (provider === 'gemini') {
                if (apiKey.length < 30) {
                     throw new Error('Invalid Gemini Key format (seems too short).');
                }
                url = `${API_ENDPOINTS.gemini_models}?key=${apiKey}`;
                console.log(`Fetching Gemini models from: ${url}`);
                const response = await fetch(url, { method: 'GET' });
                console.log(`Gemini models API response status: ${response.status} ${response.statusText}`);
                if (!response.ok) {
                    let errorMsg = `Gemini API Error (${response.status}): ${response.statusText}`;
                    try {
                        const errorData = await response.json();
                        console.error("Gemini API Error Response Body:", errorData);
                        errorMsg += ` - ${errorData?.error?.message || 'Unknown error details'}`;
                    } catch (e) { console.error("Failed to parse Gemini error response body:", e); }
                    throw new Error(errorMsg);
                }
                const data = await response.json();
                console.log("Gemini models API Success Response Body:", data);
                 if (!data || !data.models || !Array.isArray(data.models)) {
                     throw new Error("Unexpected response structure from Gemini models API.");
                 }
                models = data.models
                   .map(model => model.name.replace(/^models\//, ''))
                   .sort();
            } else {
                throw new Error("Unknown AI provider specified.");
            }

            console.log(`Successfully fetched ${models.length} models for ${provider}:`, models);
            if (models.length === 0) {
                 setStatus(`No models found for ${provider}. Key might be valid but have no models, or API returned empty.`, true, settingsStatusElement); // Adjusted message
            }
            return models;

        } catch (error) {
            console.error(`Error fetching ${provider} models:`, error);
            setStatus(`Error fetching ${provider} models: ${error.message}`, true, settingsStatusElement);
             selectElement.innerHTML = `<option value="" disabled selected>Error loading models</option>`;
            selectElement.disabled = true;
            return [];
        }
    }

    function populateModelSelect(selectElement, models, savedModel) {
        const providerName = selectElement.id.includes('openai') ? 'OpenAI' : 'Gemini';
        console.log(`Populating ${providerName} models dropdown. Received ${models?.length ?? 0} models. Previously saved model: ${savedModel || 'None'}`);
        selectElement.innerHTML = '';

        if (!models || models.length === 0) {
            selectElement.disabled = true;
            if (!selectElement.firstChild) {
                const defaultOption = document.createElement('option');
                defaultOption.value = "";
                defaultOption.textContent = `No models available`; // Simpler default message
                defaultOption.disabled = true;
                defaultOption.selected = true;
                selectElement.appendChild(defaultOption);
            }
             console.log(`${providerName} select dropdown disabled, no models to populate or error occurred.`);
            return;
        }

        selectElement.disabled = false;
        console.log(`${providerName} select dropdown enabled.`);

        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = "Select a model";
        defaultOption.disabled = true;
        defaultOption.selected = true;
        selectElement.appendChild(defaultOption);

        let savedModelFound = false;
        models.forEach(modelId => {
            const option = document.createElement('option');
            option.value = modelId;
            option.textContent = modelId;
            selectElement.appendChild(option);
            if (modelId === savedModel) {
                option.selected = true;
                savedModelFound = true;
                defaultOption.selected = false;
                 console.log(`Found and selected previously saved model: ${savedModel}`);
            }
        });

        if (savedModel && !savedModelFound) {
            console.warn(`Previously saved model '${savedModel}' for ${providerName} was not found in the newly fetched list. User needs to re-select.`);
            setStatus(`Note: Saved ${providerName} model '${savedModel}' unavailable. Select a new one.`, false, settingsStatusElement);
        } else if (!savedModel) {
             console.log(`No previously saved model for ${providerName}, leaving "Select a model" as default.`);
        }
    }

    async function loadSettings() {
        console.log("Loading settings from chrome.storage.local...");
        // --- ADDED selectedProvider to the list of keys to get ---
        chrome.storage.local.get(
            ['openaiKey', 'geminiKey', 'selectedProvider', 'openaiModel', 'geminiModel'],
            async (result) => {
                console.log("Loaded settings data:", result);
                const { openaiKey, geminiKey, selectedProvider, openaiModel, geminiModel } = result;

                openaiKeyInput.value = openaiKey || '';
                geminiKeyInput.value = geminiKey || '';

                // --- Set the main AI Provider dropdown selection FIRST ---
                if (selectedProvider && aiProviderSelect.querySelector(`option[value="${selectedProvider}"]`)) {
                    aiProviderSelect.value = selectedProvider;
                     console.log(`Restored selected provider to: ${selectedProvider}`);
                } else {
                    console.log(`No saved provider found or invalid value "${selectedProvider}", defaulting to ${aiProviderSelect.value}.`);
                    // If no provider was saved, save the current default one
                     chrome.storage.local.set({ selectedProvider: aiProviderSelect.value }, () => {
                         console.log(`Saved default provider selection: ${aiProviderSelect.value}`);
                     });
                }

                // --- Fetch and Populate Models (logic remains the same) ---
                let fetchedOpenAIModels = [];
                if (openaiKey) {
                    fetchedOpenAIModels = await fetchModels('openai', openaiKey);
                } else {
                     openaiModelSelect.disabled = true;
                     openaiModelSelect.innerHTML = '<option value="" disabled selected>Enter API Key to load models...</option>';
                }
                populateModelSelect(openaiModelSelect, fetchedOpenAIModels, openaiModel);

                let fetchedGeminiModels = [];
                if (geminiKey) {
                    fetchedGeminiModels = await fetchModels('gemini', geminiKey);
                } else {
                     geminiModelSelect.disabled = true;
                     geminiModelSelect.innerHTML = '<option value="" disabled selected>Enter API Key to load models...</option>';
                }
                 populateModelSelect(geminiModelSelect, fetchedGeminiModels, geminiModel);

                 console.log("Settings load and initial model fetch complete.");
            }
        );
    }

    function getSystemPrompt() {
        // System prompt content remains the same...
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
            const tabId = button.dataset.tab;
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            clearStatus(statusElement);
            clearStatus(settingsStatusElement);
            copyMessageElement.style.display = 'none';
        });
    });

    // --- ADDED: AI Provider Selection Change Listener ---
    aiProviderSelect.addEventListener('change', (event) => {
        const newProvider = event.target.value;
        console.log(`AI provider changed to: ${newProvider}`);
        // Save the new selection immediately
        chrome.storage.local.set({ selectedProvider: newProvider }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error saving selected provider:", chrome.runtime.lastError);
            } else {
                console.log(`Saved selected provider (${newProvider}) to chrome.storage.`);
            }
        });
    });
    // --- END ADDED Listener ---

    // "Generate n8n JSON" Button Click Handler
    generateBtn.addEventListener('click', async () => {
        console.log("Generate button clicked.");
        const provider = aiProviderSelect.value;
        const prompt = promptTextarea.value.trim();

        clearStatus(statusElement);
        copyMessageElement.style.display = 'none';
        outputTextarea.value = '';
        copyJsonBtn.disabled = true;

        if (!prompt) {
            setStatus('Please enter a description for the node or workflow.', true, statusElement);
            outputGroupElement.style.display = 'none';
            return;
        }

        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';
        setStatus('Generating JSON, please wait...', false, statusElement);
        outputGroupElement.style.display = 'block'; // Show output area

        chrome.storage.local.get([`${provider}Key`, `${provider}Model`], async (result) => {
            const apiKey = result[`${provider}Key`];
            const model = result[`${provider}Model`];
            console.log(`Using provider: ${provider}, model: ${model}, API key present: ${!!apiKey}`);

            if (!apiKey) {
                setStatus(`API key for ${provider} is not set. Go to Settings.`, true, statusElement); // Shortened msg
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate n8n JSON';
                return;
            }
            if (!model) {
                setStatus(`Model for ${provider} is not selected. Go to Settings.`, true, statusElement); // Shortened msg
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate n8n JSON';
                return;
            }

            const systemMessage = getSystemPrompt();
            let requestBody, headers;
            let apiUrl = '';

            try {
                if (provider === 'openai') {
                    apiUrl = API_ENDPOINTS.openai;
                    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
                    requestBody = JSON.stringify({
                        model: model,
                        messages: [ { role: "system", content: systemMessage }, { role: "user", content: prompt } ],
                        temperature: 0.2,
                        response_format: { type: "json_object" },
                    });
                     console.log("Prepared OpenAI request to:", apiUrl);

                } else if (provider === 'gemini') {
                    apiUrl = `${API_ENDPOINTS.gemini}${model}:generateContent?key=${apiKey}`;
                    headers = { 'Content-Type': 'application/json' };
                    requestBody = JSON.stringify({
                        contents: [ { role: "user", parts: [{ text: systemMessage + "\n\nUser Request:\n" + prompt }] } ],
                        generationConfig: { responseMimeType: "application/json", temperature: 0.2, }
                    });
                     console.log("Prepared Gemini request to:", apiUrl);

                 } else {
                     throw new Error("Invalid AI provider selected.");
                 }

                console.log(`Sending API request to ${provider}...`);
                const response = await fetch(apiUrl, { method: 'POST', headers: headers, body: requestBody });
                 console.log(`API response status: ${response.status} ${response.statusText}`);

                if (!response.ok) {
                     const errorText = await response.text();
                     console.error(`API Error Response Text (${response.status}):`, errorText);
                     let errorMessage = `API request failed: ${response.status} ${response.statusText}.`;
                     try {
                         const errorData = JSON.parse(errorText);
                         errorMessage += ` ${errorData?.error?.message || 'No details.'}`; // Shorter error append
                     } catch (e) { errorMessage += ` Response: ${errorText.substring(0, 100)}...`; } // Shorter raw text
                    throw new Error(errorMessage);
                }

                const data = await response.json();
                 console.log("API Success Response Body (structure may vary):", data);

                let jsonOutput = '';
                if (provider === 'openai') {
                    jsonOutput = data.choices?.[0]?.message?.content;
                } else if (provider === 'gemini') {
                     if (data.candidates?.[0]?.finishReason && data.candidates?.[0]?.finishReason !== 'STOP') {
                         const reason = data.candidates?.[0]?.finishReason;
                          console.warn("Gemini response potentially blocked:", reason);
                         throw new Error(`Generation stopped by Gemini due to ${reason}.`); // Shortened msg
                     }
                    jsonOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
                }

                if (!jsonOutput) {
                    console.error("Unexpected API response structure or empty content:", data);
                    throw new Error("Received empty/unexpected content from AI."); // Shortened msg
                }

                 console.log("Raw JSON output from AI:", jsonOutput);
                 try {
                     const cleanedJson = jsonOutput.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
                     const parsedJson = JSON.parse(cleanedJson);
                     outputTextarea.value = JSON.stringify(parsedJson, null, 2);
                     setStatus('JSON generated successfully!', false, statusElement);
                     copyJsonBtn.disabled = false;
                     console.log("Successfully parsed and displayed JSON.");
                 } catch (e) {
                     console.error("Failed to parse JSON from AI response:", e);
                     outputTextarea.value = jsonOutput;
                     setStatus('Generated content may not be valid JSON. Review carefully.', true, statusElement); // Shortened msg
                     copyJsonBtn.disabled = false;
                 }

            } catch (error) {
                console.error('Error during JSON generation process:', error);
                setStatus(`Error: ${error.message}`, true, statusElement);
                copyJsonBtn.disabled = true;
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate n8n JSON';
                console.log("Generation process finished.");
            }
        });
    });


    // "Copy Generated JSON" Button Click Handler
    copyJsonBtn.addEventListener('click', () => {
        const jsonToCopy = outputTextarea.value;
        if (!jsonToCopy) {
            console.warn("Copy button clicked, but output area is empty.");
            return;
        }
        navigator.clipboard.writeText(jsonToCopy)
            .then(() => {
                showCopyMessage('Copied! Switch to n8n & press Ctrl+V / Cmd+V');
                console.log('JSON copied successfully to clipboard.');
            })
            .catch(err => {
                showCopyMessage('Failed to copy JSON to clipboard!', true);
                console.error('Failed to copy JSON to clipboard:', err);
            });
    });

    // "Save Settings" Button Click Handler
    saveSettingsBtn.addEventListener('click', () => {
        clearStatus(settingsStatusElement);
        const openaiKey = openaiKeyInput.value.trim();
        const geminiKey = geminiKeyInput.value.trim();
        // const selectedProvider = aiProviderSelect.value; // No need to save this here anymore
        const openaiModel = openaiModelSelect.value;
        const geminiModel = geminiModelSelect.value;

        console.log("Attempting to save settings (excluding provider):", {
            openaiKeyProvided: !!openaiKey,
            geminiKeyProvided: !!geminiKey,
            openaiModel,
            geminiModel
        });

        let validationError = false;
        if (openaiKey && !openaiModelSelect.disabled && !openaiModel) {
            setStatus('Please select an OpenAI model before saving.', true, settingsStatusElement);
            validationError = true;
        }
        if (!validationError && geminiKey && !geminiModelSelect.disabled && !geminiModel) {
             setStatus('Please select a Gemini model before saving.', true, settingsStatusElement);
             validationError = true;
        }

        if (validationError) {
             console.log("Save prevented due to missing model selection.");
             return;
        }

        // Save only keys and models here
        chrome.storage.local.set({
            openaiKey: openaiKey,
            geminiKey: geminiKey,
            // selectedProvider: selectedProvider, // REMOVED - saved on change now
            openaiModel: openaiModel,
            geminiModel: geminiModel
        }, () => {
            if (chrome.runtime.lastError) {
                 console.error("Error saving settings:", chrome.runtime.lastError); // Shortened msg
                 setStatus(`Error saving settings: ${chrome.runtime.lastError.message}`, true, settingsStatusElement);
            } else {
                 console.log("Settings (keys/models) saved successfully."); // Adjusted log
                setStatus('Settings saved successfully!', false, settingsStatusElement);
                setTimeout(() => clearStatus(settingsStatusElement), 3000);
            }
        });
    });

    // API Key Input Change Listeners
    openaiKeyInput.addEventListener('change', async (event) => {
        const key = event.target.value.trim();
         console.log("OpenAI key input 'change' event fired. New key presence:", !!key);
        const models = await fetchModels('openai', key);
        populateModelSelect(openaiModelSelect, models, null); // Force re-select on key change
    });

    geminiKeyInput.addEventListener('change', async (event) => {
        const key = event.target.value.trim();
         console.log("Gemini key input 'change' event fired. New key presence:", !!key);
        const models = await fetchModels('gemini', key);
        populateModelSelect(geminiModelSelect, models, null); // Force re-select on key change
    });

    // --- Initial Load ---
    loadSettings(); // Loads keys, provider preference, models
    copyJsonBtn.disabled = true;
    if (outputGroupElement) {
        outputGroupElement.style.display = 'none';
    }

    console.log("n8n Workflow Builder AI popup initialized.");
}); // End DOMContentLoaded
