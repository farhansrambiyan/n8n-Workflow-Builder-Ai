# n8n Workflow Builder AI (beta)

**Generate n8n workflow & node JSON using AI (OpenAI & Google Gemini) directly in your browser!**

An open-source Chrome Extension designed to help n8n users quickly generate JSON configurations for workflows or individual nodes based on natural language prompts. This extension leverages the power of OpenAI (GPT models) or Google Gemini, using **your own API keys**, making the extension itself free to use.

**Note:** This project is intended for **personal, non-commercial use**. Please respect the terms of service of the AI providers (OpenAI, Google).

Need help? Visit our FAQs & Guide: https://far.hn/n8n-workflow-builder-ai
Report Bug or Request a feature: https://far.hn/feature-request
Consider Donating via BMC: https://www.buymeacoffee.com/farhansrambiyan

## Features

*   **AI-Powered Generation:** Describe the n8n workflow or node you need in plain text.
*   **Dual AI Support:** Choose between using OpenAI (GPT models) or Google Gemini.
*   **Bring Your Own Key:** Uses your personal API keys, meaning no subscription fee for the extension itself. You only pay for your AI usage directly to the provider.
*   **Simple Interface:** Clean UI with separate tabs for generation and settings.
*   **Secure Local Storage:** API keys are stored only in your browser's local storage, never transmitted elsewhere except directly to the respective AI provider.

## Why Use This Extension?

*   **Speed Up Development:** Quickly scaffold nodes or entire workflows without manually looking up every parameter.
*   **Learn Node Structures:** See how different requests translate into n8n's JSON format.
*   **Convenient:** Generate JSON directly where you work, without switching to a separate AI chat interface.
*   **Cost-Effective:** No extension fees – leverage your existing AI API credits.
*   **Simple Alternative:** Provides core AI generation functionality without the complexity of some larger companion tools.

## Installation (From Source / GitHub)

Since this is open-source and intended for personal use, you'll typically load it as an unpacked extension:

1.  **Download / Clone:** Download the source code (e.g., as a ZIP file from GitHub and extract it) or clone the repository using Git. You should have a folder containing `manifest.json`, `popup.html`, `popup.js`, `popup.css`, and the `icons` folder.
2.  **Open Chrome Extensions:** Open Google Chrome, type `chrome://extensions/` in the address bar, and press Enter.
3.  **Enable Developer Mode:** Find the "Developer mode" toggle switch (usually in the top-right corner) and make sure it's **ON**.
4.  **Load Unpacked:** Click the "Load unpacked" button (usually on the top-left).
5.  **Select Folder:** In the file dialog that opens, navigate to the folder where you downloaded/cloned the code and select the main folder (the one containing `manifest.json`). Click "Select Folder".
6.  **Done!** The "n8n Workflow Builder AI" extension icon should appear in your Chrome toolbar. You might need to click the puzzle piece icon to pin it.

## Setup & Configuration

Before you can generate JSON, you need to provide your API keys:

1.  **Click the Extension Icon:** Click the n8n Workflow Builder AI icon in your toolbar.
2.  **Go to Settings:** Click the "Settings" tab within the popup.
3.  **Enter API Keys:**
    *   **OpenAI:** Obtain an API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Paste your **Secret Key** (starts with `sk-...`) into the "OpenAI API Key" field.
    *   **Gemini:** Obtain an API key from [Google AI Studio](https://aistudio.google.com/app/apikey). Click "Create API key" if needed. Paste the key into the "Gemini API Key" field.
4.  **Save Keys & Load Models:** Click the **"Save Settings"** button. If the keys are valid, the extension will attempt to contact the respective APIs to load the available models into the dropdown lists below the keys. This might take a few seconds.
5.  **Select Models:** Once the dropdowns are populated (or show default models if fetching fails), choose your preferred model for OpenAI (e.g., `gpt-4o-mini`) and Gemini (e.g., `gemini-1.5-flash-latest`).
6.  **Save Model Preferences:** Click **"Save Settings"** again to store your chosen models.

*Your API keys and model preferences are stored securely only in your browser's local storage. They are not synced or sent anywhere other than directly to OpenAI or Google when you perform generation or model fetching.*

## How to Use

Install directly from chrome webstore: https://chromewebstore.google.com/detail/n8n-workflow-builder-ai-b/jkncjfiaifpdoemifnelilkikhbjfbhd

Or

1.  **Open the Extension:** Click the n8n Workflow Builder AI icon.
2.  **Select Provider:** On the "Generate" tab, choose "OpenAI (GPT)" or "Google Gemini" from the "AI Provider" dropdown.
3.  **Write Your Prompt:** In the text box, clearly describe the n8n node or workflow you want to create. **Be specific!** The better the prompt, the better the result.
    *   *Workflow Example:* `Create a workflow: Start with a Schedule trigger running every Monday at 9 AM. Then, use an HTTP Request node to GET data from 'https://api.example.com/users'. Finally, use a Set node to extract only the 'email' field from the result.`
    *   *Node Example:* `Generate an n8n Google Sheets node to append a row to spreadsheet ID 'YOUR_SHEET_ID' on sheet 'Sheet1'. The row should contain columns 'Name' with value '{{ $json.name }}' and 'Timestamp' with value '{{ $now }}'.`
4.  **Generate:** Click the "Generate n8n JSON" button.
5.  **Review Output:** The generated JSON will appear below. **Carefully review the JSON structure**, especially `parameters` and `connections`, to ensure it matches your expectations and n8n's requirements. The AI might occasionally make mistakes.
6.  **Copy:** If the JSON looks correct and is valid, click the copy button.
7.  **Paste in n8n:** Go to your n8n canvas, right-click (or use Ctrl/Cmd+V), and paste the copied JSON. n8n should create the node(s)/workflow.

## Important Notes & Disclaimers

*   **API Costs:** Using this extension will make calls to the OpenAI or Google Gemini APIs using *your* keys. You are solely responsible for any costs incurred based on your usage with these providers. Monitor your usage on their respective platforms.
*   **JSON Validity & Accuracy:** While the extension instructs the AI to generate valid and correctly structured n8n JSON, AI models can make mistakes. **Always review the generated JSON before pasting it into n8n.** Minor edits might be required, especially for complex nodes or specific parameter formats (like the `{ "values": [...] }` structure).
*   **Security:** API keys are stored using `chrome.storage.local`, which is standard practice for extensions storing sensitive data locally. They are not sent to any third-party server by this extension. However, be mindful of general browser security.
*   **Personal Use Only:** This extension is provided as an open-source tool primarily for personal, non-commercial use and learning purposes. Commercial use is not explicitly supported or tested.
*   **No Affiliation:** This extension is an independent project and is not officially affiliated with, endorsed by, or supported by n8n.io GmbH, OpenAI, or Google.

## Technology Stack

*   JavaScript (ES6+)
*   HTML5
*   CSS3
*   Chrome Extension Manifest V3
*   Chrome Storage API (`chrome.storage.local`)
*   Chrome Clipboard API (`navigator.clipboard`)
*   Fetch API (for OpenAI/Gemini calls)

## Contributing

Contributions are welcome! If you find a bug, have a feature request, or want to improve the code:

1.  **Open an Issue:** Discuss the change you wish to make via a GitHub issue first.
2.  **Fork the Repository:** Create your own copy of the project.
3.  **Create a Branch:** Make your changes in a dedicated branch (`git checkout -b feature/YourFeature` or `bugfix/IssueDescription`).
4.  **Commit Changes:** Make clear, concise commits.
5.  **Push to Your Branch:** Push your changes to your forked repository.
6.  **Open a Pull Request:** Submit a pull request back to the main repository for review.

Please ensure your code follows basic formatting and includes comments where necessary.

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

*(You will need to create a file named `LICENSE` in your repository and paste the standard MIT License text into it.)*

## Acknowledgements

*   Thanks to the **n8n team** for creating an amazing workflow automation tool.
*   Powered by APIs from **OpenAI** and **Google**.

---
