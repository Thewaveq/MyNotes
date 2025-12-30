import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AIActionType, AIProvider } from "../types";
import { getSettings } from "../utils/storage";

const getActionDescription = (action: AIActionType): string => {
    switch (action) {
        case AIActionType.IMPROVE: return "Улучши стиль текста, сделай его более читаемым.";
        case AIActionType.FIX_GRAMMAR: return "Исправь грамматические и пунктуационные ошибки.";
        case AIActionType.SUMMARIZE: return "Напиши краткое содержание (summary).";
        default: return "";
    }
};

const commonSystemInstruction = `
Ты — умный текстовый редактор.
Твоя задача — редактировать и дополнять текст.

ВАЖНЫЕ ПРАВИЛА:
1. Используй ТОЛЬКО Markdown форматирование.
   - **Жирный** для важного.
   - *Курсив* для акцентов.
   - Списки (- или 1.).
   - # Заголовки (если уместно).

2. ЗАПРЕЩЕНО:
   - НЕ используй HTML теги (<div>, <br>, <b>).
   - НЕ пиши вводные фразы ("Вот ваш текст:", "Конечно").
   - Сразу выдавай результат.

3. Если это обычный текст, просто пиши текст.
`;

export const streamAIResponse = async (
    selectedText: string,
    action: AIActionType,
    customPrompt?: string,
    contextBefore: string = "",
    contextAfter: string = ""
) => {
    const settings = getSettings();
    const activeProvider = settings.providers?.find(p => p.id === settings.activeProviderId);
    
    if (!activeProvider) {
        throw new Error("No active AI provider selected.");
    }
    
    let availableKeys: string[] = [];
    if (activeProvider.apiKeys && activeProvider.apiKeys.length > 0) {
        availableKeys = [...activeProvider.apiKeys];
    }
    
    if (activeProvider.type === 'gemini' && availableKeys.length === 0 && process.env.API_KEY) {
        availableKeys.push(process.env.API_KEY);
    }

    if (availableKeys.length === 0) {
        throw new Error(`No API keys found for ${activeProvider.name}.`);
    }

    const MAX_CONTEXT = 4000;
    const safeContextBefore = contextBefore.slice(-MAX_CONTEXT);
    const safeContextAfter = contextAfter.slice(0, MAX_CONTEXT);

    let systemInstruction = "";
    let finalPrompt = "";

    if (action === AIActionType.CONTINUE) {
        finalPrompt = `
CONTEXT_BEFORE:
${safeContextBefore}

Продолжи текст с того места, где он оборвался. Не повторяй уже написанное.
`;
        systemInstruction = commonSystemInstruction;
    } else {
        const task = customPrompt || getActionDescription(action);
        systemInstruction = commonSystemInstruction;
        finalPrompt = `
CONTEXT_BEFORE:
${safeContextBefore}

TEXT_TO_EDIT:
${selectedText}

CONTEXT_AFTER:
${safeContextAfter}

TASK:
${task}

Верни ТОЛЬКО результат для TEXT_TO_EDIT в формате Markdown.
`;
    }

    let lastError: any = null;

    for (let i = 0; i < availableKeys.length; i++) {
        const currentKey = availableKeys[i];
        try {
            if (activeProvider.type === 'openai-compatible') {
                return await streamOpenAI(currentKey, activeProvider, systemInstruction, finalPrompt);
            } else {
                return await streamGemini(currentKey, activeProvider, systemInstruction, finalPrompt);
            }
        } catch (error: any) {
            console.warn(`Key ${i + 1} failed.`, error.message);
            lastError = error;
            if (i < availableKeys.length - 1) continue;
            throw error;
        }
    }

    throw lastError || new Error("All API keys failed.");
};

async function streamGemini(apiKey: string, provider: AIProvider, systemInstruction: string, prompt: string) {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const modelName = provider.defaultModel || "gemini-2.5-flash";

    const response = await ai.models.generateContentStream({
        model: modelName,
        contents: prompt,
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.7,
        }
    });
    return response;
}

async function streamOpenAI(apiKey: string, provider: AIProvider, systemInstruction: string, prompt: string) {
    const baseUrl = (provider.baseUrl || 'https://api.openai.com/v1').replace(///$/, '');
    const model = provider.defaultModel || 'gpt-4o-mini';

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: prompt }
            ],
            stream: true,
            temperature: 0.7
        })
    });

    if (!response.ok) throw new Error(`OpenAI Error ${response.status}`);
    if (!response.body) throw new Error("No response body");

    return (async function* () {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith("data: ")) continue;
                    const dataStr = trimmed.slice(6);
                    if (dataStr === "[DONE]") return;
                    try {
                        const json = JSON.parse(dataStr);
                        const content = json.choices?.[0]?.delta?.content || "";
                        if (content) yield { text: content };
                    } catch (e) {}
                }
            }
        } finally {
            reader.releaseLock();
        }
    })();
}
