<p align="center"><img src="https://raw.githubusercontent.com/pixlcore/xyplug-ai/refs/heads/main/logo.png" height="120" alt="AI"/></p>
<h1 align="center">AI Generation Plugin</h1>

An AI generation event plugin for the [xyOps Workflow Automation System](https://xyops.io). This plugin sends prompts to AI providers using the [Vercel AI SDK](https://sdk.vercel.ai/providers) and can generate either text/JSON output or one or more images.

## Requirements

- **Node.js + npx**
	- Required to run the plugin via `npx`.
- **git**
	- Required if you run the plugin via the GitHub `npx` install path.
- **AI Provider Credentials**
	- You will need an API key for your chosen provider (unless you are using a local service).

## Environment Variables

Create a [Secret Vault](https://xyops.io/docs/secrets) in xyOps and assign this Plugin to it. Add one of the following variables:

- `AI_API_KEY` (preferred cross-provider key)
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `XAI_API_KEY`
- `GROQ_API_KEY`
- `DEEPSEEK_API_KEY`
- `MISTRAL_API_KEY`
- `COHERE_API_KEY`
- `LOCAL_API_KEY`

If both `AI_API_KEY` and a provider-specific key are present, the provider-specific key takes precedence.

For local OpenAI-compatible endpoints (like Ollama), set the **AI Base URL** and omit API keys if your endpoint does not require one.

## Plugin Parameters

The plugin uses a **Tool Select** menu to switch between two modes: **Text / JSON Generation** and **Image Generation**.

### Text / JSON Generation

- **AI Provider/Model**: Provider and model name in the form `provider/model` (e.g. `openai/gpt-5.1`, `anthropic/claude-3-5-sonnet`, `google/gemini-1.5-pro`). If you set **AI Base URL**, enter the model name only (no provider prefix).
- **AI Base URL**: Optional custom base URL for OpenAI-compatible endpoints (e.g. Ollama at `http://localhost:11434/v1`). When set, the plugin uses the local OpenAI-compatible provider and treats the model string as-is.
- **Prompt**: The text prompt sent to the model.
- **System Prompt**: Optional system prompt to include with the request.
- **Temperature / Top P / Max Tokens**: Optional tuning parameters.
- **Stop Sequences**: Optional list of stop sequences (comma separated).
- **Expect JSON**: Fail the job if the response is not valid JSON.
- **Timeout (ms)**: Maximum time to wait for the model response.

### Image Generation

- **AI Provider/Model**: Provider and image model name in the form `provider/model` (e.g. `openai/gpt-image-1`).
- **AI Base URL**: Optional custom base URL for OpenAI-compatible endpoints.
- **Prompt**: The text prompt sent to the image model.
- **Image Count**: Number of images to generate.
- **Image Width / Image Height**: Desired output size in pixels.
- **Seed**: Optional seed for reproducible results.
- **Timeout (ms)**: Maximum time to wait for the image response.

## Response Handling

- **Text Mode:** If the model response is valid JSON (including JSON inside a fenced code block), the plugin parses it and returns the parsed object/array directly in the job output `data`. Otherwise, the plugin returns `{ "text": "..." }` in `data`.
- **Image Mode:** The plugin attaches the generated image files to the job output.

## Using Local Models

To use a local OpenAI-compatible server (like Ollama), set **AI Base URL** and provide the model name without a provider prefix, e.g. `qwen2.5-7b-instruct-1m`.

## Usage Examples

Text mode example parameters:

```
Tool Select: Text / JSON Generation
AI Provider/Model: openai/gpt-5.1
Prompt: Write a haiku about automation.
System Prompt: You are a helpful assistant.
Temperature: 0.2
Max Tokens: 128
```

OpenAI-compatible local example (e.g. Ollama):

```
Tool Select: Text / JSON Generation
AI Base URL: http://localhost:11434/v1
AI Model: qwen2.5-7b-instruct-1m
Prompt: Return JSON with an array of three task names.
Expect JSON: true
```

Image mode example parameters:

```
Tool Select: Image Generation
AI Provider/Model: openai/gpt-image-1
Prompt: A playful robot juggling oranges in a neon-lit kitchen.
Image Count: 2
Image Width: 1024
Image Height: 1024
```

## Local Testing

When invoked by xyOps the script expects JSON input via STDIN. You can simulate this locally with a JSON file.

Example input file for text generation:

```json
{
	"params": {
		"tool": "text",
		"model": "openai/gpt-5.1",
		"prompt": "Return JSON with a greeting and a timestamp.",
		"expect_json": true
	}
}
```

Example input file for image generation:

```json
{
	"params": {
		"tool": "image",
		"model": "openai/gpt-image-1",
		"prompt": "A corgi riding a skateboard.",
		"width": 1024,
		"height": 1024
	}
}
```

Example command:

```sh
export AI_API_KEY="your-ai-provider-key"
cat input.json | node index.js
```

## Data Collection

This plugin does not collect or transmit any data outside of the configured AI provider endpoint. The selected AI provider may collect usage metrics according to its own terms.

## License

MIT
