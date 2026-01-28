const BASE_URL ="https://login.n8ncopilot.com";

// Global variable to store the current AbortController for cancellation
let currentGenerationController = null;

// On extension install or update, request necessary permissions
chrome.runtime.onInstalled.addListener(() => {
  // Request necessary permissions for debug feature
  chrome.permissions.contains(
    {
      permissions: ["scripting", "activeTab"],
    },
    (hasPermissions) => {
      if (!hasPermissions) {
        // Debug feature permissions not granted yet. Will request when needed.
      }
    }
  );
});

// Startup listener
chrome.runtime.onStartup.addListener(() => {
  // Startup initialization
});


// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "N8N_AUTH_SUCCESS") {
    validateUserWithServer(request.userData,request.userData.accessToken)
      .then((validationResult) => {
        if (validationResult.success){
          // Server validation successful, store user data locally
          chrome.storage.local.set(
            {
              userAuthData: validationResult.userData,
              isAuthenticated: true,
              lastLoginTime: Date.now(),
            },
            () => {
              // Show notification to user
              chrome.notifications.create({
                type: "basic",
                iconUrl: "assets/icon48.png",
                title: "n8n Copilot",
                message: `Welcome, ${
                  validationResult.userData.displayName || validationResult.userData.email
                }!`,
              });

              // Notify popup if it's open
              chrome.runtime
                .sendMessage({
                  type: "AUTH_UPDATE",
                  userData: validationResult.userData,
                })
                .catch(() => {
                  // Ignore errors if popup is not open
                });

              sendResponse({ success: true });
            }
          );
        } else {
          // Server validation failed, don't store user data
          
          // Notify popup about authentication error
          chrome.runtime
            .sendMessage({
              type: "AUTH_ERROR",
              error: validationResult.error || "Authentication failed"
            })
            .catch(() => {
              // Popup might not be open, ignore error
            });
          
          sendResponse({ 
            success: false, 
            error: validationResult.error || "Authentication failed" 
          });
        }
      })
      .catch((error) => {
        
        // Notify popup about authentication error
        chrome.runtime
          .sendMessage({
            type: "AUTH_ERROR",
            error: "Server validation error"
          })
          .catch(() => {
            // Popup might not be open, ignore error
          });
        
        sendResponse({ 
          success: false, 
          error: "Server validation error" 
        });
      });
    
    return true; // Keep the message channel open for async response
  }

  if (request.type === "AUTH_UPDATE") {
    // Handle auth updates in popup
  }
});

// Function to validate user data with server
async function validateUserWithServer(userData, accessToken) {
  try {
    const response = await fetch(`${BASE_URL}/api/user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userData: userData,
        accessToken: accessToken,
      })   
    });

    const result = await response.json();
    if (response.ok && result.success) {
      return {
        success: true,
        userData: result.userData
      }
    } else {
      return {
        success: false,
        error: result.error || "Validation failed"
      };
    }
  } catch (error) {
    return {
      success: false,
      error: "Network error during validation"
    };
  }
}

// Helper to inject the Generate Workflow button
function injectGenerateButton(tabId, tabUrl) {
  chrome.storage.local.get(null, (data) => {
    const n8nDomain = data.n8nDomain;
    if (!n8nDomain) return;
    if (!tabUrl.startsWith(n8nDomain)) return;
    
    // Check if we actually have permission for this domain
    chrome.permissions.contains(
      { origins: [n8nDomain + "/*"] },
      (hasPermission) => {
        if (!hasPermission) {
          console.log("No permission for domain, skipping button injection:", n8nDomain);
          return;
        }
        
        // Continue with button injection
        injectGenerateButtonWithPermission(tabId, tabUrl, data);
      }
    );
  });
}

// Actual button injection logic (separated for permission check)
function injectGenerateButtonWithPermission(tabId, tabUrl, data) {
  const n8nDomain = data.n8nDomain;

    // Prepare enabled models for the modal dropdown
    const PROVIDER_LABELS = {
      openai: "OpenAI (GPT)",
      gemini: "Google Gemini",
      mistral: "Mistral AI",
      claude: "Anthropic (Claude)",
      openrouter: "OpenRouter",
      grok: "Grok (x.ai)",
    };
    const enabledModels = [];
    Object.keys(PROVIDER_LABELS).forEach((providerId) => {
      if (
        data[`${providerId}IsEnabled`] &&
        data[`${providerId}SelectedModel`]
      ) {
        enabledModels.push({
          providerId,
          label: PROVIDER_LABELS[providerId],
          model: data[`${providerId}SelectedModel`],
          apiKey: data[`${providerId}ApiKey`],
        });
      }
    });

    const imgUrl = chrome.runtime.getURL("assets/icons/generate.png");
    const historyImgUrl = chrome.runtime.getURL("assets/icons/history.png");

    // Calculate dynamic position based on enabled buttons
    // Position the container from the right edge
    const buttonPosition = "95px";

    chrome.scripting.executeScript({
      target: { tabId },
      world: "ISOLATED",
      func: (imgUrl, historyImgUrl, enabledModels, buttonPosition) => {
        if (document.getElementById("n8n-generate-btn-container")) return;

        const pane = document.querySelector("#n8n-app .vue-flow__pane");
        if (!pane) return;

        // Ensure pane is positioned for absolute children
        if (getComputedStyle(pane).position === "static") {
          pane.style.position = "relative";
        }

        // --- Container div ---
        const container = document.createElement("div");
        container.id = "n8n-generate-btn-container";
        container.style.position = "absolute";
        container.style.top = "15px";
        container.style.right = buttonPosition;
        container.style.display = "flex";
        container.style.alignItems = "center";
        container.style.justifyContent = "center";
        container.style.flexDirection = "row";
        container.style.gap = "12px";
        container.style.zIndex = "9999";

        // --- Main Generate button ---
        const btn = document.createElement("button");
        btn.id = "n8n-generate-workflow-btn";
        btn.style.height = "42px";
        btn.style.width = "200px";
        btn.style.display = "flex";
        btn.style.justifyContent = "center";
        btn.style.boxShadow =
          "0 2px 8px rgba(254, 111, 91, 0.2), 0 1px 4px rgba(0, 0, 0, 0.1)";
        btn.style.alignItems = "center";
        btn.style.background =
          "linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%)";
        btn.style.color = "#FFFFFF";
        btn.style.border = "1px solid rgba(255, 255, 255, 0.15)";
        btn.style.borderRadius = "5px";
        btn.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
        btn.style.cursor = "pointer";
        btn.style.fontSize = "14px";
        btn.style.fontFamily = "Poppins, sans-serif";
        btn.style.fontWeight = "600";
        btn.style.gap = "10px";
        btn.style.letterSpacing = "0.5px";
        btn.onmouseenter = () => {
          btn.style.transform = "translateY(-1px) scale(1.01)";
          btn.style.boxShadow =
            "0 4px 12px rgba(254, 111, 91, 0.25), 0 2px 6px rgba(0, 0, 0, 0.1)";
          btn.style.background =
            "linear-gradient(135deg, #FF8A80 0%, #FE6F5B 100%)";
        };
        btn.onmouseleave = () => {
          btn.style.transform = "translateY(0) scale(1)";
          btn.style.boxShadow =
            "0 2px 8px rgba(254, 111, 91, 0.2), 0 1px 4px rgba(0, 0, 0, 0.1)";
          btn.style.background =
            "linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%)";
        };

        const img = document.createElement("img");
        img.src = imgUrl;
        img.alt = "Generate";
        img.style.width = "23px";
        img.style.height = "20px";

        const span = document.createElement("span");
        span.textContent = "Generate Workflow";

        btn.appendChild(span);
        btn.appendChild(img);

        // Generate button click handler
        btn.onclick = () => {
          let modal = document.getElementById("n8n-generate-modal");

          if (modal) {
            modal.style.display = "flex";
            return;
          }

          modal = document.createElement("div");
          modal.id = "n8n-generate-modal";
          modal.style.position = "absolute";
          modal.style.top = container.style.top;
          modal.style.right = container.style.right;
          modal.style.boxShadow =
            "0 8px 16px rgba(0, 0, 0, 0.2), 0 4px 8px rgba(0, 0, 0, 0.1)";
          modal.style.border = "1px solid rgba(255, 255, 255, 0.1)";
          modal.style.backdropFilter = "blur(10px)";
          modal.style.zIndex = "10001";
          modal.style.background =
            "linear-gradient(145deg, #1A1A1A 0%, #2A2A2A 100%)";
          modal.style.borderRadius = "20px";
          modal.style.padding = "24px 24px 20px 24px";
          modal.style.display = "flex";
          modal.style.flexDirection = "column";
          modal.style.alignItems = "stretch";
          modal.style.gap = "16px";
          modal.style.minWidth = "560px";
          modal.style.maxWidth = "620px";

          // Prompt textarea
          const textarea = document.createElement("textarea");
          textarea.placeholder =
            "e.g., 'Create a workflow that triggers on a webhook, reads data from Google Sheets, and sends an email.' or 'A node that fetches weather data for a city.'";
          textarea.style.width = "100%";
          textarea.style.height = "130px";
          textarea.style.borderRadius = "12px";
          textarea.style.border = "1px solid rgba(255, 255, 255, 0.2)";
          textarea.style.resize = "vertical";
          textarea.style.fontSize = "14px";
          textarea.style.fontWeight = "400";
          textarea.style.outline = "none";
          textarea.style.padding = "16px 18px";
          textarea.style.overflow = "hidden";
          textarea.style.background = "rgba(255, 255, 255, 0.05)";
          textarea.style.color = "#FFFFFF";
          textarea.style.fontFamily = "Manrope, sans-serif";
          textarea.style.marginBottom = "8px";
          textarea.style.lineHeight = "1.6";
          textarea.style.transition = "all 0.2s ease";
          textarea.style.boxShadow = "0 1px 4px rgba(0, 0, 0, 0.1)";
          textarea.onfocus = () => {
            textarea.style.borderColor = "rgba(254, 111, 91, 0.4)";
            textarea.style.background = "rgba(255, 255, 255, 0.06)";
            textarea.style.boxShadow = "0 2px 6px rgba(254, 111, 91, 0.15)";
          };
          textarea.onblur = () => {
            textarea.style.borderColor = "rgba(255, 255, 255, 0.2)";
            textarea.style.background = "rgba(255, 255, 255, 0.05)";
            textarea.style.boxShadow = "0 1px 4px rgba(0, 0, 0, 0.1)";
          };
          textarea.onmouseenter = () => {
            textarea.style.background = "rgba(255, 255, 255, 0.08)";
          };
          textarea.onmouseleave = () => {
            if (document.activeElement !== textarea) {
              textarea.style.background = "rgba(255, 255, 255, 0.05)";
            }
          };

          // Bottom row: dropdown + button initially
          const bottomRow = document.createElement("div");
          bottomRow.style.display = "flex";
          bottomRow.style.justifyContent = "space-between";
          bottomRow.style.alignItems = "center";
          bottomRow.style.gap = "10px";
          bottomRow.style.marginTop = "4px";
          bottomRow.style.minHeight = "60px";

          // Model select row (label + custom dropdown)
          const modelRow = document.createElement("div");
          modelRow.style.display = "flex";
          modelRow.style.alignItems = "center";
          modelRow.style.gap = "4px";
          modelRow.style.marginBottom = "6px";
          modelRow.style.position = "relative";
          modelRow.style.flex = "1";
          modelRow.style.minWidth = "160px";

          // Label with dropdown icon inside
          const modelLabel = document.createElement("span");
          modelLabel.innerHTML = `<span>Select Ai Model</span><svg width="16" height="16" fill="#fff" viewBox="0 0 24 24" style="margin-left: auto;"><path d="M7 10l5 5 5-5z"/></svg>`;
          modelLabel.style.border = "1px solid rgba(255, 255, 255, 0.2)";
          modelLabel.style.borderRadius = "8px";
          modelLabel.style.background = "rgba(255, 255, 255, 0.05)";
          modelLabel.style.color = "#fff";
          modelLabel.style.display = "flex";
          modelLabel.style.alignItems = "center";
          modelLabel.style.justifyContent = "space-between";
          modelLabel.style.fontSize = "13px";
          modelLabel.style.flex = "1";
          modelLabel.style.padding = "12px 18px";
          modelLabel.style.cursor = "pointer";
          modelLabel.style.transition = "all 0.2s ease";
          modelLabel.style.fontWeight = "500";
          modelLabel.onmouseenter = () => {
            modelLabel.style.background = "rgba(255, 255, 255, 0.1)";
            modelLabel.style.borderColor = "rgba(254, 111, 91, 0.5)";
          };
          modelLabel.onmouseleave = () => {
            modelLabel.style.background = "rgba(255, 255, 255, 0.05)";
            modelLabel.style.borderColor = "rgba(255, 255, 255, 0.2)";
          };
          modelRow.appendChild(modelLabel);

          // Custom dropdown menu (hidden by default)
          const dropdown = document.createElement("div");
          dropdown.style.position = "absolute";
          dropdown.style.left = "0";
          dropdown.style.top = "110%";
          dropdown.style.background =
            "linear-gradient(145deg, #2A2A2A 0%, #1C1C1C 100%)";
          dropdown.style.border = "1px solid rgba(255, 255, 255, 0.15)";
          dropdown.style.borderRadius = "12px";
          dropdown.style.boxShadow =
            "0 8px 24px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2)";
          dropdown.style.zIndex = "9999";
          dropdown.style.display = "none";
          dropdown.style.minWidth = "280px";
          dropdown.style.maxHeight = "200px";
          dropdown.style.overflowY = "auto";
          dropdown.style.padding = "10px 0";
          dropdown.style.backdropFilter = "blur(10px)";
          dropdown.style.scrollbarWidth = "thin";
          dropdown.style.scrollbarColor = "#FF6B3B #1A1A1A";

          // Model options (from enabledModels param)
          enabledModels.forEach((modelObj) => {
            const opt = document.createElement("div");
            opt.textContent = `${modelObj.label} - ${modelObj.model}`;
            opt.style.padding = "14px 18px";
            opt.style.color = "#fff";
            opt.style.cursor = "pointer";
            opt.style.fontSize = "13px";
            opt.style.borderRadius = "8px";
            opt.style.margin = "2px 8px";
            opt.style.transition = "all 0.2s ease";
            opt.style.fontWeight = "500";
            opt.onmouseenter = () => {
              opt.style.background =
                "linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%)";
              opt.style.transform = "translateX(4px)";
            };
            opt.onmouseleave = () => {
              opt.style.background = "transparent";
              opt.style.transform = "translateX(0)";
            };
            opt.onclick = () => {
              modelLabel.innerHTML = `<span>${modelObj.label} - ${modelObj.model}</span><svg width="16" height="16" fill="#fff" viewBox="0 0 24 24" style="margin-left: auto;"><path d="M7 10l5 5 5-5z"/></svg>`;
              dropdown.style.display = "none";
              // Save selected model info for generation operation
              modelRow.dataset.selectedProviderId = modelObj.providerId;
              modelRow.dataset.selectedModel = modelObj.model;
              modelRow.dataset.selectedApiKey = modelObj.apiKey;
            };
            dropdown.appendChild(opt);
          });
          modelRow.appendChild(dropdown);

          // Show dropdown on label click
          modelLabel.onclick = (e) => {
            dropdown.style.display =
              dropdown.style.display === "none" ? "block" : "none";
            e.stopPropagation();
          };
          // Hide dropdown when clicking outside
          document.addEventListener("click", (e) => {
            if (!modelRow.contains(e.target)) {
              dropdown.style.display = "none";
            }
          });

          // Initial Generate button
          const generateBtn = document.createElement("button");
          generateBtn.textContent = "Generate";
          generateBtn.style.background =
            "linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%)";
          generateBtn.style.color = "#fff";
          generateBtn.style.border = "none";
          generateBtn.style.width = "100px";
          generateBtn.style.height = "40px";
          generateBtn.style.borderRadius = "10px";
          generateBtn.style.padding = "10px 24px";
          generateBtn.style.fontSize = "13px";
          generateBtn.style.fontWeight = "600";
          generateBtn.style.display = "flex";
          generateBtn.style.alignItems = "center";
          generateBtn.style.justifyContent = "center";
          generateBtn.style.cursor = "pointer";
          generateBtn.style.fontFamily = "Poppins, sans-serif";
          generateBtn.style.transition = "all 0.2s ease";
          generateBtn.style.boxShadow = "0 2px 6px rgba(254, 111, 91, 0.2)";
          generateBtn.style.letterSpacing = "0.3px";
          generateBtn.onmouseenter = () => {
            generateBtn.style.transform = "scale(1.02)";
            generateBtn.style.boxShadow = "0 3px 8px rgba(254, 111, 91, 0.25)";
            generateBtn.style.background =
              "linear-gradient(135deg, #FF8A80 0%, #FE6F5B 100%)";
          };
          generateBtn.onmouseleave = () => {
            generateBtn.style.transform = "scale(1)";
            generateBtn.style.boxShadow = "0 2px 6px rgba(254, 111, 91, 0.2)";
            generateBtn.style.background =
              "linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%)";
          };

          // Close button
          const closeBtn = document.createElement("button");
          closeBtn.textContent = "×";
          closeBtn.style.position = "absolute";
          closeBtn.style.top = "2px";
          closeBtn.style.right = "2px";
          closeBtn.style.background = "transparent";
          closeBtn.style.fontSize = "18px";
          closeBtn.style.color = "#FFFFFF";
          closeBtn.style.cursor = "pointer";
          closeBtn.style.border = "none";
          closeBtn.style.borderRadius = "50%";
          closeBtn.style.width = "32px";
          closeBtn.style.height = "32px";
          closeBtn.style.display = "flex";
          closeBtn.style.alignItems = "center";
          closeBtn.style.justifyContent = "center";
          closeBtn.style.transition = "all 0.2s ease";
          closeBtn.style.fontWeight = "bold";
          closeBtn.onmouseenter = () => {
            closeBtn.style.transform = "scale(1.1)";
          };
          closeBtn.onmouseleave = () => {
            closeBtn.style.transform = "scale(1)";
          };

          closeBtn.onclick = () => {
            modal.style.display = "none";
            container.style.display = "flex";
          };

          bottomRow.appendChild(modelRow);
          bottomRow.appendChild(generateBtn);

          modal.appendChild(closeBtn);
          modal.appendChild(textarea);
          modal.appendChild(bottomRow);

          pane.appendChild(modal);

          // Add Enter key listener for textarea (Enter without Shift triggers generate)
          textarea.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              generateBtn.click();
            }
          });

          // Handle Generate button click
          generateBtn.onclick = () => {
            const prompt = textarea.value.trim();
            const providerId = modelRow.dataset.selectedProviderId;
            const model = modelRow.dataset.selectedModel;
            const apiKey = modelRow.dataset.selectedApiKey;

            if (!prompt) {
              textarea.focus();
              textarea.style.border = "1.5px solid #FFFFFF";
              textarea.style.borderRadius = "5px";
              return;
            }
            if (!providerId || !model || !apiKey) {
              modelLabel.style.color = "#FE6F5B";
              modelLabel.textContent = "Please select an AI model!";
              setTimeout(() => {
                modelLabel.style.color = "#fff";
                modelLabel.textContent =
                  providerId && model
                    ? `${providerId} - ${model}`
                    : "Select Ai Model";
              }, 1500);
              return;
            }

            // Replace dropdown with static text during generation
            bottomRow.removeChild(modelRow);
            const staticText = document.createElement("span");
            staticText.textContent =
              "Generating JSON, please wait... Generation speed depends on your API and query  complexity.";
            staticText.style.color = "#FFA323";
            staticText.style.fontSize = "9px";
            staticText.style.fontWeight = "275";
            staticText.style.fontStyle = "italic";
            staticText.style.fontFamily = "poppins, sans-serif";
            staticText.style.flex = "1";
            staticText.style.maxWidth = "280px";
            staticText.style.lineHeight = "1.4";
            staticText.style.wordWrap = "break-word";
            staticText.style.overflowWrap = "break-word";
            staticText.style.display = "flex";
            staticText.style.alignItems = "center";
            bottomRow.insertBefore(staticText, generateBtn);

            // Replace Generate button with Generating state
            bottomRow.removeChild(generateBtn);
            const generatingBtn = document.createElement("button");
            generatingBtn.textContent = "Generating...";
            generatingBtn.style.background =
              "linear-gradient(135deg, #7A7575 0%, #9E9E9E 100%)";
            generatingBtn.style.color = "#FFFFFF";
            generatingBtn.style.width = "110px";
            generatingBtn.style.height = "40px";
            generatingBtn.style.border = "none";
            generatingBtn.style.borderRadius = "10px";
            generatingBtn.style.padding = "10px 24px";
            generatingBtn.style.fontSize = "13px";
            generatingBtn.style.fontWeight = "600";
            generatingBtn.style.display = "flex";
            generatingBtn.style.alignItems = "center";
            generatingBtn.style.justifyContent = "center";
            generatingBtn.style.cursor = "not-allowed";
            generatingBtn.style.fontFamily = "Poppins, sans-serif";
            generatingBtn.style.transition = "all 0.2s ease";
            generatingBtn.style.boxShadow =
              "0 4px 12px rgba(122, 117, 117, 0.3)";
            generatingBtn.style.letterSpacing = "0.3px";
            generatingBtn.disabled = true;

            const cancelBtn = document.createElement("button");
            cancelBtn.textContent = "Cancel";
            cancelBtn.style.background =
              "linear-gradient(135deg, #E32000 0%, #FF4444 100%)";
            cancelBtn.style.color = "#FFFFFF";
            cancelBtn.style.border = "none";
            cancelBtn.style.width = "80px";
            cancelBtn.style.height = "40px";
            cancelBtn.style.borderRadius = "10px";
            cancelBtn.style.padding = "10px 24px";
            cancelBtn.style.fontSize = "13px";
            cancelBtn.style.fontWeight = "600";
            cancelBtn.style.display = "flex";
            cancelBtn.style.alignItems = "center";
            cancelBtn.style.justifyContent = "center";
            cancelBtn.style.cursor = "pointer";
            cancelBtn.style.fontFamily = "Poppins, sans-serif";
            cancelBtn.style.transition = "all 0.2s ease";
            cancelBtn.style.boxShadow = "0 2px 6px rgba(227, 32, 0, 0.2)";
            cancelBtn.style.letterSpacing = "0.3px";
            cancelBtn.onmouseenter = () => {
              cancelBtn.style.transform = "scale(1.02)";
              cancelBtn.style.boxShadow = "0 3px 8px rgba(227, 32, 0, 0.25)";
              cancelBtn.style.background =
                "linear-gradient(135deg, #FF4444 0%, #E32000 100%)";
            };
            cancelBtn.onmouseleave = () => {
              cancelBtn.style.transform = "scale(1)";
              cancelBtn.style.boxShadow = "0 2px 6px rgba(227, 32, 0, 0.2)";
              cancelBtn.style.background =
                "linear-gradient(135deg, #E32000 0%, #FF4444 100%)";
            };

            cancelBtn.onclick = () => {
              // Send cancel message to background script
              chrome.runtime.sendMessage(
                { action: "cancelGeneration" },
                (response) => {
                  if (response && response.success) {
                    // Revert to original state with dropdown after cancellation
                    bottomRow.removeChild(generatingBtn);
                    bottomRow.removeChild(cancelBtn);
                    bottomRow.removeChild(staticText);
                    bottomRow.appendChild(modelRow);
                    bottomRow.appendChild(generateBtn);
                  }
                }
              );
            };

            bottomRow.appendChild(generatingBtn);
            bottomRow.appendChild(cancelBtn);

            // Send message to background script and wait for response
            chrome.runtime.sendMessage(
              {
                action: "startBackgroundGeneration",
                providerId,
                model,
                userPrompt: prompt,
                apiKey,
              },
              (response) => {
                // Clean up generating state
                bottomRow.removeChild(generatingBtn);
                bottomRow.removeChild(cancelBtn);
                bottomRow.removeChild(staticText);

                // Restore dropdown and generate controls
                if (!bottomRow.contains(modelRow)) {
                  bottomRow.appendChild(modelRow);
                }
                if (!bottomRow.contains(generateBtn)) {
                  bottomRow.appendChild(generateBtn);
                }

                // If generation succeeded, close the modal
                if (response && response.success) {
                  modal.style.display = "none";
                  container.style.display = "flex";
                }
              }
            );

          };
        };

        // Add button to the container
        container.appendChild(btn);

        // --- Version Flow History button (small square with icon only) ---
        const historyBtn = document.createElement("button");
        historyBtn.id = "n8n-version-history-btn";
        historyBtn.style.height = "45px";
        historyBtn.style.width = "45px";
        historyBtn.style.display = "flex";
        historyBtn.style.justifyContent = "center";
        historyBtn.style.boxShadow =
          "0 2px 8px rgba(254, 111, 91, 0.2), 0 1px 4px rgba(0, 0, 0, 0.1)";
        historyBtn.style.alignItems = "center";
        historyBtn.style.background =
          "linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%)";
        historyBtn.style.color = "#FFFFFF";
        historyBtn.style.border = "1px solid rgba(255, 255, 255, 0.15)";
        historyBtn.style.borderRadius = "5px";
        historyBtn.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
        historyBtn.style.cursor = "pointer";
        historyBtn.style.fontFamily = "Poppins, sans-serif";
        historyBtn.title = "Version History";
        historyBtn.onmouseenter = () => {
          historyBtn.style.transform = "translateY(-1px) scale(1.05)";
          historyBtn.style.boxShadow =
            "0 4px 12px rgba(254, 111, 91, 0.25), 0 2px 6px rgba(0, 0, 0, 0.1)";
          historyBtn.style.background =
            "linear-gradient(135deg, #FF8A80 0%, #FE6F5B 100%)";
        };
        historyBtn.onmouseleave = () => {
          historyBtn.style.transform = "translateY(0) scale(1)";
          historyBtn.style.boxShadow =
            "0 2px 8px rgba(254, 111, 91, 0.2), 0 1px 4px rgba(0, 0, 0, 0.1)";
          historyBtn.style.background =
            "linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%)";
        };

        const historyImg = document.createElement("img");
        historyImg.src = historyImgUrl;
        historyImg.alt = "Version History";
        historyImg.style.width = "22px";
        historyImg.style.height = "22px";

        historyBtn.appendChild(historyImg);

        // Version History button click handler - show premium notification
        historyBtn.onclick = () => {
          showPremiumNotification("Version History", "This version history feature is only available in the paid version. Upgrade to access workflow versioning and history tracking.");
        };

        container.appendChild(historyBtn);

        // Helper function to show premium feature notification
        function showPremiumNotification(featureName, message) {
          // Remove existing notification if any
          const existingNotification = document.getElementById('n8n-premium-notification');
          if (existingNotification) {
            existingNotification.remove();
          }

          // Create notification element
          const notification = document.createElement('div');
          notification.id = 'n8n-premium-notification';
          notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(145deg, #1A1A1A 0%, #2A2A2A 100%);
            border: 1px solid rgba(254, 111, 91, 0.3);
            border-left: 4px solid #FE6F5B;
            color: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3), 0 4px 6px rgba(0, 0, 0, 0.2);
            z-index: 999999;
            max-width: 420px;
            min-width: 350px;
            animation: slideInPremium 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            backdrop-filter: blur(10px);
          `;

          // Add animation styles if not already present
          if (!document.getElementById('n8n-premium-notification-style')) {
            const style = document.createElement('style');
            style.id = 'n8n-premium-notification-style';
            style.textContent = `
              @keyframes slideInPremium {
                from {
                  transform: translateX(100%) scale(0.95);
                  opacity: 0;
                }
                to {
                  transform: translateX(0) scale(1);
                  opacity: 1;
                }
              }
              @keyframes slideOutPremium {
                from {
                  transform: translateX(0) scale(1);
                  opacity: 1;
                }
                to {
                  transform: translateX(100%) scale(0.95);
                  opacity: 0;
                }
              }
            `;
            document.head.appendChild(style);
          }

          notification.innerHTML = `
            <button style="
              position: absolute;
              top: 10px;
              right: 10px;
              background: none;
              border: none;
              color: #999;
              cursor: pointer;
              font-size: 18px;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 4px;
              transition: all 0.2s ease;
            " onmouseover="this.style.background='#2a2a2a';this.style.color='white';" onmouseout="this.style.background='none';this.style.color='#999';" onclick="this.parentElement.remove()">×</button>
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <div style="
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div>
                <h3 style="font-weight: 700; font-size: 16px; color: white; margin: 0;">Premium Feature</h3>
                <p style="font-size: 13px; color: #FE6F5B; margin: 0; font-weight: 500;">${featureName}</p>
              </div>
            </div>
            <p style="font-size: 14px; color: #e0e0e0; line-height: 1.5; margin: 0 0 16px 0;">${message}</p>
            <a href="https://n8ncopilot.com/pricing" target="_blank" style="
              display: inline-flex;
              align-items: center;
              gap: 8px;
              background: linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%);
              color: white;
              text-decoration: none;
              padding: 10px 20px;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 600;
              transition: all 0.2s ease;
            " onmouseover="this.style.transform='scale(1.02)';this.style.boxShadow='0 4px 12px rgba(254, 111, 91, 0.3)';" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none';">
              Upgrade Now
              <svg width="14" height="14" fill="white" viewBox="0 0 24 24">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </a>
          `;

          document.body.appendChild(notification);

          // Auto remove after 8 seconds
          setTimeout(() => {
            if (notification.parentNode) {
              notification.style.animation = 'slideOutPremium 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
              setTimeout(() => {
                if (notification.parentNode) {
                  notification.remove();
                }
              }, 300);
            }
          }, 8000);
        }

        // Add the container to the pane
        pane.appendChild(container);
      },
      args: [imgUrl, historyImgUrl, enabledModels, buttonPosition],
    });
}

// Helper to inject the Debug button (bottom right corner)
function injectDebugButton(tabId, tabUrl) {
  chrome.storage.local.get(null, (data) => {
    const n8nDomain = data.n8nDomain;
    if (!n8nDomain) return;
    if (!tabUrl.startsWith(n8nDomain)) return;
    
    // Check if we actually have permission for this domain
    chrome.permissions.contains(
      { origins: [n8nDomain + "/*"] },
      (hasPermission) => {
        if (!hasPermission) {
          console.log("No permission for domain, skipping debug button injection:", n8nDomain);
          return;
        }
        
        // Continue with button injection
        injectDebugButtonWithPermission(tabId, tabUrl, data);
      }
    );
  });
}

// Actual debug button injection logic (separated for permission check)
function injectDebugButtonWithPermission(tabId, tabUrl, data) {
    chrome.scripting.executeScript({
      target: { tabId },
      world: "ISOLATED",
      func: () => {
        if (document.getElementById("n8n-debug-btn")) return;

        const pane = document.querySelector("#n8n-app .vue-flow__pane");
        if (!pane) return;

        // Ensure pane is positioned for absolute children
        if (getComputedStyle(pane).position === "static") {
          pane.style.position = "relative";
        }

        // --- Debug FAB button ---
        const debugBtn = document.createElement("button");
        debugBtn.id = "n8n-debug-btn";
        debugBtn.style.position = "absolute";
        debugBtn.style.bottom = "20px";
        debugBtn.style.right = "20px";
        debugBtn.style.height = "50px";
        debugBtn.style.width = "50px";
        debugBtn.style.display = "flex";
        debugBtn.style.justifyContent = "center";
        debugBtn.style.alignItems = "center";
        debugBtn.style.background = "linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%)";
        debugBtn.style.color = "#FFFFFF";
        debugBtn.style.border = "1px solid rgba(255, 255, 255, 0.15)";
        debugBtn.style.borderRadius = "50%";
        debugBtn.style.boxShadow = "0 4px 12px rgba(254, 111, 91, 0.3), 0 2px 6px rgba(0, 0, 0, 0.15)";
        debugBtn.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
        debugBtn.style.cursor = "pointer";
        debugBtn.style.fontFamily = "Poppins, sans-serif";
        debugBtn.style.zIndex = "9999";
        debugBtn.title = "Debug Chat";
        
        debugBtn.onmouseenter = () => {
          debugBtn.style.transform = "translateY(-2px) scale(1.05)";
          debugBtn.style.boxShadow = "0 6px 16px rgba(254, 111, 91, 0.35), 0 4px 8px rgba(0, 0, 0, 0.2)";
          debugBtn.style.background = "linear-gradient(135deg, #FF8A80 0%, #FE6F5B 100%)";
        };
        debugBtn.onmouseleave = () => {
          debugBtn.style.transform = "translateY(0) scale(1)";
          debugBtn.style.boxShadow = "0 4px 12px rgba(254, 111, 91, 0.3), 0 2px 6px rgba(0, 0, 0, 0.15)";
          debugBtn.style.background = "linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%)";
        };

        // Chat icon SVG
        debugBtn.innerHTML = `
          <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          </svg>
        `;

        // Debug button click handler - show premium notification
        debugBtn.onclick = () => {
          showPremiumNotification("Debug Mode", "This debug feature is only available in the paid version. Upgrade to access workflow debugging and error analysis tools.");
        };

        // Helper function to show premium feature notification
        function showPremiumNotification(featureName, message) {
          // Remove existing notification if any
          const existingNotification = document.getElementById('n8n-premium-notification');
          if (existingNotification) {
            existingNotification.remove();
          }

          // Create notification element
          const notification = document.createElement('div');
          notification.id = 'n8n-premium-notification';
          notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(145deg, #1A1A1A 0%, #2A2A2A 100%);
            border: 1px solid rgba(254, 111, 91, 0.3);
            border-left: 4px solid #FE6F5B;
            color: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3), 0 4px 6px rgba(0, 0, 0, 0.2);
            z-index: 999999;
            max-width: 420px;
            min-width: 350px;
            animation: slideInPremium 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            backdrop-filter: blur(10px);
          `;

          // Add animation styles if not already present
          if (!document.getElementById('n8n-premium-notification-style')) {
            const style = document.createElement('style');
            style.id = 'n8n-premium-notification-style';
            style.textContent = `
              @keyframes slideInPremium {
                from {
                  transform: translateX(100%) scale(0.95);
                  opacity: 0;
                }
                to {
                  transform: translateX(0) scale(1);
                  opacity: 1;
                }
              }
              @keyframes slideOutPremium {
                from {
                  transform: translateX(0) scale(1);
                  opacity: 1;
                }
                to {
                  transform: translateX(100%) scale(0.95);
                  opacity: 0;
                }
              }
            `;
            document.head.appendChild(style);
          }

          notification.innerHTML = `
            <button style="
              position: absolute;
              top: 10px;
              right: 10px;
              background: none;
              border: none;
              color: #999;
              cursor: pointer;
              font-size: 18px;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 4px;
              transition: all 0.2s ease;
            " onmouseover="this.style.background='#2a2a2a';this.style.color='white';" onmouseout="this.style.background='none';this.style.color='#999';" onclick="this.parentElement.remove()">×</button>
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <div style="
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                </svg>
              </div>
              <div>
                <h3 style="font-weight: 700; font-size: 16px; color: white; margin: 0;">Premium Feature</h3>
                <p style="font-size: 13px; color: #FE6F5B; margin: 0; font-weight: 500;">${featureName}</p>
              </div>
            </div>
            <p style="font-size: 14px; color: #e0e0e0; line-height: 1.5; margin: 0 0 16px 0;">${message}</p>
            <a href="https://n8ncopilot.com/pricing" target="_blank" style="
              display: inline-flex;
              align-items: center;
              gap: 8px;
              background: linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%);
              color: white;
              text-decoration: none;
              padding: 10px 20px;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 600;
              transition: all 0.2s ease;
            " onmouseover="this.style.transform='scale(1.02)';this.style.boxShadow='0 4px 12px rgba(254, 111, 91, 0.3)';" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none';">
              Upgrade Now
              <svg width="14" height="14" fill="white" viewBox="0 0 24 24">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </a>
          `;

          document.body.appendChild(notification);

          // Auto remove after 8 seconds
          setTimeout(() => {
            if (notification.parentNode) {
              notification.style.animation = 'slideOutPremium 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
              setTimeout(() => {
                if (notification.parentNode) {
                  notification.remove();
                }
              }, 300);
            }
          }, 8000);
        }

        // Add debug button to the pane
        pane.appendChild(debugBtn);
      },
      args: [],
    });
}

// function injectHistoryButton(tabId, tabUrl) {
//   chrome.storage.local.get(null, (data) => {
//     const n8nDomain = data.n8nDomain;
//     if (!n8nDomain) return;
//     if (!tabUrl.startsWith(n8nDomain)) return;
    
//     // Check if we actually have permission for this domain
//     chrome.permissions.contains(
//       { origins: [n8nDomain + "/*"] },
//       (hasPermission) => {
//         if (!hasPermission) {
//           console.log("No permission for domain, skipping history button injection:", n8nDomain);
//           return;
//         }
        
//         // Continue with button injection
//         injectHistoryButtonWithPermission(tabId, tabUrl, data);
//       }
//     );
//   });
// }

// // Actual history button injection logic (separated for permission check)
// function injectHistoryButtonWithPermission(tabId, tabUrl, data) {
//   const n8nDomain = data.n8nDomain;

//     const historyImgUrl = chrome.runtime.getURL("assets/icons/history.png");
//     const downloadImgUrl = chrome.runtime.getURL("assets/icons/download.png");
//     const copyImgUrl = chrome.runtime.getURL("assets/icons/copy.png");

//     chrome.scripting.executeScript({
//       target: { tabId },
//       world: "ISOLATED",
//       func: (historyImgUrl, downloadImgUrl, copyImgUrl) => {
//         window.copyJSON = function (index) {
//           const json = window.__n8nVersionHistoryCache?.[index]?.json;
//           if (!json) {
//             alert("Nothing to copy!");
//             return;
//           }

//           window.focus();
//           try {
//             navigator.clipboard
//               .writeText(json)
//               .then(() => {
//                 alert("Copied to clipboard!");
//               })
//               .catch((err) => {
//                 alert(
//                   "Failed to copy to clipboard. Please try again or ensure this tab is active."
//                 );
//               });
//           } catch (err) {
//             alert(
//               "Clipboard access denied. Please ensure this tab is active and try again."
//             );
//           }
//         };

//         window.downloadJSON = function (index) {
//           const json = window.__n8nVersionHistoryCache?.[index]?.json;
//           if (!json) return alert("Nothing to download!");
//           const blob = new Blob([json], { type: "application/json" });
//           const url = URL.createObjectURL(blob);
//           const a = document.createElement("a");
//           a.href = url;
//           a.download = `n8n-history-${index + 1}.json`;
//           document.body.appendChild(a);
//           a.click();
//           document.body.removeChild(a);
//           URL.revokeObjectURL(url);
//         };

//         function showHistoryModal() {
//           let workflowId = null;
//           try {
//             const url = window.location.href;
//             const workflowIdMatch = url.match(/\/workflows?\/([^\/\?]+)/);
//             workflowId = workflowIdMatch ? workflowIdMatch[1] : null;
//             if (!workflowId) {
//               const app = document.querySelector("#app")?.__vue_app__;
//               if (app) {
//                 const pinia = app._context.config.globalProperties.$pinia;
//                 const workflowStore = pinia._s.get("workflows");
//                 const workflow = workflowStore.workflow;
//                 workflowId = workflow?.id || null;
//                 if (
//                   workflowId === "__EMPTY__" ||
//                   !workflowId ||
//                   workflowId === "undefined"
//                 ) {
//                   workflowId = null;
//                 }
//               }
//             }
//           } catch (e) {
//             workflowId = null;
//           }

//           if (!workflowId) {
//             try {
//               let tempId = sessionStorage.getItem("n8nVersionTempId");
//               if (!tempId) {
//                 const baseSeed = (document.querySelector("#app")?.__vue_app__?._uid) || Date.now();
//                 tempId = `temp-${baseSeed}`;
//                 sessionStorage.setItem("n8nVersionTempId", tempId);
//               }
//               workflowId = tempId;
//             } catch (e) {
//               workflowId = `temp-${Date.now()}`;
//             }
//           }

//           chrome.runtime.sendMessage(
//             { action: "getWorkflowVersionHistory", workflowId },
//             (response) => {
//               if (chrome.runtime.lastError || !response || !response.success) {
//                 return;
//               }
//               window.__n8nVersionHistoryCache = response.history
//                 .slice(0, 10)
//                 .reverse();
              
//               let existingModal = document.getElementById("n8nHistoryModal");
//               if (existingModal) existingModal.remove();

//               const modal = document.createElement("div");
//               modal.id = "n8nHistoryModal";
//               modal.style.position = "fixed";
//               modal.style.top = "142px";
//               modal.style.right = "76px";
//               modal.style.width = "460px";
//               modal.style.maxHeight = "360px";
//               modal.style.background =
//                 "linear-gradient(145deg, #1C1C1C 0%, #2A2A2A 100%)";
//               modal.style.borderRadius = "20px";
//               modal.style.zIndex = "10011";
//               modal.style.display = "flex";
//               modal.style.flexDirection = "column";
//               modal.style.padding = "0";
//               modal.style.overflow = "hidden";
//               modal.style.fontFamily = "Manrope, sans-serif";
//               modal.style.backdropFilter = "blur(20px)";
//               modal.style.border = "1px solid rgba(255, 255, 255, 0.15)";
//               modal.style.boxShadow =
//                 "0 8px 16px rgba(0, 0, 0, 0.2), 0 4px 8px rgba(0, 0, 0, 0.1)";

//               // Header
//               const header = document.createElement("div");
//               header.style.background = "#F97316";
//               header.style.height = "50px";
//               header.style.borderTopLeftRadius = "8px";
//               header.style.borderTopRightRadius = "8px";
//               header.style.display = "flex";
//               header.style.alignItems = "center";
//               header.style.justifyContent = "space-between";
//               header.style.padding = "0 20px";
//               header.style.position = "relative";
//               header.style.boxShadow = "0 1px 4px rgba(249, 115, 22, 0.2)";

//               const headerTitle = document.createElement("div");
//               headerTitle.textContent = "Version History";
//               headerTitle.style.color = "#fff";
//               headerTitle.style.fontSize = "16px";
//               headerTitle.style.fontWeight = "600";
//               headerTitle.style.fontFamily = "Poppins, sans-serif";

//               const headerCloseBtn = document.createElement("button");
//               headerCloseBtn.textContent = "×";
//               headerCloseBtn.style.position = "absolute";
//               headerCloseBtn.style.top = "2px";
//               headerCloseBtn.style.right = "12px";
//               headerCloseBtn.style.background = "transparent";
//               headerCloseBtn.style.color = "#FFFFFFCC";
//               headerCloseBtn.style.border = "none";
//               headerCloseBtn.style.borderRadius = "0";
//               headerCloseBtn.style.width = "auto";
//               headerCloseBtn.style.height = "auto";
//               headerCloseBtn.style.padding = "0";
//               headerCloseBtn.style.fontSize = "20px";
//               headerCloseBtn.style.cursor = "pointer";
//               headerCloseBtn.style.transition = "color 0.15s ease";
//               headerCloseBtn.style.display = "flex";
//               headerCloseBtn.style.alignItems = "center";
//               headerCloseBtn.style.justifyContent = "center";
//               headerCloseBtn.style.fontWeight = "bold";
//               headerCloseBtn.onmouseenter = () => {
//                 headerCloseBtn.style.color = "#FFFFFF";
//               };
//               headerCloseBtn.onmouseleave = () => {
//                 headerCloseBtn.style.color = "#FFFFFFCC";
//               };
//               headerCloseBtn.onclick = () => modal.remove();

//               header.appendChild(headerTitle);
//               header.appendChild(headerCloseBtn);
//               modal.appendChild(header);

//               if (window.__n8nVersionHistoryCache.length === 0) {
//                 const contentArea = document.createElement("div");
//                 contentArea.style.flex = "1";
//                 contentArea.style.padding = "40px 20px";
//                 contentArea.style.display = "flex";
//                 contentArea.style.flexDirection = "column";
//                 contentArea.style.alignItems = "center";
//                 contentArea.style.justifyContent = "center";
//                 contentArea.style.textAlign = "center";

//                 const emptyIcon = document.createElement("div");
//                 emptyIcon.style.width = "60px";
//                 emptyIcon.style.height = "60px";
//                 emptyIcon.style.borderRadius = "50%";
//                 emptyIcon.style.background = "rgba(254, 111, 91, 0.1)";
//                 emptyIcon.style.display = "flex";
//                 emptyIcon.style.alignItems = "center";
//                 emptyIcon.style.justifyContent = "center";
//                 emptyIcon.style.marginBottom = "20px";
//                 emptyIcon.style.fontSize = "24px";
//                 emptyIcon.textContent = "📝";

//                 const emptyText = document.createElement("div");
//                 emptyText.textContent = "No version history found";
//                 emptyText.style.color = "#FFFFFF";
//                 emptyText.style.fontSize = "16px";
//                 emptyText.style.fontWeight = "500";
//                 emptyText.style.marginBottom = "8px";

//                 const emptyDesc = document.createElement("div");
//                 emptyDesc.textContent =
//                   "Versions will be saved automatically when you generate or modify workflows.";
//                 emptyDesc.style.color = "#AAAAAA";
//                 emptyDesc.style.fontSize = "14px";
//                 emptyDesc.style.lineHeight = "1.5";
//                 emptyDesc.style.maxWidth = "280px";

//                 contentArea.appendChild(emptyIcon);
//                 contentArea.appendChild(emptyText);
//                 contentArea.appendChild(emptyDesc);
//                 modal.appendChild(contentArea);

//                 const pane = document.querySelector("#n8n-app .vue-flow__pane");
//                 if (pane && getComputedStyle(pane).overflow !== "hidden") {
//                   pane.appendChild(modal);
//                 } else {
//                   document.body.appendChild(modal);
//                 }
//                 return;
//               }

//               const contentArea = document.createElement("div");
//               contentArea.style.flex = "1";
//               contentArea.style.padding = "20px";
//               contentArea.style.overflowY = "scroll"; // Changed from auto to scroll to always show scrollbar
//               contentArea.style.maxHeight = "300px";
//               // Constrain scroll area so new versions do not grow modal height
//               contentArea.style.maxHeight = "calc(100vh - 210px)";
//               contentArea.style.display = "flex";
//               contentArea.style.flexDirection = "column";
//               contentArea.style.gap = "12px";
//               contentArea.style.scrollbarWidth = "thin"; // Firefox
//               contentArea.style.scrollbarColor = "#666666 #1A1A1A"; // Firefox: thumb track
              
//               // Add scrollbar styles once - simple and always visible
//               let scrollbarStyle = document.getElementById("n8nHistoryScrollbarStyle");
//               if (!scrollbarStyle) {
//                 scrollbarStyle = document.createElement("style");
//                 scrollbarStyle.id = "n8nHistoryScrollbarStyle";
//                 scrollbarStyle.textContent = `
//                 #n8nHistoryModal .content-area::-webkit-scrollbar {
//                   width: 10px;
//                   -webkit-appearance: none;
//                 }
//                 #n8nHistoryModal .content-area::-webkit-scrollbar-track {
//                   background: #1A1A1A;
//                   border-radius: 5px;
//                 }
//                 #n8nHistoryModal .content-area::-webkit-scrollbar-thumb {
//                   background: #666666;
//                   border-radius: 5px;
//                   border: 2px solid #1A1A1A;
//                 }
//                 #n8nHistoryModal .content-area::-webkit-scrollbar-thumb:hover {
//                   background: #888888;
//                 }
//                 #n8nHistoryModal .content-area::-webkit-scrollbar-thumb:active {
//                   background: #999999;
//                 }
//                 `;
//                 document.head.appendChild(scrollbarStyle);
//               }
//               contentArea.className = "content-area";

//               // Reverse the array to show latest version first
//               window.__n8nVersionHistoryCache.slice().reverse().forEach((item, index) => {
//                 // Calculate the original index in the non-reversed array
//                 const originalIndex = window.__n8nVersionHistoryCache.length - 1 - index;
                
//                 const versionItem = document.createElement("div");
//                 versionItem.style.display = "flex";
//                 versionItem.style.justifyContent = "space-between";
//                 versionItem.style.alignItems = "center";
//                 versionItem.style.padding = "16px";
//                 versionItem.style.border = "1px solid rgba(255, 255, 255, 0.1)";
//                 versionItem.style.backgroundColor = "#2A2A2A";
//                 versionItem.style.borderRadius = "8px";
//                 versionItem.style.transition = "all 0.2s ease";
//                 versionItem.style.cursor = "pointer";
//                 versionItem.onmouseenter = () => {
//                   versionItem.style.backgroundColor = "#333333";
//                   versionItem.style.borderColor = "rgba(249, 115, 22, 0.3)";
//                   versionItem.style.transform = "translateY(-1px)";
//                 };
//                 versionItem.onmouseleave = () => {
//                   versionItem.style.backgroundColor = "#2A2A2A";
//                   versionItem.style.borderColor = "rgba(255, 255, 255, 0.1)";
//                   versionItem.style.transform = "translateY(0)";
//                 };

//                 const versionInfo = document.createElement("div");
//                 versionInfo.style.display = "flex";
//                 versionInfo.style.flexDirection = "column";
//                 versionInfo.style.gap = "4px";

//                 const versionNumber = document.createElement("div");
//                 versionNumber.textContent = `Version ${item.version}`;
//                 versionNumber.style.color = "#FFFFFF";
//                 versionNumber.style.fontSize = "14px";
//                 versionNumber.style.fontWeight = "600";
//                 versionNumber.style.fontFamily = "Poppins, sans-serif";

//                 const timestamp = document.createElement("div");
//                 timestamp.textContent = `${new Date(
//                   item.timestamp
//                 ).toLocaleDateString()} ${new Date(
//                   item.timestamp
//                 ).toLocaleTimeString([], {
//                   hour: "2-digit",
//                   minute: "2-digit",
//                 })}`;
//                 timestamp.style.color = "#AAAAAA";
//                 timestamp.style.fontSize = "12px";
//                 timestamp.style.fontWeight = "400";

//                 versionInfo.appendChild(versionNumber);
//                 versionInfo.appendChild(timestamp);

//                 const buttonDiv = document.createElement("div");
//                 buttonDiv.style.display = "flex";
//                 buttonDiv.style.gap = "8px";

//                 const downloadBtn = document.createElement("button");
//                 downloadBtn.title = "Download JSON";
//                 downloadBtn.style.background = "#F97316";
//                 downloadBtn.style.border = "none";
//                 downloadBtn.style.borderRadius = "6px";
//                 downloadBtn.style.padding = "8px 12px";
//                 downloadBtn.style.cursor = "pointer";
//                 downloadBtn.style.color = "white";
//                 downloadBtn.style.fontSize = "12px";
//                 downloadBtn.style.fontWeight = "600";
//                 downloadBtn.style.display = "flex";
//                 downloadBtn.style.alignItems = "center";
//                 downloadBtn.style.gap = "6px";
//                 downloadBtn.style.transition = "background-color 0.2s ease";
//                 downloadBtn.innerHTML = `<img src="${downloadImgUrl}" style="width: 14px; height: 14px;"> Download`;
//                 downloadBtn.onmouseenter = () => {
//                   downloadBtn.style.background = "#EA580C";
//                 };
//                 downloadBtn.onmouseleave = () => {
//                   downloadBtn.style.background = "#F97316";
//                 };
//                 downloadBtn.addEventListener("click", (e) => {
//                   e.stopPropagation();
//                   window.downloadJSON(originalIndex);
//                 });

//                 const copyBtn = document.createElement("button");
//                 copyBtn.title = "Copy JSON";
//                 copyBtn.style.background = "#1C1C1C";
//                 copyBtn.style.border = "1px solid #404040";
//                 copyBtn.style.borderRadius = "6px";
//                 copyBtn.style.padding = "8px 12px";
//                 copyBtn.style.cursor = "pointer";
//                 copyBtn.style.color = "#C0C0C0";
//                 copyBtn.style.fontSize = "12px";
//                 copyBtn.style.fontWeight = "600";
//                 copyBtn.style.display = "flex";
//                 copyBtn.style.alignItems = "center";
//                 copyBtn.style.gap = "6px";
//                 copyBtn.style.transition = "all 0.2s ease";
//                 copyBtn.innerHTML = `<img src="${copyImgUrl}" style="width: 14px; height: 14px;"> Copy`;
//                 copyBtn.onmouseenter = () => {
//                   copyBtn.style.background = "#2A2A2A";
//                   copyBtn.style.borderColor = "#555555";
//                   copyBtn.style.color = "#FFFFFF";
//                 };
//                 copyBtn.onmouseleave = () => {
//                   copyBtn.style.background = "#1C1C1C";
//                   copyBtn.style.borderColor = "#404040";
//                   copyBtn.style.color = "#C0C0C0";
//                 };
//                 copyBtn.addEventListener("click", (e) => {
//                   e.stopPropagation();
//                   window.copyJSON(originalIndex);
//                 });

//                 buttonDiv.appendChild(downloadBtn);
//                 buttonDiv.appendChild(copyBtn);

//                 versionItem.appendChild(versionInfo);
//                 versionItem.appendChild(buttonDiv);
//                 contentArea.appendChild(versionItem);
//               });

//               modal.appendChild(contentArea);

//               const pane = document.querySelector("#n8n-app .vue-flow__pane");
//               if (pane && getComputedStyle(pane).overflow !== "hidden") {
//                 pane.appendChild(modal);
//               } else {
//                 document.body.appendChild(modal);
//               }
//             }
//           );
//         }

//         // Check if history button already exists
//         if (document.getElementById("n8n-history-btn-container")) return;

//         const pane = document.querySelector("#n8n-app .vue-flow__pane");
//         if (!pane) return;

//         if (getComputedStyle(pane).position === "static") {
//           pane.style.position = "relative";
//         }

//         // Get the existing generate button container to position relative to it

//         // Create a new container for the history button
//         const historyContainer = document.createElement("div");
//         historyContainer.id = "n8n-history-btn-container";
//         historyContainer.style.position = "absolute";
//         historyContainer.style.top = "15px";
//         historyContainer.style.right = "80px"; // Position to the right of generate button
//         historyContainer.style.display = "flex";
//         historyContainer.style.alignItems = "center";
//         historyContainer.style.justifyContent = "center";
//         historyContainer.style.zIndex = "9999";

//         // Create the floating history button (styled as FAB)
//         const historyFab = document.createElement("button");
//         historyFab.id = "n8n-history-fab";
//         historyFab.title = "History";
//         historyFab.style.width = "45px";
//         historyFab.style.height = "43px";
//         historyFab.style.borderRadius = "10%";
//         // historyFab.style.marginRight = "20%";
//         historyFab.style.background = "#2d2e2e";
//         historyFab.style.display = "flex";
//         historyFab.style.alignItems = "center";
//         historyFab.style.justifyContent = "center";
//         historyFab.style.border = "1px solid rgba(255, 255, 255, 0.2)";
//         historyFab.style.cursor = "pointer";
//         historyFab.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
//         historyFab.style.color = "#FFFFFF";
//         historyFab.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.1)";
//         historyFab.style.fontFamily = "Poppins, sans-serif";
//         historyFab.style.fontWeight = "600";
//         historyFab.onmouseenter = () => {
//           historyFab.style.transform = "scale(1.02) translateY(-1px)";
//           historyFab.style.borderColor = "rgba(235, 134, 19, 0.88)";
//           historyFab.style.boxShadow = "0 3px 8px rgba(254, 111, 91, 0.15)";
//         };
//         historyFab.onmouseleave = () => {
//           historyFab.style.transform = "scale(1) translateY(0)";
//           historyFab.style.borderColor = "rgba(255, 255, 255, 0.2)";
//           historyFab.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.1)";
//         };

//         const historyImg = document.createElement("img");
//         historyImg.src = historyImgUrl;
//         historyImg.alt = "History";
//         historyImg.style.width = "26px";
//         historyImg.style.height = "22px";
//         historyImg.style.display = "block";

//         historyFab.appendChild(historyImg);

//         historyFab.onclick = () => {
//           const existingModal = document.getElementById("n8nHistoryModal");
//           if (existingModal) {
//             existingModal.remove();
//           } else {
//             showHistoryModal();
//           }
//         };

//         // Add history button to its own container
//         historyContainer.appendChild(historyFab);
        
//         // Append the history container to the pane
//         pane.appendChild(historyContainer);
//       },
//       args: [historyImgUrl, downloadImgUrl, copyImgUrl],
//     });
// }

// function injectDebugButton(tabId, tabUrl) {
//   chrome.storage.local.get(null, (data) => {
//     const n8nDomain = data.n8nDomain;
//     if (!n8nDomain) return; 
//     if (!tabUrl.startsWith(n8nDomain)) return;
    
//     // Check if we actually have permission for this domain
//     chrome.permissions.contains(
//       { origins: [n8nDomain + "/*"] },
//       (hasPermission) => {
//         if (!hasPermission) {
//           console.log("No permission for domain, skipping debug button injection:", n8nDomain);
//           return;
//         }
        
//         // Continue with button injection
//         injectDebugButtonWithPermission(tabId, tabUrl, data);
//       }
//     );
//   });
// }

// Actual debug button injection logic (separated for permission check)
// function injectDebugButtonWithPermission(tabId, tabUrl, data) {
//   const n8nDomain = data.n8nDomain;

//     // Prepare enabled models for the modal dropdown
//     const PROVIDER_LABELS = {
//       openai: "OpenAI (GPT)",
//       gemini: "Google Gemini",
//       mistral: "Mistral AI",
//       claude: "Anthropic (Claude)",
//       openrouter: "OpenRouter",
//       grok: "Grok (x.ai)",
//     };
//     const enabledModels = [];
//     Object.keys(PROVIDER_LABELS).forEach((providerId) => {
//       if (
//         data[`${providerId}IsEnabled`] &&
//         data[`${providerId}SelectedModel`]
//       ) {
//         enabledModels.push({
//           providerId,
//           label: PROVIDER_LABELS[providerId],
//           model: data[`${providerId}SelectedModel`],
//           apiKey: data[`${providerId}ApiKey`], // <-- add apiKey here
//         });
//       }
//     });

//     const chatImgUrl = chrome.runtime.getURL("assets/icons/chat.png");

//     chrome.scripting.executeScript({
//       target: { tabId },
//       world: "ISOLATED",
//       func: (chatImgUrl, enabledModels) => {
//         async function getCurrentWorkflowFromMainWorld() {
//           return new Promise((resolve) => {
//             chrome.runtime.sendMessage(
//               { action: "extractWorkflow" },
//               (response) => {
//                 if (response && response.success) {
//                   resolve(response.data);
//                 } else {
//                   resolve(null);
//                 }
//               }
//             );
//           });
//         }
//         // Minimal getProviderConfig for parsing responses
//         function getProviderConfig(providerId) {
//           const PROVIDER_CONFIG = {
//             openai: {
//               parseResponse: (data) =>
//                 data.choices?.[0]?.message?.content?.trim(),
//             },
//             gemini: {
//               parseResponse: (data) => {
//                 const textResponse =
//                   data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
//                 if (!textResponse) return null;
//                 return textResponse;
//               },
//             },
//             mistral: {
//               parseResponse: (data) => {
//                 // Check if server returned cleanedJson (processed response)
//                 if (data.cleanedJson && typeof data.cleanedJson === 'string') {
//                   return data.cleanedJson.trim();
//                 }
                
//                 // Standard Mistral API response format
//                 const content = data.choices?.[0]?.message?.content;
//                 if (content) {
//                   return content.trim();
//                 }
                
//                 // Fallback: check if message exists but content is in a different location
//                 const message = data.choices?.[0]?.message;
//                 if (message) {
//                   if (message.text) return message.text.trim();
//                   if (message.body) return message.body.trim();
//                 }
                
//                 return null;
//               },
//             },
//             claude: {
//               parseResponse: (data) => {
//                 // Check if server returned cleanedJson (processed response)
//                 if (data.cleanedJson && typeof data.cleanedJson === 'string') {
//                   return data.cleanedJson.trim();
//                 }

//                 if (data.content && Array.isArray(data.content)) {
//                   const textBlocks = data.content.filter(
//                     (block) => block.type === "text"
//                   );
//                   if (textBlocks.length > 0) {
//                     let text = textBlocks
//                       .map((block) => block.text)
//                       .join("\n")
//                       .trim();

//                     // Check if response is HTML (error case)
//                     if (text.trim().startsWith('<') || text.trim().startsWith('<!DOCTYPE')) {
//                       throw new Error("Received HTML response instead of JSON. Please check your API key and try again.");
//                     }

//                     // Remove markdown code blocks if present
//                     if (text.includes("```json") || text.includes("```")) {
//                       text = text.replace(/^```(?:json)?\s*/i, "");
//                       text = text.replace(/\s*```$/i, "");
//                       text = text.replace(/```(?:json)?\s*/gi, "").replace(/\s*```/gi, "");
//                     }

//                     return text.trim();
//                   }
//                 }
//                 if (data.completion) {
//                   let completion = data.completion.trim();
//                   // Remove markdown code blocks if present
//                   if (completion.includes("```json") || completion.includes("```")) {
//                     completion = completion.replace(/^```(?:json)?\s*/i, "");
//                     completion = completion.replace(/\s*```$/i, "");
//                     completion = completion.replace(/```(?:json)?\s*/gi, "").replace(/\s*```/gi, "");
//                   }
//                   return completion;
//                 }
//                 throw new Error("Unexpected response format from Claude API");
//               },
//             },
//             openrouter: {
//               parseResponse: (data) => {
//                 // Check if server returned cleanedJson (processed response)
//                 if (data.cleanedJson && typeof data.cleanedJson === 'string') {
//                   return data.cleanedJson.trim();
//                 }
                
//                 const content = data.choices?.[0]?.message?.content;
//                 if (content) {
//                   let text = content.trim();
                  
//                   // Check if response is HTML (error case)
//                   if (text.trim().startsWith('<') || text.trim().startsWith('<!DOCTYPE')) {
//                     throw new Error("Received HTML response instead of JSON. Please check your API key and try again.");
//                   }
                  
//                   // Remove markdown code blocks if present
//                   if (text.includes("```json") || text.includes("```")) {
//                     text = text.replace(/^```(?:json)?\s*/i, "");
//                     text = text.replace(/\s*```$/i, "");
//                     text = text.replace(/```(?:json)?\s*/gi, "").replace(/\s*```/gi, "");
//                   }
                  
//                   return text.trim();
//                 }
//                 return null;
//               },
//             },
//             grok: {
//               parseResponse: (data) =>
//                 data.choices?.[0]?.message?.content?.trim(),
//             },
//             groq: {
//               parseResponse: (data) =>
//                 data.choices?.[0]?.message?.content?.trim(),
//             },
//           };
//           return PROVIDER_CONFIG[providerId];
//         }
//         // Check if debug button already exists
//         if (document.getElementById("n8n-debug-fab")) return;

//         const pane = document.querySelector("#n8n-app .vue-flow__pane");
//         if (!pane) return;

//         // Ensure pane is positioned for absolute children
//         if (getComputedStyle(pane).position === "static") {
//           pane.style.position = "relative";
//         }

//         // Create the floating debug button
//         const debugFab = document.createElement("button");
//         debugFab.id = "n8n-debug-fab";
//         debugFab.title = "Debug Workflow";
//         debugFab.style.position = "absolute";
//         debugFab.style.bottom = "39px";
//         debugFab.style.right = "32px";
//         debugFab.style.width = "67px";
//         debugFab.style.height = "67px";
//         debugFab.style.borderRadius = "50%";
//         debugFab.style.background =
//           "linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%)";
//         debugFab.style.display = "flex";
//         debugFab.style.alignItems = "center";
//         debugFab.style.justifyContent = "center";
//         debugFab.style.zIndex = "10010";
//         debugFab.style.border = "2px solid rgba(255, 255, 255, 0.2)";
//         debugFab.style.cursor = "pointer";
//         debugFab.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
//         debugFab.style.color = "#FFFFFF";
//         debugFab.style.boxShadow =
//           "0 2px 8px rgba(254, 111, 91, 0.2), 0 1px 4px rgba(0, 0, 0, 0.1)";
//         debugFab.style.fontFamily = "Poppins, sans-serif";
//         debugFab.style.fontWeight = "600";
//         // Reduced glare hover effect
//         debugFab.onmouseenter = () => {
//           debugFab.style.transform = "scale(1.03) translateY(-1px)";
//           debugFab.style.boxShadow =
//             "0 4px 12px rgba(254, 111, 91, 0.25), 0 2px 6px rgba(0, 0, 0, 0.1)";
//           debugFab.style.background =
//             "linear-gradient(135deg, #FF8A80 0%, #FE6F5B 100%)";
//         };
//         debugFab.onmouseleave = () => {
//           debugFab.style.transform = "scale(1) translateY(0)";
//           debugFab.style.boxShadow =
//             "0 2px 8px rgba(254, 111, 91, 0.2), 0 1px 4px rgba(0, 0, 0, 0.1)";
//           debugFab.style.background =
//             "linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%)";
//         };
//         // Use chat.png as the icon
//         const chatImg = document.createElement("img");
//         chatImg.src = chatImgUrl;
//         chatImg.alt = "Debug";
//         chatImg.style.width = "27px";
//         chatImg.style.height = "24px";
//         chatImg.style.display = "block";
//         debugFab.appendChild(chatImg);

//         debugFab.onclick = () => {
//           let chatModal = document.getElementById("n8n-debug-modal");
//           if (chatModal) {
//             chatModal.style.display = "flex";
//             return;
//           }
//           // Create modal
//           chatModal = document.createElement("div");
//           chatModal.id = "n8n-debug-modal";
//           chatModal.style.position = "fixed";
//           chatModal.style.bottom = "112px";
//           chatModal.style.right = "32px";
//           chatModal.style.width = "380px";
//           chatModal.style.height = "480px";
//           chatModal.style.background =
//             "linear-gradient(145deg, #1C1C1C 0%, #2A2A2A 100%)";
//           chatModal.style.borderRadius = "20px";
//           chatModal.style.zIndex = "10011";
//           chatModal.style.display = "flex";
//           chatModal.style.flexDirection = "column";
//           chatModal.style.padding = "0";
//           chatModal.style.overflow = "hidden";
//           chatModal.style.fontFamily = "Manrope, sans-serif";
//           chatModal.style.overflow = "visible";
//           chatModal.style.backdropFilter = "blur(20px)";
//           chatModal.style.border = "1px solid rgba(255, 255, 255, 0.15)";
//           chatModal.style.boxShadow =
//             "0 8px 16px rgba(0, 0, 0, 0.2), 0 4px 8px rgba(0, 0, 0, 0.1)";

//           // Header
//           const header = document.createElement("div");
//           header.style.background =
//             "linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%)";
//           header.style.height = "50px";
//           header.style.borderTopLeftRadius = "20px";
//           header.style.borderTopRightRadius = "20px";
//           header.style.display = "flex";
//           header.style.alignItems = "center";
//           header.style.justifyContent = "flex-end";
//           header.style.position = "relative";
//           header.style.boxShadow = "0 1px 4px rgba(254, 111, 91, 0.2)";

//           // Close button
//           const closeBtn = document.createElement("button");
//           closeBtn.textContent = "×";
//           closeBtn.id = "n8n-debug-modal-close";
//           closeBtn.style.position = "absolute";
//           closeBtn.style.top = "10px";
//           closeBtn.style.right = "12px";
//           closeBtn.style.background = "rgba(255, 255, 255, 0.2)";
//           closeBtn.style.color = "#fff";
//           closeBtn.style.border = "none";
//           closeBtn.style.borderRadius = "50%";
//           closeBtn.style.width = "32px";
//           closeBtn.style.height = "32px";
//           closeBtn.style.fontSize = "18px";
//           closeBtn.style.cursor = "pointer";
//           closeBtn.style.transition = "all 0.2s ease";
//           closeBtn.style.display = "flex";
//           closeBtn.style.alignItems = "center";
//           closeBtn.style.justifyContent = "center";
//           closeBtn.style.fontWeight = "bold";
//           // Hover effect for close button
//           closeBtn.onmouseenter = () => {
//             closeBtn.style.background = "rgba(255, 255, 255, 0.3)";
//             closeBtn.style.transform = "scale(1.1)";
//           };
//           closeBtn.onmouseleave = () => {
//             closeBtn.style.background = "rgba(255, 255, 255, 0.2)";
//             closeBtn.style.transform = "scale(1)";
//           };
//           closeBtn.onclick = () => {
//             chatModal.style.display = "none";
//           };
//           header.appendChild(closeBtn);
//           chatModal.appendChild(header);

//           // Chat area
//           const chatArea = document.createElement("div");
//           chatArea.style.flex = "1";
//           chatArea.style.padding = "20px";
//           chatArea.style.overflowY = "auto";
//           chatArea.style.display = "flex";
//           chatArea.style.flexDirection = "column";
//           chatArea.style.gap = "16px";
//           chatArea.style.scrollbarWidth = "thin";
//           chatArea.style.scrollbarColor = "#FF6B3B #1A1A1A";

//           // Initial message bubble
//           const botMsg = document.createElement("div");
//           botMsg.style.background = "#333333";
//           botMsg.style.color = "#fff";
//           botMsg.style.padding = "12px 16px";
//           botMsg.style.borderRadius = "12px";
//           botMsg.style.maxWidth = "85%";
//           botMsg.style.alignSelf = "flex-start";
//           botMsg.style.fontSize = "13px";
//           botMsg.style.lineHeight = "1.4";
//           botMsg.style.wordWrap = "break-word";
//           botMsg.style.overflowWrap = "break-word";
//           botMsg.textContent =
//             "Hello! I'm here to help with your n8n workflow issues. Just type your question below.";
//           chatArea.appendChild(botMsg);

//           chatModal.appendChild(chatArea);

//           // Footer (input area)
//           const footer = document.createElement("div");
//           footer.style.padding = "16px 20px";
//           footer.style.background = "#1C1C1C";
//           footer.style.display = "flex";
//           footer.style.flexDirection = "column";
//           footer.style.gap = "8px";

//           // Model select row (label + button + custom dropdown)
//           // Model select row (label + button + custom dropdown)
//           const modelRow = document.createElement("div");
//           modelRow.style.display = "flex";
//           modelRow.style.alignItems = "center";
//           modelRow.style.gap = "8px";
//           modelRow.style.marginBottom = "6px";
//           modelRow.style.position = "relative";

//           // Label with dropdown icon inside
//           const modelLabel = document.createElement("span");
//           modelLabel.innerHTML = `<span>Select Ai Model</span><svg width="16" height="16" fill="#fff" viewBox="0 0 24 24" style="margin-left: auto;"><path d="M7 10l5 5 5-5z"/></svg>`;
//           modelLabel.style.border = "1px solid rgba(255, 255, 255, 0.2)";
//           modelLabel.style.borderRadius = "8px";
//           modelLabel.style.background = "rgba(255, 255, 255, 0.05)";
//           modelLabel.style.color = "#fff";
//           modelLabel.style.fontSize = "13px";
//           modelLabel.style.padding = "12px 18px";
//           modelLabel.style.minWidth = "280px";
//           modelLabel.style.display = "flex";
//           modelLabel.style.alignItems = "center";
//           modelLabel.style.justifyContent = "space-between";
//           modelLabel.style.cursor = "pointer";
//           modelLabel.style.transition = "all 0.2s ease";
//           modelLabel.style.fontWeight = "500";
//           // Hover effect for label
//           modelLabel.onmouseenter = () => {
//             modelLabel.style.background = "rgba(255, 255, 255, 0.1)";
//             modelLabel.style.borderColor = "rgba(254, 111, 91, 0.5)";
//           };
//           modelLabel.onmouseleave = () => {
//             modelLabel.style.background = "rgba(255, 255, 255, 0.05)";
//             modelLabel.style.borderColor = "rgba(255, 255, 255, 0.2)";
//           };
//           modelRow.appendChild(modelLabel);

//           // Custom dropdown menu (hidden by default)
//           const dropdown = document.createElement("div");
//           dropdown.style.position = "absolute";
//           dropdown.style.left = "0";
//           dropdown.style.top = "110%";
//           dropdown.style.background =
//             "linear-gradient(145deg, #2A2A2A 0%, #1C1C1C 100%)";
//           dropdown.style.border = "1px solid rgba(255, 255, 255, 0.15)";
//           dropdown.style.borderRadius = "12px";
//           dropdown.style.boxShadow =
//             "0 8px 24px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2)";
//           dropdown.style.zIndex = "9999";
//           dropdown.style.display = "none";
//           dropdown.style.minWidth = "280px";
//           dropdown.style.maxHeight = "200px";
//           dropdown.style.overflowY = "auto";
//           dropdown.style.padding = "10px 0";
//           dropdown.style.backdropFilter = "blur(10px)";
//           dropdown.style.scrollbarWidth = "thin";
//           dropdown.style.scrollbarColor = "#FF6B3B #1A1A1A";

//           // Model options (from enabledModels param)
//           enabledModels.forEach((modelObj) => {
//             const opt = document.createElement("div");
//             opt.textContent = `${modelObj.label} - ${modelObj.model}`;
//             opt.style.padding = "14px 18px";
//             opt.style.color = "#fff";
//             opt.style.cursor = "pointer";
//             opt.style.fontSize = "13px";
//             opt.style.borderRadius = "8px";
//             opt.style.margin = "2px 8px";
//             opt.style.transition = "all 0.2s ease";
//             opt.style.fontWeight = "500";
//             opt.onmouseenter = () => {
//               opt.style.background =
//                 "linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%)";
//               opt.style.transform = "translateX(4px)";
//             };
//             opt.onmouseleave = () => {
//               opt.style.background = "transparent";
//               opt.style.transform = "translateX(0)";
//             };
//             opt.onclick = () => {
//               modelLabel.innerHTML = `<span>${modelObj.label} - ${modelObj.model}</span><svg width="16" height="16" fill="#fff" viewBox="0 0 24 24" style="margin-left: auto;"><path d="M7 10l5 5 5-5z"/></svg>`;
//               dropdown.style.display = "none";
//               // Save selected model info for debug operation
//               modelRow.dataset.selectedProviderId = modelObj.providerId;
//               modelRow.dataset.selectedModel = modelObj.model;
//               modelRow.dataset.selectedApiKey = modelObj.apiKey;
//             };
//             dropdown.appendChild(opt);
//           });
//           modelRow.appendChild(dropdown);

//           // Show dropdown on label click
//           modelLabel.onclick = (e) => {
//             dropdown.style.display =
//               dropdown.style.display === "none" ? "block" : "none";
//             e.stopPropagation();
//           };
//           // Hide dropdown when clicking outside
//           document.addEventListener("click", (e) => {
//             if (!modelRow.contains(e.target)) {
//               dropdown.style.display = "none";
//             }
//           });

//           footer.appendChild(modelRow);

//           // Input row
//           const inputRow = document.createElement("div");
//           inputRow.style.display = "flex";
//           inputRow.style.gap = "8px";
//           inputRow.style.alignItems = "center";

//           const input = document.createElement("input");
//           input.type = "text";
//           input.placeholder = "Type your message here...";
//           input.style.flex = "1";
//           input.style.padding = "12px 16px";
//           input.style.fontSize = "13px";
//           input.style.borderRadius = "12px";
//           input.style.border = "1px solid rgba(255, 255, 255, 0.2)";
//           input.style.background = "rgba(255, 255, 255, 0.05)";
//           input.style.color = "#fff";
//           input.style.fontWeight = "400";
//           input.style.outline = "none";
//           input.style.fontFamily = "Manrope, sans-serif";
//           input.style.transition = "all 0.2s ease";
//           input.style.boxShadow = "0 1px 4px rgba(0, 0, 0, 0.1)";
//           // Reduced glare focus and hover effects for input
//           input.onfocus = () => {
//             input.style.borderColor = "rgba(254, 111, 91, 0.4)";
//             input.style.background = "rgba(255, 255, 255, 0.06)";
//             input.style.boxShadow = "0 2px 6px rgba(254, 111, 91, 0.15)";
//           };
//           input.onblur = () => {
//             input.style.borderColor = "rgba(255, 255, 255, 0.2)";
//             input.style.background = "rgba(255, 255, 255, 0.05)";
//             input.style.boxShadow = "0 1px 4px rgba(0, 0, 0, 0.1)";
//           };
//           input.onmouseenter = () => {
//             input.style.background = "rgba(255, 255, 255, 0.08)";
//           };
//           input.onmouseleave = () => {
//             if (document.activeElement !== input) {
//               input.style.background = "rgba(255, 255, 255, 0.05)";
//             }
//           };

//           // Add Enter key functionality
//           input.onkeydown = (e) => {
//             if (e.key === "Enter" && !e.shiftKey) {
//               e.preventDefault();
//               sendBtn.click();
//             }
//           };

//           // Send button
//           const sendBtn = document.createElement("button");
//           sendBtn.innerHTML = `<svg width="20" height="20" fill="#fff" viewBox="0 0 24 24"><path d="M2 21l21-9-21-9v7l15 2-15 2z"/></svg>`;
//           sendBtn.style.background =
//             "linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%)";
//           sendBtn.style.border = "none";
//           sendBtn.style.borderRadius = "12px";
//           sendBtn.style.width = "44px";
//           sendBtn.style.height = "44px";
//           sendBtn.style.display = "flex";
//           sendBtn.style.alignItems = "center";
//           sendBtn.style.justifyContent = "center";
//           sendBtn.style.cursor = "pointer";
//           sendBtn.style.transition = "all 0.2s ease";
//           sendBtn.style.boxShadow = "0 2px 6px rgba(254, 111, 91, 0.2)";
//           // Reduced glare hover effect for send button
//           sendBtn.onmouseenter = () => {
//             sendBtn.style.transform = "scale(1.02)";
//             sendBtn.style.boxShadow = "0 3px 8px rgba(254, 111, 91, 0.25)";
//             sendBtn.style.background =
//               "linear-gradient(135deg, #FF8A80 0%, #FE6F5B 100%)";
//           };
//           sendBtn.onmouseleave = () => {
//             sendBtn.style.transform = "scale(1)";
//             sendBtn.style.boxShadow = "0 2px 6px rgba(254, 111, 91, 0.2)";
//             sendBtn.style.background =
//               "linear-gradient(135deg, #FE6F5B 0%, #FF8A80 100%)";
//           };

//           sendBtn.onclick = async () => {
//             const msg = input.value.trim();
//             const providerId = modelRow.dataset.selectedProviderId;
//             const model = modelRow.dataset.selectedModel;
//             const apiKey = modelRow.dataset.selectedApiKey;
//             if (!providerId || !model || !apiKey) {
//               modelLabel.style.color = "#FE6F5B";
//               modelLabel.textContent = "Please select an AI model!";
//               setTimeout(() => {
//                 modelLabel.style.color = "#fff";
//                 modelLabel.textContent =
//                   providerId && model
//                     ? `${providerId} - ${model}`
//                     : "Select Ai Model";
//               }, 1500);
//               return;
//             }

//             if (!msg) return;

//             // User message bubble
//             const userMsg = document.createElement("div");
//             userMsg.style.background = "#FE6F5B";
//             userMsg.style.color = "#fff";
//             userMsg.style.padding = "12px 16px";
//             userMsg.style.borderRadius = "12px";
//             userMsg.style.maxWidth = "85%";
//             userMsg.style.alignSelf = "flex-end";
//             userMsg.style.fontSize = "13px";
//             userMsg.style.lineHeight = "1.4";
//             userMsg.style.wordWrap = "break-word";
//             userMsg.style.overflowWrap = "break-word";
//             userMsg.textContent = msg;
//             chatArea.appendChild(userMsg);
//             input.value = "";
//             chatArea.scrollTop = chatArea.scrollHeight;

//             // Show typing indicator
//             const typingMsg = document.createElement("div");
//             typingMsg.className = "typing-indicator";
//             typingMsg.style.color = "#aaa";
//             typingMsg.style.fontSize = "12px";
//             typingMsg.style.margin = "8px 0 0 0";
//             typingMsg.textContent = "Assistant is typing...";
//             chatArea.appendChild(typingMsg);
//             chatArea.scrollTop = chatArea.scrollHeight;
//             const BASE_URL ="https://login.n8ncopilot.com";
//             try {
//               const currentWorkflowData =
//               await getCurrentWorkflowFromMainWorld();
//               // Call your debug API
//               const response = await fetch(`${BASE_URL}/api/debug`, {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({
//                   provider: providerId,
//                   model,
//                   apiKey,
//                   userPrompt: msg,
//                   workflowContext: currentWorkflowData || undefined,
//                 }),
//               });

//               if (!response.ok) {
//                 throw new Error(
//                   `API error: ${response.status} ${response.statusText}`
//                 );
//               }
//               const providerConfig = getProviderConfig(providerId);
//               const data = await response.json();
//               let parsedResponse = providerConfig.parseResponse(data);
//               try {
//                 // If the response is a JSON object with a 'response' field, extract it
//                 if (
//                   typeof parsedResponse === "string" &&
//                   parsedResponse.trim().startsWith("{")
//                 ) {
//                   const jsonResponse = JSON.parse(parsedResponse);
//                   if (jsonResponse.response) {
//                     parsedResponse = jsonResponse.response;
//                   }
//                 }
//               } catch (e) {
//                 console.warn(
//                   "Response is not JSON, treating as plain text:",
//                   parsedResponse
//                 );
//               }

//               if (!parsedResponse) {
//                 throw new Error("Failed to parse response from AI provider");
//               }

//               // Show assistant message
//               const assistantMsg = document.createElement("div");
//               assistantMsg.style.background = "#333";
//               assistantMsg.style.color = "#fff";
//               assistantMsg.style.padding = "12px 16px";
//               assistantMsg.style.borderRadius = "12px";
//               assistantMsg.style.maxWidth = "85%";
//               assistantMsg.style.alignSelf = "flex-start";
//               assistantMsg.style.fontSize = "13px";
//               assistantMsg.style.lineHeight = "1.4";
//               assistantMsg.style.whiteSpace = "pre-wrap";
//               assistantMsg.style.wordWrap = "break-word";
//               assistantMsg.style.overflowWrap = "break-word";
//               assistantMsg.textContent = parsedResponse;

//               // Remove typing indicator and show assistant message
//               chatArea.removeChild(typingMsg);
//               chatArea.appendChild(assistantMsg);
//               // After response is displayed, align view to start of latest message
//               chatArea.scrollTop = assistantMsg.offsetTop;
//             } catch (error) {
//               chatArea.removeChild(typingMsg);
//               const errorMsg = document.createElement("div");
//               errorMsg.style.background = "#c0392b";
//               errorMsg.style.color = "#fff";
//               errorMsg.style.padding = "12px 16px";
//               errorMsg.style.borderRadius = "12px";
//               errorMsg.style.maxWidth = "85%";
//               errorMsg.style.alignSelf = "flex-start";
//               errorMsg.style.fontSize = "13px";
//               errorMsg.style.lineHeight = "1.4";
//               errorMsg.style.wordWrap = "break-word";
//               errorMsg.style.overflowWrap = "break-word";
//               errorMsg.textContent = "Error: " + error.message;
//               chatArea.appendChild(errorMsg);
//               // Align view to start of latest error message
//               chatArea.scrollTop = errorMsg.offsetTop;
//             }
//           };

//           inputRow.appendChild(input);
//           inputRow.appendChild(sendBtn);
//           footer.appendChild(inputRow);

//           chatModal.appendChild(footer);
//           document.body.appendChild(chatModal);
//         };

//         // Append debug button to pane instead of body
//         pane.appendChild(debugFab);
//       },
//       args: [chatImgUrl, enabledModels],
//     });
// }

// Helper function to check button injection settings
function checkButtonSettings(callback) {
  chrome.storage.local.get(['generateButtonEnabled', 'historyButtonEnabled', 'debugButtonEnabled', 'isAuthenticated'], (data) => {
    // Don't inject buttons if user is not authenticated
    if (!data.isAuthenticated) {
      callback({
        generate: false,
        history: false,
        debug: false
      });
      return;
    }
    
    const settings = {
      generate: data.generateButtonEnabled !== undefined ? data.generateButtonEnabled : true,
      history: data.historyButtonEnabled !== undefined ? data.historyButtonEnabled : true,
      debug: data.debugButtonEnabled !== undefined ? data.debugButtonEnabled : true
    };
    callback(settings);
  });
}

// Inject on tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (!tab || !tab.url) return;
    checkButtonSettings((settings) => {
      if (settings.generate) {
        injectGenerateButton(tab.id, tab.url);
      }
      if (settings.debug) {
        injectDebugButton(tab.id, tab.url);
      }
    });
  });
});

// Inject on tab update (when tab loads or reloads)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  setTimeout(() => {
      if (changeInfo.status !== 'complete' || !tab.url) return;
      else{ 
      checkButtonSettings((settings) => {
      if (settings.generate) {
        injectGenerateButton(tabId, tab.url);
      }
      if (settings.debug) {
        injectDebugButton(tabId, tab.url);
      }
    });}
  }, 3000);
});

// Debounced refresh to reinject UI when model settings change
let __n8nRefreshInjectedUiTimer = null;
function scheduleInjectedUiRefresh() {
  if (__n8nRefreshInjectedUiTimer) {
    clearTimeout(__n8nRefreshInjectedUiTimer);
  }
  __n8nRefreshInjectedUiTimer = setTimeout(() => {
    chrome.storage.local.get(["n8nDomain"], (data) => {
      const domain = data.n8nDomain;
      // Only refresh on the active tab; others re-inject on activation/update
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || !tab.id || !tab.url) return;
        if (domain && !tab.url.startsWith(domain)) return;

        // Remove existing injected elements, then reinject
        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            world: "ISOLATED",
            func: () => {
              [
                "n8n-generate-btn-container",
                "n8n-generate-modal",
                "n8n-debug-btn",
                "n8n-premium-notification",
              ].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.remove();
              });
            },
          },
          () => {
            checkButtonSettings((settings) => {
              if (settings.generate) {
                injectGenerateButton(tab.id, tab.url);
              }
              if (settings.debug) {
                injectDebugButton(tab.id, tab.url);
              }
            });
          }
        );
      });
    });
  }, 200);
}
// Listen for storage changes to update behavior immediately
chrome.storage.onChanged.addListener((changes) => {
  // Handle button injection settings changes
  if (changes.generateButtonEnabled || changes.historyButtonEnabled || changes.debugButtonEnabled) {
    // Refresh injected UI when button settings change
    scheduleInjectedUiRefresh();
  }

  // Update badge when generation status changes
  if (changes.generationInProgress) {
    if (changes.generationInProgress.newValue === true) {
      chrome.action.setBadgeText({ text: "..." });
      chrome.action.setBadgeBackgroundColor({ color: "#F59E0B" });
    } else {
      // Only clear badge if not showing success or error
      if (!changes.generationComplete) {
        chrome.action.setBadgeText({ text: "" });
      }
    }
  }

  // Handle generation completion separately
  if (
    changes.generationComplete &&
    changes.generationComplete.newValue === true
  ) {
    chrome.storage.local.get(["generatedJson", "generationError"], (data) => {
      if (data.generatedJson && !data.generationError) {
        // Success indicator
        chrome.action.setBadgeText({ text: "✓" });
        chrome.action.setBadgeBackgroundColor({ color: "#22C55E" });

        // Clear badge after 3 seconds
        setTimeout(() => {
          chrome.action.setBadgeText({ text: "" });
        }, 3000);
      } else if (data.generationError) {
        // Error indicator
        chrome.action.setBadgeText({ text: "!" });
        chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });

        // Clear badge after 5 seconds
        setTimeout(() => {
          chrome.action.setBadgeText({ text: "" });
        }, 5000);
      }
    });
  }

  // If provider configuration changes, refresh injected UI so model list updates immediately
  const providerPrefixes = [
    "openai",
    "gemini",
    "mistral",
    "claude",
    "openrouter",
    "grok",
  ];
  const keys = Object.keys(changes || {});
  const modelRelatedChange = keys.some(
    (k) => providerPrefixes.some((p) => k.startsWith(p)) || k === "n8nDomain"
  );
  if (modelRelatedChange) {
    scheduleInjectedUiRefresh();
  }
});

// Handle action click when popup is disabled
chrome.action.onClicked.addListener((tab) => {
  // This will only be triggered when popup is disabled (in side panel mode)
  chrome.sidePanel.open({ tabId: tab.id });
});

// Function to show a notification about permissions
function showPermissionNotification(domain) {
  // Check if we're in Brave browser
  const isBrave = navigator.userAgent.includes('Brave') || 
                  (navigator.userAgent.includes('Chrome') && 
                   !navigator.userAgent.includes('Edg') && 
                   !navigator.userAgent.includes('OPR') && 
                   !navigator.userAgent.includes('Vivaldi'));

  // Try system notification first
  chrome.notifications.create({
    type: "basic",
    iconUrl: "assets/icon128.png",
    title: "Permission Required",
    message: `Permission is needed to access ${domain}. Please check your extension settings to grant access.`,
    buttons: [{ title: "Learn More" }],
    priority: 2,
  }, (notificationId) => {
    // If system notification fails (common in Brave), show page notification as fallback
    if (chrome.runtime.lastError || !notificationId) {
      console.log('System notification failed, showing page notification fallback');
      showPageNotificationFallback(
        false, 
        `Permission needed for ${domain}. Check extension settings.`
      );
    }
  });

  // Listen for notification button clicks
  chrome.notifications.onButtonClicked.addListener(
    (notificationId, buttonIndex) => {
      if (buttonIndex === 0) {
        // Open extension management page
        chrome.tabs.create({
          url: "chrome://extensions/?id=" + chrome.runtime.id,
        });
      }
    }
  );
}

function showGenerationNotification(success, message) {
  // Send notification to content script to display on n8n website
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'SHOW_NOTIFICATION',
        success: success,
        message: message
      }).catch((error) => {
        // Content script might not be loaded, try fallback notification
        console.log('Content script notification failed, trying fallback:', error);
        showPageNotificationFallback(success, message);
      });
    } else {
      // No active tab, use fallback
      showPageNotificationFallback(success, message);
    }
  });
}

function extractSingleSentence(text) {
  if (typeof text !== "string") {
    return "";
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  const sentenceMatch = trimmed.match(/^[^.!?\n\r]+[.!?]?/);
  if (sentenceMatch && sentenceMatch[0]) {
    return sentenceMatch[0].trim();
  }

  const newlineIndex = trimmed.indexOf("\n");
  if (newlineIndex !== -1) {
    return trimmed.slice(0, newlineIndex).trim();
  }

  return trimmed;
}

// Fallback notification function for when content script or system notifications fail
function showPageNotificationFallback(success, message) {
  // Try to inject notification into any available tab
  chrome.tabs.query({}, (tabs) => {
    // Find a tab that matches our content script patterns
    const targetTab = tabs.find(tab => 
      tab.url && (
        tab.url.includes('login.n8ncopilot.com') ||
        tab.url.includes('localhost:5678') ||
        tab.url.includes('app.n8n.cloud') ||
        tab.url.includes('n8n.cloud')
      )
    );

    if (targetTab) {
      // Try to send to the target tab
      chrome.tabs.sendMessage(targetTab.id, {
        type: 'SHOW_NOTIFICATION',
        success: success,
        message: message
      }).catch(() => {
        // If that fails too, try system notification as last resort
        chrome.notifications.create({
          type: "basic",
          iconUrl: "assets/icon48.png",
          title: success ? "n8n Copilot - Success" : "n8n Copilot - Error",
          message: message,
          priority: success ? 1 : 2,
        }, (notificationId) => {
          if (chrome.runtime.lastError) {
            console.log('All notification methods failed:', chrome.runtime.lastError);
          }
        });
      });
    } else {
      // No suitable tab found, use system notification
      chrome.notifications.create({
        type: "basic",
        iconUrl: "assets/icon48.png",
        title: success ? "n8n Copilot - Success" : "n8n Copilot - Error",
        message: message,
        priority: success ? 1 : 2,
      }, (notificationId) => {
        if (chrome.runtime.lastError) {
          console.log('System notification also failed:', chrome.runtime.lastError);
        }
      });
    }
  });
}

// Message handler for background processing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle permission check and request
  if (
    message.action === "checkDomainPermission" ||
    message.action === "requestDomainPermission"
  ) {
    const domain = message.domain;

    if (!domain) {
      sendResponse({
        success: false,
        error: "No domain provided",
      });
      return true;
    }

    // Format domain with wildcard
    let formattedDomain;
    try {
      const url = new URL(domain);
      formattedDomain = url.origin + "/*";
    } catch (e) {
      sendResponse({
        success: false,
        error: "Invalid domain format",
      });
      return true;
    }

    if (message.action === "checkDomainPermission") {
      // Just check if we have permission
      try {
        chrome.permissions.contains(
          {
            origins: [formattedDomain],
          },
          (hasPermission) => {
            try {
              sendResponse({
                success: true,
                hasPermission: hasPermission,
              });
            } catch (responseError) {
              // Try to send a fallback response
              try {
                sendResponse({
                  success: false,
                  error: "Error sending permission check response",
                });
              } catch (e) {
              }
            }
          }
        );
      } catch (permissionError) {
        sendResponse({
          success: false,
          error: "Error checking permission: " + permissionError.message,
        });
      }
      return true; // Keep message channel open for async response
    } else {
      // Request permission
      try {
        chrome.permissions.request(
          {
            origins: [formattedDomain],
          },
          (granted) => {
            try {
              if (chrome.runtime.lastError) {
                console.error(
                  "Permission request error:",
                  chrome.runtime.lastError
                );
                sendResponse({
                  success: false,
                  error: chrome.runtime.lastError.message,
                });

                // Show notification to help user
                showPermissionNotification(domain);
              } else {
                sendResponse({
                  success: true,
                  granted: granted,
                });

                // If permission was denied, show notification
                if (!granted) {
                  showPermissionNotification(domain);
                }

                // If permission was granted, try to open a test connection
                if (granted) {
                  fetch(domain + "/favicon.ico", {
                    method: "HEAD",
                    mode: "no-cors",
                  })
                    .catch((err) =>
                      console.warn(
                        "Test connection failed, but permissions may still be valid:",
                        err
                      )
                    );
                  
                  // Reload the current tab to apply the new permissions
                  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0] && tabs[0].id) {
                      chrome.tabs.reload(tabs[0].id);
                    }
                  });
                }
              }
            } catch (responseError) {
              try {
                sendResponse({
                  success: false,
                  error: "Error sending permission request response",
                });
              } catch (e) {
              }
            }
          }
        );
      } catch (permissionError) {
        sendResponse({
          success: false,
          error: "Error requesting permission: " + permissionError.message,
        });

        // Show notification to help user
        showPermissionNotification(domain);
      }
      return true; // Keep message channel open for async response
    }
  }

  // Handle debug workflow extraction
  if (message.action === "extractWorkflow") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = (sender?.tab && sender?.tab?.id) || tabs[0]?.id;
      if (tabId) {
        chrome.scripting.executeScript(
          {
            target: { tabId: tabId },
            world: "MAIN",
            func: async () => {
              try {
                // Use #app for n8n v1.98.2+
                const app = document.querySelector("#app")?.__vue_app__;
                if (!app) {
                  return { error: "Could not find Vue app instance" };
                }
                // Pinia store extraction 
                const pinia = app._context.config.globalProperties.$pinia;
                const workflowStore = pinia._s.get("workflows");
                const url = window.location.href;
                const workflowIdMatch = url.match(/\/workflows?\/([^\/\?]+)/);
                // let workflowId = workflowIdMatch ? workflowIdMatch[1] : null;
                
                if (!workflowStore || !workflowStore.workflow) {
                  return { error: "Could not find workflow store" };
                }
                const workflow = await workflowStore.workflow;
                if (!workflow) {
                  return { error: "No workflow loaded" };
                }
                // Return name and nodes (add more fields if needed)
                return {
                  name: workflow.name || "Unnamed Workflow",
                  nodes: workflow.nodes || [],
                  connections: workflow.connections || [],
                  settings: workflow.settings || {},
                  id: workflow.id || null,
                };
              } catch (e) {
                return { error: e.message };
              }
            },
          },
          (results) => {
            if (chrome.runtime.lastError) {
              sendResponse({
                success: false,
                error: chrome.runtime.lastError.message,
              });
            } else if (results && results[0]) {
              sendResponse({
                success: true,
                data: results[0].result,
              });
            } else {
              sendResponse({
                success: false,
                error: "No results returned from script execution",
              });
            }
          }
        );
      } else {
        sendResponse({
          success: false,
          error: "No active tab found",
        });
      }
    });
    return true; // Keep message channel open for async response
  }

  // Add a new message handler for direct Claude API testing
  if (message.action === "directClaudeTest") {

    const exactKey = message.apiKey; // Use exactly as provided

    // First try the x-api-key method (recommended by Anthropic)
    fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": exactKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
    })
      .then((response) => {

        if (!response.ok) {
          return response.text().then((text) => {
            throw new Error(
              `API Error (${response.status}): ${
                text || response.statusText || "Unknown error"
              }`
            );
          });
        }

        return response.json();
      })
      .then((data) => {

        if (data.models && data.models.length > 0) {
          // Store auth method preference
          chrome.storage.local.set({ claudeAuthMethod: "x-api-key" });

          // Send success response
          sendResponse({
            success: true,
            message: "API key verified successfully with x-api-key method",
            models: data.models.map((m) => m.id),
            authMethod: "x-api-key",
          });
        } else {
          throw new Error("No models found in response");
        }
      })
      .catch((error) => {

        // Try Bearer token method as fallback
        fetch("https://api.anthropic.com/v1/models", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${exactKey}`,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
        })
          .then((response) => {

            if (!response.ok) {
              return response.text().then((text) => {
                throw new Error(
                  `API Error (${response.status}): ${
                    text || response.statusText || "Unknown error"
                  }`
                );
              });
            }

            return response.json();
          })
          .then((data) => {

            if (data.models && data.models.length > 0) {
              // Store auth method preference
              chrome.storage.local.set({ claudeAuthMethod: "bearer" });

              // Send success response
              sendResponse({
                success: true,
                message: "API key verified successfully with Bearer method",
                models: data.models.map((m) => m.id),
                authMethod: "bearer",
              });
            } else {
              throw new Error("No models found in Bearer response");
            }
          })
          .catch((bearerError) => {

            // Both methods failed
            sendResponse({
              success: false,
              message: `Both authentication methods failed. First error: ${error.message}, Bearer error: ${bearerError.message}`,
              error: error.message,
              bearerError: bearerError.message,
            });
          });
      });

    return true; // Important: keeps the message channel open for async response
  }

  // ...inside chrome.runtime.onMessage.addListener...
  if (message.action === "startBackgroundGeneration") {
    chrome.storage.local.set({ generationInProgress: true });
    const { providerId, model, userPrompt, apiKey } = message;
    const controller = new AbortController();
    currentGenerationController = controller; // Store globally for cancellation
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout


    fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: providerId,
        model,
        apiKey: apiKey,
        userPrompt,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        clearTimeout(timeoutId);
        const responseText = await response.text();
        let parsedBody = null;

        if (responseText) {
          try {
            parsedBody = JSON.parse(responseText);
          } catch (parseError) {
            if (!response.ok) {
              const errorMessage = responseText.slice(0, 500);
              throw new Error(
                `API error: ${response.status} ${response.statusText} - ${errorMessage}`
              );
            }
            throw new Error(
              `Failed to parse API response JSON: ${parseError.message}`
            );
          }
        }

        if (!response.ok) {
          const errorDetail =
            (parsedBody &&
              (parsedBody.error ||
                parsedBody.message ||
                parsedBody.detail ||
                parsedBody.info)) ||
            response.statusText ||
            "Unknown error";
          const detailString =
            typeof errorDetail === "string"
              ? errorDetail
              : JSON.stringify(errorDetail);
          const singleSentenceDetail = extractSingleSentence(detailString);
          const formattedDetail = singleSentenceDetail || detailString;
          throw new Error(
            `API error: ${response.status} ${response.statusText} - ${formattedDetail}`
          );
        }

        return parsedBody;
      })
      .then((data) => {
        const providerConfig = getProviderConfig(providerId);
        const generatedJson = providerConfig.parseResponse(data);

        // Validate that we got a response
        if (!generatedJson) {
          console.error(`${providerId} parseResponse returned empty result. Response data:`, data);
          throw new Error(`No content received from ${providerConfig.label || providerId} API. Response structure may have changed.`);
        }

        // Save to history
        saveToHistory(userPrompt, generatedJson, providerId);

        chrome.storage.local.set({
          generatedJson,
          generationError: null,
          generationComplete: true,
          generationInProgress: false,
        });
        
        // Clear the controller since generation completed successfully
        currentGenerationController = null;

        // Show success notification
        showGenerationNotification(
          true,
          "Workflow JSON generated successfully!"
        );

        // Inject the JSON into the n8n editor
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.scripting.executeScript(
              {
                target: { tabId: tabs[0].id },
                world: "MAIN",
                func: (workflowJson) => {
                  try {

                    const app = document.querySelector("#app")?.__vue_app__;
                    if (!app) {
                      alert("Could not find Vue app instance");
                      return { success: false, error: "No Vue app" };
                    }
                    const pinia = app._context.config.globalProperties.$pinia;
                    const workflowStore = pinia._s.get("workflows");

                    let newWorkflow;
                    try {
                      newWorkflow =
                        typeof workflowJson === "string"
                          ? JSON.parse(workflowJson)
                          : workflowJson;
                    } catch (parseError) {
                      console.error("Failed to parse workflow JSON:", parseError, "JSON string:", workflowJson?.substring(0, 200));
                      return { success: false, error: "Failed to parse JSON: " + parseError.message };
                    }
                   
                    let workflowCreationSkipped = true;

                    if (
                      workflowStore &&
                      typeof workflowStore.setWorkflow === "function"
                    ) {
                      try {
                        // If workflow creation was skipped, ensure we have a basic workflow structure
                        // Only create minimal workflow if there's no existing workflow or it's invalid
                        if (workflowCreationSkipped && (!workflowStore.workflow || !workflowStore.workflow.id || workflowStore.workflow.id === 'temp-undefined')) {
                          const minimalWorkflow = {
                            id: `temp-${Date.now()}`,
                            name: "Generated Workflow",
                            nodes: [],
                            connections: {},
                            active: false,
                            isArchived: false,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            settings: {
                              executionOrder: "v1",
                              timezone: "UTC",
                              saveDataErrorExecution: "all",
                              saveDataSuccessExecution: "all",
                              errorWorkflow: ""
                            },
                            staticData: {},
                            meta: {},
                            pinData: {},
                            versionId: 1,
                            tags: []
                          };
                          workflowStore.setWorkflow(minimalWorkflow);
                        }
                        
                        const existingNodes = workflowStore.workflow?.nodes || [];
                        
                        const mergedWorkflow = {
                          ...newWorkflow,
                          nodes: [...existingNodes, ...(newWorkflow.nodes || [])],
                        };
                        workflowStore.setWorkflow(mergedWorkflow);
                        
                        // Version history will be saved when user clicks Save in n8n
                        return { success: true };
                      } catch (setWorkflowError) {
                        return { success: false, error: setWorkflowError.message };
                      }
                    }

                    if (
                      app.config &&
                      app.config.globalProperties &&
                      app.config.globalProperties.$store
                    ) {
                      const existingNodes =
                        app.config.globalProperties.$store.state.workflow
                          ?.nodes || [];
                      const mergedWorkflow = {
                        ...newWorkflow,
                        nodes: [...existingNodes, ...(newWorkflow.nodes || [])],
                      };
                      app.config.globalProperties.$store.commit(
                        "workflow/setWorkflow",
                        mergedWorkflow
                      );
                      // Version history will be saved when user clicks Save in n8n
                      return { success: true };
                    }

                    return {
                      success: false,
                      error: "Could not find workflow store",
                    };
                  } catch (e) {
                    return { success: false, error: e.message };
                  }
                },
                args: [generatedJson],
              },
              (results) => {
                if (chrome.runtime.lastError) {
                  console.error("Error executing workflow injection script:", chrome.runtime.lastError);
                  showGenerationNotification(
                    false,
                    "Failed to paste workflow: " + chrome.runtime.lastError.message
                  );
                  return;
                }

                if (
                  results &&
                  results[0] &&
                  results[0].result &&
                  results[0].result.success
                ) {
                  showGenerationNotification(
                    true,
                    "Workflow generated and pasted successfully!"
                  );
                  
                  // Re-inject buttons after successful workflow update
                  // n8n re-renders the DOM when workflow is updated, causing buttons to disappear
                  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                      // Wait a bit for n8n to finish re-rendering
                      setTimeout(() => {
                        checkButtonSettings((settings) => {
                          if (settings.generate) {
                            injectGenerateButton(tabs[0].id, tabs[0].url);
                          }
                          if (settings.debug) {
                            injectDebugButton(tabs[0].id, tabs[0].url);
                          }
                        });
                      }, 500); // Small delay to ensure DOM is stable
                    }
                  });
                  
                  sendResponse({ success: true });
                } else {
                  const errorMsg =
                    results &&
                    results[0] &&
                    results[0].result &&
                    results[0].result.error
                      ? results[0].result.error
                      : "Unknown error";
                  console.error("Workflow injection failed. Error:", errorMsg, "Results:", results);
                  showGenerationNotification(
                    false,
                    "Failed to paste workflow: " + errorMsg
                  );
                }
              }
            );
          }
        });
      })
      .catch((error) => {
        chrome.storage.local.set({
          generationError: error.message,
          generationComplete: true,
          generationInProgress: false,
        });
        
        // Clear the controller since generation failed
        currentGenerationController = null;

        // Show error notification
        showGenerationNotification(
          false,
          "Generation failed: " + error.message
        );
      });

    return true; // Keep message channel open for async response
  }

  // Handle clear data request
  // Handle cancel generation request
  if (message.action === "cancelGeneration") {
    // Abort the ongoing generation if controller exists
    if (currentGenerationController) {
      currentGenerationController.abort();
      currentGenerationController = null;
    }
    
    chrome.storage.local.set({
      generationInProgress: false,
      generationError: "Generation was cancelled by user.",
      generationComplete: true,
    });
    sendResponse({ success: true });
    return true;
  }

  // Add the new history retrieval handler HERE
  if (message.action === "getHistory") {
    chrome.storage.local.get(["generationHistory"], (data) => {
      const history = data.generationHistory || [];
      sendResponse({ success: true, history });
    });
    return true; // Keep message channel open for async response
  }

  if (message.action === "getWorkflowVersionHistory") {
    const workflowId = message.workflowId;
    chrome.storage.local.get(["workflowVersionHistory"], (data) => {
      const versionHistory = data.workflowVersionHistory || {};
      sendResponse({
        success: true,
        history: versionHistory[workflowId] || [],
      });
    });
    return true; // async
  }

});

// Helper function to get provider configuration
function getProviderConfig(providerId) {
  const PROVIDER_CONFIG = {
    openai: {
      label: "OpenAI (GPT)",
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
          temperature: 0.3,
        }),
      }),
      parseResponse: (data) => {
        // Check if server returned cleanedJson (processed response)
        if (data.cleanedJson && typeof data.cleanedJson === 'string') {
          return data.cleanedJson.trim();
        }
        
        // Standard Mistral API response format
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          return content.trim();
        }
        
        // Fallback: check if message exists but content is in a different location
        const message = data.choices?.[0]?.message;
        if (message) {
          console.warn("Mistral response message structure:", message);
          // Try to find content in message object
          if (message.text) return message.text.trim();
          if (message.body) return message.body.trim();
        }
        
        console.error("Mistral parseResponse: Unable to extract content. Full response:", data);
        return null;
      },
    },
    claude: {
      label: "Anthropic (Claude)",
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

        // Check if server returned cleanedJson (processed response)
        if (data.cleanedJson && typeof data.cleanedJson === 'string') {
          return data.cleanedJson.trim();
        }

        // Updated to match the new Messages API response format
        if (data.content && Array.isArray(data.content)) {
          // Extract text from content blocks
          const textBlocks = data.content.filter(
            (block) => block.type === "text"
          );
          if (textBlocks.length > 0) {
            let text = textBlocks
              .map((block) => block.text)
              .join("\n")
              .trim();

            // Check if response is HTML (error case)
            if (text.trim().startsWith('<') || text.trim().startsWith('<!DOCTYPE')) {
              console.error("Claude API returned HTML instead of JSON. This might be an error page.");
              throw new Error("Received HTML response instead of JSON. Please check your API key and try again.");
            }

            // Remove markdown code blocks if present
            if (text.includes("```json") || text.includes("```")) {
              // Remove opening code block marker with or without language specifier
              text = text.replace(/^```(?:json)?\s*/i, "");
              // Remove closing code block marker
              text = text.replace(/\s*```$/i, "");
              // Also handle cases where code blocks are in the middle
              text = text.replace(/```(?:json)?\s*/gi, "").replace(/\s*```/gi, "");
            }

            return text.trim();
          }
        }

        // Fallbacks for older API versions
        if (data.completion) {
          let completion = data.completion.trim();
          // Remove markdown code blocks if present
          if (completion.includes("```json") || completion.includes("```")) {
            completion = completion.replace(/^```(?:json)?\s*/i, "");
            completion = completion.replace(/\s*```$/i, "");
            completion = completion.replace(/```(?:json)?\s*/gi, "").replace(/\s*```/gi, "");
          }
          return completion;
        }

        console.error("Claude parseResponse: Unable to extract content. Full response:", data);
        throw new Error("Unexpected response format from Claude API");
      },
    },
    openrouter: {
      label: "OpenRouter",
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
      parseResponse: (data) => {
        // Check if server returned cleanedJson (processed response)
        if (data.cleanedJson && typeof data.cleanedJson === 'string') {
          return data.cleanedJson.trim();
        }
        
        // Standard OpenRouter API response format
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          let text = content.trim();
          
          // Check if response is HTML (error case)
          if (text.trim().startsWith('<') || text.trim().startsWith('<!DOCTYPE')) {
            console.error("OpenRouter API returned HTML instead of JSON. This might be an error page.");
            throw new Error("Received HTML response instead of JSON. Please check your API key and try again.");
          }
          
          // Remove markdown code blocks if present
          if (text.includes("```json") || text.includes("```")) {
            // Remove opening code block marker with or without language specifier
            text = text.replace(/^```(?:json)?\s*/i, "");
            // Remove closing code block marker
            text = text.replace(/\s*```$/i, "");
            // Also handle cases where code blocks are in the middle
            text = text.replace(/```(?:json)?\s*/gi, "").replace(/\s*```/gi, "");
          }
          
          return text.trim();
        }
        
        console.error("OpenRouter parseResponse: Unable to extract content. Full response:", data);
        return null;
      },
    },
    grok: {
      label: "Grok (x.ai)",
      getApiDetails: (apiKey, model, systemPrompt, userPrompt) => {
        // Ensure API key is properly formatted (trim any whitespace)
        const cleanedApiKey = apiKey.trim();

        // Log key details for debugging

        // Log first and last few characters for verification (safe to log)

        // Prepare headers - EXACT FORMAT from documentation
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cleanedApiKey}`,
        };

        // Use x.ai API endpoint for chat completions
        const apiUrl = "https://api.x.ai/v1/chat/completions";


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
              role: "system",
              content:
                systemPrompt +
                "\n\nIt is EXTREMELY important that you return a fully valid, well-structured JSON object. Check your output carefully before responding.",
            },
            {
              role: "user",
              content: enhancedUserPrompt,
            },
          ],
          model: model,
          stream: false,
          temperature: 0.1, // Lower temperature for more deterministic output
          max_tokens: 16000, // Max token limit for large workflows
          top_p: 0.1, // Lower for more deterministic JSON output
        };

        // Log the request (without sensitive data)

        return {
          url: apiUrl,
          headers: headers,
          body: JSON.stringify(requestBody),
        };
      },
      parseResponse: (data) => {
        // Enhanced error checking for x.ai

        // Check for error in response
        if (data.error) {
          throw new Error(
            `x.ai API Error: ${data.error?.message || data.error}`
          );
        }

        // Check for choices array
        if (
          !data.choices ||
          !Array.isArray(data.choices) ||
          data.choices.length === 0
        ) {
          console.error(
            "x.ai response missing choices array or empty choices:",
            data
          );
          throw new Error(
            "Invalid x.ai response format: missing choices array"
          );
        }

        // Get the content from the standard OpenAI-like format
        const content = data.choices[0]?.message?.content;
        if (!content) {
          console.error(
            "x.ai response missing content in expected location:",
            data.choices[0]
          );
          throw new Error("Invalid x.ai response format: missing content");
        }

        // Check if content is very short or potentially incomplete
        if (content.trim().length < 50) {
          // We don't throw here but log it as a warning
        }

        // Log finishing reason for debugging
        if (data.choices[0].finish_reason) {

          // If it stopped because it hit the token limit, warn about potential truncation
          if (data.choices[0].finish_reason === "length") {
          }
        }

        return content.trim();
      },
    },
    groq: {
      label: "Groq",
      getApiDetails: (apiKey, model, systemPrompt, userPrompt) => {
        // Ensure API key is properly formatted (trim any whitespace)
        const cleanedApiKey = apiKey.trim();

        // Prepare headers
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cleanedApiKey}`,
        };

        // Use Groq API endpoint
        const apiUrl = "https://api.groq.com/openai/v1/chat/completions";


        // Prepare request body
        const requestBody = {
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          model: model,
          temperature: 0.3,
        };

        // Log the request (without sensitive data)

        return {
          url: apiUrl,
          headers: headers,
          body: JSON.stringify(requestBody),
        };
      },
      parseResponse: (data) => data.choices?.[0]?.message?.content?.trim(),
    },
  };

  return PROVIDER_CONFIG[providerId];
}

// Helper function to save to history
function saveToHistory(promptText, jsonOutput, provider) {
  chrome.storage.local.get(["generationHistory"], (data) => {
    let history = data.generationHistory || [];

    // Add new item at the beginning of the array
    history.unshift({
      id: Date.now(), // Use timestamp as ID
      prompt: promptText,
      json: jsonOutput,
      provider: provider,
      timestamp: new Date().toISOString(),
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
    return response;
  }

  // Remove any text before the first opening brace
  let cleaned = response;
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace > 0) {
    cleaned = cleaned.substring(firstBrace);
  }

  // Remove any text after the last closing brace
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace !== -1 && lastBrace < cleaned.length - 1) {
    cleaned = cleaned.substring(0, lastBrace + 1);
  }

  // Remove markdown code blocks
  if (cleaned.includes("```")) {
    cleaned = cleaned.replace(/```(?:json)?\s*/g, "").replace(/\s*```/g, "");
  }

  // Remove common explanatory text patterns
  const explanationPatterns = [
    /^Here's the JSON for your workflow:[\s\n]*/i,
    /^Here is the JSON:[\s\n]*/i,
    /^Here's the n8n workflow JSON:[\s\n]*/i,
    /^The generated JSON:[\s\n]*/i,
    /[\s\n]*This JSON can be imported into n8n\.[\s\n]*$/i,
    /[\s\n]*You can import this JSON into n8n\.[\s\n]*$/i,
  ];

  for (const pattern of explanationPatterns) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, "");
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
          await new Promise((r) => setTimeout(r, delayMs));
        }

        const response = await fetchFn();
        return resolve(response);
      } catch (error) {
        lastError = error;

        // Only retry on "Overloaded" errors
        if (error.message && error.message.includes("Overloaded")) {
          retryCount++;
        } else {
          // Don't retry on other errors
          return reject(error);
        }
      }
    }

    // If we've exhausted retries, reject with the last error
    reject(
      new Error(
        `Claude API still overloaded after ${maxRetries} retries. Please try again later.`
      )
    );
  });
}
