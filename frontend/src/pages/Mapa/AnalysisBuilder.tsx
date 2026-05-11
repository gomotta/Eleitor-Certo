import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type Dimension, DIMENSION_DEFS } from './rankingHelpers';

const ICON: Record<Dimension, JSX.Element> = {
  partido: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22V4l9 4-9 4" /><path d="M4 14l9 4 7-4-7-3" />
    </svg>
  ),
  macro: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  ),
  micro: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h18M3 12h18M3 17h18" />
    </svg>
  ),
  municipio: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />
    </svg>
  ),
  candidato: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  ),
  cargo: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  local: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-4h6v4" /><path d="M12 3v2" />
    </svg>
  ),
};

function DragHandle() {
  return (
    <span className="text-gray-300 text-xs leading-none select-none cursor-grab active:cursor-grabbing">⋮⋮</span>
  );
}

function PaletteChip({ dim, disabled }: { dim: Dimension; disabled: boolean }) {
  const meta = DIMENSION_DEFS.find((d) => d.id === dim)!;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${dim}`,
    data: { source: 'palette', dim },
    disabled,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      disabled={disabled}
      title={disabled ? 'Já adicionado' : `Arrastar ${meta.label}`}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all
        ${disabled
          ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
          : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300 hover:text-primary-700 hover:shadow-sm cursor-grab active:cursor-grabbing'}
        ${isDragging ? 'opacity-30' : ''}`}
    >
      <span className={disabled ? 'text-gray-300' : 'text-primary-500'}>{ICON[dim]}</span>
      <span>{meta.label}</span>
    </button>
  );
}

function SortableChip({ dim, index, onRemove, total }: { dim: Dimension; index: number; total: number; onRemove: () => void }) {
  const meta = DIMENSION_DEFS.find((d) => d.id === dim)!;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `dim:${dim}`,
    data: { source: 'list', dim },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} className={`flex items-center shrink-0 ${isDragging ? 'z-10' : ''}`}>
      <div
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label={`Mover ${meta.label}`}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border bg-white shadow-sm select-none cursor-grab active:cursor-grabbing touch-none
          ${isDragging ? 'border-primary-400 shadow-md' : 'border-gray-200'}`}
      >
        <span className="pointer-events-none"><DragHandle /></span>
        <span className="text-[11px] font-medium text-gray-800 pointer-events-none">{meta.label}</span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label={`Remover ${meta.label}`}
          className="w-3 h-3 rounded text-gray-300 hover:text-red-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {index < total - 1 && (
        <svg className="w-3.5 h-3.5 mx-0.5 text-primary-300 shrink-0 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  );
}

function DropZone({ dims, children }: { dims: Dimension[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'dropzone' });
  const empty = dims.length === 0;
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl transition-all ${
        isOver
          ? 'bg-primary-100/60 border-2 border-solid border-primary-500'
          : empty
            ? 'bg-primary-50/30 border-2 border-dashed border-primary-200'
            : 'bg-gray-50/40 border border-gray-200'
      }`}
    >
      {empty ? (
        <div className="flex flex-col items-center text-center px-4 py-6 gap-2">
          <svg className={`w-10 h-10 ${isOver ? 'text-primary-500' : 'text-primary-300'}`} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7l8-4 8 4-8 4-8-4z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 12l8 4 8-4" opacity="0.6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 17l8 4 8-4" opacity="0.3" />
          </svg>
          <div className="text-[12px] font-semibold text-primary-700">
            Construa sua análise
          </div>
          <div className="text-[10px] text-gray-500 leading-snug max-w-[260px]">
            Arraste dimensões aqui para criar um drilldown.
            <br />
            <span className="text-gray-400">A ordem define a hierarquia.</span>
          </div>
        </div>
      ) : (
        <div className="p-2 flex flex-row flex-wrap items-center gap-y-1.5 gap-x-0">{children}</div>
      )}
    </div>
  );
}

export default function AnalysisBuilder({
  dims, onChange, cargoTodos = false,
}: {
  dims: Dimension[];
  onChange: (dims: Dimension[]) => void;
  cargoTodos?: boolean;
}) {
  const palette = cargoTodos ? DIMENSION_DEFS : DIMENSION_DEFS.filter((d) => d.id !== 'cargo');
  const [activeDim, setActiveDim] = useState<Dimension | null>(null);
  const [activeSource, setActiveSource] = useState<'palette' | 'list' | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Quando estamos reordenando um chip da própria lista, ignorar o droppable
  // 'dropzone' nas colisões — caso contrário ele "ganha" sempre que o ponteiro
  // sai do retângulo de outro chip (ex.: arrastando para a esquerda do primeiro
  // chip), bloqueando a reordenação para trás. Para drags vindo da palette,
  // mantemos o comportamento original que aceita dropzone como destino.
  const collision: CollisionDetection = (args) => {
    if (activeSource === 'list') {
      // Só consideramos chips como alvos: se o ponteiro estiver sobre um chip,
      // reordena; caso contrário não há "over", e o drop fora remove o card.
      const onlyChips = {
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (c) => String(c.id).startsWith('dim:'),
        ),
      };
      const pointer = pointerWithin(onlyChips);
      if (pointer.length > 0) return pointer;
      return [];
    }
    return closestCenter(args);
  };

  const handleDragStart = (e: DragStartEvent) => {
    const dim = e.active.data.current?.dim as Dimension | undefined;
    const source = e.active.data.current?.source as 'palette' | 'list' | undefined;
    if (dim) setActiveDim(dim);
    setActiveSource(source ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDim(null);
    setActiveSource(null);
    const { active, over } = e;
    const source = active.data.current?.source as 'palette' | 'list' | undefined;
    const dim = active.data.current?.dim as Dimension;

    if (source === 'palette') {
      if (!over) return;
      if (dims.includes(dim)) return;
      const overId = String(over.id);
      if (overId === 'dropzone') {
        onChange([...dims, dim]);
      } else if (overId.startsWith('dim:')) {
        const targetDim = overId.slice(4) as Dimension;
        const idx = dims.indexOf(targetDim);
        const next = [...dims];
        next.splice(idx + 1, 0, dim);
        onChange(next);
      } else {
        onChange([...dims, dim]);
      }
      return;
    }

    if (source === 'list') {
      // Solto fora de qualquer chip da lista -> remove (volta para a palette).
      if (!over) {
        onChange(dims.filter((d) => d !== dim));
        return;
      }
      const overId = String(over.id);
      if (!overId.startsWith('dim:')) {
        onChange(dims.filter((d) => d !== dim));
        return;
      }
      const overDim = overId.slice(4) as Dimension;
      if (overDim === dim) return;
      const oldIdx = dims.indexOf(dim);
      const newIdx = dims.indexOf(overDim);
      if (oldIdx < 0 || newIdx < 0) return;
      onChange(arrayMove(dims, oldIdx, newIdx));
    }
  };

  const remove = (dim: Dimension) => onChange(dims.filter((d) => d !== dim));
  const clear = () => onChange([]);

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => { setActiveDim(null); setActiveSource(null); }}>
      <div className="px-4 pt-3 pb-3 border-b border-gray-100 bg-white">
        {/* Palette */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Dimensões disponíveis
          </span>
          {dims.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
            >
              Limpar
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {palette.filter((d) => !dims.includes(d.id)).map((d) => (
            <PaletteChip key={d.id} dim={d.id} disabled={false} />
          ))}
        </div>

        {/* Drop zone */}
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Construir análise
        </div>
        <DropZone dims={dims}>
          <SortableContext items={dims.map((d) => `dim:${d}`)} strategy={rectSortingStrategy}>
            {dims.map((d, i) => (
              <SortableChip key={d} dim={d} index={i} total={dims.length} onRemove={() => remove(d)} />
            ))}
          </SortableContext>
        </DropZone>
      </div>

      {createPortal(
        <DragOverlay dropAnimation={{ duration: 180 }}>
          {activeDim ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-primary-400 bg-white text-[11px] font-medium text-primary-700 shadow-md rotate-[-2deg] scale-105">
              <span className="text-primary-500">{ICON[activeDim]}</span>
              <span>{DIMENSION_DEFS.find((d) => d.id === activeDim)!.label}</span>
            </div>
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
