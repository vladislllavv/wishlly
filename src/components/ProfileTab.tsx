import { User, Calendar, ArrowRight, Pencil, Users, X } from 'lucide-react';
import type { Profile, Wish } from '../types';
import { formatBirthdate, daysUntilBirthday, birthdayLabel } from '../formatUtils';
import type { ThemePreference } from '../theme';

interface ProfileTabProps {
  tgUser: any;
  userProfile: Profile | null;
  wishes: Wish[];
  userId: string | undefined;
  reservedCount: number;
  onGoToReserved: () => void;
  onOpenInterests: () => void;
  // profile: undefined — ещё грузится, null — профиля нет
  friends: { ownerId: string; profile: Profile | null | undefined }[];
  onOpenFriend: (ownerId: string) => void;
  onLeaveFriend: (ownerId: string) => void;
  themePref: ThemePreference;
  onThemeChange: (preference: ThemePreference) => void;
}

export default function ProfileTab({
  tgUser, userProfile, wishes, userId, reservedCount, onGoToReserved, onOpenInterests,
  friends, onOpenFriend, onLeaveFriend, themePref, onThemeChange,
}: ProfileTabProps) {
  // Ближайшие дни рождения — выше
  const sortedFriends = [...friends].sort((a, b) => {
    const da = daysUntilBirthday(a.profile?.birthdate) ?? Infinity;
    const db = daysUntilBirthday(b.profile?.birthdate) ?? Infinity;
    return da - db;
  });

  return (
    <div className="flex flex-col items-center mt-8 px-4">
      <div className="relative mb-5">
        <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-rose-100 to-pink-100 flex items-center justify-center border-4 border-white shadow-lg overflow-hidden relative z-10">
          {tgUser?.photo_url ? (
            <img src={tgUser.photo_url} alt="Фото профиля" className="h-full w-full object-cover" />
          ) : (
            <User className="h-12 w-12 text-rose-300" />
          )}
        </div>
        <div className="absolute top-0 -inset-1 bg-gradient-to-r from-rose-400 to-pink-400 rounded-full blur opacity-30"></div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900">
        {tgUser ? `${tgUser.first_name} ${tgUser.last_name || ''}` : 'Мой Профиль'}
      </h2>
      {tgUser?.username && (
        <p className="text-sm text-gray-500 mt-1 font-medium bg-gray-100 px-3 py-1 rounded-lg">
          @{tgUser.username}
        </p>
      )}

      {/* Profile Info Display */}
      {userProfile && (
        <div className="flex gap-4 mt-4">
          {userProfile.birthdate && (
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100">
              <Calendar className="h-4 w-4 text-rose-400" />
              {formatBirthdate(userProfile.birthdate)}
            </div>
          )}
          {userProfile.gender && userProfile.gender !== 'Не указано' && (
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
              <User className="h-4 w-4 text-indigo-400" />
              {userProfile.gender}
            </div>
          )}
        </div>
      )}

      {/* Исправленный блок статистики */}
      <div className="mt-8 bg-white p-6 rounded-sheet shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100 w-full">
        <h3 className="font-semibold text-gray-900 mb-4 text-lg">Статистика</h3>
        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-tile mb-3">
          <span className="text-gray-500 font-medium">Мои желания</span>
          <span className="font-bold text-xl text-rose-500">
            {wishes.filter(w => w.ownerId === userId).length}
          </span>
        </div>
        <button
          onClick={onGoToReserved}
          className="w-full flex justify-between items-center bg-gray-50 p-4 rounded-tile hover:bg-gray-100 active:scale-[0.99] transition-all"
        >
          <span className="text-gray-500 font-medium flex items-center gap-1.5">
            Я дарю
            <ArrowRight className="h-4 w-4" />
          </span>
          <span className="font-bold text-xl text-success-text">
            {reservedCount}
          </span>
        </button>
      </div>

      <div className="mt-4 bg-white p-6 rounded-sheet shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100 w-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-lg">Интересы</h3>
          <button
            onClick={onOpenInterests}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-11 rounded-2xl text-xs font-bold bg-rose-50 text-accent-text border border-rose-100 hover:bg-rose-100 active:scale-95 transition-all"
          >
            <Pencil className="h-3.5 w-3.5" />
            {userProfile?.interests?.length ? 'Изменить' : 'Выбрать'}
          </button>
        </div>
        {userProfile?.interests?.length ? (
          <div className="flex flex-wrap gap-2">
            {userProfile.interests.map(name => (
              <span key={name} className="bg-rose-50 text-accent-text text-xs font-bold px-3 py-1.5 rounded-xl border border-rose-100">
                {name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 font-medium">Добавьте интересы — так друзьям будет проще выбрать подарок.</p>
        )}
      </div>

      <div className="mt-4 bg-white p-6 rounded-sheet shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100 w-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-rose-400" />
            Друзья
          </h3>
          {friends.length > 0 && <span className="text-sm font-bold text-gray-500">{friends.length}</span>}
        </div>
        {sortedFriends.length === 0 ? (
          <p className="text-sm text-gray-500 font-medium">Откройте вишлист друга по ссылке и нажмите «Присоединиться». Он появится здесь.</p>
        ) : (
          <ul className="space-y-2">
            {sortedFriends.map(({ ownerId, profile }) => {
              const days = daysUntilBirthday(profile?.birthdate);
              const name = profile?.firstName || (profile === undefined ? 'Загрузка…' : 'Друг');
              return (
                <li key={ownerId} className="flex items-center gap-3 bg-gray-50 p-3 rounded-tile">
                  <div className="h-10 w-10 flex-none rounded-full bg-gradient-to-tr from-rose-100 to-pink-100 flex items-center justify-center font-bold text-rose-400">
                    {name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <p className="font-semibold text-gray-900 truncate">{name}</p>
                    {days !== null && <p className="text-xs font-semibold text-accent-text leading-snug">{birthdayLabel(days)}</p>}
                  </div>
                  <button
                    onClick={() => onOpenFriend(ownerId)}
                    className="px-3.5 py-2 min-h-11 rounded-2xl text-xs font-bold bg-rose-50 text-accent-text border border-rose-100 hover:bg-rose-100 active:scale-95 transition-all"
                  >
                    Вишлист
                  </button>
                  <button
                    onClick={() => onLeaveFriend(ownerId)}
                    aria-label={`Отписаться от вишлиста: ${name}`}
                    className="flex-none h-11 w-11 flex items-center justify-center rounded-2xl text-gray-500 hover:bg-gray-100 active:scale-95 transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 bg-white p-6 rounded-sheet shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100 w-full">
        <h3 className="font-semibold text-gray-900 mb-3 text-lg">Тема</h3>
        <div className="grid grid-cols-3 gap-1 bg-gray-50 p-1 rounded-tile" role="group" aria-label="Тема оформления">
          {([['auto', 'Авто'], ['light', 'Светлая'], ['dark', 'Тёмная']] as [ThemePreference, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => onThemeChange(value)}
              aria-pressed={themePref === value}
              className={`py-2.5 min-h-11 rounded-2xl text-sm font-semibold transition-all ${themePref === value ? 'bg-white text-accent-text shadow-sm' : 'text-gray-500 hover:text-gray-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 font-medium mt-3">«Авто» повторяет тему Telegram.</p>
      </div>
    </div>
  );
}
