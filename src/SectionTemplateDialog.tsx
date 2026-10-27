import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Plus, Search, Trash2, X } from "lucide-react";
import { type BoardTemplate } from "./library";
import { StaticScene } from "./StaticScene";
import "./section-template-dialog.css";

type Props = {
  templates: BoardTemplate[];
  customIds: string[];
  light: boolean;
  onCreate(template: BoardTemplate | null): void;
  onDelete(template: BoardTemplate): void;
  onClose(): void;
};

export function SectionTemplateDialog({ templates, customIds, light, onCreate, onDelete, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const [choice, setChoice] = useState("");
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState<"all" | "ready" | "custom">("all");
  const selected = templates.find((template) => template.id === choice);
  const customTemplates = templates.filter((template) => customIds.includes(template.id));
  const filteredTemplates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return templates.filter((template) => {
      const isCustom = customIds.includes(template.id);
      const matchesCollection = collection === "all" || (collection === "custom" ? isCustom : !isCustom);
      const matchesQuery = !normalized || `${template.name} ${template.scene.description}`.toLocaleLowerCase().includes(normalized);
      return matchesCollection && matchesQuery;
    });
  }, [templates, customIds, collection, query]);
  const filteredReady = filteredTemplates.filter((template) => !customIds.includes(template.id));
  const filteredCustom = filteredTemplates.filter((template) => customIds.includes(template.id));
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog ref={dialog} className="section-template-dialog" aria-labelledby="section-template-title" aria-describedby="section-template-description"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}
      onKeyDown={(event) => event.stopPropagation()} onCopy={(event) => event.stopPropagation()} onCut={(event) => event.stopPropagation()} onPaste={(event) => event.stopPropagation()}>
      <div className="section-template-heading">
        <div><span className="dialog-eyebrow">ADICIONAR AO QUADRO</span><h2 id="section-template-title">Nova seção</h2><p id="section-template-description">Comece do zero ou escolha um modelo para sua próxima ideia.</p></div>
        <button className="icon-button" aria-label="Fechar modelos de seção" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="section-template-body">
        <div className="section-template-layout">
          <section className="section-template-browser" aria-label="Escolher modelo">
            <label className="section-template-search"><Search size={16} aria-hidden="true" /><input aria-label="Buscar modelos por nome ou descrição" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar modelos por nome ou descrição" /></label>
            {customTemplates.length > 0 && <div className="section-template-filters" role="group" aria-label="Filtrar modelos">
              {[{ id: "all", label: "Todos" }, { id: "ready", label: "Prontos" }, { id: "custom", label: "Meus modelos" }].map((filter) => <button key={filter.id} type="button" className={collection === filter.id ? "active" : ""} aria-pressed={collection === filter.id} onClick={() => setCollection(filter.id as typeof collection)}>{filter.label}{filter.id === "custom" && <span>{customTemplates.length}</span>}</button>)}
            </div>}
            <article className={`section-template-card section-template-blank ${!choice ? "selected" : ""}`}>
              <button className="section-template-option" autoFocus aria-pressed={!choice} onClick={() => setChoice("")} data-template-id="blank">
                <span className="section-template-preview blank-preview" aria-hidden="true"><Plus size={22} strokeWidth={1.2} /></span>
                <span className="section-template-copy"><strong>Em branco</strong><span>Um espaço livre para suas ideias.</span></span>
                {!choice && <Check className="template-selected-icon" size={15} />}
              </button>
            </article>
            {filteredTemplates.length === 0 ? <div className="section-template-empty" role="status"><strong>Nenhum modelo encontrado</strong><span>Tente outro nome ou descrição.</span><button type="button" onClick={() => { setQuery(""); setCollection("all"); }}>Limpar busca e filtros</button></div> : <>
              {filteredReady.length > 0 && <TemplateGroup title={customTemplates.length > 0 ? "Modelos prontos" : "Modelos disponíveis"} templates={filteredReady} choice={choice} light={light} onSelect={setChoice} />}
              {filteredCustom.length > 0 && <TemplateGroup title="Meus modelos" templates={filteredCustom} choice={choice} light={light} onSelect={setChoice} onDelete={onDelete} />}
            </>}
          </section>
          <div className="section-template-detail" aria-label="Prévia do modelo selecionado">
            <div className="section-template-detail-heading"><span>PRÉVIA</span>{selected && customIds.includes(selected.id) && <span className="section-template-saved-label">SEU MODELO</span>}</div>
            <div className={`section-template-detail-canvas ${!selected ? "is-blank" : ""}`} aria-label={selected ? `Prévia: ${selected.name}` : "Prévia de seção em branco"}>
              {selected ? <StaticScene scene={selected.scene} index={0} light={light} images={{}} embeddedFonts="" /> : <div><Plus size={26} strokeWidth={1.2} /><span>Seu espaço começa vazio</span></div>}
            </div>
            <h3>{selected?.name || "Em branco"}</h3>
            <p>{selected?.scene.description || "Crie uma seção livre e adicione suas ideias quando quiser."}</p>
          </div>
        </div>
      </div>
      <div className="section-template-footer"><span>{selected ? selected.name : "Seção em branco"}<small>Você pode editar tudo depois.</small></span><button onClick={onClose}>Cancelar</button><button className="template-create-button" onClick={() => onCreate(selected || null)}>Criar seção <ArrowRight size={15} /></button></div>
    </dialog>
  );
}

function TemplateGroup({ title, templates, choice, light, onSelect, onDelete }: { title: string; templates: BoardTemplate[]; choice: string; light: boolean; onSelect(id: string): void; onDelete?(template: BoardTemplate): void }) {
  return <section className="section-template-group" aria-label={title}><h3>{title}<span>{templates.length}</span></h3><div className="section-template-list">
    {templates.map((template) => <article key={template.id} className={`section-template-card ${choice === template.id ? "selected" : ""}`}>
      <button className="section-template-option" aria-pressed={choice === template.id} onClick={() => onSelect(template.id)} data-template-id={template.id}>
        <span className="section-template-preview" aria-hidden="true"><StaticScene scene={template.scene} index={0} light={light} images={{}} embeddedFonts="" /></span>
        <span className="section-template-copy"><strong>{template.name}</strong><span>{template.scene.description}</span></span>
        {choice === template.id && <Check className="template-selected-icon" size={15} />}
      </button>
      {onDelete && <button className="template-card-delete icon-button" aria-label={`Excluir modelo ${template.name}`} onClick={() => onDelete(template)}><Trash2 size={13} /></button>}
    </article>)}
  </div></section>;
}
