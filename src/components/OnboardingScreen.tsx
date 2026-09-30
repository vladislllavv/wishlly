import { Gift, Folder, CheckCircle, ArrowRight, ArrowLeft, Calendar, Search, XCircle, Check, Loader2 } from 'lucide-react';
import { INTEREST_CATEGORIES, normalizeSearch } from '../interests';
import { birthdateProblem, todayISO, MIN_BIRTH_YEAR } from '../formatUtils';

export const MIN_ONBOARDING_INTERESTS = 5;

export interface OnboardingFormState {
  birthdate: string;
  gender: string;
}

interface OnboardingScreenProps {
  step: number;
  onStepChange: (step: number) => void;
  form: OnboardingFormState;
  onFormChange: (form: OnboardingFormState) => void;
  interestsQuery: string;
  onInterestsQueryChange: (query: string) => void;
  interestsDraft: string[];
  onToggleInterest: (name: string) => void;
  onComplete: () => void;
  isSavingProfile: boolean;
}

export default function OnboardingScreen({
  step, onStepChange, form, onFormChange, interestsQuery, onInterestsQueryChange,
  interestsDraft, onToggleInterest, onComplete, isSavingProfile,
}: OnboardingScreenProps) {
  return (
    <div className="absolute inset-0 z-[100] bg-white flex flex-col overflow-y-auto animate-in fade-in duration-300 pb-safe custom-scrollbar">
      <div className="flex-1 px-6 pt-12 flex flex-col items-center">
        {step === 1 ? (
          <div className="flex flex-col items-center text-center max-w-sm w-full animate-in slide-in-from-right-8 duration-300 h-full">
            <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-rose-100 to-pink-100 flex items-center justify-center shadow-inner mb-8 border-4 border-white">
              <Gift className="h-14 w-14 text-rose-500" />
            </div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Шаг 1 из 3</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">Добро пожаловать в WISHLLY! ✨</h2>
            <p className="text-gray-500 font-medium mb-10 text-lg">Ваш идеальный список желаний, которым хочется делиться.</p>

            <div className="space-y-6 text-left w-full">
              <div className="flex items-start gap-4">
                <div className="bg-rose-50 p-3.5 rounded-2xl">
                  <Gift className="h-6 w-6 text-rose-500" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-lg">Добавляйте желания</h4>
                  <p className="text-sm text-gray-500 font-medium mt-0.5">Сохраняйте все, что хотите получить в подарок.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-rose-50 p-3.5 rounded-2xl">
                  <Folder className="h-6 w-6 text-rose-500" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-lg">Сортируйте по поводам</h4>
                  <p className="text-sm text-gray-500 font-medium mt-0.5">Разделяйте подарки на День рождения, Новый год и т.д.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-rose-50 p-3.5 rounded-2xl">
                  <CheckCircle className="h-6 w-6 text-rose-500" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-lg">Тайная бронь</h4>
                  <p className="text-sm text-gray-500 font-medium mt-0.5">Друзья могут занять подарок, а для вас это останется сюрпризом!</p>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-10 w-full pb-8">
                <button
                onClick={() => onStepChange(2)}
                className="w-full bg-gray-900 text-white font-bold rounded-button py-4 shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                Продолжить <ArrowRight className="h-5 w-5" />
                </button>
            </div>
          </div>
        ) : step === 2 ? (
          <div className="flex flex-col items-center w-full max-w-sm animate-in slide-in-from-right-8 duration-300 h-full">
            <div className="w-full flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => onStepChange(1)}
                className="flex items-center gap-1 -ml-2 px-2 py-2.5 rounded-full text-sm font-semibold text-gray-500 hover:text-gray-700 active:scale-95 transition-all"
              >
                <ArrowLeft className="h-5 w-5" />
                Назад
              </button>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Шаг 2 из 3</p>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3 text-center pt-6">Ещё пара деталей</h2>
            <p className="text-gray-500 font-medium mb-10 text-center">Это поможет друзьям не забыть о вашем празднике.</p>

            <div className="w-full space-y-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="onboarding-birthdate" className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1">Дата рождения *</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-4 h-6 w-6 text-gray-500" />
                  <input
                    id="onboarding-birthdate"
                    type="date"
                    min={`${MIN_BIRTH_YEAR}-01-01`}
                    max={todayISO()}
                    value={form.birthdate}
                    aria-invalid={!!birthdateProblem(form.birthdate)}
                    onChange={(e) => onFormChange({...form, birthdate: e.target.value})}
                    className={`w-full bg-gray-50 border-2 text-gray-900 rounded-button py-4 pl-14 pr-4 outline-none focus:bg-white transition-all font-semibold ${birthdateProblem(form.birthdate) ? 'border-red-300 focus:border-red-400' : 'border-transparent focus:border-rose-200'}`}
                  />
                </div>
                {birthdateProblem(form.birthdate) && (
                  <p role="alert" className="px-2 text-sm font-medium text-danger-text">{birthdateProblem(form.birthdate)}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1">Пол *</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Мужской', 'Женский'].map(gender => (
                    <button
                      key={gender}
                      onClick={() => onFormChange({...form, gender})}
                      className={`py-4 rounded-button font-bold border-2 transition-all ${form.gender === gender ? 'border-rose-200 bg-rose-50 text-accent-text' : 'border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                    >
                      {gender}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto pt-10 w-full pb-8">
                {(() => {
                  // Почему «Готово» неактивна — говорим прямо, а не оставляем серую кнопку без объяснения
                  const noDate = !form.birthdate;
                  const noGender = form.gender === 'Не указано';
                  const hint = noDate && noGender ? 'Укажите дату рождения и пол'
                    : noDate ? (birthdateProblem(form.birthdate) ? null : 'Укажите дату рождения')
                    : noGender ? 'Выберите пол' : null;
                  return hint ? <p className="mb-3 text-center text-sm font-medium text-gray-500">{hint}</p> : null;
                })()}
                <button
                onClick={() => onStepChange(3)}
                disabled={!form.birthdate || !!birthdateProblem(form.birthdate) || form.gender === 'Не указано'}
                className="w-full bg-gray-900 text-white font-bold rounded-button py-4 shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                Продолжить <ArrowRight className="h-5 w-5" />
                </button>
            </div>
          </div>
        ) : (() => {
          const q = normalizeSearch(interestsQuery);
          const categories = INTEREST_CATEGORIES
            .map(category => ({
              ...category,
              items: !q || normalizeSearch(category.name).includes(q)
                ? category.items
                : category.items.filter(item => normalizeSearch(item).includes(q)),
            }))
            .filter(category => category.items.length > 0);
          const remaining = MIN_ONBOARDING_INTERESTS - interestsDraft.length;

          return (
            <div className="flex flex-col items-center w-full max-w-sm animate-in slide-in-from-right-8 duration-300 h-full">
              <div className="w-full flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => onStepChange(2)}
                  className="flex items-center gap-1 -ml-2 px-2 py-2.5 rounded-full text-sm font-semibold text-gray-500 hover:text-gray-700 active:scale-95 transition-all"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Назад
                </button>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Шаг 3 из 3</p>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3 text-center pt-6">Что вам интересно?</h2>
              <p className="text-gray-500 font-medium mb-6 text-center">
                Выберите минимум {MIN_ONBOARDING_INTERESTS} — по ним подберём идеи подарков во вкладке «Идеи».
              </p>

              <div className="relative w-full mb-5">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  inputMode="search"
                  placeholder="Найти интерес"
                  aria-label="Поиск по интересам"
                  value={interestsQuery}
                  onChange={(e) => onInterestsQueryChange(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-tile py-3 pl-12 pr-11 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-500"
                />
                {interestsQuery && (
                  <button
                    onClick={() => onInterestsQueryChange('')}
                    aria-label="Очистить поиск"
                    className="absolute right-3 top-2.5 p-1.5 text-gray-500 hover:text-gray-600"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="w-full flex-1 overflow-y-auto space-y-5 custom-scrollbar pb-4">
                {categories.length === 0 ? (
                  <p className="text-center text-gray-500 font-medium py-10">Ничего не нашлось. Попробуйте другое слово.</p>
                ) : (
                  categories.map(category => (
                    <section key={category.name}>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-2">
                        {category.emoji} {category.name}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {category.items.map(item => {
                          const selected = interestsDraft.includes(item);
                          return (
                            <button
                              key={item}
                              onClick={() => onToggleInterest(item)}
                              aria-pressed={selected}
                              className={`px-3.5 py-2 rounded-2xl text-sm font-semibold transition-all active:scale-95 ${selected ? 'bg-gradient-to-r from-accent to-accent-2 text-on-accent shadow-md' : 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100'}`}
                            >
                              {item}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))
                )}
              </div>

              <div className="mt-auto pt-4 w-full pb-8">
                {remaining > 0 && (
                  <p className="mb-3 text-center text-sm font-medium text-gray-500">
                    Выберите ещё {remaining} {remaining === 1 ? 'интерес' : remaining < 5 ? 'интереса' : 'интересов'}
                  </p>
                )}
                <button
                  onClick={onComplete}
                  disabled={interestsDraft.length < MIN_ONBOARDING_INTERESTS || isSavingProfile}
                  className="w-full bg-gradient-to-r from-accent to-accent-2 text-on-accent font-bold rounded-button py-4 shadow-lg shadow-pink-200/50 transition-all hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:shadow-none active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {isSavingProfile ? <Loader2 className="h-6 w-6 animate-spin" /> : <Check className="h-6 w-6" />}
                  {isSavingProfile ? 'Сохраняем…' : `Готово (${interestsDraft.length})`}
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
