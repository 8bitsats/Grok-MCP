# Grok MCP Server

A comprehensive MCP (Model Context Protocol) server providing access to xAI's Grok AI models with advanced capabilities including chat, image generation, vision/image understanding, live web search, voice synthesis, and encrypted reasoning.

## Features

- **Chat Completions**: Interact with Grok 4, Grok 4 Fast Reasoning, Grok 3, and Grok 3 Mini models
- **Live Web Search**: Real-time web search with Grok's internet access capabilities
- **Image Generation**: Generate images using Grok-2-image model
- **Vision/Image Understanding**: Analyze and understand images using Grok's vision capabilities
- **Voice Synthesis**: Convert text to speech (when available)
- **Encrypted Reasoning**: Chain-of-thought reasoning with encrypted content for context continuity
- **Conversation Management**: Stateful conversations using the Responses API (stored for 30 days)

## Prerequisites

- Node.js 18+
- xAI API Key (get one at [console.x.ai](https://console.x.ai))

## Installation

```bash
# Clone the repository
git clone https://github.com/8bitsats/Grok-MCP.git
cd Grok-MCP

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

Set your xAI API key as an environment variable:

```bash
export XAI_API_KEY="your_api_key_here"
```

Optional environment variables:
- `GROK_MODEL` - Default chat model (default: `grok-4`)
- `GROK_FAST_MODEL` - Default fast model for search (default: `grok-4-fast-reasoning`)

## Available Tools

### 1. `grok_chat`
Chat with Grok AI models with optional conversation persistence.

**Parameters:**
- `message` (required): The message to send
- `model`: Model to use (`grok-4`, `grok-4-fast-reasoning`, `grok-3`, `grok-3-mini`)
- `system_prompt`: Custom system prompt
- `conversation_id`: ID to continue a previous conversation
- `include_reasoning`: Include encrypted reasoning content
- `store_conversation`: Store conversation for later continuation (default: true)

### 2. `grok_live_search`
Perform live web searches with real-time internet access.

**Parameters:**
- `query` (required): The search query
- `model`: Model for search synthesis
- `max_results`: Maximum results (1-20, default: 10)
- `search_type`: `web`, `news`, or `all`

### 3. `generate_image`
Generate images from text prompts.

**Parameters:**
- `prompt` (required): Description of the image to generate
- `n`: Number of images (1-10, default: 1)
- `response_format`: `url` or `b64_json`

### 4. `grok_vision`
Analyze and understand images.

**Parameters:**
- `image_url`: URL of the image to analyze
- `image_base64`: Base64-encoded image data (alternative to URL)
- `prompt`: Question about the image (default: "What is in this image?")
- `model`: Vision model to use
- `detail`: Detail level (`auto`, `low`, `high`)

### 5. `grok_voice`
Generate speech from text.

**Parameters:**
- `text` (required): Text to convert to speech
- `voice`: Voice style (`alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`)
- `speed`: Speech speed (0.25-4.0)
- `response_format`: Audio format (`mp3`, `opus`, `aac`, `flac`, `wav`)

### 6. `grok_reason`
Complex reasoning with encrypted thought chains.

**Parameters:**
- `problem` (required): The problem to analyze
- `model`: Model to use (grok-3-mini supports `reasoning_effort`)
- `reasoning_effort`: `low` or `high` (grok-3-mini only)
- `return_encrypted_reasoning`: Return encrypted content for chaining
- `previous_reasoning`: Encrypted reasoning from previous response

### 7. `grok_conversation`
Manage stored conversations.

**Parameters:**
- `action` (required): `list`, `get`, `continue`, or `delete`
- `conversation_id`: ID of conversation (required for get/continue/delete)
- `message`: New message (required for continue)

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "grok-mcp": {
      "command": "node",
      "args": ["/path/to/Grok-MCP/build/index.js"],
      "env": {
        "XAI_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Docker Support

```bash
# Build the image
docker build -t grok-mcp .

# Run the container
docker run -e XAI_API_KEY=your_api_key grok-mcp
```

## Example Usage

### Chat with Grok
```
Use grok_chat to ask: "What is the meaning of life?"
```

### Generate an Image
```
Use generate_image with prompt: "A futuristic city at sunset with flying cars"
```

### Analyze an Image
```
Use grok_vision with image_url: "https://example.com/image.jpg"
and prompt: "Describe what you see in detail"
```

### Live Web Search
```
Use grok_live_search with query: "Latest AI developments 2026"
```

### Complex Reasoning
```
Use grok_reason with problem: "Prove that the square root of 2 is irrational"
```

## API Response Format

All tools return JSON-formatted responses with relevant data and usage statistics.

### Chat Response Example:
```json
{
  "response": "The meaning of life...",
  "model": "grok-4",
  "conversation_id": "conv_1234567890_abc123",
  "usage": {
    "input_tokens": 25,
    "output_tokens": 150
  }
}
```

### Reasoning Response Example:
```json
{
  "solution": "To prove √2 is irrational...",
  "model": "grok-4",
  "encrypted_reasoning": "eyJ...",
  "reasoning_note": "Store this encrypted_reasoning to continue context",
  "reasoning_tokens": 500
}
```

## Available Models

| Model | Capabilities |
|-------|-------------|
| `grok-4` | Full capabilities, vision, encrypted reasoning |
| `grok-4-fast-reasoning` | Fast reasoning, vision, encrypted reasoning |
| `grok-3` | Chat, vision |
| `grok-3-mini` | Chat, configurable reasoning effort |
| `grok-2-image` | Image generation |

## Notes

- Conversations are stored on xAI servers for 30 days
- Image inputs should not be stored (automatically disabled)
- The `reasoning_effort` parameter only works with `grok-3-mini`
- Voice synthesis availability depends on your API access level

## License

MIT
