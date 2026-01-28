export function extractJsonFromText(text) {
  if (!text) return "";
  
  // Remove markdown code blocks
  if (text.includes("```")) {
    text = text.replaceAll("```json", "").replaceAll("```", "");
  }
  
  // Find the first { and last }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  
  if (first !== -1 && last !== -1 && last > first) {
    let jsonStr = text.substring(first, last + 1);
    
    // Try to fix common JSON errors
    try {
      // Remove trailing commas before ] or }
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      
      // Try to parse to validate
      JSON.parse(jsonStr);
      return jsonStr;
    } catch (e) {
      // If parsing fails, return the string anyway and let the client handle it
      return jsonStr;
    }
  }
  
  return text.trim();
}
