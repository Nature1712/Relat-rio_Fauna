import { GoogleGenAI } from "@google/genai";

// Always route through proxy (Express locally / Netlify functions in production)
// This ensures that API keys are never exposed or required client-side.
const useProxy = true;

export type AIAction = "generateBackground" | "extractOCR";

export interface AIProxyOptions {
  action: AIAction;
  payload: {
    prompt: string;
    mimeType?: string;
    data?: string;
  };
}

/**
 * Executes AI generation commands safely.
 * Under production / Netlify environment, this proxies requests to a serverless lambda,
 * protecting your GEMINI_API_KEY from reverse-engineering on web browsers and cellular devices.
 * Under local dev / preview environment, it utilizes the client-side GoogleGenAI SDK as a fallback.
 */
export async function executeAICommand(options: AIProxyOptions): Promise<any> {
  if (useProxy) {
    try {
      console.log(`[AI SECURE GATEWAY] Routing '${options.action}' through Serverless Proxy...`);
      const response = await fetch("/.netlify/functions/gemini-proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Servidor proxy respondeu com status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.warn("[AI SECURE GATEWAY] Proxy request failed, trying client-side fallback...", error);
      // Fallback below if proxy fails or is not yet configured on this URL
    }
  }

  // --- CLIENT-SIDE FALLBACK / LOCAL PREVIEW MODE ---
  // Read current API key from secure environment variables mapped dynamically
  const apiKey = (
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    (typeof process !== "undefined" && process.env?.GEMINI_API_KEY) ||
    (typeof process !== "undefined" && process.env?.API_KEY) ||
    ""
  ) as string;

  if (!apiKey) {
    throw new Error(
      "API Key não configurada. Defina VITE_GEMINI_API_KEY nas variáveis de ambiente do Vite ou adicione GEMINI_API_KEY no painel do Netlify."
    );
  }

  const ai_client = new GoogleGenAI({ apiKey });

  if (options.action === "generateBackground") {
    const res = await ai_client.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: options.payload.prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });
    return res;
  } else if (options.action === "extractOCR") {
    const res = await ai_client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: options.payload.prompt },
            { inlineData: { mimeType: options.payload.mimeType!, data: options.payload.data! } },
          ],
        },
      ],
      config: { responseMimeType: "application/json" },
    });
    // Return standard object matching serverless response payload format
    return { text: res.text };
  }

  throw new Error(`Ação desconhecida: ${options.action}`);
}
