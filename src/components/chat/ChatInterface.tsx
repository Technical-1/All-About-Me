import { useState, useRef, useEffect, useCallback } from 'react';
import type { MLCEngine, InitProgressReport } from '@mlc-ai/web-llm';
import { searchContext, formatContext } from '../../lib/rag';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_PROMPT = `You are Jacob Kanfer's AI assistant on his portfolio website. You help visitors learn about Jacob's background, projects, and experience.

Key facts about Jacob:
- Software Developer specializing in AI, automation, and full-stack development
- Engineering Solutions Analyst at Deloitte (Government & Public Services - AI & Data)
- B.S. in Computer Engineering from University of Florida (2024)
- Experience with: Python, TypeScript, React, AI Agents, Machine Learning, Cloud (AWS, Azure)
- Featured project: AHSR (Autonomous Hospital Stretcher Robot) - senior design project using ROS2, OpenCV, SLAM
- Leadership: Chief of Staff to UF Student Body President, managed $23M budget
- Awards: Florida Blue Key, John Michael Stratton Award

Be helpful, concise, and friendly. If you don't know something specific about Jacob, say so.`;

// Check WebGPU support
async function checkWebGPUSupport(): Promise<{ supported: boolean; reason?: string }> {
  if (!navigator.gpu) {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
        'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        { initProgressCallback: progressCallback }
      );

      setEngine(newEngine);
      setLoadingProgress(null);
      setMessages([{
        role: 'assistant',
        content: "Hi! I'm Jacob's AI assistant. Feel free to ask me about his background, projects, or experience!"
      }]);
    } catch (err: any) {
      console.error('WebLLM init error:', err);
      setError('Failed to load the AI model');
      setErrorDetails(err?.message || 'Unknown error during model initialization');
      setLoadingProgress(null);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !engine || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Search for relevant context from project documentation
      let ragContext = '';
      try {
        const results = await searchContext(userMessage, { topK: 3 });
        ragContext = formatContext(results);
        if (results.length > 0) {
          console.log('RAG found relevant context from:', results.map(r => r.chunk.project).join(', '));
        }
      } catch (ragError) {
        console.warn('RAG search failed, continuing without context:', ragError);
      }

      const systemPromptWithContext = SYSTEM_PROMPT + ragContext;

      const response = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: systemPromptWithContext },
          ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user', content: userMessage }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const assistantMessage = response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial loading state
  if (!engine && !error) {
    return (
      <div className="terminal h-[600px] flex flex-col">
        <div className="terminal-header">
          <div className="terminal-dot bg-red-500" />
          <div className="terminal-dot bg-yellow-500" />
          <div className="terminal-dot bg-green-500" />
          <span className="ml-3 text-gray-400 text-sm">jacob-ai</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            {loadingProgress ? (
              <>
                <div className="w-12 h-12 border-2 border-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-cyan font-mono text-sm mb-2">Loading AI Model...</p>
                <p className="text-gray-400 text-xs max-w-md">{loadingProgress}</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-cyan/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">&#129302;</span>
                </div>
                <h3 className="font-mono font-bold text-white mb-2">Chat with AI</h3>
                <p className="text-gray-400 text-sm mb-6 max-w-md">
                  This chat runs entirely in your browser using WebLLM.
                  No data is sent to external servers.
                </p>
                <button onClick={initEngine} className="btn-primary">
                  Start Chat
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="terminal h-[600px] flex flex-col">
        <div className="terminal-header">
          <div className="terminal-dot bg-red-500" />
          <div className="terminal-dot bg-yellow-500" />
          <div className="terminal-dot bg-green-500" />
          <span className="ml-3 text-gray-400 text-sm">jacob-ai</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-lg">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">&#9888;</span>
            </div>
            <h3 className="font-mono font-bold text-white mb-2">{error}</h3>
            {errorDetails && (
              <p className="text-gray-400 text-sm mb-4 font-mono bg-black/30 p-2 rounded">{errorDetails}</p>
            )}
            <div className="text-left text-gray-400 text-sm space-y-2 mb-6">
              <p className="font-semibold text-gray-300">Troubleshooting:</p>
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
        <span className="ml-3 text-gray-400 text-sm">jacob-ai ~ chat</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="chat-bubble-ai">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-cyan rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-cyan rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-cyan rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
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
            className="flex-1 px-4 py-3 bg-surface border border-border rounded-lg text-white placeholder-muted focus:outline-none focus:border-cyan/50 transition-colors font-code text-sm"
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
