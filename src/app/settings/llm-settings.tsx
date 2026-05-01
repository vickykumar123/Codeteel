"use client";

import { useState, useEffect } from "react";

// ===========================================
// TYPES
// ===========================================

interface LLMProviderConfig {
  id?: string;
  provider: string;
  api_key: string;
  base_url: string;
  model: string;
  is_active: boolean;
}

interface LLMSettingsProps {
  initialProviders: LLMProviderConfig[];
  initialPlatformProviders: LLMProviderConfig[];
  initialEmbeddingProvider: string;
  initialEmbeddingApiKey: string;
  initialEmbeddingModel: string;
}

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

// ===========================================
// PROVIDER METADATA
// ===========================================

const LLM_PROVIDERS = [
  { id: "ollama", name: "Ollama (Local)", description: "Free, private, runs on your machine", defaultUrl: "http://localhost:11434/v1", needsKey: false },
  { id: "openai", name: "OpenAI", description: "GPT models", defaultUrl: "https://api.openai.com/v1", needsKey: true },
  { id: "claude", name: "Anthropic Claude", description: "Claude models", defaultUrl: "https://api.anthropic.com/v1", needsKey: true },
  { id: "gemini", name: "Google Gemini", description: "Gemini models", defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai", needsKey: true },
  { id: "grok", name: "xAI Grok", description: "Grok models", defaultUrl: "https://api.x.ai/v1", needsKey: true },
  { id: "qwen", name: "Alibaba Qwen", description: "Qwen models", defaultUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", needsKey: true },
  { id: "fireworks", name: "Fireworks AI", description: "Fast open-source models", defaultUrl: "https://api.fireworks.ai/inference/v1", needsKey: true },
  { id: "together", name: "Together AI", description: "Open-source models", defaultUrl: "https://api.together.xyz/v1", needsKey: true },
];

const EMBEDDING_PROVIDERS = [
  { id: "openai", name: "OpenAI", defaultModel: "text-embedding-3-small", price: "$0.02/1M tokens" },
  { id: "gemini", name: "Google Gemini", defaultModel: "text-embedding-004", price: "$0.015/1M tokens" },
  { id: "mistral", name: "Mistral AI", defaultModel: "mistral-embed", price: "$0.10/1M tokens" },
  { id: "voyage", name: "Voyage AI", defaultModel: "voyage-code-2", price: "$0.12/1M tokens" },
  { id: "cohere", name: "Cohere", defaultModel: "embed-english-v3.0", price: "$0.10/1M tokens" },
];

// ===========================================
// COMPONENT
// ===========================================

// Cloud-only providers (no Ollama) for platform use
const PLATFORM_PROVIDERS = LLM_PROVIDERS.filter(p => p.id !== "ollama");

export function LLMSettings({
  initialProviders,
  initialPlatformProviders,
  initialEmbeddingProvider,
  initialEmbeddingApiKey,
  initialEmbeddingModel,
}: LLMSettingsProps) {
  // LLM providers state
  const [providers, setProviders] = useState<LLMProviderConfig[]>(initialProviders);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LLMProviderConfig>({ provider: "", api_key: "", base_url: "", model: "", is_active: false });
  const [addingNew, setAddingNew] = useState(false);

  // Platform providers state
  const [platformProviders, setPlatformProviders] = useState<LLMProviderConfig[]>(initialPlatformProviders);
  const [editingPlatformProvider, setEditingPlatformProvider] = useState<string | null>(null);
  const [platformEditForm, setPlatformEditForm] = useState<LLMProviderConfig>({ provider: "", api_key: "", base_url: "", model: "", is_active: false });
  const [addingNewPlatform, setAddingNewPlatform] = useState(false);

  // Ollama-specific
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<"idle" | "loading" | "connected" | "error">("idle");

  // Embedding state
  const [embeddingProvider, setEmbeddingProvider] = useState(initialEmbeddingProvider);
  const [embeddingApiKey, setEmbeddingApiKey] = useState(initialEmbeddingApiKey);
  const [embeddingModel, setEmbeddingModel] = useState(initialEmbeddingModel);

  // UI state
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch Ollama models
  const fetchOllamaModels = async (url: string) => {
    setOllamaStatus("loading");
    try {
      // Strip /v1 suffix for Ollama API
      const ollamaUrl = url.replace(/\/v1\/?$/, "");
      const response = await fetch(`/api/ollama/models?url=${encodeURIComponent(ollamaUrl)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to connect");
      setOllamaModels(data.models || []);
      setOllamaStatus("connected");
    } catch {
      setOllamaStatus("error");
      setOllamaModels([]);
    }
  };

  // Auto-fetch Ollama models when editing Ollama provider
  useEffect(() => {
    if (editForm.provider === "ollama" && editForm.base_url) {
      const debounce = setTimeout(() => fetchOllamaModels(editForm.base_url), 500);
      return () => clearTimeout(debounce);
    }
  }, [editForm.provider, editForm.base_url]);

  const startAdd = (providerId: string) => {
    const meta = LLM_PROVIDERS.find(p => p.id === providerId);
    if (!meta) return;
    setEditForm({
      provider: providerId,
      api_key: "",
      base_url: meta.defaultUrl,
      model: "",
      is_active: providers.length === 0, // first provider is active by default
    });
    setAddingNew(true);
    setEditingProvider(providerId);
  };

  const startEdit = (p: LLMProviderConfig) => {
    setEditForm({ ...p });
    setAddingNew(false);
    setEditingProvider(p.provider);
  };

  const cancelEdit = () => {
    setEditingProvider(null);
    setAddingNew(false);
  };

  const saveProvider = async () => {
    if (!editForm.model) {
      setMessage({ type: "error", text: "Model is required" });
      return;
    }
    const meta = LLM_PROVIDERS.find(p => p.id === editForm.provider);
    if (meta?.needsKey && !editForm.api_key && !editForm.api_key?.includes("...")) {
      setMessage({ type: "error", text: "API key is required for this provider" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ llm_provider: editForm }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      // Update local state
      const existing = providers.findIndex(p => p.provider === editForm.provider);
      const updated = { ...editForm, api_key: editForm.api_key.includes("...") ? editForm.api_key : (editForm.api_key ? editForm.api_key.slice(0, 7) + "..." : "") };
      if (existing >= 0) {
        const newProviders = [...providers];
        newProviders[existing] = updated;
        setProviders(newProviders);
      } else {
        setProviders([...providers, updated]);
      }

      setEditingProvider(null);
      setAddingNew(false);
      setMessage({ type: "success", text: `${editForm.provider} saved` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (provider: string) => {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ set_active_provider: { provider } }),
      });
      if (!response.ok) throw new Error("Failed to set active");

      setProviders(providers.map(p => ({ ...p, is_active: p.provider === provider })));
      setMessage({ type: "success", text: `${provider} set as active` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  };

  const deleteProvider = async (provider: string) => {
    const target = providers.find(p => p.provider === provider);
    if (target?.is_active && providers.length === 1) {
      setMessage({ type: "error", text: "Cannot remove the only configured provider. Add another provider first." });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delete_provider: { provider } }),
      });
      if (!response.ok) throw new Error("Failed to delete");

      const remaining = providers.filter(p => p.provider !== provider);
      // If we deleted the active provider, activate the first remaining one
      if (target?.is_active && remaining.length > 0) {
        await setActive(remaining[0].provider);
      }
      setProviders(remaining);
      setMessage({ type: "success", text: `${provider} removed` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  };

  const saveEmbedding = async () => {
    if (!embeddingApiKey || embeddingApiKey.includes("...")) {
      setMessage({ type: "error", text: "API key is required for embedding provider" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embedding: {
            embedding_provider: embeddingProvider,
            embedding_api_key: embeddingApiKey,
            embedding_model: embeddingModel,
          },
        }),
      });
      if (!response.ok) throw new Error("Failed to save embedding settings");
      setMessage({ type: "success", text: "Embedding settings saved" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  };

  // Platform provider functions
  const startAddPlatform = (providerId: string) => {
    const meta = PLATFORM_PROVIDERS.find(p => p.id === providerId);
    if (!meta) return;
    setPlatformEditForm({
      provider: providerId,
      api_key: "",
      base_url: meta.defaultUrl,
      model: "",
      is_active: platformProviders.length === 0,
    });
    setAddingNewPlatform(true);
    setEditingPlatformProvider(providerId);
  };

  const startEditPlatform = (p: LLMProviderConfig) => {
    setPlatformEditForm({ ...p });
    setAddingNewPlatform(false);
    setEditingPlatformProvider(p.provider);
  };

  const cancelEditPlatform = () => {
    setEditingPlatformProvider(null);
    setAddingNewPlatform(false);
  };

  const savePlatformProvider = async () => {
    if (!platformEditForm.model) {
      setMessage({ type: "error", text: "Model is required" });
      return;
    }
    if (!platformEditForm.api_key || platformEditForm.api_key === "") {
      setMessage({ type: "error", text: "API key is required for platform providers" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform_provider: platformEditForm }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      const existing = platformProviders.findIndex(p => p.provider === platformEditForm.provider);
      const updated = { ...platformEditForm, api_key: platformEditForm.api_key.includes("...") ? platformEditForm.api_key : (platformEditForm.api_key ? platformEditForm.api_key.slice(0, 7) + "..." : "") };
      if (existing >= 0) {
        const newProviders = [...platformProviders];
        newProviders[existing] = updated;
        setPlatformProviders(newProviders);
      } else {
        setPlatformProviders([...platformProviders, updated]);
      }

      setEditingPlatformProvider(null);
      setAddingNewPlatform(false);
      setMessage({ type: "success", text: `Platform provider ${platformEditForm.provider} saved` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const setActivePlatform = async (provider: string) => {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ set_active_platform_provider: { provider } }),
      });
      if (!response.ok) throw new Error("Failed to set active");

      setPlatformProviders(platformProviders.map(p => ({ ...p, is_active: p.provider === provider })));
      setMessage({ type: "success", text: `${provider} set as active platform provider` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  };

  const deletePlatformProvider = async (provider: string) => {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delete_platform_provider: { provider } }),
      });
      if (!response.ok) throw new Error("Failed to delete");

      const remaining = platformProviders.filter(p => p.provider !== provider);
      setPlatformProviders(remaining);
      setMessage({ type: "success", text: `${provider} removed from platform providers` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  };

  const configuredIds = providers.map(p => p.provider);
  const availableToAdd = LLM_PROVIDERS.filter(p => !configuredIds.includes(p.id));
  const selectedEmbeddingProvider = EMBEDDING_PROVIDERS.find(p => p.id === embeddingProvider);

  const formatSize = (bytes: number) => `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;

  return (
    <div className="p-6 space-y-6">
      {/* Status Message */}
      {message && (
        <div className={`text-sm p-3 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
          {message.text}
        </div>
      )}

      {/* Configured Providers */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          LLM Providers
        </label>

        {providers.length === 0 && !addingNew && (
          <div className="text-sm text-gray-500 dark:text-gray-400 p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
            No providers configured. Add one below.
          </div>
        )}

        <div className="space-y-3">
          {providers.map((p) => (
            <div key={p.provider} className={`p-4 border-2 rounded-lg ${p.is_active ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-600"}`}>
              {editingProvider === p.provider && !addingNew ? (
                // Edit form
                <ProviderForm
                  form={editForm}
                  setForm={setEditForm}
                  ollamaModels={ollamaModels}
                  ollamaStatus={ollamaStatus}
                  fetchOllamaModels={fetchOllamaModels}
                  formatSize={formatSize}
                  onSave={saveProvider}
                  onCancel={cancelEdit}
                  saving={saving}
                />
              ) : (
                // Display
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {LLM_PROVIDERS.find(m => m.id === p.provider)?.name || p.provider}
                      </span>
                      {p.is_active && <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded-full">Active</span>}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Model: <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">{p.model}</code>
                      {p.api_key && <span className="ml-3">Key: {p.api_key}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!p.is_active && (
                      <button onClick={() => setActive(p.provider)} disabled={saving} className="text-xs px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded hover:bg-blue-200 disabled:opacity-50">
                        Set Active
                      </button>
                    )}
                    <button onClick={() => startEdit(p)} className="text-xs px-3 py-1 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-200">
                      Edit
                    </button>
                    <button onClick={() => deleteProvider(p.provider)} disabled={saving} className="text-xs px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded hover:bg-red-200 disabled:opacity-50">
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add new provider form */}
          {addingNew && editingProvider && (
            <div className="p-4 border-2 border-green-300 dark:border-green-600 rounded-lg bg-green-50 dark:bg-green-900/10">
              <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-3">
                Add {LLM_PROVIDERS.find(m => m.id === editForm.provider)?.name}
              </div>
              <ProviderForm
                form={editForm}
                setForm={setEditForm}
                ollamaModels={ollamaModels}
                ollamaStatus={ollamaStatus}
                fetchOllamaModels={fetchOllamaModels}
                formatSize={formatSize}
                onSave={saveProvider}
                onCancel={cancelEdit}
                saving={saving}
              />
            </div>
          )}
        </div>
      </div>

      {/* Add Provider Buttons */}
      {availableToAdd.length > 0 && !addingNew && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Add Provider
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {availableToAdd.map((p) => (
              <button
                key={p.id}
                onClick={() => startAdd(p.id)}
                className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg text-left hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-white text-sm">{p.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{p.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Platform LLM Providers */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Platform LLM (Slack, Telegram, Discord)</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Cloud providers only. Used when messages come from messaging platforms (server cannot reach local Ollama).
        </p>

        {platformProviders.length === 0 && !addingNewPlatform && (
          <div className="text-sm text-gray-500 dark:text-gray-400 p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center mb-4">
            No platform provider configured. Add one to use Codeteel from Slack, Telegram, or Discord.
          </div>
        )}

        <div className="space-y-3 mb-4">
          {platformProviders.map((p) => (
            <div key={p.provider} className={`p-4 border-2 rounded-lg ${p.is_active ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" : "border-gray-200 dark:border-gray-600"}`}>
              {editingPlatformProvider === p.provider && !addingNewPlatform ? (
                <ProviderForm
                  form={platformEditForm}
                  setForm={setPlatformEditForm}
                  ollamaModels={[]}
                  ollamaStatus="idle"
                  fetchOllamaModels={() => {}}
                  formatSize={formatSize}
                  onSave={savePlatformProvider}
                  onCancel={cancelEditPlatform}
                  saving={saving}
                />
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {PLATFORM_PROVIDERS.find(m => m.id === p.provider)?.name || p.provider}
                      </span>
                      {p.is_active && <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-0.5 rounded-full">Active</span>}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Model: <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">{p.model}</code>
                      {p.api_key && <span className="ml-3">Key: {p.api_key}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!p.is_active && (
                      <button onClick={() => setActivePlatform(p.provider)} disabled={saving} className="text-xs px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded hover:bg-purple-200 disabled:opacity-50">
                        Set Active
                      </button>
                    )}
                    <button onClick={() => startEditPlatform(p)} className="text-xs px-3 py-1 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-200">
                      Edit
                    </button>
                    <button onClick={() => deletePlatformProvider(p.provider)} disabled={saving} className="text-xs px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded hover:bg-red-200 disabled:opacity-50">
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {addingNewPlatform && editingPlatformProvider && (
            <div className="p-4 border-2 border-green-300 dark:border-green-600 rounded-lg bg-green-50 dark:bg-green-900/10">
              <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-3">
                Add {PLATFORM_PROVIDERS.find(m => m.id === platformEditForm.provider)?.name}
              </div>
              <ProviderForm
                form={platformEditForm}
                setForm={setPlatformEditForm}
                ollamaModels={[]}
                ollamaStatus="idle"
                fetchOllamaModels={() => {}}
                formatSize={formatSize}
                onSave={savePlatformProvider}
                onCancel={cancelEditPlatform}
                saving={saving}
              />
            </div>
          )}
        </div>

        {(() => {
          const configuredPlatformIds = platformProviders.map(p => p.provider);
          const availablePlatformToAdd = PLATFORM_PROVIDERS.filter(p => !configuredPlatformIds.includes(p.id));
          return availablePlatformToAdd.length > 0 && !addingNewPlatform ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {availablePlatformToAdd.map((p) => (
                <button
                  key={p.id}
                  onClick={() => startAddPlatform(p.id)}
                  className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg text-left hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors"
                >
                  <div className="font-medium text-gray-900 dark:text-white text-sm">{p.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{p.description}</div>
                </button>
              ))}
            </div>
          ) : null;
        })()}
      </div>

      {/* Embedding Settings */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Embedding Provider</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Required for semantic code search. All providers output 1536 dimensions.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {EMBEDDING_PROVIDERS.map((ep) => (
            <button
              key={ep.id}
              type="button"
              onClick={() => { setEmbeddingProvider(ep.id); if (!embeddingModel) setEmbeddingModel(ep.defaultModel); }}
              className={`p-3 border-2 rounded-lg text-left transition-colors ${embeddingProvider === ep.id ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-600 hover:border-gray-300"}`}
            >
              <div className="font-medium text-gray-900 dark:text-white text-sm">{ep.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{ep.price}</div>
            </button>
          ))}
        </div>

        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              API Key <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={embeddingApiKey}
              onChange={(e) => setEmbeddingApiKey(e.target.value)}
              placeholder={`Enter your ${selectedEmbeddingProvider?.name || "embedding"} API key`}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model (optional)</label>
            <input
              type="text"
              value={embeddingModel}
              onChange={(e) => setEmbeddingModel(e.target.value)}
              placeholder={selectedEmbeddingProvider?.defaultModel || "Default model"}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Leave empty to use default: <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">{selectedEmbeddingProvider?.defaultModel}</code>
            </p>
          </div>
          <button onClick={saveEmbedding} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save Embedding Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================
// PROVIDER FORM (shared between add + edit)
// ===========================================

function ProviderForm({
  form, setForm, ollamaModels, ollamaStatus, fetchOllamaModels, formatSize, onSave, onCancel, saving,
}: {
  form: LLMProviderConfig;
  setForm: (f: LLMProviderConfig) => void;
  ollamaModels: OllamaModel[];
  ollamaStatus: string;
  fetchOllamaModels: (url: string) => void;
  formatSize: (bytes: number) => string;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const meta = LLM_PROVIDERS.find(p => p.id === form.provider);
  const isOllama = form.provider === "ollama";

  return (
    <div className="space-y-3">
      {/* Base URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base URL</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={form.base_url}
            onChange={(e) => setForm({ ...form, base_url: e.target.value })}
            placeholder={meta?.defaultUrl}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          />
          {isOllama && (
            <button
              type="button"
              onClick={() => fetchOllamaModels(form.base_url)}
              disabled={ollamaStatus === "loading"}
              className="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 text-sm disabled:opacity-50"
            >
              {ollamaStatus === "loading" ? "..." : "Test"}
            </button>
          )}
        </div>
        {isOllama && ollamaStatus === "connected" && (
          <div className="mt-1 flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-xs text-green-600 dark:text-green-400">Connected - {ollamaModels.length} models</span>
          </div>
        )}
      </div>

      {/* API Key (not for Ollama) */}
      {meta?.needsKey && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
          <input
            type="password"
            value={form.api_key}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            placeholder="Enter API key"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          />
        </div>
      )}

      {/* Model */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Model <span className="text-red-500">*</span>
        </label>
        {isOllama && ollamaModels.length > 0 ? (
          <select
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="">Select a model</option>
            {ollamaModels.map((m) => (
              <option key={m.name} value={m.name}>{m.name} ({formatSize(m.size)})</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder="e.g. gpt-4o, claude-sonnet-4-20250514, gemini-2.0-flash"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button onClick={onSave} disabled={saving || !form.model} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm">
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
