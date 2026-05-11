import { useState, useRef, useEffect } from 'react';
import { aiApi, type AiQueryContext, type MapAction, type ChatMessage, type AiTokensUsed } from '@/services/api/ai';

function AISparkIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="4.5" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <text
        x="7.5"
        y="13.5"
        fontSize="6.5"
        fontWeight="800"
        fill="currentColor"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="-0.2"
      >
        AI
      </text>
      <path d="M16 1.5 L16.6 3.3 L18.5 3.5 L16.6 3.7 L16 5.5 L15.4 3.7 L13.5 3.5 L15.4 3.3Z" fill="currentColor" />
    </svg>
  );
}

interface UsageInfo {
  requests: number;
  tokens: AiTokensUsed;
}

interface Props {
  open: boolean;
  onClose: () => void;
  context?: AiQueryContext;
  onMapActions?: (actions: MapAction[]) => void;
}

export default function MapAIChat({ open, onClose, context, onMapActions }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastUsage, setLastUsage] = useState<UsageInfo | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleClose = () => {
    setMessages([]);
    setInput('');
    setLastUsage(null);
    onClose();
  };

  const submit = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setLoading(true);

    try {
      const { data } = await aiApi.query(text, context, messages);

      if (data.mapActions?.length > 0) {
        onMapActions?.(data.mapActions);
      }

      if (data.totalRequests != null && data.tokensUsed != null) {
        setLastUsage({ requests: data.totalRequests, tokens: data.tokensUsed });
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.message || 'Pronto.' }]);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      const errMsg = e?.response?.data?.error ?? e?.message ?? 'Erro ao consultar a IA.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Não consegui responder: ${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const SUGGESTIONS = [
    'Qual partido mais votado aqui?',
    'Top candidatos em 2024',
    'Mostre a esquerda no mapa',
  ];

  return (
    <div
      className={`absolute top-0 right-0 h-full z-[900] bg-white border-l border-gray-200 shadow-2xl flex flex-col transition-all duration-300 ease-in-out ${
        open ? 'w-[360px]' : 'w-0 overflow-hidden'
      }`}
    >
      <div className="flex flex-col h-full min-w-[360px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center text-white">
              <AISparkIcon />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 leading-none">Copiloto IA</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Gemini 2.5 Flash · TSE</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
            title="Fechar e limpar conversa"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center pb-8">
              <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center text-primary-600 mb-3">
                <AISparkIcon />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Como posso ajudar?</p>
              <p className="text-xs text-gray-400 leading-relaxed max-w-[220px]">
                Pergunte sobre partidos, candidatos ou peça para filtrar o mapa.
              </p>
              <div className="mt-4 flex flex-col gap-2 w-full">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="text-left text-xs text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-2 rounded-lg transition-colors border border-primary-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white rounded-tr-sm'
                    : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 p-3 shrink-0 bg-white">
          <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-primary-300 focus-within:ring-1 focus-within:ring-primary-200 transition-all">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre dados eleitorais…"
              className="flex-1 bg-transparent text-xs text-gray-800 placeholder-gray-400 resize-none outline-none leading-relaxed overflow-y-auto"
              style={{ minHeight: '20px', maxHeight: '120px' }}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!input.trim() || loading}
              className="shrink-0 w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center text-white disabled:opacity-25 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
              title="Enviar (Enter)"
            >
              <svg className="w-3.5 h-3.5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          {lastUsage && (
            <div className="mt-2 px-1 flex items-center justify-between text-[9px] text-gray-300 font-mono">
              <span title="Chamadas ao Gemini nesta resposta">
                {lastUsage.requests} req{lastUsage.requests !== 1 ? 's' : ''}
              </span>
              <span title="Tokens usados (entrada + saída)">
                {lastUsage.tokens.prompt.toLocaleString('pt-BR')} in · {lastUsage.tokens.output.toLocaleString('pt-BR')} out · {lastUsage.tokens.total.toLocaleString('pt-BR')} total
              </span>
            </div>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleClose}
              className="mt-1.5 w-full text-[10px] text-gray-400 hover:text-red-500 transition-colors"
            >
              Limpar conversa e fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
