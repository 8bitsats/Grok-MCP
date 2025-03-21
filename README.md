Grok AI Image Generation MCP Server 


AI Image Generation MCP Server

A server that connects to the xAI/Grok image generation API
Implemented proper error handling with lazy API key initialization
Added support for multiple image generation (up to 10 images)
Added support for different response formats (URL or base64 JSON)
Docker Support:

Added a Dockerfile to containerize the MCP server
Configured the Dockerfile with a dummy API key that can be overridden at runtime
Set up proper layer caching for efficient builds
MCP Tools Available:

generate_image: Generate images using the Grok-2-image model
set_api_key: Set the xAI API key at runtime if not provided via environment variable
How to Use
You can now generate images with prompts like:

"Generate an image of a cat in a space suit"
"Create a picture of a futuristic city at night"
The MCP server has been configured in your Claude desktop app, and the implementation handles API key management gracefully, allowing the server to start even without an API key initially set.

If you want to run the server in Docker, you can build and run it with:

cd /Users/8bit/Documents/Cline/MCP/ai-image-generator
docker build -t grokart .
docker run -e XAI_API_KEY=your-api-key -p 8080:8080 grokart
