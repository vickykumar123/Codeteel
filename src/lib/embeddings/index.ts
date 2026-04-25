// Embedding client for multiple providers
// All providers configured to output 1536 dimensions

export type EmbeddingProvider = 'openai' | 'gemini' | 'mistral' | 'voyage' | 'cohere';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  apiKey: string;
  model?: string;
}

interface ProviderConfig {
  defaultModel: string;
  endpoint: string;
  dimensions: number;
}

const PROVIDER_CONFIGS: Record<EmbeddingProvider, ProviderConfig> = {
  openai: {
    defaultModel: 'text-embedding-3-small',
    endpoint: 'https://api.openai.com/v1/embeddings',
    dimensions: 1536,
  },
  gemini: {
    defaultModel: 'text-embedding-004',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    dimensions: 1536,
  },
  mistral: {
    defaultModel: 'mistral-embed',
    endpoint: 'https://api.mistral.ai/v1/embeddings',
    dimensions: 1536,
  },
  voyage: {
    defaultModel: 'voyage-code-2',
    endpoint: 'https://api.voyageai.com/v1/embeddings',
    dimensions: 1536,
  },
  cohere: {
    defaultModel: 'embed-english-v3.0',
    endpoint: 'https://api.cohere.ai/v1/embed',
    dimensions: 1536,
  },
};

export async function generateEmbedding(
  config: EmbeddingConfig,
  text: string
): Promise<number[]> {
  if (!config.apiKey) {
    throw new Error(`${config.provider} API key not configured for embeddings`);
  }

  const providerConfig = PROVIDER_CONFIGS[config.provider];
  const model = config.model || providerConfig.defaultModel;

  switch (config.provider) {
    case 'openai':
      return embedOpenAI(config.apiKey, model, text);
    case 'gemini':
      return embedGemini(config.apiKey, model, text);
    case 'mistral':
      return embedMistral(config.apiKey, model, text);
    case 'voyage':
      return embedVoyage(config.apiKey, model, text);
    case 'cohere':
      return embedCohere(config.apiKey, model, text);
    default:
      throw new Error(`Unsupported embedding provider: ${config.provider}`);
  }
}

export async function generateEmbeddings(
  config: EmbeddingConfig,
  texts: string[]
): Promise<number[][]> {
  // Batch embedding for providers that support it
  if (!config.apiKey) {
    throw new Error(`${config.provider} API key not configured for embeddings`);
  }

  const model = config.model || PROVIDER_CONFIGS[config.provider].defaultModel;

  switch (config.provider) {
    case 'openai':
      return embedOpenAIBatch(config.apiKey, model, texts);
    case 'voyage':
      return embedVoyageBatch(config.apiKey, model, texts);
    case 'cohere':
      return embedCohereBatch(config.apiKey, model, texts);
    default:
      // Fallback to sequential for providers without batch support
      return Promise.all(texts.map(text => generateEmbedding(config, text)));
  }
}

// ===========================================
// OpenAI
// ===========================================

async function embedOpenAI(
  apiKey: string,
  model: string,
  text: string
): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
      dimensions: 1536,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI embedding error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function embedOpenAIBatch(
  apiKey: string,
  model: string,
  texts: string[]
): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: texts,
      dimensions: 1536,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI embedding error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  // Sort by index to ensure correct order
  return data.data
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((item: { embedding: number[] }) => item.embedding);
}

// ===========================================
// Google Gemini
// ===========================================

async function embedGemini(
  apiKey: string,
  model: string,
  text: string
): Promise<number[]> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: `models/${model}`,
      content: {
        parts: [{ text }],
      },
      outputDimensionality: 1536,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini embedding error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

// ===========================================
// Mistral AI
// ===========================================

async function embedMistral(
  apiKey: string,
  model: string,
  text: string
): Promise<number[]> {
  const response = await fetch('https://api.mistral.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [text],
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Mistral embedding error: ${error.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// ===========================================
// Voyage AI
// ===========================================

async function embedVoyage(
  apiKey: string,
  model: string,
  text: string
): Promise<number[]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
      input_type: 'document',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Voyage embedding error: ${error.detail || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function embedVoyageBatch(
  apiKey: string,
  model: string,
  texts: string[]
): Promise<number[][]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: texts,
      input_type: 'document',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Voyage embedding error: ${error.detail || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.data.map((item: { embedding: number[] }) => item.embedding);
}

// ===========================================
// Cohere
// ===========================================

async function embedCohere(
  apiKey: string,
  model: string,
  text: string
): Promise<number[]> {
  const response = await fetch('https://api.cohere.ai/v1/embed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      texts: [text],
      input_type: 'search_document',
      truncate: 'END',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Cohere embedding error: ${error.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.embeddings[0];
}

async function embedCohereBatch(
  apiKey: string,
  model: string,
  texts: string[]
): Promise<number[][]> {
  const response = await fetch('https://api.cohere.ai/v1/embed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      texts,
      input_type: 'search_document',
      truncate: 'END',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Cohere embedding error: ${error.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.embeddings;
}

// ===========================================
// Utility
// ===========================================

export function getDefaultModel(provider: EmbeddingProvider): string {
  return PROVIDER_CONFIGS[provider].defaultModel;
}

export function getSupportedProviders(): EmbeddingProvider[] {
  return Object.keys(PROVIDER_CONFIGS) as EmbeddingProvider[];
}
