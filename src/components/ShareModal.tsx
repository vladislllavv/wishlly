import { X, Share2, Gift, Folder } from 'lucide-react';
import type { Group } from '../types';
import { inertWhen } from '../telegramUtils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  onShare: (groupId: string, groupName: string) => void;
}

export default function ShareModal({ isOpen, onClose, groups, onShare }: ShareModalProps) {
  return (
    <>
      <div
        className={`absolute inset-0 z-[60] bg-black/45 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={onClose}
      />
      <div
        role="dialog"
        data-overlay="share"
        tabIndex={-1}
        aria-modal="true"
        aria-label="Поделиться вишлистом"
        aria-hidden={!isOpen}
        {...inertWhen(!isOpen)}
        className={`outline-none absolute bottom-0 left-0 right-0 z-[70] bg-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-400 transform ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="p-7 relative pb-safe">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />

          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute top-5 right-5 h-11 w-11 flex items-center justify-center bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 hover:text-gray-600 active:scale-90 transition-all"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
             <Share2 className="h-6 w-6 text-rose-500" />
             Поделиться
          </h2>

          <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
             <button
                onClick={() => onShare('all', 'Все желания')}
                className="w-full flex items-center gap-4 p-4 rounded-tile bg-gray-50 hover:bg-rose-50 transition-colors border-2 border-transparent hover:border-rose-100 group text-left"
             >
                <div className="bg-white p-3 rounded-2xl shadow-sm group-hover:text-rose-500 text-gray-500 transition-colors">
                   <Gift className="h-6 w-6" />
                </div>
                <div>
                   <h4 className="font-bold text-gray-900 text-lg">Все желания</h4>
                   <p className="text-sm font-medium text-gray-500">Отправить общий список</p>
                </div>
             </button>

             {groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => onShare(group.id, group.name)}
                  className="w-full flex items-center gap-4 p-4 rounded-tile bg-gray-50 hover:bg-rose-50 transition-colors border-2 border-transparent hover:border-rose-100 group text-left"
               >
                  <div className="bg-white p-3 rounded-2xl shadow-sm group-hover:text-rose-500 text-gray-500 transition-colors">
                     <Folder className="h-6 w-6" />
                  </div>
                  <div>
                     <h4 className="font-bold text-gray-900 text-lg">{group.name}</h4>
                     <p className="text-sm font-medium text-gray-500">Только из этой группы</p>
                  </div>
               </button>
             ))}
          </div>
        </div>
      </div>
    </>
  );
}
