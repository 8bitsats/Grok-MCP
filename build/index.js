#!/usr/bin/env node
/**
 * Grok MCP Server v1.0
 *
 * A comprehensive MCP server providing access to xAI's Grok models with:
 * - Chat completions with Grok 4 models
 * - Live web search
 * - Image generation
 * - Vision/Image understanding
 * - Voice/Audio generation
 * - Encrypted reasoning content support
 * - Stateful conversation management via Responses API
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError, } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import OpenAI from "openai";
// =============================================================================
// Configuration
// =============================================================================
const XAI_API_KEY = process.env.XAI_API_KEY || process.env.X_AI_API_KEY;
if (!XAI_API_KEY) {
    throw new Error("XAI_API_KEY environment variable is required");
}
// Default model configuration
const DEFAULT_CHAT_MODEL = process.env.GROK_MODEL || "grok-4";
const DEFAULT_FAST_MODEL = process.env.GROK_FAST_MODEL || "grok-4-fast-reasoning";
const DEFAULT_IMAGE_MODEL = "grok-2-image";
const DEFAULT_VISION_MODEL = "grok-4";
// Available models
const AVAILABLE_MODELS = {
    chat: ["grok-4", "grok-4-fast-reasoning", "grok-3", "grok-3-mini"],
    image: ["grok-2-image"],
    vision: ["grok-4", "grok-4-fast-reasoning", "grok-3"],
    voice: ["grok-3-fast"] // Voice synthesis model
};
// =============================================================================
// API Clients
// =============================================================================
// OpenAI-compatible client for xAI Responses API
const xaiClient = new OpenAI({
    apiKey: XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
    timeout: 360000,
});
// Axios instance for direct API calls (image generation, etc.)
const xaiApi = axios.create({
    baseURL: "https://api.x.ai/v1",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${XAI_API_KEY}`,
    },
    timeout: 120000,
});
// Store for conversation states (in-memory, keyed by conversation ID)
const conversationStore = new Map();
// =============================================================================
// MCP Server Setup
// =============================================================================
const server = new Server({
    name: "grok-mcp",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// =============================================================================
// Tool Definitions
// =============================================================================
const tools = [
    // Chat completion tool
    {
        name: "grok_chat",
        description: "Chat with Grok AI models. Supports Grok 4, Grok 4 Fast Reasoning, Grok 3, and Grok 3 Mini. Can maintain conversation state using the Responses API.",
        inputSchema: {
            type: "object",
            properties: {
                message: {
                    type: "string",
                    description: "The message to send to Grok"
                },
                model: {
                    type: "string",
                    description: `Model to use. Options: ${AVAILABLE_MODELS.chat.join(", ")}. Default: ${DEFAULT_CHAT_MODEL}`,
                    enum: AVAILABLE_MODELS.chat
                },
                system_prompt: {
                    type: "string",
                    description: "System prompt to set the AI's behavior (optional)"
                },
                conversation_id: {
                    type: "string",
                    description: "ID to continue a previous conversation (optional)"
                },
                include_reasoning: {
                    type: "boolean",
                    description: "Include encrypted reasoning content for chain-of-thought (default: false)"
                },
                store_conversation: {
                    type: "boolean",
                    description: "Store conversation on server for continuation (default: true)"
                }
            },
            required: ["message"]
        }
    },
    // Live search tool
    {
        name: "grok_live_search",
        description: "Perform live web search using Grok with real-time internet access. Returns current, up-to-date information from the web.",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The search query"
                },
                model: {
                    type: "string",
                    description: "Model to use for search synthesis. Default: grok-4-fast-reasoning",
                    enum: AVAILABLE_MODELS.chat
                },
                max_results: {
                    type: "number",
                    description: "Maximum number of search results to return (1-20, default: 10)"
                },
                search_type: {
                    type: "string",
                    description: "Type of search: 'web', 'news', or 'all' (default: 'all')",
                    enum: ["web", "news", "all"]
                }
            },
            required: ["query"]
        }
    },
    // Image generation tool
    {
        name: "generate_image",
        description: "Generate images using Grok's image generation model based on a text prompt.",
        inputSchema: {
            type: "object",
            properties: {
                prompt: {
                    type: "string",
                    description: "Text description of the image you want to generate"
                },
                n: {
                    type: "number",
                    description: "Number of images to generate (1-10, default: 1)",
                    minimum: 1,
                    maximum: 10
                },
                response_format: {
                    type: "string",
                    description: "Format of the generated images ('url' or 'b64_json')",
                    enum: ["url", "b64_json"]
                }
            },
            required: ["prompt"]
        }
    },
    // Image understanding/vision tool
    {
        name: "grok_vision",
        description: "Analyze and understand images using Grok's vision capabilities. Can describe images, answer questions about them, or extract information.",
        inputSchema: {
            type: "object",
            properties: {
                image_url: {
                    type: "string",
                    description: "URL of the image to analyze"
                },
                image_base64: {
                    type: "string",
                    description: "Base64-encoded image data (alternative to image_url)"
                },
                prompt: {
                    type: "string",
                    description: "Question or instruction about the image (default: 'What is in this image?')"
                },
                model: {
                    type: "string",
                    description: `Model to use for vision. Options: ${AVAILABLE_MODELS.vision.join(", ")}`,
                    enum: AVAILABLE_MODELS.vision
                },
                detail: {
                    type: "string",
                    description: "Image detail level: 'auto', 'low', or 'high' (default: 'auto')",
                    enum: ["auto", "low", "high"]
                }
            },
            required: []
        }
    },
    // Voice/Audio generation tool
    {
        name: "grok_voice",
        description: "Generate speech audio from text using Grok's voice synthesis capabilities.",
        inputSchema: {
            type: "object",
            properties: {
                text: {
                    type: "string",
                    description: "The text to convert to speech"
                },
                voice: {
                    type: "string",
                    description: "Voice style to use (options may vary by model)",
                    enum: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
                },
                speed: {
                    type: "number",
                    description: "Speech speed (0.25-4.0, default: 1.0)",
                    minimum: 0.25,
                    maximum: 4.0
                },
                response_format: {
                    type: "string",
                    description: "Audio format: 'mp3', 'opus', 'aac', 'flac', or 'wav' (default: 'mp3')",
                    enum: ["mp3", "opus", "aac", "flac", "wav"]
                }
            },
            required: ["text"]
        }
    },
    // Conversation management tool
    {
        name: "grok_conversation",
        description: "Manage Grok conversations - retrieve, continue, or delete stored conversations.",
        inputSchema: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    description: "Action to perform: 'list', 'get', 'continue', or 'delete'",
                    enum: ["list", "get", "continue", "delete"]
                },
                conversation_id: {
                    type: "string",
                    description: "Conversation ID (required for get, continue, delete)"
                },
                message: {
                    type: "string",
                    description: "New message to add (required for 'continue' action)"
                }
            },
            required: ["action"]
        }
    },
    // Reasoning tool with encrypted content
    {
        name: "grok_reason",
        description: "Use Grok's reasoning capabilities with optional encrypted reasoning content. Ideal for complex problem-solving, math, and logical analysis.",
        inputSchema: {
            type: "object",
            properties: {
                problem: {
                    type: "string",
                    description: "The problem or question to reason about"
                },
                model: {
                    type: "string",
                    description: "Model to use. grok-3-mini supports reasoning_effort control.",
                    enum: ["grok-4", "grok-4-fast-reasoning", "grok-3", "grok-3-mini"]
                },
                reasoning_effort: {
                    type: "string",
                    description: "Reasoning effort level (only for grok-3-mini): 'low' or 'high'",
                    enum: ["low", "high"]
                },
                return_encrypted_reasoning: {
                    type: "boolean",
                    description: "Return encrypted reasoning content for later use (default: true)"
                },
                previous_reasoning: {
                    type: "string",
                    description: "Encrypted reasoning from a previous response to continue context"
                }
            },
            required: ["problem"]
        }
    }
];
// =============================================================================
// Tool Handlers
// =============================================================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "grok_chat":
                return await handleGrokChat(args);
            case "grok_live_search":
                return await handleLiveSearch(args);
            case "generate_image":
                return await handleImageGeneration(args);
            case "grok_vision":
                return await handleVision(args);
            case "grok_voice":
                return await handleVoice(args);
            case "grok_conversation":
                return await handleConversation(args);
            case "grok_reason":
                return await handleReasoning(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
    }
    catch (error) {
        if (error instanceof McpError) {
            throw error;
        }
        console.error(`Error in ${name}:`, error);
        throw new McpError(ErrorCode.InternalError, `Error executing ${name}: ${String(error)}`);
    }
});
// =============================================================================
// Handler Implementations
// =============================================================================
async function handleGrokChat(args) {
    const message = args?.message;
    const model = args?.model || DEFAULT_CHAT_MODEL;
    const systemPrompt = args?.system_prompt;
    const conversationId = args?.conversation_id;
    const includeReasoning = args?.include_reasoning ?? false;
    const storeConversation = args?.store_conversation ?? true;
    if (!message || typeof message !== "string") {
        throw new McpError(ErrorCode.InvalidParams, "A message is required");
    }
    // Build the request
    const messages = [];
    if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: message });
    // Build request body for Responses API
    const requestBody = {
        model,
        input: messages,
        store: storeConversation,
    };
    // Continue from previous conversation if provided
    if (conversationId && conversationStore.has(conversationId)) {
        const state = conversationStore.get(conversationId);
        requestBody.previous_response_id = state.responseId;
    }
    // Include encrypted reasoning if requested
    if (includeReasoning) {
        requestBody.include = ["reasoning.encrypted_content"];
    }
    try {
        const response = await xaiApi.post("/responses", requestBody);
        const result = response.data;
        // Extract text content
        let textContent = "";
        let encryptedReasoning = "";
        for (const output of result.output || []) {
            if (output.content) {
                for (const content of output.content) {
                    if (content.type === "text" && content.text) {
                        textContent += content.text;
                    }
                }
            }
            if (output.reasoning?.encrypted_content) {
                encryptedReasoning = output.reasoning.encrypted_content;
            }
        }
        // Store conversation state for continuation
        if (storeConversation && result.id) {
            const newConversationId = conversationId || generateConversationId();
            conversationStore.set(newConversationId, {
                responseId: result.id,
                model,
                createdAt: new Date(),
                encryptedReasoning,
            });
        }
        const responseData = {
            response: textContent,
            model,
            conversation_id: conversationId || (storeConversation ? generateConversationId() : undefined),
            usage: result.usage,
        };
        if (encryptedReasoning) {
            responseData.encrypted_reasoning = encryptedReasoning;
        }
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(responseData, null, 2)
                }]
        };
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const statusCode = error.response?.status || 500;
            const errorMessage = error.response?.data?.error?.message || error.message;
            throw new McpError(ErrorCode.InternalError, `xAI API Error (${statusCode}): ${errorMessage}`);
        }
        throw error;
    }
}
async function handleLiveSearch(args) {
    const query = args?.query;
    const model = args?.model || DEFAULT_FAST_MODEL;
    const maxResults = Math.min(Math.max(args?.max_results || 10, 1), 20);
    const searchType = args?.search_type || "all";
    if (!query || typeof query !== "string") {
        throw new McpError(ErrorCode.InvalidParams, "A search query is required");
    }
    // Use Grok with live search enabled via a specialized prompt
    const searchPrompt = `You have access to real-time web search. Please search the web for: "${query}"

Provide a comprehensive summary of the current, most relevant results. Include:
1. Key findings and facts
2. Source references with URLs where available
3. Any recent news or updates related to this topic

Focus on ${searchType === "news" ? "recent news articles" : searchType === "web" ? "general web results" : "both news and general web content"}.
Limit your response to the ${maxResults} most relevant results.`;
    const requestBody = {
        model,
        input: [
            { role: "system", content: "You are a helpful assistant with access to real-time web search capabilities. Always provide current, accurate information with source references." },
            { role: "user", content: searchPrompt }
        ],
        store: false, // Don't store search queries
    };
    try {
        const response = await xaiApi.post("/responses", requestBody);
        const result = response.data;
        let searchResults = "";
        for (const output of result.output || []) {
            if (output.content) {
                for (const content of output.content) {
                    if (content.type === "text" && content.text) {
                        searchResults += content.text;
                    }
                }
            }
        }
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        query,
                        search_type: searchType,
                        model,
                        results: searchResults,
                        usage: result.usage
                    }, null, 2)
                }]
        };
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const statusCode = error.response?.status || 500;
            const errorMessage = error.response?.data?.error?.message || error.message;
            throw new McpError(ErrorCode.InternalError, `Search Error (${statusCode}): ${errorMessage}`);
        }
        throw error;
    }
}
async function handleImageGeneration(args) {
    const prompt = args?.prompt;
    const n = args?.n || 1;
    const responseFormat = args?.response_format || "url";
    if (!prompt || typeof prompt !== "string") {
        throw new McpError(ErrorCode.InvalidParams, "A text prompt is required");
    }
    if (n < 1 || n > 10 || !Number.isInteger(n)) {
        throw new McpError(ErrorCode.InvalidParams, "Number of images (n) must be an integer between 1 and 10");
    }
    if (responseFormat !== "url" && responseFormat !== "b64_json") {
        throw new McpError(ErrorCode.InvalidParams, "response_format must be either 'url' or 'b64_json'");
    }
    try {
        const response = await xaiApi.post("/images/generations", {
            model: DEFAULT_IMAGE_MODEL,
            prompt,
            n,
            response_format: responseFormat
        });
        const images = response.data.data;
        const revisedPrompt = images[0].revised_prompt || prompt;
        const result = {
            generated_images: images.map((img, index) => ({
                index,
                image_type: responseFormat,
                [responseFormat]: responseFormat === "url" ? img.url : img.b64_json
            })),
            revised_prompt: revisedPrompt,
            original_prompt: prompt,
            num_images: images.length,
            model: DEFAULT_IMAGE_MODEL
        };
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
        };
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const statusCode = error.response?.status || 500;
            const errorMessage = error.response?.data?.error?.message || error.message;
            throw new McpError(ErrorCode.InternalError, `Image Generation Error (${statusCode}): ${errorMessage}`);
        }
        throw error;
    }
}
async function handleVision(args) {
    const imageUrl = args?.image_url;
    const imageBase64 = args?.image_base64;
    const prompt = args?.prompt || "What is in this image?";
    const model = args?.model || DEFAULT_VISION_MODEL;
    const detail = args?.detail || "auto";
    if (!imageUrl && !imageBase64) {
        throw new McpError(ErrorCode.InvalidParams, "Either image_url or image_base64 is required");
    }
    // Build the image content
    const imageContent = {
        type: "input_image",
        detail
    };
    if (imageUrl) {
        imageContent.image_url = imageUrl;
    }
    else if (imageBase64) {
        // Detect image type from base64 or default to jpeg
        const mimeType = imageBase64.startsWith("/9j/") ? "image/jpeg" : "image/png";
        imageContent.image_url = `data:${mimeType};base64,${imageBase64}`;
    }
    const requestBody = {
        model,
        input: [
            {
                role: "user",
                content: [
                    imageContent,
                    { type: "input_text", text: prompt }
                ]
            }
        ],
        store: false, // Don't store image requests
    };
    try {
        const response = await xaiApi.post("/responses", requestBody);
        const result = response.data;
        let analysis = "";
        for (const output of result.output || []) {
            if (output.content) {
                for (const content of output.content) {
                    if (content.type === "text" && content.text) {
                        analysis += content.text;
                    }
                }
            }
        }
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        analysis,
                        model,
                        detail,
                        prompt,
                        usage: result.usage
                    }, null, 2)
                }]
        };
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const statusCode = error.response?.status || 500;
            const errorMessage = error.response?.data?.error?.message || error.message;
            throw new McpError(ErrorCode.InternalError, `Vision Error (${statusCode}): ${errorMessage}`);
        }
        throw error;
    }
}
async function handleVoice(args) {
    const text = args?.text;
    const voice = args?.voice || "alloy";
    const speed = args?.speed || 1.0;
    const responseFormat = args?.response_format || "mp3";
    if (!text || typeof text !== "string") {
        throw new McpError(ErrorCode.InvalidParams, "Text is required for voice synthesis");
    }
    if (speed < 0.25 || speed > 4.0) {
        throw new McpError(ErrorCode.InvalidParams, "Speed must be between 0.25 and 4.0");
    }
    try {
        const response = await xaiApi.post("/audio/speech", {
            model: "tts-1",
            input: text,
            voice,
            speed,
            response_format: responseFormat
        }, {
            responseType: "arraybuffer"
        });
        const audioBase64 = Buffer.from(response.data).toString("base64");
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        audio_base64: audioBase64,
                        format: responseFormat,
                        voice,
                        speed,
                        text_length: text.length
                    }, null, 2)
                }]
        };
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const statusCode = error.response?.status || 500;
            const errorMessage = error.response?.data?.error?.message || error.message;
            // If voice API is not available, provide a helpful message
            if (statusCode === 404) {
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                error: "Voice synthesis API not available",
                                message: "The xAI voice/audio API may not be available for your account or model. Please check your API access.",
                                text_provided: text
                            }, null, 2)
                        }]
                };
            }
            throw new McpError(ErrorCode.InternalError, `Voice Error (${statusCode}): ${errorMessage}`);
        }
        throw error;
    }
}
async function handleConversation(args) {
    const action = args?.action;
    const conversationId = args?.conversation_id;
    const message = args?.message;
    if (!action) {
        throw new McpError(ErrorCode.InvalidParams, "Action is required");
    }
    switch (action) {
        case "list": {
            const conversations = Array.from(conversationStore.entries()).map(([id, state]) => ({
                conversation_id: id,
                model: state.model,
                created_at: state.createdAt.toISOString(),
                has_reasoning: !!state.encryptedReasoning
            }));
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({ conversations, count: conversations.length }, null, 2)
                    }]
            };
        }
        case "get": {
            if (!conversationId) {
                throw new McpError(ErrorCode.InvalidParams, "conversation_id is required for 'get' action");
            }
            const state = conversationStore.get(conversationId);
            if (!state) {
                throw new McpError(ErrorCode.InvalidParams, `Conversation not found: ${conversationId}`);
            }
            // Try to retrieve from server
            try {
                const response = await xaiClient.responses.retrieve(state.responseId);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                conversation_id: conversationId,
                                response_id: state.responseId,
                                model: state.model,
                                created_at: state.createdAt.toISOString(),
                                response_data: response
                            }, null, 2)
                        }]
                };
            }
            catch (error) {
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                conversation_id: conversationId,
                                response_id: state.responseId,
                                model: state.model,
                                created_at: state.createdAt.toISOString(),
                                note: "Could not retrieve full response from server"
                            }, null, 2)
                        }]
                };
            }
        }
        case "continue": {
            if (!conversationId) {
                throw new McpError(ErrorCode.InvalidParams, "conversation_id is required for 'continue' action");
            }
            if (!message) {
                throw new McpError(ErrorCode.InvalidParams, "message is required for 'continue' action");
            }
            return await handleGrokChat({
                message,
                conversation_id: conversationId,
                store_conversation: true
            });
        }
        case "delete": {
            if (!conversationId) {
                throw new McpError(ErrorCode.InvalidParams, "conversation_id is required for 'delete' action");
            }
            const state = conversationStore.get(conversationId);
            if (!state) {
                throw new McpError(ErrorCode.InvalidParams, `Conversation not found: ${conversationId}`);
            }
            // Try to delete from server
            try {
                await xaiClient.responses.del(state.responseId);
            }
            catch (error) {
                // Ignore deletion errors from server
            }
            conversationStore.delete(conversationId);
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({ deleted: conversationId, success: true }, null, 2)
                    }]
            };
        }
        default:
            throw new McpError(ErrorCode.InvalidParams, `Unknown action: ${action}`);
    }
}
async function handleReasoning(args) {
    const problem = args?.problem;
    const model = args?.model || "grok-4";
    const reasoningEffort = args?.reasoning_effort;
    const returnEncryptedReasoning = args?.return_encrypted_reasoning ?? true;
    const previousReasoning = args?.previous_reasoning;
    if (!problem || typeof problem !== "string") {
        throw new McpError(ErrorCode.InvalidParams, "A problem description is required");
    }
    // Only grok-3-mini supports reasoning_effort
    if (reasoningEffort && model !== "grok-3-mini") {
        throw new McpError(ErrorCode.InvalidParams, "reasoning_effort is only supported by grok-3-mini");
    }
    const systemPrompt = `You are a highly intelligent AI assistant specialized in reasoning and problem-solving. Think through problems step-by-step before delivering an answer. Show your work and explain your reasoning clearly.`;
    const requestBody = {
        model,
        input: [
            { role: "system", content: systemPrompt },
            { role: "user", content: problem }
        ],
        store: true,
    };
    // Include encrypted reasoning if requested
    if (returnEncryptedReasoning) {
        requestBody.include = ["reasoning.encrypted_content"];
    }
    // Add reasoning effort for grok-3-mini
    if (reasoningEffort && model === "grok-3-mini") {
        requestBody.reasoning = { effort: reasoningEffort };
    }
    // Include previous reasoning context if provided
    if (previousReasoning) {
        requestBody.input.unshift({
            role: "assistant",
            content: [],
            reasoning: { encrypted_content: previousReasoning }
        });
    }
    try {
        const response = await xaiApi.post("/responses", requestBody);
        const result = response.data;
        let reasoningOutput = "";
        let encryptedReasoning = "";
        for (const output of result.output || []) {
            if (output.content) {
                for (const content of output.content) {
                    if (content.type === "text" && content.text) {
                        reasoningOutput += content.text;
                    }
                }
            }
            if (output.reasoning?.encrypted_content) {
                encryptedReasoning = output.reasoning.encrypted_content;
            }
        }
        const responseData = {
            solution: reasoningOutput,
            model,
            problem,
            usage: result.usage
        };
        if (encryptedReasoning) {
            responseData.encrypted_reasoning = encryptedReasoning;
            responseData.reasoning_note = "Store this encrypted_reasoning to continue context in future requests";
        }
        if (result.usage?.reasoning_tokens) {
            responseData.reasoning_tokens = result.usage.reasoning_tokens;
        }
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(responseData, null, 2)
                }]
        };
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const statusCode = error.response?.status || 500;
            const errorMessage = error.response?.data?.error?.message || error.message;
            throw new McpError(ErrorCode.InternalError, `Reasoning Error (${statusCode}): ${errorMessage}`);
        }
        throw error;
    }
}
// =============================================================================
// Utility Functions
// =============================================================================
function generateConversationId() {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
// =============================================================================
// Server Startup
// =============================================================================
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Grok MCP Server v1.0.0 running on stdio");
    console.error(`Available models: ${AVAILABLE_MODELS.chat.join(", ")}`);
    console.error(`Default chat model: ${DEFAULT_CHAT_MODEL}`);
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
