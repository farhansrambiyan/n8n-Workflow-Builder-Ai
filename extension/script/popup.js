// Authentication functions
function checkAuthenticationStatus() {
  chrome.storage.local.get(['userAuthData', 'isAuthenticated'], (data) => {
    if (data.isAuthenticated && data.userAuthData) {
      // After auth, decide whether to show onboarding or main
      maybeShowOnboardingThenMain();
    } else {
      showLoginScreen();
    }
  });
}

function showLoginScreen() {
  const loginScreen = document.getElementById('login-screen');
  const mainContent = document.getElementById('main-content');
  
  if (loginScreen && mainContent) {
    loginScreen.style.display = 'flex';
    mainContent.style.display = 'none';
    
    // Clear any existing error messages
    const errorMessage = document.getElementById('auth-error-message');
    if (errorMessage) {
      errorMessage.style.display = 'none';
    }
    
    // Add event listener for sign in button
    const signInBtn = document.getElementById('signInBtn');
    if (signInBtn) {
      signInBtn.onclick = () => {
        // Open the Firebase authentication page
        chrome.tabs.create({
          url: 'https://login.n8ncopilot.com/option'
        });
      };
    }
  }
}

function showMainContent() {
  const loginScreen = document.getElementById('login-screen');
  const mainContent = document.getElementById('main-content');
  const onboarding = document.getElementById('onboarding');
  
  if (loginScreen && mainContent) {
    loginScreen.style.display = 'none';
    mainContent.style.display = 'flex';
    if (onboarding) onboarding.style.display = 'none';
    
    // Update user info display
    updateUserInfo();
  }
}

// Onboarding flow
function maybeShowOnboardingThenMain() {
  chrome.storage.local.get(['onboardingCompleted'], (data) => {
    if (data.onboardingCompleted) {
      showMainContent();
    } else {
      showOnboarding();
    }
  });
}

function showOnboarding() {
  const loginScreen = document.getElementById('login-screen');
  const mainContent = document.getElementById('main-content');
  const onboarding = document.getElementById('onboarding');
  if (loginScreen) loginScreen.style.display = 'none';
  if (mainContent) mainContent.style.display = 'none';
  if (onboarding) onboarding.style.display = 'flex';

  initOnboardingSlides();
}

function initOnboardingSlides() {
  const slides = Array.from(document.querySelectorAll('.slide'));
  const nextBtn = document.getElementById('onboardingNext');
  const prevBtn = document.getElementById('onboardingPrev');
  const getStartedBtn = document.getElementById('onboardingGetStarted');
  const dotsContainer = document.getElementById('onboardingDots');
  if (!slides.length || !nextBtn || !prevBtn || !dotsContainer) return;

  let current = 0;

  // Build dots
  dotsContainer.innerHTML = '';
  for (let i = 0; i < slides.length; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dotsContainer.appendChild(dot);
  }

  const update = () => {
    slides.forEach((s, i) => s.classList.toggle('active', i === current));
    const dots = dotsContainer.querySelectorAll('.dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
    
    // Hide back button on first slide completely
    prevBtn.style.visibility = current === 0 ? 'hidden' : 'visible';
    
    const onLast = current === slides.length - 1;
    nextBtn.style.visibility = onLast ? 'hidden' : 'visible';
    if (getStartedBtn) getStartedBtn.style.display = onLast ? 'inline-block' : 'none';
  };

  nextBtn.onclick = () => { if (current < slides.length - 1) { current++; update(); } };
  prevBtn.onclick = () => { if (current > 0) { current--; update(); } };
  if (getStartedBtn) getStartedBtn.onclick = completeOnboarding;
  update();
}

function completeOnboarding() {
  chrome.storage.local.set({ onboardingCompleted: true }, () => {
    showMainContent();
  });
}

function updateUserInfo() {
  chrome.storage.local.get(['userAuthData'], (data) => {
    // Update profile tab content
    updateProfileTab(data.userAuthData);
  });
}

function updateProfileTab(userAuthData) {
  const profileName = document.getElementById('profileName');
  const profileEmail = document.getElementById('profileEmail');
  const profileAvatar = document.getElementById('profileAvatar');
  const memberSince = document.getElementById('memberSince');
  const profileLogoutBtn = document.getElementById('profileLogoutBtn');
  
  if (userAuthData && profileName && profileEmail) {
    // Update profile information
    profileName.textContent = userAuthData.displayName || userAuthData.email || 'User';
    profileEmail.textContent = userAuthData.email || 'No email available';
    
    // Update profile picture if available
    if (userAuthData.photoURL && profileAvatar) {
      profileAvatar.src = userAuthData.photoURL;
      profileAvatar.alt = userAuthData.displayName || 'Profile Picture';
    } else if (profileAvatar) {
      profileAvatar.src = 'assets/user.png';
      profileAvatar.alt = 'Default Profile Picture';
    }
    
    // Update member since date
    if (memberSince) {
      const loginTime = userAuthData.lastLoginTime || Date.now();
      const loginDate = new Date(loginTime);
      memberSince.textContent = loginDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    
    // Add logout functionality to profile tab
    if (profileLogoutBtn) {
      profileLogoutBtn.onclick = () => {
          logout();
        };
      }
    } else {
    // Show loading or default state
    if (profileName) profileName.textContent = 'Loading...';
    if (profileEmail) profileEmail.textContent = 'Loading...';
    if (memberSince) memberSince.textContent = 'Loading...';
  }
}

function logout() {
  // Clear authentication data
  chrome.storage.local.clear();
    // Show login screen
    showLoginScreen();
}

// Listen for authentication updates from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'AUTH_UPDATE') {
    // Update UI to show user is authenticated
    maybeShowOnboardingThenMain();
  } else if (request.type === 'AUTH_ERROR') {
    alert("Authentication error: " + request.error);
  }
});

// Listen for storage changes to update UI when auth status changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.isAuthenticated || changes.userAuthData) {
      checkAuthenticationStatus();
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // Check authentication status first
  checkAuthenticationStatus();

  // Remove the style element that was overriding hint-text color

  checkBackgroundGeneration(); // Always check on load

  // --- Element References (Same as before) ---
  const mainAiProviderSelect = document.getElementById("aiProvider");
  const promptTextarea = document.getElementById("prompt");
  const generateBtn = document.getElementById("generateBtn");
  const clearBtn = document.getElementById("clearBtn");
  const outputTextarea = document.getElementById("output");
  const copyJsonBtn = document.getElementById("copyJsonBtn");
  const statusMessage = document.getElementById("status");
  const copyMessage = document.getElementById("copy-message");
  const outputGroup = document.querySelector(".output-group");
  const noProviderEnabledMessage = document.getElementById(
    "no-provider-enabled-message"
  );
  const settingsStatusMessage = document.getElementById("settings-status");
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  // Add references to the new DOM elements
  const n8nDomainInput = document.getElementById("n8nDomain");
  const requestPermissionBtn = document.getElementById("requestPermissionBtn");
  const domainPermissionStatus = document.getElementById(
    "domain-permission-status"
  );

  // Event listener for requestPermissionBtn is added in setupEventListeners()

  // Store the current workflow data
  let currentWorkflowData = null;

  // Add a generation indicator element
  const generateSection = document.querySelector("#generate");
  const generationIndicator = document.createElement("div");
  generationIndicator.className = "generation-background-indicator";
  generationIndicator.innerHTML =
    '<span class="status-text">Generation is running in the background...</span>';

  // Add a cancel button to the generation indicator
  const cancelGenerationBtn = document.createElement("button");
  cancelGenerationBtn.textContent = "Cancel";
  cancelGenerationBtn.className = "cancel-generation-btn";
  cancelGenerationBtn.style.marginLeft = "15px";
  cancelGenerationBtn.style.padding = "5px 10px";
  cancelGenerationBtn.style.backgroundColor = "#b71c1c";
  cancelGenerationBtn.style.color = "white";
  cancelGenerationBtn.style.border = "none";
  cancelGenerationBtn.style.borderRadius = "4px";
  cancelGenerationBtn.style.cursor = "pointer";
  cancelGenerationBtn.addEventListener("click", cancelGeneration);
  generationIndicator.appendChild(cancelGenerationBtn);

  generateSection.appendChild(generationIndicator);

  // Check if we're in a side panel
  const isInSidePanel =
    chrome.sidePanel !== undefined && window.innerWidth < 600;

  // --- Provider Configuration ---
  const PROVIDER_CONFIG = {
    openai: {
      label: "OpenAI (GPT)",
      apiKeyInput: document.getElementById("openaiKey"),
      modelSelect: document.getElementById("openaiModelSelect"),
      toggleInput: document.querySelector(
        '.provider-toggle[data-provider-id="openai"]'
      ),
      detailsContainer: document.querySelector(
        '.settings-provider-container[data-provider-id="openai"]'
      ),
      fetchModelsFn: fetchOpenAIModels,
      defaultModelIdSuggestion: "gpt-4o-mini",
      getApiDetails: (apiKey, model, systemPrompt, userPrompt) => ({
        url: "https://api.openai.com/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        }),
      }),
      parseResponse: (data) => data.choices?.[0]?.message?.content?.trim(),
    },
    gemini: {
      label: "Google Gemini",
      apiKeyInput: document.getElementById("geminiKey"),
      modelSelect: document.getElementById("geminiModelSelect"),
      toggleInput: document.querySelector(
        '.provider-toggle[data-provider-id="gemini"]'
      ),
      detailsContainer: document.querySelector(
        '.settings-provider-container[data-provider-id="gemini"]'
      ),
      fetchModelsFn: fetchGeminiModels,
      defaultModelIdSuggestion: "gemini-2.0-flash",
      getApiDetails: (apiKey, model, systemPrompt, userPrompt) => ({
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    systemPrompt +
                    "\n\n===USER REQUEST===\n" +
                    userPrompt +
                    "\n\nRemember: Return ONLY valid JSON without any markdown code blocks or formatting.",
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
          },
        }),
      }),
      parseResponse: (data) => {
        const textResponse =
          data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!textResponse) return null;
        // Additional safety for Gemini: try to extract JSON if wrapped in backticks
        if (textResponse.includes("```")) {
          const match = textResponse.match(/```(?:json)?([\s\S]*?)```/);
          return match ? match[1].trim() : textResponse;
        }
        return textResponse;
      },
    },
    mistral: {
      label: "Mistral AI",
      apiKeyInput: document.getElementById("mistralApiKey"),
      modelSelect: document.getElementById("mistralModelSelect"),
      toggleInput: document.querySelector(
        '.provider-toggle[data-provider-id="mistral"]'
      ),
      detailsContainer: document.querySelector(
        '.settings-provider-container[data-provider-id="mistral"]'
      ),
      fetchModelsFn: fetchMistralModels,
      defaultModelIdSuggestion: "mistral-small-latest",
      getApiDetails: (apiKey, model, systemPrompt, userPrompt) => ({
        url: "https://api.mistral.ai/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
        }),
      }),
      parseResponse: (data) => data.choices?.[0]?.message?.content?.trim(),
    },
    claude: {
      label: "Anthropic (Claude)",
      apiKeyInput: document.getElementById("claudeApiKey"),
      modelSelect: document.getElementById("claudeModelSelect"),
      toggleInput: document.querySelector(
        '.provider-toggle[data-provider-id="claude"]'
      ),
      detailsContainer: document.querySelector(
        '.settings-provider-container[data-provider-id="claude"]'
      ),
      fetchModelsFn: fetchClaudeModels,
      defaultModelIdSuggestion: "claude-haiku-4-5-20251001",
      getApiDetails: (apiKey, model, systemPrompt, userPrompt) => {
        // Clean API key
        const cleanedApiKey = apiKey.trim();

        // Updated to use the correct endpoint and headers per Anthropic documentation
        return {
          url: "https://api.anthropic.com/v1/messages",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": cleanedApiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 4096,
            messages: [
              {
                role: "user",
                content:
                  systemPrompt +
                  "\n\n===USER REQUEST===\n" +
                  userPrompt +
                  "\n\nRemember: Return ONLY valid JSON without any markdown code blocks or formatting.",
              },
            ],
            temperature: 0.2,
          }),
        };
      },
      parseResponse: (data) => {
        // Handle error if present
        if (data.error) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.error)
          );
        }

        // Updated to match the new Messages API response format
        if (data.content && Array.isArray(data.content)) {
          // Extract text from content blocks
          const textBlocks = data.content.filter(
            (block) => block.type === "text"
          );
          if (textBlocks.length > 0) {
            return textBlocks
              .map((block) => block.text)
              .join("\n")
              .trim();
          }
        }

        // Fallbacks for older API versions
        if (data.completion) {
          return data.completion.trim();
        }

        throw new Error("Unexpected response format from Claude API");
      },
    },
    openrouter: {
      label: "OpenRouter",
      apiKeyInput: document.getElementById("openrouterApiKey"),
      modelSelect: document.getElementById("openrouterModelSelect"),
      toggleInput: document.querySelector(
        '.provider-toggle[data-provider-id="openrouter"]'
      ),
      detailsContainer: document.querySelector(
        '.settings-provider-container[data-provider-id="openrouter"]'
      ),
      fetchModelsFn: fetchOpenRouterModels,
      defaultModelIdSuggestion: "mistralai/mistral-7b-instruct",
      getApiDetails: (apiKey, model, systemPrompt, userPrompt) => ({
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer":
            "https://github.com/farhansrambiyan/n8n-Workflow-Builder-Ai",
          "X-Title": "n8n Workflow Builder Ai (Beta)",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        }),
      }),
      parseResponse: (data) => data.choices?.[0]?.message?.content?.trim(),
    },
    grok: {
      label: "Grok (x.ai)",
      apiKeyInput: document.getElementById("groqApiKey"),
      modelSelect: document.getElementById("groqModelSelect"),
      toggleInput: document.querySelector(
        '.provider-toggle[data-provider-id="groq"]'
      ),
      detailsContainer: document.querySelector(
        '.settings-provider-container[data-provider-id="groq"]'
      ),
      fetchModelsFn: fetchGrokModels,
      defaultModelIdSuggestion: "grok-3-latest",
      getApiDetails: (apiKey, model, systemPrompt, userPrompt) => ({
        url: "https://api.x.ai/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          stream: false,
        }),
      }),
      parseResponse: (data) => data.choices?.[0]?.message?.content?.trim(),
    },
  };

  // --- System Prompt (Ensure this is your full, correct prompt) ---
  const SYSTEM_PROMPT = `You are an expert n8n workflow generator. Your task is to generate valid, complete, and importable n8n workflow JSON or single node JSON based on the user's automation request.

STRICT RULES:

1. Output ONLY the raw JSON code. No explanations, introductions, markdown formatting, or extra text—just the JSON object.
2. Workflow JSON:
   - Output a top-level object with "nodes" (array), "connections" (object), "settings" (object), "name" (string), and "active" (boolean). Include "id" (string) only if specified, as n8n auto-generates it on import.
   - Node "position" values must be spatially distinct (e.g., [800,300], [1000,300], [1200,300]), incrementing x by 200+ units and adjusting y for branches (e.g., [1000,400] for false branch).
   - ALWAYS validate that "nodes" is an array, even with one element.
   - ALWAYS ensure "settings" includes required fields, e.g.:
     \`\`\`json
     {"executionOrder": "v1", "timezone": "UTC", "saveDataErrorExecution": "all", "saveDataSuccessExecution": "all", "errorWorkflow": ""}
     \`\`\`
3. Single Node JSON:
   - If the user requests a single node, output ONLY the JSON for that node (not wrapped in a workflow object).
4. Node Structure:
   - Every node must include: "parameters" (object), "id" (string), "name" (string), "type" (string), "typeVersion" (number), "position" (array of two numbers).
   - If credentials are needed, use descriptive placeholders (e.g., "credentials": {"credentialType": {"id": "YOUR_CREDENTIAL_ID", "name": "YOUR_CREDENTIAL_NAME"}}).
   - Use n8n expressions (e.g., {{ $json.body.propertyName }}) for dynamic fields.
   - For all node parameters that accept lists (e.g., "additionalFields", "rules"), ALWAYS output as arrays, even with one item.
   - For nodes where "options" is an object (e.g., n8n-nodes-base.emailSend), use an object, defaulting to {} if empty.
   - NEVER output null for properties that should be arrays or objects; use [] or {} instead.
   - Always include all required properties for each node, even if empty arrays or objects.
5. Node Types:
   - Use accurate node types (e.g., "n8n-nodes-base.httpRequest", "n8n-nodes-base.googleSheets", "n8n-nodes-base.scheduleTrigger").
   - For API integrations without a specific node, use "n8n-nodes-base.httpRequest" with placeholders for URL, method, headers, and body.
   - For data manipulation, use "n8n-nodes-base.code" (Code node).
   - For triggers, use "n8n-nodes-base.scheduleTrigger" for schedules, "n8n-nodes-base.webhook" for webhooks, or "n8n-nodes-base.cron" for advanced cron expressions.
6. AI Agent Node Logic:
   - For AI-powered actions (e.g., generate email, summarize text), use "@n8n/n8n-nodes-langchain.agent" as the main node with the agent type matching the request (default: "Tools Agent").
   - Attach at least one chat model sub-node (e.g., "@n8n/n8n-nodes-langchain.lmChatGoogleGemini") as a child node.
   - If external tools are needed, add "@n8n/n8n-nodes-langchain.tools" sub-nodes and connect them to the AI Agent node.
   - Set the AI Agent's prompt from the previous node (e.g., "chatInput") or explicitly in the prompt field.
   - Include a memory sub-node only for conversational workflows requiring context retention.
   - Ensure sub-nodes have unique "id", "name", and "position" values and are referenced in "nodes" and "connections".
7. Connections:
   - The "connections" object must link nodes according to the described flow.
   - Use the structure: {"SourceNodeName": {"main": [[{"node": "TargetNodeName", "type": "main", "index": 0}]]}}.
   - Support multiple targets (e.g., IF node branches) and empty connections ("main": [[]]).
   - Node names in "connections" must match the "name" property in "nodes".
   - ALWAYS use an array for "main", NEVER a single object or null.
   - ALWAYS include the "index" property.
8. Placeholders:
   - Use all-caps for static placeholders (e.g., "YOUR_SHEET_ID", "YOUR_API_KEY").
   - Use n8n expression syntax for dynamic fields (e.g., {{ $json.body.someValue }}).
   - Ensure placeholders are unique and descriptive per node.
9. Simplicity:
   - Start with the simplest valid structure that meets the request. Add complexity only if explicitly asked.
10. Compatibility:
    - All JSON must be valid and compatible with n8n v1.x (2024+).
    - Use the latest "typeVersion" for each node.
11. No Extra Text:
    - Absolutely no text before or after the JSON. The output must be a single, valid, parseable JSON object.
    - Ensure all commas, braces, and brackets are correct.
12. General Best Practices:
    - Use a trigger node (e.g., Schedule Trigger, Webhook) to start the workflow unless otherwise specified.
    - Output nodes (Email, Telegram, Slack) should be last unless requested otherwise.
    - Intermediate nodes should logically process data (e.g., Code, Set, IF).
    - Include error handling (e.g., IF node, Error Trigger) for robustness unless explicitly excluded.
    - Ensure all nodes are logically and spatially connected.
    - Validate all JSON for import compatibility.
    - NEVER output an object where an array is expected.
    - NEVER use null for array or object properties—use [] or {} to avoid errors like "(element ?? []).forEach is not a function".`;

  // --- Initialize ---
  function initialize() {
    // Check if we're in a side panel
    if (isInSidePanel) {
      document.body.classList.add("in-side-panel");
    }

    // Load settings
    loadAndApplySettings();

    // Check for saved domain and permissions
    chrome.storage.local.get(["n8nDomain"], (data) => {
      if (data.n8nDomain) {
        // Check if we have permission for this domain
        chrome.permissions.contains(
          {
            origins: [data.n8nDomain + "/*"],
          },
          (hasPermission) => {
            if (hasPermission) {
              displayStatus(
                "Permission granted for " + data.n8nDomain,
                "success",
                domainPermissionStatus
              );
            } else {
              displayStatus(
                "Permission needed for " +
                  data.n8nDomain +
                  '. Click "Request Access Permission"',
                "warning",
                domainPermissionStatus
              );
            }
          }
        );
      }
    });

    // Setup event listeners
    setupEventListeners();
    
    // Setup provider-specific event listeners
    setupProviderEventListeners();
    // Check for background generation in progress
    checkBackgroundGeneration();
  }

  // --- Setup Event Listeners ---
  function setupEventListeners() {
    // Tab navigation
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        tabButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        const targetTab = button.getAttribute("data-tab");
        tabContents.forEach((content) =>
          content.classList.toggle("active", content.id === targetTab)
        );

        if (targetTab === "generate") {
          loadAndApplySettings();
          // Check if generation is in progress and update button state
          chrome.storage.local.get(["generationInProgress"], (data) => {
            if (data.generationInProgress) {
              setLoadingState(true);
              generationIndicator.style.display = "block";
            }
          });
        } else if (targetTab === "feedback") {
        // Direct approach - set the src attribute immediately
          document
            .querySelectorAll("#feedback iframe[data-tally-src]:not([src])")
            .forEach((e) => {
              e.src = e.dataset.tallySrc;
            });

        }

        // Special handling for settings tab
        if (targetTab === "settings") {
          checkDomainPermissionStatus();
        }
      });
    });

    // n8n domain input change
    n8nDomainInput.addEventListener("blur", () => {
      const domain = n8nDomainInput.value.trim();
      if (domain) {
        // Format and save the domain
        let formattedDomain = domain;
        if (
          !formattedDomain.startsWith("http://") &&
          !formattedDomain.startsWith("https://")
        ) {
          formattedDomain = "https://" + formattedDomain;
        }

        try {
          const url = new URL(formattedDomain);
          const origin = url.origin;

          // Save the formatted domain
          n8nDomainInput.value = origin;
          chrome.storage.local.set({ n8nDomain: origin }, () => {
          });

          // Check if we already have permission
          chrome.permissions.contains(
            {
              origins: [origin + "/*"],
            },
            (hasPermission) => {
              if (hasPermission) {
                displayStatus(
                  "Permission already granted for " + origin,
                  "success",
                  domainPermissionStatus
                );
              } else {
                displayStatus(
                  "Permission needed for " +
                    origin +
                    '. Click "Request Access Permission"',
                  "warning",
                  domainPermissionStatus
                );
              }
            }
          );
        } catch (e) {
          displayStatus("Invalid URL format", "error", domainPermissionStatus);
        }
      }

      scheduleSaveSettings(false);
    });

    // Generate button click
    generateBtn.addEventListener("click", () => {
      const promptText = promptTextarea.value.trim();
      if (!promptText) {
        displayStatus("Please enter a prompt first.", "error", statusMessage);
        return;
      }

      const providerId = mainAiProviderSelect.value;
      if (!providerId) {
        displayStatus(
          "Please select an AI provider in the Settings tab.",
          "error",
          statusMessage
        );
        return;
      }

      // generateWorkflow(promptText, providerId);
    });

    // Clear button click
    clearBtn.addEventListener("click", () => {
      promptTextarea.value = "";
      outputTextarea.value = "";
      outputGroup.style.display = "none";
      statusMessage.textContent = "";
      copyMessage.textContent = "";
      updateClearButtonVisibility();
    });

    // Copy button click
    copyJsonBtn.addEventListener("click", () => {
      const jsonText = outputTextarea.value;
      if (jsonText) {
        navigator.clipboard
          .writeText(jsonText)
          .then(() => {
            displayStatus("Copied to clipboard!", "success", copyMessage, 2000);
          })
          .catch((err) => {
            console.error("Failed to copy: ", err);
            displayStatus("Failed to copy to clipboard.", "error", copyMessage);
          });
      }
    });

    // Prompt textarea input
    promptTextarea.addEventListener("input", updateClearButtonVisibility);

    // Add Enter key listener for prompt textarea (Enter without Shift triggers generate)
    promptTextarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        generateBtn.click();
      }
    });

    // Auto-save settings
    document.querySelectorAll(".auto-save").forEach((el) => {
      el.addEventListener("change", () => scheduleSaveSettings());
    });

    document.querySelectorAll(".auto-save-blur").forEach((el) => {
      el.addEventListener("blur", () => scheduleSaveSettings());
    });

    // Provider toggle switches
    document.querySelectorAll(".provider-toggle").forEach((toggle) => {
      toggle.addEventListener("change", function () {
        const providerId = this.getAttribute("data-provider-id");
        // Get API key input from PROVIDER_CONFIG instead of constructing ID
        // This handles inconsistent ID naming (openaiKey vs mistralApiKey)
        const config = PROVIDER_CONFIG[providerId];
        const apiKeyInput = config?.apiKeyInput;
        // const modelSelect = document.getElementById(`${providerId}ModelSelect`);

        if (this.checked && apiKeyInput) {
          // Provider enabled
          if (apiKeyInput.value.trim()) {
            // If API key is already entered, fetch models
            const fetchModelsFn = config.fetchModelsFn;
            if (fetchModelsFn) {
              fetchModelsFn(apiKeyInput.value);
            }
          }
        }

        // Update main provider dropdown after settings change
        scheduleSaveSettings(false);
        setTimeout(() => {
          chrome.storage.local.get(["settings"], (data) => {
            if (data.settings) {
              populateMainProviderDropdown(data.settings);
            }
          });
        }, 100);
      });
    });

    // API key inputs
    Object.keys(PROVIDER_CONFIG).forEach((providerId) => {
      const apiKeyInput = PROVIDER_CONFIG[providerId].apiKeyInput;
      const modelSelect = PROVIDER_CONFIG[providerId].modelSelect;
      const toggleInput = PROVIDER_CONFIG[providerId].toggleInput;

      if (apiKeyInput && modelSelect) {
        apiKeyInput.addEventListener("blur", function () {
          if (this.value.trim() && toggleInput.checked) {
            const fetchModelsFn = PROVIDER_CONFIG[providerId].fetchModelsFn;
            if (fetchModelsFn) {
              fetchModelsFn(this.value);
            }
          }
        });
      }
    });

    // Profile button functionality
    const profileBtn = document.getElementById('profileBtn');
    const loginPopup = document.getElementById('loginPopup');
    const loginBtn = document.getElementById('loginBtn');

    if (profileBtn && loginPopup && loginBtn) {
      // Toggle profile button active state and show/hide login popup
      profileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Toggle active state
        profileBtn.classList.toggle('active');
        
        // Toggle popup visibility
        loginPopup.classList.toggle('show');
      });

      // Login button functionality
      loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // For now, just hide the popup
        loginPopup.classList.remove('show');
        profileBtn.classList.remove('active');
      });

      // Close popup when clicking outside
      document.addEventListener('click', (e) => {
        if (!profileBtn.contains(e.target) && !loginPopup.contains(e.target)) {
          loginPopup.classList.remove('show');
          profileBtn.classList.remove('active');
        }
      });
    }
  }

  // --- Settings Logic (Auto-Saving) ---
  function loadAndApplySettings() {
    const storageKeys = [
      "selectedAiProviderOnGenerateTab",
      "claudeAuthMethod",
      "n8nDomain",
      "generateButtonEnabled",
    ];
    for (const id in PROVIDER_CONFIG) {
      storageKeys.push(`${id}ApiKey`, `${id}SelectedModel`, `${id}IsEnabled`);
    }

    chrome.storage.local.get(storageKeys, (data) => {
      for (const id in PROVIDER_CONFIG) {
        const config = PROVIDER_CONFIG[id];
        const isEnabled =
          data[`${id}IsEnabled`] === undefined ? false : data[`${id}IsEnabled`];

        config.toggleInput.checked = isEnabled;
        config.detailsContainer.classList.toggle("active", isEnabled);

        if (data[`${id}ApiKey`]) {
          config.apiKeyInput.value = data[`${id}ApiKey`];
        }

        if (isEnabled && config.apiKeyInput.value.trim()) {
          config.fetchModelsFn(
            config.apiKeyInput.value.trim(),
            data[`${id}SelectedModel`]
          );
        } else if (isEnabled && !config.apiKeyInput.value.trim()) {
          config.modelSelect.innerHTML =
            '<option value="" disabled selected>Enter API Key...</option>';
          config.modelSelect.disabled = true;
        } else {
          config.modelSelect.innerHTML =
            '<option value="" disabled selected>Enable provider...</option>';
          config.modelSelect.disabled = true;
        }
      }

      // Apply saved Claude auth method if available
      if (data.claudeAuthMethod) {
        updateClaudeAuthMethod(data.claudeAuthMethod);
      }

      populateMainProviderDropdown(data);
      if (
        data.selectedAiProviderOnGenerateTab &&
        mainAiProviderSelect.querySelector(
          `option[value="${data.selectedAiProviderOnGenerateTab}"]`
        )
      ) {
        mainAiProviderSelect.value = data.selectedAiProviderOnGenerateTab;
      }

      // Load n8n domain if available
      if (data.n8nDomain) {
        n8nDomainInput.value = data.n8nDomain;
      }

      // Load button injection settings with defaults
      const generateButtonEnabled = document.getElementById('generateButtonEnabled');
      
      // Get the container elements for show/hide behavior
      const generateContainer = document.querySelector('.settings-provider-container[data-provider-id="generate"]');

      if (generateButtonEnabled) {
        const isEnabled = data.generateButtonEnabled !== undefined ? data.generateButtonEnabled : true;
        generateButtonEnabled.checked = isEnabled;
        if (generateContainer) {
          generateContainer.classList.toggle("active", isEnabled);
        }       
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
    };

    // Add button injection settings
    const generateButtonEnabled = document.getElementById('generateButtonEnabled');
    
    if (generateButtonEnabled) {
      settingsToSave.generateButtonEnabled = generateButtonEnabled.checked;
      ('Saving generateButtonEnabled:', generateButtonEnabled.checked);
    }

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
        displayStatus("Settings auto-saved!", "success", settingsStatusMessage);
      }
      populateMainProviderDropdown(settingsToSave);
    });
  }

  function populateMainProviderDropdown(currentSettings) {
    const previouslySelectedProviderInGenerateTab =
      currentSettings.selectedAiProviderOnGenerateTab ||
      mainAiProviderSelect.value;
    mainAiProviderSelect.innerHTML = "";
    let enabledProvidersCount = 0;
    let firstEnabledProviderId = null;

    for (const id in PROVIDER_CONFIG) {
      if (currentSettings[`${id}IsEnabled`]) {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = PROVIDER_CONFIG[id].label;
        mainAiProviderSelect.appendChild(option);
        enabledProvidersCount++;
        if (!firstEnabledProviderId) firstEnabledProviderId = id;
      }
    }

    if (enabledProvidersCount === 0) {
      mainAiProviderSelect.innerHTML =
        '<option value="" disabled selected>No providers enabled</option>';
      mainAiProviderSelect.disabled = true;
      generateBtn.disabled = true;
      noProviderEnabledMessage.style.display = "block";
    } else {
      mainAiProviderSelect.disabled = false;
      generateBtn.disabled = false;
      noProviderEnabledMessage.style.display = "none";
      if (
        previouslySelectedProviderInGenerateTab &&
        mainAiProviderSelect.querySelector(
          `option[value="${previouslySelectedProviderInGenerateTab}"]`
        )
      ) {
        mainAiProviderSelect.value = previouslySelectedProviderInGenerateTab;
      } else if (firstEnabledProviderId) {
        mainAiProviderSelect.value = firstEnabledProviderId;
      }
    }
  }

  // --- Generic Model Fetching Helper ---
  async function fetchAndPopulateDynamicModels(
    apiKey,
    modelsUrl,
    authHeaderProvider,
    selectElement,
    modelParser,
    defaultModelIdSuggestion,
    previouslySelectedModel
  ) {
    if (!apiKey) {
      selectElement.innerHTML =
        '<option value="" disabled selected>Enter API Key...</option>';
      selectElement.disabled = true;
      return;
    }
    selectElement.disabled = true;
    selectElement.innerHTML =
      '<option value="" disabled selected>Loading models...</option>';
    try {
      // Create headers object
      const headers = authHeaderProvider(apiKey);

      // Debug log for Mistral specifically (will only show in console)
      if (modelsUrl.includes("mistral.ai")) {
        (
          "Fetching Mistral models with API key format:",
          apiKey
            ? `${apiKey.substring(0, 3)}...${apiKey.substring(
                apiKey.length - 3
              )}`
            : "empty"
        );
      }

      const response = await fetch(modelsUrl, {
        method: "GET",
        headers: headers,
      });

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg =
            errorData.message ||
            errorData.error?.message ||
            errorData.error ||
            errorMsg;

          // Special handling for Mistral API to provide more context
          if (modelsUrl.includes("mistral.ai")) {
            console.error("Mistral API error details:", errorData);
            if (response.status === 401) {
              errorMsg =
                "Unauthorized: Please check your Mistral API key is valid and correctly formatted (no extra spaces)";
            }
          }

          // Special handling for Groq API errors
          if (modelsUrl.includes("api.groq.com")) {
            console.error("Groq API error details:", errorData);
            if (response.status === 401) {
              // Check if it's an x.ai key
              if (apiKey && apiKey.startsWith("xai-")) {
                errorMsg =
                  "Unauthorized: x.ai API key detected but you are trying to access the Groq API. Please use a standard Groq API key instead.";
              } else {
                errorMsg =
                  "Unauthorized: Please check your Groq API key is valid and correctly formatted";
              }
            }
          }

          // Special handling for x.ai API errors
          if (modelsUrl.includes("api.x.ai")) {
            console.error("x.ai API error details:", errorData);
            if (response.status === 401) {
              errorMsg =
                'Unauthorized: Please check your x.ai API key is valid and correctly formatted (should start with "xai-")';
            } else if (response.status === 404) {
              errorMsg =
                "API endpoint not found. The x.ai API might have changed or may not support model listing. Using default models.";

              // Fallback to hardcoded list
              setTimeout(() => {
                const selectEl = document.getElementById("groqModelSelect");
                if (selectEl) {
                  const xaiModels = [
                    { id: "grok-3-latest", name: "Grok-3 (Latest)" },
                    { id: "grok-2", name: "Grok-2" },
                    { id: "grok-code-fast-1", name: "Grok Code Fast 1" },
                    { id: "grok-4-fast-reasoning", name: "Grok 4 Fast Reasoning" },
                    { id: "grok-4-fast-non-reasoning", name: "Grok 4 Fast Non-Reasoning" },
                  ];

                  populateModelSelect(
                    selectEl,
                    xaiModels,
                    "grok-3-latest",
                    null
                  );
                }
              }, 500);
            }
          }
        } catch (e) {
          // If we can't parse the error JSON, use the status text
          errorMsg = `${errorMsg}: ${response.statusText || "Unknown error"}`;
        }

        // Handle rate limiting explicitly
        if (response.status === 429) {
          errorMsg = "Rate limit exceeded. Please try again later.";
        }

        throw new Error(errorMsg);
      }
      const data = await response.json();
      const models = modelParser(data);
      selectElement.innerHTML = "";

      if (models?.length > 0) {
        models.forEach((model) => {
          const option = document.createElement("option");
          option.value = model.id;
          option.textContent = model.name;
          selectElement.appendChild(option);
        });
        selectElement.disabled = false;

        // Add "Choose model" as the first option
        const chooseOption = document.createElement("option");
        chooseOption.value = "";
        chooseOption.textContent = "Choose model";
        selectElement.insertBefore(chooseOption, selectElement.firstChild);

        if (
          previouslySelectedModel &&
          selectElement.querySelector(
            `option[value="${previouslySelectedModel}"]`
          )
        ) {
          selectElement.value = previouslySelectedModel;
        } else if (
          defaultModelIdSuggestion &&
          selectElement.querySelector(
            `option[value="${defaultModelIdSuggestion}"]`
          )
        ) {
          selectElement.value = defaultModelIdSuggestion;
        } else {
          // Set the "Choose model" option as selected
          selectElement.value = "";
        }
      } else {
        selectElement.innerHTML =
          '<option value="" disabled selected>No compatible models found by API.</option>';
      }
    } catch (error) {
      console.error(`Models fetch error for ${selectElement.id}:`, error);
      selectElement.innerHTML =
        '<option value="" disabled selected>Load failed: ' +
        (error.message || "Unknown error") +
        "</option>";
      displayStatus(
        `Models load error: ${error.message}`,
        "error",
        settingsStatusMessage
      );
    }
  }

  // --- Provider-Specific Model Fetchers ---
  function fetchOpenAIModels(apiKey, selectedModel) {
    const selectEl = PROVIDER_CONFIG.openai.modelSelect;
    
    if (!apiKey) {
      selectEl.innerHTML =
        '<option value="" disabled selected>Enter API Key...</option>';
      selectEl.disabled = true;
      return;
    }
    
    selectEl.disabled = true;
    selectEl.innerHTML =
      '<option value="" disabled selected>Loading models...</option>';
    
    // Hardcoded list of working OpenAI models
    const openaiModels = [
      {id: "gpt-5", name: "GPT-5"},
      { id: "gpt-5-mini", name: "GPT-5 Mini" },
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
      { id: "gpt-4", name: "GPT-4" },
      { id: "gpt-4o-mini", name: "GPT-4.1-mini" },
      { id: "o3-mini", name: "O3 Mini" },
    ];
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      populateModelSelect(
        selectEl,
        openaiModels,
        PROVIDER_CONFIG.openai.defaultModelIdSuggestion,
        selectedModel
      );
    }, 100);
  }

  async function fetchGeminiModels(apiKey, previouslySelectedModel) {
    const selectEl = PROVIDER_CONFIG.gemini.modelSelect;
    
    if (!apiKey) {
      selectEl.innerHTML =
        '<option value="" disabled selected>Enter API Key...</option>';
      selectEl.disabled = true;
      return;
    }
    
    selectEl.disabled = true;
    selectEl.innerHTML =
      '<option value="" disabled selected>Loading models...</option>';
    
    // Hardcoded list of working Gemini models
    // Most fetched models are deprecated or don't work properly
    const geminiModels = [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
      { id: "gemini-1.5-pro-latest", name: "Gemini 1.5 Pro" },
      { id: "gemini-1.5-flash-latest", name: "Gemini 1.5 Flash" },
    ];
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      populateModelSelect(
        selectEl,
        geminiModels,
        PROVIDER_CONFIG.gemini.defaultModelIdSuggestion,
        previouslySelectedModel
      );
    }, 100);
  }

  function fetchMistralModels(apiKey, selectedModel) {
    const selectEl = PROVIDER_CONFIG.mistral.modelSelect;
    
    if (!apiKey) {
      selectEl.innerHTML =
        '<option value="" disabled selected>Enter API Key...</option>';
      selectEl.disabled = true;
      return;
    }
    
    selectEl.disabled = true;
    selectEl.innerHTML =
      '<option value="" disabled selected>Loading models...</option>';
    
    // Hardcoded list of working Mistral models (text-to-text only)
    const mistralModels = [
      { id: "mistral-large-latest", name: "Mistral Large" },
      { id: "mistral-medium-latest", name: "Mistral Medium" },
      { id: "mistral-small-latest", name: "Mistral Small" },
      { id: "mistral-large-2407", name: "Mistral Large 2407" },
      { id: "mistral-large-2402", name: "Mistral Large 2402" },
      { id: "mistral-small-2409", name: "Mistral Small 2409" },
      { id: "mistral-small-2408", name: "Mistral Small 2408" },
    ];
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      populateModelSelect(
        selectEl,
        mistralModels,
        PROVIDER_CONFIG.mistral.defaultModelIdSuggestion,
        selectedModel
      );
    }, 100);
  }

  function fetchClaudeModels(apiKey, selectedModel) {
    const selectEl = PROVIDER_CONFIG.claude.modelSelect;
    
    if (!apiKey) {
      selectEl.innerHTML =
        '<option value="" disabled selected>Enter API Key...</option>';
      selectEl.disabled = true;
      return;
    }
    
    selectEl.disabled = true;
    selectEl.innerHTML =
      '<option value="" disabled selected>Loading models...</option>';
    
    // Hardcoded list of working Claude models
    const claudeModels = [
      { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5 (Latest)" },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5 (Latest)" },
      { id: "claude-opus-4-1-20250805", name: "Claude Opus 4.1 (Latest)" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
      { id: "claude-3-opus-20250718", name: "Claude 3 Opus (Latest)" },
      { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet" },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku" },
      { id: "claude-3-5-sonnet-20240620", name: "Claude 3.5 Sonnet" },
      { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet" },
    ];
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      populateModelSelect(
        selectEl,
        claudeModels,
        PROVIDER_CONFIG.claude.defaultModelIdSuggestion,
        selectedModel
      );
    }, 100);
  }

  function fetchOpenRouterModels(apiKey, selectedModel) {
    fetchAndPopulateDynamicModels(
      apiKey,
      "https://openrouter.ai/api/v1/models",
      (key) => ({
        Authorization: `Bearer ${key}`,
        "HTTP-Referer":
          "https://github.com/farhansrambiyan/n8n-Workflow-Builder-Ai",
        "X-Title": "n8n Workflow Builder Ai (Beta)",
      }),
      PROVIDER_CONFIG.openrouter.modelSelect,
      (data) => {
        if (!data.data) return [];
        return data.data
          .map((m) => ({ id: m.id, name: m.name || m.id })) // OpenRouter provides good names generally
          .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
      },
      PROVIDER_CONFIG.openrouter.defaultModelIdSuggestion,
      selectedModel
    );
  }

  // Function to update Claude authentication method based on testing
  function updateClaudeAuthMethod(method) {
    (`Updating Claude auth method to: ${method}`);

    if (method === "x-api-key") {
      PROVIDER_CONFIG.claude.getApiDetails = (
        apiKey,
        model,
        systemPrompt,
        userPrompt
      ) => {
        const cleanedApiKey = apiKey.trim();
        return {
          url: "https://api.anthropic.com/v1/messages",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": cleanedApiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 4096,
            messages: [
              {
                role: "user",
                content:
                  systemPrompt +
                  "\n\n===USER REQUEST===\n" +
                  userPrompt +
                  "\n\nRemember: Return ONLY valid JSON without any markdown code blocks or formatting.",
              },
            ],
            temperature: 0.2,
          }),
        };
      };
    } else {
      PROVIDER_CONFIG.claude.getApiDetails = (
        apiKey,
        model,
        systemPrompt,
        userPrompt
      ) => {
        const cleanedApiKey = apiKey.trim();
        return {
          url: "https://api.anthropic.com/v1/messages",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cleanedApiKey}`,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 4096,
            messages: [
              {
                role: "user",
                content:
                  systemPrompt +
                  "\n\n===USER REQUEST===\n" +
                  userPrompt +
                  "\n\nRemember: Return ONLY valid JSON without any markdown code blocks or formatting.",
              },
            ],
            temperature: 0.2,
          }),
        };
      };
    }

    // Save the auth method preference
    chrome.storage.local.set({ claudeAuthMethod: method });
    ("Saved Claude auth method preference:", method);
  }

  function fetchGrokModels(_apiKey, selectedModel) {
    const selectEl = PROVIDER_CONFIG.grok.modelSelect;
    selectEl.disabled = true;

    const xaiModels = [
      { id: "grok-3-latest", name: "Grok-3 (Latest)" },
      { id: "grok-2", name: "Grok-2" },
      { id: "grok-code-fast-1", name: "Grok Code Fast 1" },
      { id: "grok-4-fast-reasoning", name: "Grok 4 Fast Reasoning" },
      { id: "grok-4-fast-non-reasoning", name: "Grok 4 Fast Non-Reasoning" },
    ];

    populateModelSelect(
      selectEl,
      xaiModels,
      "grok-3-latest",
      selectedModel
    );
  }

  // Helper function to populate model select
  function populateModelSelect(selectEl, models, defaultModel, selectedModel) {
    selectEl.innerHTML = "";

    if (models.length > 0) {
      // Add "Choose model" as the first option
      const chooseOption = document.createElement("option");
      chooseOption.value = "";
      chooseOption.textContent = "Choose model";
      chooseOption.selected = true;
      selectEl.appendChild(chooseOption);

      models.forEach((model) => {
        const option = document.createElement("option");
        option.value = model.id;
        option.textContent = model.name;
        selectEl.appendChild(option);
      });

      selectEl.disabled = false;

      if (
        selectedModel &&
        selectEl.querySelector(`option[value="${selectedModel}"]`)
      ) {
        selectEl.value = selectedModel;
      } else if (
        defaultModel &&
        selectEl.querySelector(`option[value="${defaultModel}"]`)
      ) {
        selectEl.value = defaultModel;
      }
      // Removed automatic selection of first model
    } else {
      selectEl.innerHTML =
        '<option value="" disabled selected>No compatible models found.</option>';
      selectEl.disabled = true;
    }
  }


  function formatJsonForDisplay(jsonString) {
    try {
      // Try to parse and pretty-print the JSON
      const formattedJson = JSON.stringify(JSON.parse(jsonString), null, 2);
      // Escape HTML and add syntax highlighting (basic version)
      return formattedJson
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(
          /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
          function (match) {
            let cls = "json-number";
            if (/^"/.test(match)) {
              if (/:$/.test(match)) {
                cls = "json-key";
              } else {
                cls = "json-string";
              }
            } else if (/true|false/.test(match)) {
              cls = "json-boolean";
            } else if (/null/.test(match)) {
              cls = "json-null";
            }
            return '<span class="' + cls + '">' + match + "</span>";
          }
        )
        .replace(/\n/g, "<br>")
        .replace(/\s{2}/g, "&nbsp;&nbsp;");
    } catch (e) {
      // If parsing fails, just return the raw string
      return jsonString
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
    }
  }

  // --- Generate Button Logic ---
  generateBtn.addEventListener("click", async () => {
    const providerId = mainAiProviderSelect.value;
    const userPrompt = promptTextarea.value.trim();

    if (!providerId) {
      displayStatus(
        "Please select an enabled AI Provider from the dropdown.",
        "error",
        statusMessage
      );
      return;
    }
    if (!userPrompt) {
      displayStatus(
        "Please enter a description for the workflow or node.",
        "error",
        statusMessage
      );
      return;
    }

    setLoadingState(true);
    const providerConf = PROVIDER_CONFIG[providerId];

    try {
      const storedData = await new Promise((resolve) =>
        chrome.storage.local.get(
          [`${providerId}ApiKey`, `${providerId}SelectedModel`],
          resolve
        )
      );
      const apiKey = storedData[`${providerId}ApiKey`];
      const model = storedData[`${providerId}SelectedModel`];

      if (!apiKey) {
        throw new Error(
          `${providerConf.label} API key is not configured, or the provider is not enabled. Please check Settings.`
        );
      }

      if (!model) {
        throw new Error(
          `Please choose a model for ${providerConf.label} in Settings.`
        );
      }

      // Reset generationComplete flag to ensure events fire correctly for this new generation
      chrome.storage.local.set({ generationComplete: false }, () => {
        // Start the background generation process
        chrome.runtime.sendMessage(
          {
            action: "startBackgroundGeneration",
            providerId,
            apiKey,
            model,
            userPrompt,
            systemPrompt: SYSTEM_PROMPT,
          },
          (response) => {
            if (chrome.runtime.lastError || !response || !response.success) {
              displayStatus(
                `Error: ${
                  chrome.runtime.lastError?.message ||
                  "Failed to start generation"
                }`,
                "error",
                statusMessage
              );
              setLoadingState(false);
            } else {
              // Show background processing indicator
              generationIndicator.style.display = "block";
            }
          }
        );
      });
    } catch (error) {
      console.error(`Error during generation setup with ${providerId}:`, error);
      displayStatus(
        `Generation Error: ${error.message}`,
        "error",
        statusMessage
      );
      outputGroup.style.display = "none";
      setLoadingState(false);
    }
  });

  // --- UI Helper Functions ---
  function displayGeneratedJson(jsonString) {
    try {
      // Enhanced markdown code block removal
      let cleanedJson = jsonString;

      // First, check if the response is wrapped in markdown code blocks
      if (cleanedJson.includes("```json") || cleanedJson.includes("```")) {
        // Remove opening code block marker with or without language specifier
        cleanedJson = cleanedJson.replace(/^```(?:json)?\s*/i, "");
        // Remove closing code block marker
        cleanedJson = cleanedJson.replace(/\s*```$/i, "");
        ("Removed markdown code block formatting from AI response");
      }

      // Check if we need to fix Mistral-specific issues
      const currentProvider = mainAiProviderSelect.value;
      if (currentProvider === "mistral") {
        try {
          // Parse the JSON and fix Mistral's common issues
          const jsonObj = JSON.parse(cleanedJson);
          const fixedJsonObj = fixMistralJsonStructure(jsonObj);
          cleanedJson = JSON.stringify(fixedJsonObj);
          ("Applied Mistral-specific JSON structure fixes");
        } catch (parseError) {
          console.warn("Failed to parse and fix Mistral JSON:", parseError);
          // Continue with the original JSON if parsing fails
        }
      }

      // Try to parse and pretty-print the JSON
      outputTextarea.value = cleanedJson;
    } catch (e) {
      console.warn(
        "Output is not valid JSON:",
        e,
        "\nRaw output from AI:",
        jsonString
      );
      outputTextarea.value = jsonString;
      displayStatus(
        "AI returned content that may not be perfectly valid JSON. Check the output.",
        "warning",
        statusMessage
      );
    }
    outputGroup.style.display = "block";
    updateClearButtonVisibility();
  }

  // Helper function to fix common Mistral JSON structure issues
  function fixMistralJsonStructure(jsonObj) {
    // If this is a workflow object
    if (jsonObj && typeof jsonObj === "object") {
      // Fix nodes array if it exists but isn't an array
      if ("nodes" in jsonObj && !Array.isArray(jsonObj.nodes)) {
        if (jsonObj.nodes === null) {
          jsonObj.nodes = [];
        } else if (typeof jsonObj.nodes === "object") {
          // Convert object to array if it's an object
          jsonObj.nodes = Object.values(jsonObj.nodes);
        }
      }

      // Process each node for common property issues
      if (Array.isArray(jsonObj.nodes)) {
        jsonObj.nodes.forEach((node) => {
          if (node && typeof node === "object") {
            // Fix parameters that should be arrays
            if (node.parameters && typeof node.parameters === "object") {
              // Common n8n properties that should always be arrays
              const shouldBeArrays = [
                "options",
                "fields",
                "rules",
                "values",
                "items",
                "propertyValues",
              ];

              for (const key in node.parameters) {
                if (
                  shouldBeArrays.includes(key) &&
                  node.parameters[key] !== undefined
                ) {
                  if (
                    node.parameters[key] === null ||
                    !Array.isArray(node.parameters[key])
                  ) {
                    if (node.parameters[key] === null) {
                      node.parameters[key] = [];
                    } else if (typeof node.parameters[key] === "object") {
                      // Convert object to array
                      node.parameters[key] = Object.values(
                        node.parameters[key]
                      );
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
      if ("connections" in jsonObj && jsonObj.connections) {
        for (const sourceNode in jsonObj.connections) {
          if (
            jsonObj.connections[sourceNode].main &&
            !Array.isArray(jsonObj.connections[sourceNode].main)
          ) {
            if (jsonObj.connections[sourceNode].main === null) {
              jsonObj.connections[sourceNode].main = [];
            } else if (
              typeof jsonObj.connections[sourceNode].main === "object"
            ) {
              // Convert a single connection object to array
              jsonObj.connections[sourceNode].main = [
                jsonObj.connections[sourceNode].main,
              ];
            }
          }
        }
      }
    }

    return jsonObj;
  }

  function setLoadingState(isLoading) {
    generateBtn.disabled = isLoading;
    generateBtn.textContent = isLoading ? "Generating..." : "Generate";

    // Apply consistent button styling
    if (isLoading) {
      generateBtn.style.backgroundColor = "#888"; // Gray out the button
      generateBtn.style.cursor = "not-allowed";
      statusMessage.textContent =
        "Generating JSON, please wait... Generation speed depends on your API.";
      statusMessage.className = "status-message";
      outputTextarea.value = "";
      outputGroup.style.display = "none";
      copyMessage.style.display = "none";
    } else {
      generateBtn.style.backgroundColor = ""; // Reset to default color from CSS
      generateBtn.style.cursor = "pointer";
    }
  }

  function displayStatus(message, type, element, autoClearDelay = 4000) {
    element.textContent = message;
    element.className = `status-message ${type || ""}`;
    // Clear existing timeouts for this specific element to prevent premature clearing if status updates quickly
    if (element.statusClearTimeout) {
      clearTimeout(element.statusClearTimeout);
    }
    if (
      (type === "success" || type === "warning") &&
      (element === statusMessage || element === copyMessage)
    ) {
      element.statusClearTimeout = setTimeout(() => {
        if (element.textContent === message) {
          element.textContent = "";
          if (element === copyMessage) {
            element.style.display = "none";
            element.className = "status-message";
          }
        }
      }, autoClearDelay);
    }
    if (element === copyMessage && type !== "" && message !== "") {
      copyMessage.style.display = "block";
    } else if (element === copyMessage && message === "") {
      copyMessage.style.display = "none";
    }
  }

  // Updates the visibility of the clear button based on content
  function updateClearButtonVisibility() {
    const hasPrompt = promptTextarea.value.trim() !== "";
    const hasOutput = outputTextarea.value.trim() !== "";
    clearBtn.style.display = hasPrompt || hasOutput ? "block" : "none";
  }

  // --- Provider Configuration Event Listeners ---
  function setupProviderEventListeners() {
    for (const id in PROVIDER_CONFIG) {
      const config = PROVIDER_CONFIG[id];

      config.toggleInput.addEventListener("change", (event) => {
        const isEnabled = event.target.checked;
        config.detailsContainer.classList.toggle("active", isEnabled);
        if (isEnabled) {
          if (config.apiKeyInput.value.trim()) {
            const currentSelectedModel = config.modelSelect.value || undefined;
            config.fetchModelsFn(
              config.apiKeyInput.value.trim(),
              currentSelectedModel
            );
          } else {
            config.modelSelect.innerHTML =
              '<option value="" disabled selected>Enter API Key...</option>';
            config.modelSelect.disabled = true;
          }
        } else {
          config.modelSelect.innerHTML =
            '<option value="" disabled selected>Enable provider...</option>';
          config.modelSelect.disabled = true;
        }
        scheduleSaveSettings();
      });

      config.apiKeyInput.addEventListener("blur", () => {
        if (config.toggleInput.checked && config.apiKeyInput.value.trim()) {
          const currentSelectedModel = config.modelSelect.value || undefined;
          config.fetchModelsFn(
            config.apiKeyInput.value.trim(),
            currentSelectedModel
          );
        } else if (
          config.toggleInput.checked &&
          !config.apiKeyInput.value.trim()
        ) {
          config.modelSelect.innerHTML =
            '<option value="" disabled selected>Enter API Key...</option>';
          config.modelSelect.disabled = true;
        }
        scheduleSaveSettings(false);
      });
      config.apiKeyInput.addEventListener("input", () => {
        scheduleSaveSettings(false);
      });

      config.modelSelect.addEventListener("change", () => {
        scheduleSaveSettings(false);
      });
    }

    // Button injection toggle event listeners
    const generateButtonEnabled = document.getElementById('generateButtonEnabled');
    
    const generateContainer = document.querySelector('.settings-provider-container[data-provider-id="generate"]');

    if (generateButtonEnabled && generateContainer) {
      generateButtonEnabled.addEventListener("change", (event) => {
        const isEnabled = event.target.checked;
        generateContainer.classList.toggle("active", isEnabled);
        scheduleSaveSettings();
      });
    }

    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        tabButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        const targetTab = button.getAttribute("data-tab");
        tabContents.forEach((content) =>
          content.classList.toggle("active", content.id === targetTab)
        );

        if (targetTab === "generate") {
          loadAndApplySettings();
          // Check if generation is in progress and update button state
          chrome.storage.local.get(["generationInProgress"], (data) => {
            if (data.generationInProgress) {
              setLoadingState(true);
              generationIndicator.style.display = "block";
            }
          });
        } else if (targetTab === "feedback") {
          // Load Tally embeds when feedback tab is selected
          ("Feedback tab selected from tab handler");
          // Direct approach - set the src attribute immediately
          document
            .querySelectorAll("#feedback iframe[data-tally-src]:not([src])")
            .forEach((e) => {
              ("Setting iframe src directly:", e.dataset.tallySrc);
              e.src = e.dataset.tallySrc;
            });

        }

        // Special handling for settings tab
        if (targetTab === "settings") {
          checkDomainPermissionStatus();
        }
      });
    });
    if (!document.querySelector(".tab-button.active")) {
      const defaultSettingsTabButton = document.querySelector(
        '.tab-button[data-tab="settings"]'
      );
      if (defaultSettingsTabButton)
        defaultSettingsTabButton.classList.add("active");
      const defaultSettingsTabContent = document.getElementById("settings");
      if (defaultSettingsTabContent)
        defaultSettingsTabContent.classList.add("active");
    }

    copyJsonBtn.addEventListener("click", () => {
      if (!outputTextarea.value) return;
      navigator.clipboard
        .writeText(outputTextarea.value)
        .then(() => displayStatus("JSON copied!", "success", copyMessage, 2000))
        .catch((err) => {
          console.error("Failed to copy JSON: ", err);
          displayStatus(
            "Failed to copy JSON to clipboard.",
            "error",
            copyMessage
          );
        });
    });

    // Clear button functionality
    clearBtn.addEventListener("click", () => {
      // Clear UI elements
      promptTextarea.value = "";
      outputTextarea.value = "";
      outputGroup.style.display = "none";
      statusMessage.textContent = "";
      copyMessage.style.display = "none";
      generationIndicator.style.display = "none";

      // Clear stored data
      chrome.runtime.sendMessage({
        action: "clearGenerationData",
      });

      // Update clear button visibility
      updateClearButtonVisibility();
    });

    // Update clear button visibility when entering or clearing the prompt
    promptTextarea.addEventListener("input", updateClearButtonVisibility);

    // Listen for storage changes to update the UI accordingly
    chrome.storage.onChanged.addListener((changes) => {
      // If generation completed while popup is open
      if (
        changes.generationComplete &&
        changes.generationComplete.newValue === true
      ) {
        ("Generation complete detected in UI");
        chrome.storage.local.get(
          ["generatedJson", "generationError", "currentPrompt"],
          (data) => {
            ("Retrieved generation results:", {
              hasJson: !!data.generatedJson,
              hasError: !!data.generationError,
              jsonLength: data.generatedJson ? data.generatedJson.length : 0,
            });

            if (data.generatedJson) {
              try {
                displayGeneratedJson(data.generatedJson);
                setLoadingState(false);

                // Special handling for truncated responses
                if (
                  data.generatedJson.includes(
                    "[Response was truncated due to size limits]"
                  )
                ) {
                  displayStatus(
                    "JSON generated successfully but was truncated due to large size. Some content may be missing.",
                    "warning",
                    statusMessage
                  );
                } else {
                  displayStatus(
                    "JSON generated successfully!",
                    "success",
                    statusMessage
                  );
                }
              } catch (err) {
                console.error("Error displaying generation result:", err);
                setLoadingState(false);
                outputGroup.style.display = "none";
                displayStatus(
                  `Error displaying result: ${err.message}. The response may be too large.`,
                  "error",
                  statusMessage
                );
              }
            } else if (data.generationError) {
              setLoadingState(false);
              outputGroup.style.display = "none";
              displayStatus(
                `Generation Error: ${data.generationError}`,
                "error",
                statusMessage
              );
            } else {
              // Handle the case where we have neither JSON nor error
              setLoadingState(false);
              outputGroup.style.display = "none";
              displayStatus(
                "Generation completed but no output was returned. This may be due to a very large response or server timeout.",
                "error",
                statusMessage
              );
            }
          }
        );
        generationIndicator.style.display = "none";
      }

      // If generation status changed
      if (changes.generationInProgress) {
        if (changes.generationInProgress.newValue === true) {
          setLoadingState(true);
          generationIndicator.style.display = "block";
        } else {
          generationIndicator.style.display = "none";
          // Ensure button is reset properly
          setLoadingState(false);
        }
      }

      // If there's a status update
      if (changes.generationStatus) {
        (
          "Generation status update:",
          changes.generationStatus.newValue
        );
        const statusTextElement =
          generationIndicator.querySelector(".status-text");
        if (statusTextElement && changes.generationStatus.newValue) {
          statusTextElement.textContent = changes.generationStatus.newValue;
        }
      }
    });

    mainAiProviderSelect.addEventListener("change", () => {
      chrome.storage.local.set({
        selectedAiProviderOnGenerateTab: mainAiProviderSelect.value,
      });
    });

    // Add key validation for Mistral specifically
    const mistralApiKeyInput = document.getElementById("mistralApiKey");
    if (mistralApiKeyInput) {
      mistralApiKeyInput.addEventListener("blur", function () {
        // Trim whitespace from Mistral API key to prevent common errors
        if (this.value) {
          const trimmedValue = this.value.trim();
          if (trimmedValue !== this.value) {
            this.value = trimmedValue;
            displayStatus(
              "Mistral API key whitespace trimmed to prevent authorization errors",
              "warning",
              settingsStatusMessage,
              3000
            );

            // Also trigger save when we fix the format
            scheduleSaveSettings();
          }
        }
      });
    }

    // Add key validation for Groq specifically
    const groqApiKeyInput = document.getElementById("groqApiKey");
    if (groqApiKeyInput) {
      groqApiKeyInput.addEventListener("blur", function () {
        // Trim whitespace from Groq API key to prevent common errors
        if (this.value) {
          const trimmedValue = this.value.trim();
          if (trimmedValue !== this.value) {
            this.value = trimmedValue;
            displayStatus(
              "Groq API key whitespace trimmed to prevent authorization errors",
              "warning",
              settingsStatusMessage,
              3000
            );

            // Also trigger save when we fix the format
            scheduleSaveSettings();
          }
        }
      });
    }

    // Add key validation for Claude specifically
    const claudeApiKeyInput = document.getElementById("claudeApiKey");
    if (claudeApiKeyInput) {
      // Add a helpful note about Claude API key format
      const noteElement = document.createElement("small");
      noteElement.className = "helper-text";
      noteElement.textContent = "Claude API keys start with 'sk-ant-'";
      noteElement.style.color = "#666";
      noteElement.style.fontStyle = "italic";
      noteElement.style.marginLeft = "5px";

      // Insert the note after the input field
      claudeApiKeyInput.parentNode.insertBefore(
        noteElement,
        claudeApiKeyInput.nextSibling
      );

      // Add validation on blur
      claudeApiKeyInput.addEventListener("blur", function () {
        // Trim whitespace from Claude API key
        if (this.value) {
          const trimmedValue = this.value.trim();
          if (trimmedValue !== this.value) {
            this.value = trimmedValue;
            displayStatus(
              "Claude API key whitespace trimmed",
              "warning",
              settingsStatusMessage,
              2000
            );
            scheduleSaveSettings();
          }

          // Show warning if format is incorrect
          if (trimmedValue && !trimmedValue.startsWith("sk-ant-")) {
            noteElement.textContent =
              "Warning: Claude API keys should start with 'sk-ant-'";
            noteElement.style.color = "#c93838";
          } else {
            noteElement.textContent = "Claude API keys start with 'sk-ant-'";
            noteElement.style.color = "#666";
          }
        }
      });
    }

    // Add event listeners for domain permission
    n8nDomainInput.addEventListener("input", () => {
      domainPermissionStatus.textContent = "";

      // Clear any existing instructions
      const existingInstructions = domainPermissionStatus.querySelector(
        ".manual-permission-instructions"
      );
      if (existingInstructions) {
        existingInstructions.remove();
      }
    });

    requestPermissionBtn.addEventListener(
      "click",
      requestDomainPermission
    );
  }

  // Check for any background generation tasks or results
  function checkBackgroundGeneration() {
    chrome.storage.local.get(
      [
        "currentPrompt",
        "generatedJson",
        "generationError",
        "generationComplete",
        "generationInProgress",
      ],
      (data) => {
        if (data.currentPrompt) {
          promptTextarea.value = data.currentPrompt;
        }

        if (data.generationInProgress) {
          setLoadingState(true);
          generationIndicator.style.display = "block";
          displayStatus("Generation in progress...", "info", statusMessage);

          // Ensure the button is in the correct disabled state with proper styling
          generateBtn.disabled = true;
          generateBtn.textContent = "Generating...";
          generateBtn.style.backgroundColor = "#888"; // Gray out the button
          generateBtn.style.cursor = "not-allowed";
        }

        if (data.generationComplete) {
          if (data.generatedJson) {
            displayGeneratedJson(data.generatedJson);
            setLoadingState(false);
          } else if (data.generationError) {
            displayStatus(
              `Generation Error: ${data.generationError}`,
              "error",
              statusMessage
            );
          }
        }
      }
    );
  }

  // Add a function to cancel ongoing generation
  function cancelGeneration() {
    if (confirm("Are you sure you want to cancel?")) {
      chrome.storage.local.set(
        {
          generationInProgress: false,
          generationError: "Generation was cancelled by user.",
          generationComplete: true,
        },
        () => {
          displayStatus("Generation cancelled.", "warning", statusMessage);
          setLoadingState(false); // Reset button state
          generationIndicator.style.display = "none";
        }
      );
    }
  }

  const maxGenerationTime = 180000; // 3 minutes
  setTimeout(() => {
    chrome.storage.local.set({
      generationInProgress: false,
      generationError: "Generation timed out after 3 minutes.",
      generationComplete: true,
    });
  }, maxGenerationTime);

  // Initialize the extension
  initialize();

  // --- Helper Functions for Domain Permission ---
  // Add function to request domain permission
  function requestDomainPermission() {
    const domain = n8nDomainInput.value.trim();

    if (!domain) {
      displayStatus(
        "Please enter a valid domain URL",
        "error",
        domainPermissionStatus
      );
      return;
    }

    // Ensure the domain has a valid format
    let formattedDomain = domain;
    if (
      !formattedDomain.startsWith("http://") &&
      !formattedDomain.startsWith("https://")
    ) {
      formattedDomain = "https://" + formattedDomain;
    }

    try {
      const url = new URL(formattedDomain);
      const origin = url.origin;

      // Update the input field to show formatted domain
      n8nDomainInput.value = origin;

      // Show status while waiting for permission dialog
      displayStatus(
        "Requesting permission for " + origin + "...",
        "warning",
        domainPermissionStatus
      );

      // Disable the button while processing
      requestPermissionBtn.disabled = true;

      // Try different permission request approaches in sequence
      // Domain will be saved only after permission is granted
      tryPermissionApproaches(origin);
    } catch (e) {
      displayStatus(
        "Invalid URL format. Please enter a valid domain",
        "error",
        domainPermissionStatus
      );
      console.error("URL parsing error:", e);
    }
  }

  // Try different approaches to request permissions
  function tryPermissionApproaches(origin) {
    ("Trying multiple permission approaches for:", origin);

    // First try the background script method
    try {
      chrome.runtime.sendMessage(
        {
          action: "requestDomainPermission",
          domain: origin,
        },
        (response) => {
          // Handle potential errors with the message port
          if (chrome.runtime.lastError) {
            console.error("Message port error:", chrome.runtime.lastError);
            // Fall back to direct permission request
            requestPermissionDirectly(origin);
            return;
          }

          // Re-enable the button
          requestPermissionBtn.disabled = false;

          if (!response || response.error) {
            console.error(
              "Permission request error:",
              response?.error || "Unknown error"
            );
            // Fall back to direct permission request
            requestPermissionDirectly(origin);
            return;
          }

          if (response.granted) {
            // Save the domain only after permission is granted
            chrome.storage.local.set({ n8nDomain: origin }, () => {
              
              displayStatus(
                "Permission granted for " + origin,
                "success",
                domainPermissionStatus
              );

              // Try to open a test connection to verify access
              fetch(origin + "/favicon.ico", { method: "HEAD", mode: "no-cors" })
                .then(() => {
                  console.log("Connection test successful");
                })
                .catch((err) => {
                  console.warn(
                    "Connection test failed, but permissions may still be valid:",
                    err
                  );
                });
            });
          } else {
            // Try the direct method as fallback
            requestPermissionDirectly(origin);
          }
        }
      );
    } catch (messageError) {
      console.error(
        "Error sending message to background script:",
        messageError
      );
      // Fall back to direct permission request
      requestPermissionDirectly(origin);
    }
  }

  // Direct permission request as fallback
  function requestPermissionDirectly(origin) {
    ("Falling back to direct permission request for:", origin);

    // Re-enable the button
    if (requestPermissionBtn) {
      requestPermissionBtn.disabled = false;
    }

    try {
      // Format domain with wildcard for permission request
      const originWithWildcard = origin + "/*";

      // Request permission directly
      chrome.permissions.request(
        {
          origins: [originWithWildcard],
        },
        (granted) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Direct permission request error:",
              chrome.runtime.lastError
            );
            // Try the manifest update method
            tryManifestPermissionUpdate(origin);
            return;
          }

          if (granted) {
            // Save the domain only after permission is granted
            chrome.storage.local.set({ n8nDomain: origin }, () => {
              console.log("Domain saved:", origin);
              
              displayStatus(
                "Permission granted for " + origin,
                "success",
                domainPermissionStatus
              );

              // Try to open a test connection to verify access
              fetch(origin + "/favicon.ico", { method: "HEAD", mode: "no-cors" })
                .then(() => console.log("Connection test successful"))
                .catch((err) =>
                  console.warn(
                    "Connection test failed, but permissions may still be valid:",
                    err
                  )
                );
              
              // Reload the current tab to apply the new permissions
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                  chrome.tabs.reload(tabs[0].id);
                }
              });
            });
          } else {
            // Permission denied - show appropriate message
            displayStatus(
              "Permission denied for " + origin + ". Buttons will not be injected.",
              "error",
              domainPermissionStatus
            );
          }
        }
      );
    } catch (permissionError) {
      console.error("Error in direct permission request:", permissionError);
      // Try the manifest update method
      tryManifestPermissionUpdate(origin);
    }
  }

  // Try to update the manifest permissions directly (may not work in all browsers)
  function tryManifestPermissionUpdate(origin) {
    ("Attempting to update manifest permissions for:", origin);

    // Show manual instructions as this is our last resort
    displayStatus(
      "Permission dialog not shown. Please try manual permission granting.",
      "warning",
      domainPermissionStatus
    );
    showManualPermissionInstructions(origin);

    // Suggest reloading the extension
    const reloadSuggestion = document.createElement("div");
    reloadSuggestion.className = "reload-suggestion";
    reloadSuggestion.innerHTML = `
            <p>You may need to reload the extension for permissions to take effect.</p>
            <button id="reloadExtensionBtn" class="reload-button">Reload Extension</button>
        `;
    domainPermissionStatus.appendChild(reloadSuggestion);

    // Add event listener to reload button
    const reloadBtn = document.getElementById("reloadExtensionBtn");
    if (reloadBtn) {
      reloadBtn.addEventListener("click", () => {
        chrome.runtime.reload();
      });
    }
  }

  // Helper function to show manual permission instructions
  function showManualPermissionInstructions(origin) {
    ("Showing manual permission instructions for:", origin);

    // Clear existing content
    domainPermissionStatus.textContent = "";

    // Add status message
    const statusMessage = document.createElement("p");
    statusMessage.textContent = "Permission needed for " + origin;
    statusMessage.className = "status-message warning";
    domainPermissionStatus.appendChild(statusMessage);

    // Add manual instructions
    const manualInstructions = document.createElement("div");
    manualInstructions.className = "manual-instructions";
    manualInstructions.innerHTML = `
            <p>To manually grant permissions for ${origin}:</p>
            <ol>
                <li>Open Chrome's extension settings (chrome://extensions)</li>
                <li>Find this extension and click on "Details"</li>
                <li>Scroll down to "Site access" or "Site permissions"</li>
                <li>Select "On specific sites" or "On specific sites you specify"</li>
                <li>Click "Add" and enter "${origin}/*"</li>
                <li>Click "Add" to confirm</li>
                <li>Return to this extension and reload it if needed</li>
            </ol>
        `;
    domainPermissionStatus.appendChild(manualInstructions);
  }

  // --- Check Current Domain Permission Status ---
  function checkDomainPermissionStatus() {
    chrome.storage.local.get(["n8nDomain"], (data) => {
      const savedDomain = data.n8nDomain;

      if (!savedDomain) {
        domainPermissionStatus.textContent = "No domain configured yet.";
        return;
      }

      // First try using the background script
      try {
        chrome.runtime.sendMessage(
          {
            action: "checkDomainPermission",
            domain: savedDomain,
          },
          (response) => {
            // Handle potential errors with the message port
            if (chrome.runtime.lastError) {
              console.error(
                "Permission check error:",
                chrome.runtime.lastError
              );
              // Fall back to direct permission check
              checkDomainPermissionDirectly(savedDomain);
              return;
            }

            if (!response || response.error) {
              console.error(
                "Permission check error:",
                response?.error || "Unknown error"
              );
              displayStatus(
                "Error checking permission: " +
                  (response?.error || "Unknown error"),
                "error",
                domainPermissionStatus
              );
              return;
            }

            if (response.hasPermission) {
              displayStatus(
                "Permission granted for " + savedDomain,
                "success",
                domainPermissionStatus
              );
            } else {
              displayStatus(
                "Permission needed for " +
                  savedDomain +
                  '. Click "Request Access Permission"',
                "warning",
                domainPermissionStatus
              );
            }
          }
        );
      } catch (error) {
        console.error("Error sending permission check message:", error);
        // Fall back to direct permission check
        checkDomainPermissionDirectly(savedDomain);
      }
    });
  }

  // Direct permission check as fallback
  function checkDomainPermissionDirectly(domain) {
    ("Falling back to direct permission check for:", domain);

    try {
      // Format domain with wildcard
      const originWithWildcard = domain + "/*";

      // Check permission directly
      chrome.permissions.contains(
        {
          origins: [originWithWildcard],
        },
        (hasPermission) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Direct permission check error:",
              chrome.runtime.lastError
            );
            displayStatus(
              "Error checking permission: " + chrome.runtime.lastError.message,
              "error",
              domainPermissionStatus
            );
            return;
          }

          if (hasPermission) {
            displayStatus(
              "Permission granted for " + domain,
              "success",
              domainPermissionStatus
            );
          } else {
            displayStatus(
              "Permission needed for " +
                domain +
                '. Click "Request Access Permission"',
              "warning",
              domainPermissionStatus
            );
          }
        }
      );
    } catch (error) {
      console.error("Error in direct permission check:", error);
      displayStatus(
        "Error checking permission: " + error.message,
        "error",
        domainPermissionStatus
      );
    }
  }

  // Format domain on blur
  n8nDomainInput.addEventListener("blur", () => {
    const domain = n8nDomainInput.value.trim();
    if (domain) {
      // Format and save the domain
      let formattedDomain = domain;
      if (
        !formattedDomain.startsWith("http://") &&
        !formattedDomain.startsWith("https://")
      ) {
        formattedDomain = "https://" + formattedDomain;
      }

      try {
        const url = new URL(formattedDomain);
        const origin = url.origin;

        // Update the input with the formatted domain
        n8nDomainInput.value = origin;

        // Save the formatted domain
        chrome.storage.local.set({ n8nDomain: origin }, () => {
          ("Domain saved:", origin);

          // Check permission status for the new domain
          checkDomainPermissionStatus();
        });
      } catch (e) {
        // Don't display an error here, wait for the user to try to request permission
        console.warn("Invalid URL format:", e);
      }
    }
  });
});
