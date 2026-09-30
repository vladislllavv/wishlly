import React, { useRef, useState } from 'react';
import { Trash2, FolderInput } from 'lucide-react';

interface SwipeRowProps {
  enabled: boolean;
  onSwipeLeft: () => void;  // смахнули влево (удалить)
  onSwipeRight: () => void; // смахнули вправо (перенести / дублировать)
  onArm?: () => void;       // жест дошёл до порога — можно дать тактильный отклик
  children: React.ReactNode;
}

const THRESHOLD = 96;      // с какого сдвига жест считается решением
const MAX_DRAG = 140;      // дальше карточку не утягиваем
const INTENT_PX = 8;       // сдвиг, после которого определяем: жест горизонтальный или это прокрутка
const EDGE_PX = 24;        // касания у левого края отдаём системе (на iOS это жест «назад»)
const CLICK_GUARD_MS = 400; // сколько после жеста гасим «хвостовой» click

// Карточка, которую можно смахнуть: влево — удалить, вправо — «перенести или дублировать».
// Вертикальная прокрутка страницы не блокируется (touch-action: pan-y), жест захватываем только когда он явно горизонтальный.
// Действия выполняются через колбэки и всегда с подтверждением/выбором — карточка сама никуда не улетает, а возвращается на место.
export default function SwipeRow({ enabled, onSwipeLeft, onSwipeRight, onArm, children }: SwipeRowProps) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const captured = useRef(false);
  const armed = useRef(false);
  const dragXRef = useRef(0);          // актуальный сдвиг: state в обработчике pointerup мог бы отставать от последнего pointermove
  const suppressClickUntil = useRef(0);

  function setDrag(value: number) {
    dragXRef.current = value;
    setDragX(value);
  }

  function reset() {
    start.current = null;
    captured.current = false;
    armed.current = false;
    setDragging(false);
    setDrag(0);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!enabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Кнопки и ссылки внутри карточки (корзина, «В магазин») работают как обычно
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select')) return;
    if (e.pointerType !== 'mouse' && e.clientX < EDGE_PX) return;
    if (start.current) return; // второй палец, пока идёт жест первого, не должен его сбивать
    suppressClickUntil.current = 0; // новый тап — не «хвост» прошлого жеста
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    captured.current = false;
    armed.current = false;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!captured.current) {
      if (Math.abs(dy) > INTENT_PX && Math.abs(dy) > Math.abs(dx)) { start.current = null; return; } // это прокрутка
      if (Math.abs(dx) < INTENT_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      captured.current = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setDragging(true);
    }
    const next = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dx));
    setDrag(next);
    const isArmed = Math.abs(next) >= THRESHOLD;
    if (isArmed && !armed.current) onArm?.();
    armed.current = isArmed;
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    const wasDragging = captured.current;
    const finalX = dragXRef.current;
    reset();
    if (!wasDragging) return;
    // Следом придёт click — его нужно погасить, иначе откроется карточка. По времени, а не по setTimeout(0):
    // на тач-устройствах click может прийти отдельной задачей позже
    suppressClickUntil.current = performance.now() + CLICK_GUARD_MS;
    if (finalX <= -THRESHOLD) onSwipeLeft();
    else if (finalX >= THRESHOLD) onSwipeRight();
  }

  const isArmed = Math.abs(dragX) >= THRESHOLD;
  const revealingDelete = dragX < 0;

  return (
    // overflow-x-clip: сдвинутая карточка не выступает за пределы строки и не растягивает страницу; -mx/px оставляют место под тень
    <div className="relative -mx-1.5 px-1.5 overflow-x-clip">
      {dragX !== 0 && (
        <div
          aria-hidden="true"
          className={`absolute inset-y-0 inset-x-1.5 rounded-card flex items-center px-4 font-bold text-sm transition-colors ${
            revealingDelete
              ? `justify-end gap-2 ${isArmed ? 'bg-red-100' : 'bg-red-50'} text-danger-text`
              : `justify-start gap-2 ${isArmed ? 'bg-rose-100' : 'bg-rose-50'} text-accent-text`
          }`}
        >
          {revealingDelete ? (
            <>Удалить<Trash2 className="h-5 w-5" /></>
          ) : (
            <><FolderInput className="h-5 w-5 flex-none" /><span className="flex flex-col leading-tight"><span>Перенести</span><span className="text-xs font-semibold opacity-80">или копия</span></span></>
          )}
        </div>
      )}
      <div
        className={`touch-pan-y ${dragging ? 'select-none' : ''}`}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 200ms ease-out',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={reset}
        // только когда capture потерял сам контейнер: при переносе неявного capture с внутреннего элемента событие всплывает сюда же
        onLostPointerCapture={(e) => { if (e.target === e.currentTarget && captured.current) reset(); }}
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={(e) => { if (performance.now() < suppressClickUntil.current) { e.stopPropagation(); e.preventDefault(); } }}
      >
        {children}
      </div>
    </div>
  );
}
