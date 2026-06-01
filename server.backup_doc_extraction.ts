import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large JSON payloads for base64 image uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Lazy initialization of the Gemini client within route handlers to prevent startup crashes when the API key is not yet set.
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY não configurada na área operacional do servidor.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  // Mount standard Netlify-compatible path locally on Express so that code remains fully portable and offline-enabled
  app.post("//.netlify/functions/gemini-proxy", async (req, res) => {
    try {
      const { action, payload } = req.body;
      console.log(`[Express Proxy] Processando ação: ${action}`);

      const ai = getGeminiClient();

      if (action === "generateBackground") {
        console.log(`[Express Proxy] Gerando imagem do cerrado: "${payload.prompt}"`);
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
        return res.status(200).json(response);
      } else if (action === "extractOCR") {
        console.log(`[Express Proxy] Executando análise multimodal OCR`);
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
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
        return res.status(200).json({ text: response.text });
      } else if (action === "improveText") {
        console.log(`[Express Proxy] Aprimorando texto de circunstâncias`);
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: {
            parts: [{ text: payload.prompt }],
          },
        });
        return res.status(200).json({ text: response.text });
      } else {
        return res.status(400).json({ error: `Ação '${action}' desconhecida no servidor.` });
      }
    } catch (error: any) {
      console.error("[Express Proxy Error]:", error);
      return res.status(500).json({ error: error?.message || "Erro interno do processamento de IA." });
    }
  });

  // Setup Vite development middleware OR serve built static assets
  if (process.env.NODE_ENV !== "production") {
    console.log("[Server] Rodando em modo DESENVOLVIMENTO com middleware do Vite.");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Rodando em modo PRODUÇÃO servindo arquivos estáticos de 'dist'.");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor ativado com sucesso em http://0.0.0.0:${PORT}`);
  });
}

startServer();
