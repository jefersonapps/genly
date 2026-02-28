import { getSetting } from "./settingsService";

export type AIModel = "gemini" | "openai";
export type AIProcessMode = "format" | "grammar";

const GEMINI_MODEL = "gemini-1.5-flash";
const OPENAI_MODEL = "gpt-4o-mini";

interface AIResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export const aiService = {
  /**
   * Process text using the selected AI model and mode.
   */
  async processText(text: string, mode: AIProcessMode): Promise<AIResponse> {
    try {
      const activeModel = await getSetting("active_model");
      let apiKey = "";
      let modelName = "";

      if (activeModel === "openai") {
        apiKey = await getSetting("openai_api_key");
        modelName = await getSetting("openai_model");
      } else {
        apiKey = await getSetting("gemini_api_key");
        modelName = await getSetting("gemini_model");
      }

      if (!apiKey) {
        return {
          success: false,
          error: `Chave de API do ${
            activeModel === "openai" ? "ChatGPT" : "Gemini"
          } não configurada.`,
        };
      }

      const prompt = this.getPrompt(text, mode);

      if (activeModel === "openai") {
        return await this.callOpenAI(apiKey, modelName, prompt);
      } else {
        return await this.callGemini(apiKey, modelName, prompt);
      }
    } catch (error: any) {
      console.error("AI Service Error:", error);
      return {
        success: false,
        error: "Erro ao processar texto com IA.",
      };
    }
  },

  getPrompt(text: string, mode: AIProcessMode): string {
    if (mode === "format") {
      return `
Vocês é um assistente de formatação de texto.
Sua tarefa é organizar e formatar o texto abaixo usando HTML simples.
Use APENAS as seguintes tags HTML: <b>, <i>, <u>, <s>, <h1>, <h2>, <h3>, <ul>, <ol>, <li>, <blockquote>, <codeblock>, <code>, <p>.
Melhore a estrutura, use listas, negrito e subtítulos onde apropriado.
Mantenha a essência e o conteúdo original, apenas melhore a apresentação e corrija erros gramaticais óbvios.
Não adicione markdown (como ** ou #), use apenas as tags HTML especificadas.
Não adicione conversas, apenas retorne o texto formatado em HTML.
IMPORTANTE: Envolva TODO o conteúdo com <html>...</html>.

Texto original:
${text}
`;
    } else {
      return `
Você é um assistente de correção gramatical.
Sua tarefa é corrigir erros gramaticais, de pontuação e ortografia no texto abaixo.
Retorne o texto corrigido mantendo a estrutura original.
Se o texto original for HTML, mantenha as tags. Se for texto plano, retorne texto plano.
Não altere o estilo ou tom do texto, apenas corrija os erros.
Não adicione conversas, apenas retorne o texto corrigido.
IMPORTANTE: Se o resultado contém tags HTML, envolva TODO o conteúdo com <html>...</html>. Use <codeblock> para blocos de código (não <pre>).

Texto original:
${text}
`;
    }
  },

  async callGemini(apiKey: string, model: string, prompt: string): Promise<AIResponse> {
    try {
      const modelName = model || GEMINI_MODEL;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || "Erro na API do Gemini",
        };
      }

      const resultText =
        data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      // Limpa blocos de código markdown se existirem
      const cleanText = resultText.replace(/```html\n?|```/g, "").trim();
      
      return { success: true, text: cleanText };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async callOpenAI(apiKey: string, model: string, prompt: string): Promise<AIResponse> {
    try {
      const modelName = model || OPENAI_MODEL;
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: "system",
              content: "Você é um assistente útil que retorna apenas o conteúdo solicitado em HTML puro, sem blocos de código markdown.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || "Erro na API da OpenAI",
        };
      }

      const resultText = data.choices?.[0]?.message?.content || "";
      
      // Limpa blocos de código markdown se existirem
      const cleanText = resultText.replace(/```html\n?|```/g, "").trim();
      
      return { success: true, text: cleanText };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};
