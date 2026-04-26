import { useState, useRef, useEffect } from 'react';

function AIIcon() {
  return (
    <svg className="w-5 h-5 text-gray-600" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Rounded square — centrado no viewBox levando em conta o sparkle */}
      <rect x="1.5" y="5" width="12.5" height="12.5" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      {/* "AI" text centralizado no rect */}
      <text
        x="7.75"
        y="14.2"
        fontSize="6.5"
        fontWeight="800"
        fill="currentColor"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="-0.2"
      >
        AI
      </text>
      {/* 4-pointed sparkle no canto superior direito */}
      <path
        d="M16 2 L16.6 3.8 L18.5 4 L16.6 4.2 L16 6 L15.4 4.2 L13.5 4 L15.4 3.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

interface Props {
  /** Posição top do botão (px), para empilhar abaixo do botão de filtro */
  topOffset?: number;
  /** right do botão em px — deve acompanhar o botão de filtro */
  rightOffset?: number;
}

export default function FloatingAIChat({ topOffset = 60, rightOffset = 16 }: Props) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) e.preventDefault();
  };

  return (
    <>
      {/* Barra de prompt — centralizada no fundo da tela */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] transition-all duration-300 ${
          open
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{ width: 'min(760px, calc(100vw - 120px))' }}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 flex items-center gap-3 px-5 py-3.5">
          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte algo sobre sua campanha…"
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none leading-relaxed"
            style={{ minHeight: '24px', maxHeight: '96px' }}
          />
          <button
            disabled={!prompt.trim()}
            className="shrink-0 w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center text-white disabled:opacity-25 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
          >
            <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[10px] text-white/50 mt-1.5 drop-shadow">
          IA Copiloto · em desenvolvimento
        </p>
      </div>

      {/* Botão — absolute, mesmo estilo do botão de filtro */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="absolute z-[1000] bg-white shadow-md rounded-lg p-2 border border-gray-200 hover:bg-gray-50 transition-colors flex items-center justify-center"
        style={{ top: `${topOffset}px`, right: `${rightOffset}px` }}
        title={open ? 'Fechar IA' : 'IA Copiloto'}
      >
        {open ? (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <AIIcon />
        )}
      </button>
    </>
  );
}
