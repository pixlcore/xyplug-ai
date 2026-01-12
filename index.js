#!/usr/bin/env node

import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createCohere } from "@ai-sdk/cohere";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createXai } from "@ai-sdk/xai";

globalThis.AI_SDK_LOG_WARNINGS = false;

// Map provider names to their Vercel AI SDK factory functions.
const PROVIDERS = {
	anthropic: createAnthropic,
	cohere: createCohere,
	deepseek: createDeepSeek,
	google: createGoogleGenerativeAI,
	groq: createGroq,
	mistral: createMistral,
	openai: createOpenAI,
	local: createOpenAICompatible,
	xai: createXai
};

// Provider-specific API key environment variables.
const PROVIDER_ENV = {
	anthropic: "ANTHROPIC_API_KEY",
	cohere: "COHERE_API_KEY",
	deepseek: "DEEPSEEK_API_KEY",
	google: "GOOGLE_API_KEY",
	groq: "GROQ_API_KEY",
	mistral: "MISTRAL_API_KEY",
	openai: "OPENAI_API_KEY",
	local: "LOCAL_API_KEY",
	xai: "XAI_API_KEY"
};

// Providers that often run locally and may not require an API key.
const OPTIONAL_KEY_PROVIDERS = new Set();

// Emit a final XYWP message and exit.
function writeExit(payload) {
	process.stdout.write(`${JSON.stringify(payload)}\n`, () => process.exit(0));
}

// Emit an error response and exit.
function fail(code, description) {
	return writeExit({ xy: 1, code, description });
}

// Read and parse the job payload from STDIN.
async function readJob() {
	const chunks = [];
	for await (const chunk of process.stdin) chunks.push(chunk);
	const raw = chunks.join("").trim();
	if (!raw) return fail("input", "No JSON input received on STDIN.");
	try {
		return JSON.parse(raw);
	}
	catch (err) {
		return fail("input", `Failed to parse JSON input: ${err.message}`);
	}
}

// Convert user-provided numeric params safely.
function parseNumber(value, fallback) {
	if (value === undefined || value === null || value === "") return fallback;
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
}

// Normalize stop sequences to an array of strings.
function parseStopSequences(value) {
	if (!value) return undefined;
	if (Array.isArray(value)) return value.map(String).filter(Boolean);
	const parts = String(value)
		.split(/\r?\n|,/)
		.map((part) => part.trim())
		.filter(Boolean);
	return parts.length ? parts : undefined;
}

// Detect JSON responses, including fenced code blocks.
function extractJson(text) {
	if (!text) return { parsed: null, jsonText: null };
	let candidate = text.trim();
	const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	if (fenced) candidate = fenced[1].trim();
	if (!candidate) return { parsed: null, jsonText: null };
	if (!((candidate.startsWith("{") && candidate.endsWith("}")) || (candidate.startsWith("[") && candidate.endsWith("]")))) {
		return { parsed: null, jsonText: null };
	}
	try {
		return { parsed: JSON.parse(candidate), jsonText: candidate };
	}
	catch {
		return { parsed: null, jsonText: candidate };
	}
}

// Parse "provider/model" into its components, or return null if absent.
function normalizeModel(value) {
	const raw = String(value || "").trim();
	if (!raw) return null;
	const parts = raw.split("/");
	if (parts.length < 2) return null;
	const provider = parts.shift().toLowerCase();
	const model = parts.join("/");
	return { provider, model };
}

// Resolve the provider API key, preferring provider-specific keys.
function resolveApiKey(provider) {
	return process.env[PROVIDER_ENV[provider]] || process.env.AI_API_KEY || "";
}

// Instantiate the provider with optional API key and base URL.
function buildProvider(provider, apiKey, baseURL) {
	const factory = PROVIDERS[provider];
	if (!factory) return null;
	const opts = {};
	if (apiKey) opts.apiKey = apiKey;
	if (baseURL) opts.baseURL = baseURL;

	if (provider === "local") {
		const instance = factory({
			...opts,
			name: "local"
		});
		return (modelName) => instance.chatModel(modelName);
	}

	return factory(opts);
}

// Main execution flow.
(async () => {
	const job = await readJob();
	const params = job.params || {};
	const prompt = params.prompt || "";
	if (!prompt.trim()) return fail("params", "Required parameter 'prompt' was not provided.");

	const baseURL = params.base_url ? String(params.base_url).trim() : "";
	const modelRaw = String(params.model || "").trim();
	if (!modelRaw) return fail("params", "Required parameter 'model' was not provided.");

	let providerName = "";
	let modelName = "";

	if (baseURL) {
		// If a base URL is specified, always use the local (OpenAI-compatible) provider.
		providerName = "local";
		modelName = modelRaw.toLowerCase().startsWith("local/") ? modelRaw.slice(6) : modelRaw;
	}
	else {
		const modelInfo = normalizeModel(modelRaw);
		if (!modelInfo) {
			return fail("params", "Parameter 'model' must be in the form 'provider/model'.");
		}
		providerName = modelInfo.provider;
		modelName = modelInfo.model;
	}

	const apiKey = resolveApiKey(providerName);

	if (providerName === "local" && !baseURL) {
		return fail("params", "Parameter 'base_url' is required for provider 'local'.");
	}

	if (!apiKey && !baseURL && !OPTIONAL_KEY_PROVIDERS.has(providerName)) {
		const envName = PROVIDER_ENV[providerName] || "AI_API_KEY";
		return fail("env", `Missing API key. Set ${envName} or AI_API_KEY.`);
	}

	const provider = buildProvider(providerName, apiKey, baseURL);
	if (!provider) {
		const supported = Object.keys(PROVIDERS).sort().join(", ");
		return fail("params", `Unsupported provider '${providerName}'. Supported providers: ${supported}.`);
	}

	const model = provider(modelName);
	const temperature = parseNumber(params.temperature, undefined);
	const maxTokens = parseNumber(params.max_tokens, undefined);
	const topP = parseNumber(params.top_p, undefined);
	const stopSequences = parseStopSequences(params.stop_sequences);
	const system = params.system_prompt ? String(params.system_prompt) : undefined;
	const expectJson = String(params.expect_json || "").toLowerCase() === "true" || params.expect_json === true;
	const timeoutMs = parseNumber(params.timeout_ms, 60000);

	// Enforce a hard timeout for the AI request.
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(new Error("AI request timed out")), timeoutMs);

	let result;
	try {
		// Send the prompt to the model.
		result = await generateText({
			model,
			prompt,
			system,
			temperature,
			maxTokens,
			topP,
			stopSequences,
			abortSignal: controller.signal
		});
	}
	finally {
		clearTimeout(timeout);
	}

	const text = result && typeof result.text === "string" ? result.text : "";
	const jsonResult = extractJson(text);

	// Optionally enforce JSON output from the model.
	if (expectJson && !jsonResult.parsed) {
		const detail = jsonResult.jsonText ? "Invalid JSON returned by model." : "No JSON returned by model.";
		return fail("json", detail);
	}

	// Return parsed JSON if available, otherwise return plain text.
	const data = jsonResult.parsed ? jsonResult.parsed : { text };
	writeExit({ xy: 1, code: 0, data });
	
})().catch((err) => {
	// Catch-all handler for unexpected errors.
	return fail("error", err && err.message ? err.message : "Unknown error");
});
