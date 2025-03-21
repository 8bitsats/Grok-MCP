#!/usr/bin/env node
/**
 * Grok Image Generator MCP Server
 * Implements AI image generation capabilities using the xAI/Grok API.
 * Provides tools for generating images based on text prompts.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError, } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
/**
 * Retrieve the xAI API key from environment variables.
 * This must be provided in the MCP server configuration.
 */
const XAI_API_KEY = process.env.XAI_API_KEY;
if (!XAI_API_KEY) {
    throw new Error("XAI_API_KEY environment variable is required");
}
/**
 * Create an MCP server with capabilities for AI image generation tools.
 */
const server = new Server({
    name: "grokart",
    version: "0.1.0",
}, {
    capabilities: {
        tools: {},
    },
});
/**
 * Axios instance for making API calls to xAI API.
 */
const xaiApi = axios.create({
    baseURL: "https://api.x.ai/v1",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${XAI_API_KEY}`,
    },
});
/**
 * Handler that lists available tools.
 * Exposes image generation tool that let clients generate images.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "generate_image",
                description: "Generate images using Grok-2-image model based on a text prompt",
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
                            maximum: 10,
                            default: 1
                        },
                        response_format: {
                            type: "string",
                            description: "Format of the generated images ('url' or 'b64_json')",
                            enum: ["url", "b64_json"],
                            default: "url"
                        }
                    },
                    required: ["prompt"]
                }
            }
        ]
    };
});
/**
 * Handler for the generate_image tool.
 * Calls the xAI API to generate images based on the provided prompt.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "generate_image") {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }
    // Extract and validate parameters
    const args = request.params.arguments;
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
        // Make API call to xAI image generation endpoint
        const response = await xaiApi.post("/images/generations", {
            model: "grok-2-image",
            prompt,
            n,
            response_format: responseFormat
        });
        // Format the response to send back to the client
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
            num_images: images.length
        };
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
        };
    }
    catch (error) {
        console.error("Error calling xAI API:", error);
        if (axios.isAxiosError(error)) {
            const statusCode = error.response?.status || 500;
            const errorMessage = error.response?.data?.error?.message || error.message;
            throw new McpError(ErrorCode.InternalError, `xAI API Error (${statusCode}): ${errorMessage}`);
        }
        throw new McpError(ErrorCode.InternalError, `Error generating image: ${String(error)}`);
    }
});
/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Grok Image Generator MCP server running on stdio");
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
