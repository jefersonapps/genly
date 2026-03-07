import { getSetting } from "./settingsService";

export type AIModel = "gemini" | "openai";
export type AIProcessMode = "format" | "grammar" | "generate_mindmap" | "generate_flashcards";

interface AIResponse {
  success: boolean;
  text?: string;
  error?: string;
}

interface AIJSONResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export const aiService = {
  /**
   * Process text using the selected AI model and mode.
   */
  async processText(text: string, mode: AIProcessMode, title?: string, availableColors?: string[]): Promise<AIResponse> {
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

      const prompt = this.getPrompt(text, mode, title, availableColors);

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

  /**
   * Process a prompt to generate structured JSON (mind maps or flashcards).
   */
  async processJSON(prompt: string, mode: AIProcessMode, availableColors?: string[]): Promise<AIJSONResponse> {
    try {
      const result = await this.processText(prompt, mode, undefined, availableColors);
      if (!result.success || !result.text) {
        return { success: false, error: result.error || 'Resposta vazia da IA.' };
      }

      // Extract JSON from response (may be wrapped in markdown code blocks)
      let jsonStr = result.text.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // Try to find JSON object or array boundaries as fallback
      if (!jsonStr.startsWith('{') && !jsonStr.startsWith('[')) {
        const objStart = jsonStr.indexOf('{');
        const arrStart = jsonStr.indexOf('[');
        if (objStart >= 0 || arrStart >= 0) {
          const start = objStart >= 0 && arrStart >= 0
            ? Math.min(objStart, arrStart)
            : Math.max(objStart, arrStart);
          jsonStr = jsonStr.substring(start);
        }
      }

      const data = JSON.parse(jsonStr);
      return { success: true, data };
    } catch (error: any) {
      console.error('AI JSON Parse Error:', error);
      return {
        success: false,
        error: 'Não foi possível interpretar a resposta da IA como JSON.',
      };
    }
  },

  getPrompt(text: string, mode: AIProcessMode, title?: string, availableColors?: string[]): string {
    const titleContext = title && title.trim() ? `Título da nota para contexto: "${title}" (AVISO: NÃO repita ou inclua este título no início ou no corpo da resposta).\n\n` : "";
    
    if (mode === "format") {
      const titleContext = title ? `Título: ${title}\n` : "";
      return `
Sua tarefa é organizar e formatar o texto abaixo usando HTML simples.
${titleContext}Use APENAS as seguintes tags HTML: <b>, <i>, <u>, <s>, <h1>, <h2>, <h3>, <ul>, <ol>, <li>, blockquote, <codeblock>, <code>, <p>.
Melhore a estrutura, use listas, negrito e subtítulos onde apropriado.
Mantenha a essência e o conteúdo original, apenas melhore a apresentação e corrija erros gramaticais óbvios.
Não adicione markdown (como ** ou #), use apenas as tags HTML especificadas.
Não adicione conversas, apenas retorne o texto formatado em HTML.
IMPORTANTE: Envolva TODO o conteúdo com <html>...</html>.

Texto original:
${text}
`;
    } else if (mode === "generate_mindmap") {
      const colorsStr = availableColors?.length ? `\nCores disponíveis para você escolher (use os códigos HEX exatos): ${availableColors.join(', ')}.\nEscolha cores didaticamente (ex: todos os filhos diretos de um assunto com a mesma cor, ou agrupe logicamente).` : '';
      return `
Você é um assistente de criação de mapas mentais.
Sua tarefa é gerar um mapa mental estruturado em JSON a partir do prompt do usuário.
Retorne APENAS um objeto JSON válido, sem texto adicional, sem blocos de código markdown.
Use EXATAMENTE este formato:
{
  "rootTitle": "Tema Central",
  "color": "#6a57e3",
  "children": [
    {
      "title": "Subtópico 1",
      "color": "#208AEF",
      "children": [
        { "title": "Detalhe A", "color": "#208AEF", "children": [] }
      ]
    },
    {
      "title": "Subtópico 2",
      "color": "#ec4899",
      "children": []
    }
  ]
}
Regras:
- "rootTitle" é obrigatório e deve ser uma string.
- "color" (opcional) é o código HEX da cor do nó (do root ou dos filhos).
- "children" é um array de objetos, cada um com "title" (string), "color" (string HEX opcional) e "children" (array).
- Crie entre 3 e 7 subtópicos principais, cada um podendo ter sub-subtópicos.
- Use títulos curtos e objetivos (máximo 5 palavras por nó).
- Use as cores sugeridas para agrupar ramos ou temas logicamente, promovendo facilidade de estudo.
- Retorne SOMENTE o JSON, nada mais.${colorsStr}

Prompt do usuário:
${text}
`;
    } else if (mode === "generate_flashcards") {
      return `
Você é um assistente de criação de flashcards de estudo.
Sua tarefa é gerar flashcards estruturados em JSON a partir do prompt do usuário.
Retorne APENAS um array JSON válido, sem texto adicional, sem blocos de código markdown.
Use EXATAMENTE este formato:
[
  { "front": "Pergunta 1", "back": "Resposta 1" },
  { "front": "Pergunta 2", "back": "Resposta 2" }
]
Regras:
- Cada objeto deve ter exatamente "front" (pergunta) e "back" (resposta), ambos strings.
- Crie entre 5 e 15 flashcards relevantes ao tema.
- As perguntas devem ser objetivas e claras.
- As respostas devem ser concisas, mas completas.
- Retorne SOMENTE o JSON array, nada mais.

Prompt do usuário:
${text}
`;
    } else {
      return `
Você é um assistente de correção gramatical.
Sua tarefa é corrigir erros gramaticais, de pontuação e ortografia no texto abaixo.
${titleContext}Retorne o texto corrigido mantendo a estrutura original.
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
      const modelName = model;
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
      const modelName = model;
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

// ─── Validation Functions ───────────────────────────

interface MindMapJSONNode {
  title: string;
  color?: string;
  children: MindMapJSONNode[];
}

interface MindMapJSON {
  rootTitle: string;
  color?: string;
  children: MindMapJSONNode[];
}

interface FlashcardJSON {
  front: string;
  back: string;
}

function isValidMindMapNode(node: any): node is MindMapJSONNode {
  if (!node || typeof node !== 'object') return false;
  if (typeof node.title !== 'string' || !node.title.trim()) return false;
  if (!Array.isArray(node.children)) return false;
  return node.children.every((child: any) => isValidMindMapNode(child));
}

export function validateMindMapJSON(data: any): data is MindMapJSON {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.rootTitle !== 'string' || !data.rootTitle.trim()) return false;
  if (!Array.isArray(data.children)) return false;
  return data.children.every((child: any) => isValidMindMapNode(child));
}

export function validateFlashcardsJSON(data: any): data is FlashcardJSON[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return false;
  return data.every(
    (item: any) =>
      item &&
      typeof item === 'object' &&
      typeof item.front === 'string' &&
      item.front.trim() !== '' &&
      typeof item.back === 'string' &&
      item.back.trim() !== '',
  );
}
