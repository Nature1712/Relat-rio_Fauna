import { GoogleGenAI } from "@google/genai";

export default async (req: Request) => {
  // Handle CORS Preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { action, payload } = await req.json();
    
    // Retrieve the secret key from safe Netlify serverless environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          error: "API key is missing on the server. Please add GEMINI_API_KEY to your Netlify environment variables list." 
        }), 
        {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    if (action === "generateBackground") {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: payload.prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          }
        }
      });
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } else if (action === "extractOCR") {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: payload.prompt },
              { inlineData: { mimeType: payload.mimeType, data: payload.data } }
            ]
          }
        ],
        config: { responseMimeType: "application/json" }
      });
      return new Response(JSON.stringify({ text: response.text }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } else if (action === "improveText") {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
          parts: [{ text: payload.prompt }],
        },
      });
      return new Response(JSON.stringify({ text: response.text }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } else {
      return new Response(JSON.stringify({ error: `Ação '${action}' desconhecida no servidor proxy.` }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }
  } catch (error: any) {
    console.error("Error in Netlify Function proxy:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno do servidor proxy." }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
};
