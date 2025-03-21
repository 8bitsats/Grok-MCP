# Docker Setup for GrokArt

This document explains how to run the GrokArt MCP server using Docker.

## Overview

GrokArt is an MCP server that implements AI image generation capabilities using the xAI/Grok API. It provides tools for generating images based on text prompts.

## Prerequisites

- Docker and Docker Compose installed on your system
- Valid xAI API key

## Getting Started

### Environment Variables

The application requires an xAI API key. Create or update your `.env` file with:

```
X_AI_API_KEY=your-xai-api-key
```

### Building and Running with Docker

1. Build and start the container:

```bash
docker-compose up -d
```

2. View logs:

```bash
docker-compose logs -f
```

3. Stop the container:

```bash
docker-compose down
```

## Manual Docker Commands

If you prefer not to use Docker Compose:

1. Build the Docker image:

```bash
docker build -t grokart .
```

2. Run the container:

```bash
docker run -d --env-file .env --name grokart-container grokart
```

3. Stop the container:

```bash
docker stop grokart-container
```

## Debugging

If you encounter any issues:

1. Check the logs:

```bash
docker logs grokart-container
```

2. Verify your API key is correctly set in the .env file

3. Make sure the environment variable is correctly named `X_AI_API_KEY`

## MCP Integration

This container runs the GrokArt MCP server which can be integrated with any MCP client. Follow the MCP documentation for connecting this server to your client application.
