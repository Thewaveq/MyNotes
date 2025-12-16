import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AIActionType, AIProvider } from "../types";
import { getSettings } from "../utils/storage";

const getActionDescription = (action: AIActionType): string => {
    switch (action) {
        case AIActionType.IMPROVE: return "Перепиши этот фрагмент, улучшив стиль. Сохрани HTML-верстку если есть.";
        case AIActionType.FIX_GRAMMAR: return "Исправь ошибки. Не ломай HTML теги.";
        case AIActionType.SUMMARIZE: return "Напиши краткое содержание.";
        default: return "";
    }
};

const commonSystemInstruction = `
Ты — умный текстовый редактор с поддержкой Rich Text.
Твоя задача — редактировать и дополнять текст.

ВАЖНЫЕ ПРАВИЛА ФОРМАТИРОВАНИЯ:
1. Используй только HTML теги:
   - <b>жирный</b>
   - <i>курсив</i>
   - <br> (только если нужен перенос строки внутри абзаца)
   - <ul><li>пункт</li></ul>
   - <h3>Заголовок</h3>

2. КРИТИЧЕСКИ ВАЖНО:
   - НЕ используй Markdown (**, #, -).
   - НЕ добавляй лишние переносы строк (\n) между тегами. Пиши HTML слитно или в одну строку, где возможно.
   - НЕ добавляй отступы (tab) в HTML коде.
   - Пример ХОРОШЕГО ответа: <h3>Заголовок</h3><p>Текст.</p><ul><li>Пункт 1</li><li>Пункт 2</li></ul>
   - Пример ПЛОХОГО ответа: 
     <h3>Заголовок</h3>
     
     <p>Текст.</p>

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
    
    // Find Active Provider
    const activeProvider = settings.providers?.find(p => p.id === settings.activeProviderId);
    
    if (!activeProvider) {
        throw new Error("No active AI provider selected. Please configure one in Settings.");
    }
    
    // 1. Prepare Keys
    let availableKeys: string[] = [];
    if (activeProvider.apiKeys && activeProvider.apiKeys.length > 0) {
        availableKeys = [...activeProvider.apiKeys];
    }
    
    // Fallback environment key only for Gemini if user hasn't set any
    if (activeProvider.type === 'gemini' && availableKeys.length === 0 && process.env.API_KEY) {
        availableKeys.push(process.env.API_KEY);
    }

    if (availableKeys.length === 0) {
        throw new Error(`No API keys found for ${activeProvider.name}. Please configure them in Settings.`);
    }

    // 2. Prepare Prompts
    const MAX_CONTEXT = 4000;
    const safeContextBefore = contextBefore.slice(-MAX_CONTEXT);
    const safeContextAfter = contextAfter.slice(0, MAX_CONTEXT);

    let systemInstruction = "";
    let finalPrompt = "";

    if (action === AIActionType.CONTINUE) {
        finalPrompt = safeContextBefore;
        systemInstruction = commonSystemInstruction + " Продолжи текст с того места, где он оборвался. Не повторяй уже написанное.";
    } else {
        const task = customPrompt || getActionDescription(action);
        systemInstruction = commonSystemInstruction + `
        Тебе передан контекст:
        CONTEXT_BEFORE: текст до
        TEXT_TO_EDIT: что менять
        CONTEXT_AFTER: текст после
        TASK: задача

        Верни ТОЛЬКО результат для TEXT_TO_EDIT. Не повторяй контекст.
        `;
        finalPrompt = `
<<<CONTEXT_BEFORE>>>
${safeContextBefore}
<<<END_CONTEXT_BEFORE>>>

<<<TEXT_TO_EDIT>>>
${selectedText}
<<<END_TEXT_TO_EDIT>>>

<<<CONTEXT_AFTER>>>
${safeContextAfter}
<<<END_CONTEXT_AFTER>>>

<<<TASK>>>
${task}
<<<END_TASK>>>
`;
    }

    // --- Key Rotation Logic ---
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
            console.warn(`Key ${i + 1}/${availableKeys.length} (${activeProvider.name}) failed.`, error.message);
            lastError = error;

            // Check quotas
            const isQuotaError = 
                error.status === 429 || 
                error.status === 503 || 
                (error.message && (
                    error.message.includes('429') || 
                    error.message.includes('Quota') || 
                    error.message.includes('Resource has been exhausted') ||
                    error.message.includes('insufficient_quota')
                ));

            if (isQuotaError && i < availableKeys.length - 1) {
                console.log("Switching to next API key...");
                continue;
            }
            throw error;
        }
    }

    throw lastError || new Error("All API keys failed.");
};

// --- GEMINI IMPLEMENTATION ---
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

// --- OPENAI IMPLEMENTATION ---
async function streamOpenAI(apiKey: string, provider: AIProvider, systemInstruction: string, prompt: string) {
    const baseUrl = (provider.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = provider.defaultModel || 'gpt-4o-mini';

    const messages = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
    ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            stream: true,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI Error ${response.status}: ${errorBody}`);
    }

    if (!response.body) throw new Error("No response body");

    // Return an async iterable that yields objects compatible with the Editor's expectation: { text: string }
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
                // Keep the last partial line in the buffer
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith("data: ")) continue;
                    
                    const dataStr = trimmed.slice(6); // remove "data: "
                    if (dataStr === "[DONE]") return;

                    try {
                        const json = JSON.parse(dataStr);
                        const content = json.choices?.[0]?.delta?.content || "";
                        if (content) {
                            // Yield an object that mimics Google's GenerateContentResponse structure for compatibility
                            yield { text: content };
                        }
                    } catch (e) {
                        console.error("Error parsing SSE JSON", e);
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    })();
}