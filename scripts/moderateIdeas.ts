// Минимальная ручная модерация идей из вкладки «Идеи» (см. server/ideasModeration.ts):
// runIdeasMirror зеркалит желания с shareToIdeas в IdeaItem со статусом "pending", и только
// approved показываются другим пользователям — без этого шага фича никому не видна.
// Запуск: npm run moderate-ideas (нужны FIREBASE_ADMIN_* в окружении, см. .env.example).
import readline from 'node:readline/promises';
import { getDefaultModerationClient, type PendingIdea } from '../server/ideasModeration.js';

function printIdea(idea: PendingIdea, index: number, total: number): void {
  console.log(`\n[${index + 1}/${total}] «${idea.title}»`);
  console.log(`  Цена: ${idea.priceAmount != null ? `${idea.priceAmount} ${idea.priceCurrency ?? ''}`.trim() : 'не указана'}`);
  console.log(`  Ссылка: ${idea.link}`);
  console.log(`  Картинка: ${idea.imageUrl.startsWith('data:') ? '(встроенное изображение)' : idea.imageUrl}`);
  console.log(`  Интересы: ${idea.interests.join(', ') || '—'}`);
}

async function main(): Promise<void> {
  const client = getDefaultModerationClient();
  const pending = await client.listPending();
  if (pending.length === 0) {
    console.log('На модерации ничего нет.');
    return;
  }

  console.log(`На модерации: ${pending.length}. Команды: a — одобрить, r — отклонить, s/Enter — пропустить, q — выйти.`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (let i = 0; i < pending.length; i++) {
      const idea = pending[i];
      printIdea(idea, i, pending.length);
      const answer = (await rl.question('  > ')).trim().toLowerCase();
      if (answer === 'q') break;
      if (answer === 'a') {
        await client.setStatus(idea.id, 'approved');
        console.log('  ✅ одобрено');
      } else if (answer === 'r') {
        await client.setStatus(idea.id, 'rejected');
        console.log('  🚫 отклонено');
      } else {
        console.log('  ⏭️  пропущено');
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error('moderate-ideas failed:', error);
  process.exitCode = 1;
});
