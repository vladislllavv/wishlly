import { Sparkles } from 'lucide-react';

// Раздел временно отключён: прошлый источник товаров (gdeslon) убран,
// колода свайпов вернётся, когда подключим новый сервис подборок.
export default function IdeasComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center text-center mt-20 text-gray-500 px-6">
      <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-rose-50 to-pink-50 flex items-center justify-center mb-6 shadow-inner">
        <Sparkles className="h-12 w-12 text-rose-300" />
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Раздел в разработке</h2>
      <p className="text-base text-gray-500 max-w-xs">
        Мы меняем источник подборок подарков. Как только подключим новый сервис — вернёмся к разработке «Идей».
      </p>
    </div>
  );
}
