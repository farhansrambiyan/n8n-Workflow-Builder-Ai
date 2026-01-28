import fetch from "node-fetch";
import { extractJsonFromText } from "../utils/extractJsonFromText.js";

export const generateHandler = async (req, res) => {
  const { provider, apiKey, model, userPrompt } = req.body;


  if (!provider || !apiKey || !model || !userPrompt) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    let apiUrl, headers, body, systemPrompt;

    systemPrompt = `PLEASE  PROVIDE  YOUR AI PROMPTING HERE.........`;

    switch (provider) {
      case "openai":
        apiUrl = "https://api.openai.com/v1/chat/completions";
        headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        };
        body = JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        });
        break;

      case "gemini":
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        headers = { "Content-Type": "application/json" };
        body = JSON.stringify({
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
          generationConfig: { temperature: 0.3 },
        });
        break;

      case "mistral":
        apiUrl = "https://api.mistral.ai/v1/chat/completions";
        headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        };
        body = JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        });
        break;

      case "claude":
        apiUrl = "https://api.anthropic.com/v1/messages";
        headers = {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        };
        body = JSON.stringify({
          model,
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
        });
        break;

      case "openrouter":
        apiUrl = "https://openrouter.ai/api/v1/chat/completions";
        headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer":
            "https://github.com/farhansrambiyan/n8n-Workflow-Builder-Ai",
          "X-Title": "n8n Workflow Builder Ai (Beta)",
        };
        body = JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        });
        break;

      case "grok": // x.ai
        apiUrl = "https://api.x.ai/v1/chat/completions";
        headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        };
        body = JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                systemPrompt +
                " It is EXTREMELY important that you return a fully valid, well-structured JSON object. Check your output carefully before responding.",
            },
            {
              role: "user",
              content: `${userPrompt}

CRITICAL JSON FORMATTING INSTRUCTIONS:
1. The output MUST be a valid JSON object with NO additional text, markdown, or explanations
2. Do NOT wrap the JSON in code blocks or backticks, return the raw JSON directly
3. Make sure each opening bracket has a closing bracket, especially with nested objects
4. Ensure all quotes are properly escaped within strings
5. Make sure there are no trailing commas in arrays or objects
6. Validate your output is well-formed JSON before responding`,
            },
          ],
          model,
          stream: false,
          temperature: 0.1,
          max_tokens: 16000,
          top_p: 0.1,
        });
        break;

      case "groq":
        apiUrl = "https://api.groq.com/openai/v1/chat/completions";
        headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        };
        body = JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          model,
          temperature: 0.3,
        });
        break;

      default:
        return res.status(400).json({ error: "Unsupported provider" });
    }

    const aiRes = await fetch(apiUrl, { method: "POST", headers, body });
    const data = await aiRes.json();

    let textResponse = "";
    if (provider === "gemini") {
      textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (provider === "claude") {
      if (data.content && Array.isArray(data.content)) {
        textResponse = data.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n");
      } else if (data.completion) {
        textResponse = data.completion;
      }
    } else if (
      provider === "grok" ||
      provider === "openai" ||
      provider === "openrouter" ||
      provider === "groq" ||
      provider === "mistral"
    ) {
      textResponse = data.choices?.[0]?.message?.content || "";
    }

    const cleanedJson = extractJsonFromText(textResponse);
    res.status(aiRes.status).json({
      ...data,
      cleanedJson,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};