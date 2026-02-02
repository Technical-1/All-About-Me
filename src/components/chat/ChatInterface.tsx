import { useState, useRef, useEffect, useCallback } from 'react';
import type { MLCEngine, InitProgressReport } from '@mlc-ai/web-llm';
import { searchContext, formatContext } from '../../lib/rag';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type ChatMode = 'local' | 'cloud';

// Reusable toggle component - only shown when WebGPU is supported
interface ModeToggleProps {
  mode: ChatMode;
  onToggle: () => void;
}

function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  return (
    <div className="px-4 py-2 border-b border-border flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        <span className={mode === 'local' ? 'text-cyan' : 'text-muted'}>Local</span>
        <button
          onClick={onToggle}
          role="switch"
          aria-checked={mode === 'cloud'}
          aria-label={`Switch to ${mode === 'local' ? 'cloud' : 'local'} mode`}
          className={`relative w-12 h-6 rounded-full transition-colors border border-border ${
            mode === 'cloud' ? 'bg-cyan' : 'bg-surface'
          }`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full transition-transform ${
            mode === 'cloud' ? 'translate-x-7 bg-white' : 'translate-x-1 bg-accent-secondary'
          }`} style={{ backgroundColor: mode === 'cloud' ? 'white' : 'var(--accent-secondary)' }} />
        </button>
        <span className={mode === 'cloud' ? 'text-cyan' : 'text-muted'}>Cloud</span>
      </div>
      <span className="text-xs text-muted">
        {mode === 'local' ? 'Runs in browser (WebGPU)' : 'Powered by Claude'}
      </span>
    </div>
  );
}

// Cloud-only header when WebGPU is not supported
function CloudOnlyHeader() {
  return (
    <div className="px-4 py-2 border-b border-border flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-cyan">Cloud Mode</span>
      </div>
      <span className="text-xs text-muted">Powered by Claude</span>
    </div>
  );
}

const SYSTEM_PROMPT = `You are an AI assistant for Jacob Kanfer's portfolio website. Help visitors learn about Jacob's background, skills, and projects.

## RESPONSE GUIDELINES

### When Documentation Is Provided:
- Base answers on the provided excerpts
- Quote specific details: technologies, features, architectural decisions
- Cite which project the information comes from
- Be specific and technical when documentation supports it

### When No Documentation Is Retrieved:
- Acknowledge you don't have detailed info on that topic
- Suggest alternatives: "You can find Jacob's resume on the Resume page" or "The Projects page has live demos"
- Offer to answer a related question

### General Behavior:
- Be conversational but concise (2-4 paragraphs typical)
- Use third person: "Jacob built...", "His approach was..."
- Never invent project names, technologies, or features not in documentation
- For personal questions, politely redirect to professional topics

## TOPICS YOU CAN DISCUSS
- Jacob's projects: architecture, tech stack, features, design decisions
- Technical skills: languages, frameworks, tools, cloud platforms
- Education: University of Florida, Computer Engineering (2024)
- Work: Deloitte (Engineering Solutions Analyst), previous roles
- Leadership: Student Government, organizations`;

// Check WebGPU support
async function checkWebGPUSupport(): Promise<{ supported: boolean; reason?: string }> {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return { supported: false, reason: 'WebGPU API not available in this browser' };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { supported: false, reason: 'No WebGPU adapter found (GPU may not be compatible)' };
    }

    const device = await adapter.requestDevice();
    if (!device) {
      return { supported: false, reason: 'Could not create WebGPU device' };
    }

    return { supported: true };
  } catch (e) {
    return { supported: false, reason: `WebGPU initialization failed: ${e}` };
  }
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<string | null>(null);
  const [engine, setEngine] = useState<MLCEngine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>('cloud');
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const preloadStarted = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // Check WebGPU support on mount
  useEffect(() => {
    checkWebGPUSupport().then(result => {
      setWebGPUSupported(result.supported);
      // If WebGPU is not supported, force cloud mode
      if (!result.supported) {
        setMode('cloud');
      }
    });
  }, []);

  const initEngine = useCallback(async () => {
    setLoadingProgress('Checking WebGPU support...');
    setError(null);
    setErrorDetails(null);

    // First check WebGPU support
    const webgpuCheck = await checkWebGPUSupport();
    if (!webgpuCheck.supported) {
      setError('WebGPU is not available');
      setErrorDetails(webgpuCheck.reason || 'Unknown reason');
      setLoadingProgress(null);
      return;
    }

    setLoadingProgress('Initializing WebLLM...');

    try {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

      const progressCallback = (report: InitProgressReport) => {
        setLoadingProgress(report.text);
      };

      const newEngine = await CreateMLCEngine(
        'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
        { initProgressCallback: progressCallback }
      );

      setEngine(newEngine);
      setLoadingProgress(null);
      setMessages([{
        role: 'assistant',
        content: "Hi! I'm Jacob's AI assistant. Feel free to ask me about his background, projects, or experience!"
      }]);
    } catch (err: unknown) {
      console.error('WebLLM init error:', err);
      setError('Failed to load the AI model');
      const message = err instanceof Error ? err.message : 'Unknown error during model initialization';
      setErrorDetails(message);
      setLoadingProgress(null);
    }
  }, []);

  const handleStartChatHover = useCallback(() => {
    if (!preloadStarted.current && !engine && !loadingProgress) {
      preloadStarted.current = true;
      initEngine();
    }
  }, [engine, loadingProgress, initEngine]);

  // Set initial greeting for cloud mode
  useEffect(() => {
    if (mode === 'cloud' && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "Hi! I'm Jacob's AI assistant. Feel free to ask me about his background, projects, or experience!"
      }]);
    }
  }, [mode]);

  const sendCloudMessageStreaming = async (userMessage: string): Promise<void> => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMessage }
        ],
        stream: true
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get response');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              // Stream complete
              setMessages(prev => [...prev, { role: 'assistant', content: fullContent }]);
              setStreamingContent('');
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullContent += parsed.text;
                setStreamingContent(fullContent);
              }
            } catch {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }

      // If we get here without [DONE], still save what we have
      if (fullContent) {
        setMessages(prev => [...prev, { role: 'assistant', content: fullContent }]);
        setStreamingContent('');
      }
    } finally {
      reader.releaseLock();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    if (mode === 'local' && !engine) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setStreamingContent('');

    try {
      if (mode === 'cloud') {
        // Cloud mode: use streaming API endpoint
        await sendCloudMessageStreaming(userMessage);
      } else {
        // Local mode: use WebLLM engine with streaming
        // Search for relevant context from project documentation
        let ragContext = '';
        try {
          const results = await searchContext(userMessage);
          ragContext = formatContext(results);
          if (results.length > 0) {
            console.log('RAG found', results.length, 'relevant chunks from:',
              [...new Set(results.map(r => r.chunk.project))].join(', '),
              'Scores:', results.map(r => r.score.toFixed(2)).join(', ')
            );
          }
        } catch (ragError) {
          console.warn('RAG search failed, continuing without context:', ragError);
        }

        const systemPromptWithContext = SYSTEM_PROMPT + ragContext;

        // Use streaming for local mode
        let fullContent = '';
        const stream = await engine!.chat.completions.create({
          messages: [
            { role: 'system', content: systemPromptWithContext },
            ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            { role: 'user', content: userMessage }
          ],
          max_tokens: 800,
          temperature: 0.3,
          stream: true,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || '';
          fullContent += delta;
          setStreamingContent(fullContent);
        }

        setMessages(prev => [...prev, { role: 'assistant', content: fullContent }]);
        setStreamingContent('');
      }
    } catch (err) {
      console.error('Chat error:', err);
      setStreamingContent('');
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial loading state - only show for local mode when engine isn't ready
  if (mode === 'local' && !engine && !error) {
    return (
      <div className="terminal h-[600px] flex flex-col">
        <div className="terminal-header">
          <div className="terminal-dot bg-red-500" />
          <div className="terminal-dot bg-yellow-500" />
          <div className="terminal-dot bg-green-500" />
          <span className="ml-3 text-muted text-sm">jacob-ai</span>
        </div>
        {webGPUSupported && (
          <ModeToggle mode={mode} onToggle={() => setMode(mode === 'local' ? 'cloud' : 'local')} />
        )}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            {loadingProgress ? (
              <>
                <div className="w-12 h-12 border-2 border-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-cyan font-mono text-sm mb-2">Loading AI Model...</p>
                <p className="text-muted text-xs max-w-md">{loadingProgress}</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-cyan/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">&#129302;</span>
                </div>
                <h3 className="font-mono font-bold text-heading mb-2">Chat with AI</h3>
                <p className="text-muted text-sm mb-6 max-w-md">
                  This chat runs entirely in your browser using WebLLM.
                  No data is sent to external servers.
                </p>
                <button
                  onClick={initEngine}
                  onMouseEnter={handleStartChatHover}
                  onFocus={handleStartChatHover}
                  className="btn-primary"
                >
                  Start Chat
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Error state - only show for local mode
  if (mode === 'local' && error) {
    return (
      <div className="terminal h-[600px] flex flex-col">
        <div className="terminal-header">
          <div className="terminal-dot bg-red-500" />
          <div className="terminal-dot bg-yellow-500" />
          <div className="terminal-dot bg-green-500" />
          <span className="ml-3 text-muted text-sm">jacob-ai</span>
        </div>
        {webGPUSupported && (
          <ModeToggle mode={mode} onToggle={() => setMode(mode === 'local' ? 'cloud' : 'local')} />
        )}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-lg">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">&#9888;</span>
            </div>
            <h3 className="font-mono font-bold text-heading mb-2">{error}</h3>
            {errorDetails && (
              <p className="text-muted text-sm mb-4 font-mono bg-card p-2 rounded border border-border">{errorDetails}</p>
            )}
            <div className="text-left text-muted text-sm space-y-2 mb-6">
              <p className="font-semibold text-secondary">Troubleshooting:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Use <strong>Chrome 113+</strong> or <strong>Edge 113+</strong></li>
                <li>Make sure your GPU drivers are up to date</li>
                <li>Try enabling hardware acceleration in browser settings</li>
                <li>Check <a href="chrome://gpu" className="text-cyan underline">chrome://gpu</a> for WebGPU status</li>
                <li>Some older GPUs may not support WebGPU</li>
              </ul>
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={initEngine} className="btn-secondary text-sm">
                Try Again
              </button>
              <a
                href="https://webgpureport.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-sm"
              >
                Check WebGPU Support
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="terminal h-[600px] flex flex-col">
      <div className="terminal-header">
        <div className="terminal-dot bg-red-500" />
        <div className="terminal-dot bg-yellow-500" />
        <div className="terminal-dot bg-green-500" />
        <span className="ml-3 text-muted text-sm">jacob-ai ~ chat</span>
      </div>

      {/* Only show toggle if WebGPU is supported, otherwise show cloud-only header */}
      {webGPUSupported ? (
        <ModeToggle mode={mode} onToggle={() => setMode(mode === 'local' ? 'cloud' : 'local')} />
      ) : (
        <CloudOnlyHeader />
      )}

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            role="article"
            aria-label={message.role === 'user' ? 'Your message' : 'Assistant response'}
          >
            <div
              className={message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {/* Streaming content */}
        {streamingContent && (
          <div className="flex justify-start" role="status" aria-label="Assistant is responding">
            <div className="chat-bubble-ai">
              <p className="whitespace-pre-wrap">{streamingContent}</p>
              <span className="inline-block w-2 h-4 bg-cyan animate-pulse ml-1" aria-hidden="true" />
            </div>
          </div>
        )}

        {/* Loading indicator (only shown when not streaming) */}
        {isLoading && !streamingContent && (
          <div className="flex justify-start" role="status" aria-label="Assistant is typing">
            <div className="chat-bubble-ai">
              <div className="flex items-center gap-2">
                <span className="sr-only">Loading response...</span>
                <div className="w-2 h-2 bg-cyan rounded-full animate-pulse" aria-hidden="true" />
                <div className="w-2 h-2 bg-cyan rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} aria-hidden="true" />
                <div className="w-2 h-2 bg-cyan rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} aria-hidden="true" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Jacob's experience, projects, skills..."
            aria-label="Type your message to chat with Jacob's AI assistant"
            className="flex-1 px-4 py-3 bg-surface border border-border rounded-lg text-primary placeholder-muted focus:outline-none focus:border-cyan/50 transition-colors font-code text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
