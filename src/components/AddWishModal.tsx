import type React from 'react';
import { Gift, PlusCircle, Tag, Link as LinkIcon, Sparkles, Loader2, Camera, XCircle, X } from 'lucide-react';
import type { Group } from '../types';
import { CURRENCY_OPTIONS, type WishFormState } from '../wishForm';
import { isSafeLink, normalizeLink, linkProblem } from '../linkUtils';
import { inertWhen } from '../telegramUtils';

type AutoFilledRef = React.MutableRefObject<{ title: boolean; imageUrl: boolean; priceAmount: boolean; note: boolean }>;

interface AddWishModalProps {
  isOpen: boolean;
  editingWishId: string | null;
  newWish: WishFormState;
  setNewWish: React.Dispatch<React.SetStateAction<WishFormState>>;
  autoFilledRef: AutoFilledRef;
  groups: Group[];
  onCreateGroup: () => void;
  linkInputRef: React.RefObject<HTMLInputElement>;
  linkTouched: boolean;
  onLinkBlur: () => void;
  onParseLink: () => void;
  isParsingLink: boolean;
  isImageProcessing: boolean;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  nativeMain: boolean;
  isSubmitting: boolean;
  onSubmit: (e?: React.FormEvent) => void;
  onRequestClose: () => void;
}

export default function AddWishModal({
  isOpen, editingWishId, newWish, setNewWish, autoFilledRef, groups, onCreateGroup,
  linkInputRef, linkTouched, onLinkBlur, onParseLink, isParsingLink, isImageProcessing, onImageUpload,
  nativeMain, isSubmitting, onSubmit, onRequestClose,
}: AddWishModalProps) {
  return (
    <>
      {/* Add Modal Overlay */}
      <div
        className={`absolute inset-0 z-40 bg-black/25 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={onRequestClose}
      />

      {/* Add Modal Bottom Sheet */}
      <div
        role="dialog"
        data-overlay="add"
        tabIndex={-1}
        aria-modal="true"
        aria-label={editingWishId ? 'Изменить желание' : 'Новое желание'}
        aria-hidden={!isOpen}
        {...inertWhen(!isOpen)}
        className={`outline-none absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-400 transform ease-out max-h-[90dvh] overflow-y-auto custom-scrollbar ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="p-7 relative pb-safe">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />

          <button
            onClick={onRequestClose}
            aria-label="Закрыть"
            className="absolute top-5 right-5 h-11 w-11 flex items-center justify-center bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 hover:text-gray-600 active:scale-90 transition-all"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="text-2xl font-bold text-gray-900 mb-6">{editingWishId ? 'Изменить желание' : 'Новое желание ✨'}</h2>

          <form onSubmit={onSubmit} className="space-y-4">

            <div className="relative">
              <Gift className="absolute left-4 top-4 h-6 w-6 text-gray-500" />
              <input
                type="text"
                placeholder="Что вы хотите?"
                aria-label="Название желания"
                required
                maxLength={200}
                value={newWish.title}
                onChange={(e) => { autoFilledRef.current.title = false; setNewWish({...newWish, title: e.target.value}); }}
                className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-button py-4 pl-14 pr-4 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-500"
              />
            </div>

            {/* Group Selector */}
            <div className="flex flex-col gap-2 mb-2">
              <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider text-xs px-1">Группа желаний</label>
              <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar">
                <button
                    type="button"
                    onClick={() => setNewWish({...newWish, groupId: 'unassigned'})}
                    aria-pressed={newWish.groupId === 'unassigned'}
                    className={`whitespace-nowrap px-4 py-2.5 min-h-11 rounded-2xl text-sm font-semibold transition-all ${newWish.groupId === 'unassigned' ? 'bg-gradient-to-r from-accent to-accent-2 text-on-accent shadow-md' : 'bg-gray-50 text-gray-500 border-2 border-transparent hover:bg-gray-100'}`}
                >
                    Без группы
                </button>
                {groups.map(group => (
                    <button
                    key={group.id}
                    type="button"
                    onClick={() => setNewWish({...newWish, groupId: group.id})}
                    aria-pressed={newWish.groupId === group.id}
                    className={`whitespace-nowrap px-4 py-2.5 min-h-11 rounded-2xl text-sm font-semibold transition-all ${newWish.groupId === group.id ? 'bg-gradient-to-r from-accent to-accent-2 text-on-accent shadow-md' : 'bg-gray-50 text-gray-500 border-2 border-transparent hover:bg-gray-100'}`}
                    >
                    {group.name}
                    </button>
                ))}
                <button
                  type="button"
                  onClick={onCreateGroup}
                  className="whitespace-nowrap px-4 py-2.5 min-h-11 rounded-2xl text-sm font-semibold bg-rose-50 text-accent-text hover:bg-rose-100 transition-all flex items-center gap-1.5 border-2 border-transparent"
                >
                  <PlusCircle className="h-4 w-4" />
                  Создать
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="relative flex-[2]">
                <Tag className="absolute left-4 top-4 h-6 w-6 text-gray-500" />
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Цена (необязательно)"
                  aria-label="Цена"
                  value={newWish.priceAmount}
                  onChange={(e) => { autoFilledRef.current.priceAmount = false; setNewWish({...newWish, priceAmount: e.target.value}); }}
                  className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-button py-4 pl-14 pr-4 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-500"
                />
              </div>
              <select
                value={newWish.priceCurrency}
                onChange={(e) => setNewWish({...newWish, priceCurrency: e.target.value})}
                aria-label="Валюта"
                className="flex-1 bg-gray-50 border-2 border-transparent text-gray-900 rounded-button px-2 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold text-center"
              >
                {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="relative">
              <LinkIcon className="absolute left-4 top-4 h-6 w-6 text-gray-500" />
              <input
                ref={linkInputRef}
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Ссылка на товар (необязательно)"
                aria-label="Ссылка на товар"
                aria-invalid={linkTouched && !!linkProblem(newWish.link)}
                aria-describedby={linkTouched && linkProblem(newWish.link) ? 'wish-link-error' : undefined}
                value={newWish.link}
                onChange={(e) => setNewWish({...newWish, link: e.target.value})}
                onBlur={() => { if (newWish.link.trim()) onLinkBlur(); }}
                className={`w-full bg-gray-50 border-2 text-gray-900 rounded-button py-4 pl-14 pr-32 outline-none focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-500 ${linkTouched && linkProblem(newWish.link) ? 'border-red-300 focus:border-red-400' : 'border-transparent focus:border-rose-200'}`}
              />
              {isSafeLink(normalizeLink(newWish.link)) && !linkProblem(newWish.link) && (
                <button
                  type="button"
                  onClick={onParseLink}
                  disabled={isParsingLink}
                  className="absolute right-2 top-2 bottom-2 px-3.5 rounded-2xl text-xs font-bold bg-rose-50 text-accent-text hover:bg-rose-100 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isParsingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Заполнить
                </button>
              )}
              {linkTouched && linkProblem(newWish.link) && (
                <p id="wish-link-error" role="alert" className="mt-1.5 px-2 text-sm font-medium text-danger-text">
                  {linkProblem(newWish.link)}
                </p>
              )}
            </div>

            <textarea
              placeholder="Комментарий: размер, цвет, пожелания (необязательно)"
              aria-label="Комментарий к желанию"
              rows={2}
              maxLength={500}
              value={newWish.note}
              onChange={(e) => { autoFilledRef.current.note = false; setNewWish({...newWish, note: e.target.value}); }}
              className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-button py-4 px-5 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-500 resize-none"
            />

            <div className="relative">
              {newWish.imageUrl ? (
                <div className="relative w-full h-32 rounded-button overflow-hidden border-2 border-gray-100 bg-gray-50">
                  <img src={newWish.imageUrl} alt="Выбранное фото" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { autoFilledRef.current.imageUrl = false; setNewWish({...newWish, imageUrl: ''}); }}
                    aria-label="Убрать фото"
                    className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-1.5 text-gray-500 hover:text-danger-text transition-colors shadow-sm"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-button bg-gray-50 hover:bg-rose-50 hover:border-rose-200 transition-all cursor-pointer group">
                  {isImageProcessing ? (
                    <Loader2 className="h-6 w-6 animate-spin text-rose-500 mb-2" />
                  ) : (
                    <Camera className="h-6 w-6 text-gray-500 mb-2 group-hover:text-rose-400 transition-colors" />
                  )}
                  <span className="text-sm font-semibold text-gray-500 group-hover:text-rose-400 transition-colors">
                    {isImageProcessing ? 'Обработка...' : 'Загрузить фото (необязательно)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onImageUpload}
                    disabled={isImageProcessing}
                  />
                </label>
              )}
            </div>

            {!nativeMain && <button
              type="submit"
              disabled={isSubmitting || isImageProcessing || !newWish.title.trim()}
              className="w-full mt-4 bg-gradient-to-r from-accent to-accent-2 text-on-accent font-bold rounded-button py-4 shadow-lg shadow-pink-200/50 transition-all hover:shadow-xl hover:scale-[1.01] disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-6 w-6" />
                  {editingWishId ? 'Сохранить изменения' : 'Сохранить в вишлист'}
                </>
              )}
            </button>}
          </form>
        </div>
      </div>
    </>
  );
}
