import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Replace, Search, X } from "lucide-react";
import { type Board } from "./model";
import {
  SEARCH_LIMIT,
  type SearchMatch,
  type SearchOptions,
  findProjectMatches,
  matchSummary,
  replaceAllMatches,
  replaceMatch,
} from "./projectSearch";

export type SearchReplaceProps = {
  board: Board;
  onNavigate(match: SearchMatch): void;
  onBoardChange(next: Board): void;
  onClose(): void;
};

export function SearchReplace({ board, onNavigate, onBoardChange, onClose }: SearchReplaceProps) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [options, setOptions] = useState<SearchOptions>({ caseSensitive: false, wholeWord: false });
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => findProjectMatches(board, query, options), [board, query, options]);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  useEffect(() => {
    if (active >= matches.length) setActive(0);
  }, [matches.length, active]);

  const go = (delta: number) => {
    if (!matches.length) return;
    const next = (active + delta + matches.length) % matches.length;
    setActive(next);
    onNavigate(matches[next]);
  };

  const replaceCurrent = () => {
    const match = matches[active];
    if (!match) return;
    onBoardChange(replaceMatch(board, match, replacement));
    onNavigate({ ...match, id: `${match.id}:replaced` });
  };

  const replaceEvery = () => {
    if (!matches.length) return;
    onBoardChange(replaceAllMatches(board, matches, replacement));
  };

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Buscar e substituir no projeto">
      <div className="search-panel">
        <header>
          <Search size={15} />
          <strong>Buscar e substituir</strong>
          <span className="search-scope">{board.title}</span>
          <button type="button" className="icon-button" aria-label="Fechar busca" title="Fechar busca" onClick={onClose}>
            <X size={15} />
          </button>
        </header>
        <div className="search-row">
          <input
            ref={input}
            aria-label="Buscar no projeto"
            placeholder="Buscar no projeto"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActive(0); }}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") { event.preventDefault(); go(event.shiftKey ? -1 : 1); }
              if (event.key === "Escape") { event.preventDefault(); onClose(); }
            }}
          />
          <span className="search-count" role="status" aria-live="polite">{matchSummary(matches, active)}</span>
          <button type="button" className="icon-button" aria-label="Resultado anterior" title="Resultado anterior" disabled={!matches.length} onClick={() => go(-1)}>
            <ChevronUp size={15} />
          </button>
          <button type="button" className="icon-button" aria-label="Próximo resultado" title="Próximo resultado" disabled={!matches.length} onClick={() => go(1)}>
            <ChevronDown size={15} />
          </button>
        </div>
        <div className="search-row">
          <input
            aria-label="Substituir por"
            placeholder="Substituir por"
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") { event.preventDefault(); replaceCurrent(); }
              if (event.key === "Escape") { event.preventDefault(); onClose(); }
            }}
          />
          <button type="button" className="search-action" aria-label="Substituir resultado atual" disabled={!matches.length} onClick={replaceCurrent}>
            <Replace size={14} /> Substituir
          </button>
          <button type="button" className="search-action" aria-label="Substituir todos os resultados" disabled={!matches.length} onClick={replaceEvery}>
            Todos
          </button>
        </div>
        <div className="search-options">
          <label className="check-setting">
            <input type="checkbox" aria-label="Diferenciar maiúsculas" checked={!!options.caseSensitive} onChange={(event) => setOptions((current) => ({ ...current, caseSensitive: event.target.checked }))} />
            Diferenciar maiúsculas
          </label>
          <label className="check-setting">
            <input type="checkbox" aria-label="Somente palavras inteiras" checked={!!options.wholeWord} onChange={(event) => setOptions((current) => ({ ...current, wholeWord: event.target.checked }))} />
            Palavra inteira
          </label>
          {matches.length >= SEARCH_LIMIT && <span className="search-hint">Mostrando os primeiros {SEARCH_LIMIT} resultados.</span>}
        </div>
        <ul className="search-results" aria-label="Resultados da busca">
          {matches.map((match, index) => (
            <li key={match.id}>
              <button
                type="button"
                className={index === active ? "active" : ""}
                aria-current={index === active ? "true" : undefined}
                onClick={() => { setActive(index); onNavigate(match); }}
              >
                <span className="search-result-scene">{match.sceneName}</span>
                <span className="search-result-label">{match.label}</span>
                <span className="search-result-preview">{match.preview}</span>
              </button>
            </li>
          ))}
          {query && !matches.length && <li className="search-empty">Nenhum trecho encontrado.</li>}
        </ul>
      </div>
    </div>
  );
}
