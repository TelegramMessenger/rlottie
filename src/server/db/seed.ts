/**
 * @file src/server/db/seed.ts
 * Наполнение базы данных начальными данными.
 *
 * Запуск: npm run db:seed
 *
 * Идемпотентно: повторный запуск не дублирует данные
 * (проверяем количество записей перед вставкой).
 */

import { getDb, execute, queryOne, withTransaction, newId } from '../services/database.js';
import { generateSalt, hashPassword } from '../services/auth.js';

const db = getDb();

console.log('🌱 Начало заполнения БД тестовыми данными...');

withTransaction(db, () => {

  // ── Admin пользователь ───────────────────────────────────────
  const adminEmail = 'admin@bazzar.ru';
  const existingAdmin = queryOne<{ id: string }>(db, 'SELECT id FROM users WHERE email = ?', [adminEmail]);

  if (!existingAdmin) {
    const salt = generateSalt();
    const hash = hashPassword('admin123', salt);
    const adminId = newId();
    execute(db,
      `INSERT INTO users (id, email, password_hash, salt, name, role) VALUES (?, ?, ?, ?, ?, ?)`,
      [adminId, adminEmail, hash, salt, 'Администратор', 'admin'],
    );
    console.log(`  ✓ Admin: ${adminEmail} / пароль: admin123`);
  } else {
    console.log('  ℹ️  Admin уже существует');
  }

  // ── Сотрудники ───────────────────────────────────────────────
  const empCount = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as { c: number }).c;

  if (empCount === 0) {
    const employees = [
      { name: 'Мария Смирнова',  role: 'Frontend Dev',   email: 'maria@bazzar.team',   dept: 'engineering', kpi: 92, salary: 120000, online: 1, bg: 'rgba(170,255,71,.15)',  color: 'var(--accent)' },
      { name: 'Иван Петров',     role: 'Backend Dev',    email: 'ivan@bazzar.team',    dept: 'engineering', kpi: 78, salary: 130000, online: 1, bg: 'rgba(200,71,255,.15)',  color: '#C847FF' },
      { name: 'Дмитрий Новиков', role: 'DevOps',         email: 'dmitry@bazzar.team',  dept: 'infrastructure', kpi: 60, salary: 110000, online: 0, bg: 'rgba(71,200,255,.15)',  color: '#47C8FF' },
      { name: 'Елена Жукова',    role: 'QA Engineer',    email: 'elena@bazzar.team',   dept: 'qa',          kpi: 95, salary: 100000, online: 1, bg: 'rgba(255,209,102,.15)', color: 'var(--yellow)' },
      { name: 'Алексей Ким',     role: 'Project Manager',email: 'alexey@bazzar.team',  dept: 'management',  kpi: 88, salary: 150000, online: 1, bg: 'rgba(255,159,71,.15)',  color: '#FF9F47' },
      { name: 'Ольга Тарасова',  role: 'Backend Dev',    email: 'olga@bazzar.team',    dept: 'engineering', kpi: 74, salary: 115000, online: 0, bg: 'rgba(170,255,71,.15)',  color: 'var(--accent)' },
      { name: 'Сергей Волков',   role: 'Mobile Dev',     email: 'sergey@bazzar.team',  dept: 'mobile',      kpi: 81, salary: 125000, online: 1, bg: 'rgba(200,71,255,.15)',  color: '#C847FF' },
      { name: 'Андрей Морозов',  role: 'System Admin',   email: 'andrey@bazzar.team',  dept: 'infrastructure', kpi: 70, salary: 95000,  online: 0, bg: 'rgba(71,200,255,.15)',  color: '#47C8FF' },
      { name: 'Анна Козлова',    role: 'Lead Designer',  email: 'anna@pixel.team',     dept: 'design',      kpi: 85, salary: 130000, online: 1, bg: 'rgba(200,71,255,.15)',  color: '#C847FF' },
      { name: 'Наталья Орлова',  role: 'Graphic Designer',email:'natalia@pixel.team',  dept: 'design',      kpi: 90, salary: 110000, online: 0, bg: 'rgba(255,159,71,.15)',  color: '#FF9F47' },
    ];

    const insertEmp = db.prepare(
      `INSERT INTO employees (id, name, role, email, avatar_initials, avatar_bg, avatar_color, kpi, salary, is_online, department)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const empIds: string[] = [];
    for (const e of employees) {
      const id  = newId();
      const ini = e.name.split(' ').map((w: string) => w[0] ?? '').join('').toUpperCase().slice(0, 2);
      insertEmp.run(id, e.name, e.role, e.email, ini, e.bg, e.color, e.kpi, e.salary, e.online, e.dept);
      empIds.push(id);
      console.log(`  ✓ Сотрудник: ${e.name}`);
    }

    // ── Проекты ────────────────────────────────────────────────
    const bazzarId = newId();
    const pixelId  = newId();

    execute(db,
      `INSERT INTO projects (id, name, description, icon, icon_bg, icon_color, accent_color, budget)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [bazzarId, 'BAZZAR MARKET', 'Маркетплейс товаров и услуг', '🛍',
       'rgba(170,255,71,.15)', 'var(--accent)', 'var(--accent)', 486000],
    );

    execute(db,
      `INSERT INTO projects (id, name, description, icon, icon_bg, icon_color, accent_color, budget)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [pixelId, 'PIXEL', 'Дизайн-студия', '🎨',
       'rgba(200,71,255,.15)', '#C847FF', '#C847FF', 214000],
    );

    console.log('  ✓ Проект: BAZZAR MARKET');
    console.log('  ✓ Проект: PIXEL');

    // ── Привязка сотрудников к проектам ────────────────────────
    for (let i = 0; i < 8; i++) {
      const empId = empIds[i];
      if (empId) execute(db, 'INSERT INTO project_members (project_id, employee_id) VALUES (?, ?)', [bazzarId, empId]);
    }
    for (let i = 4; i < 10; i++) {
      const empId = empIds[i];
      if (empId) execute(db, 'INSERT INTO project_members (project_id, employee_id) VALUES (?, ?)', [pixelId, empId]);
    }

    // ── Задачи ─────────────────────────────────────────────────
    const tasks = [
      { pid: bazzarId, title: 'Корзина и оформление заказа',    status: 'in_progress', tag: 'dev' },
      { pid: bazzarId, title: 'Интеграция СМС-уведомлений',     status: 'in_progress', tag: 'dev' },
      { pid: bazzarId, title: 'Страница продавца',              status: 'in_progress', tag: 'dev' },
      { pid: bazzarId, title: 'Редизайн главной страницы',      status: 'in_progress', tag: 'design' },
      { pid: bazzarId, title: 'API поиска товаров',             status: 'review',      tag: 'dev' },
      { pid: bazzarId, title: 'Баг #298 — дублирование товара', status: 'review',      tag: 'bug' },
      { pid: bazzarId, title: 'Авторизация OAuth',              status: 'done',        tag: 'dev' },
      { pid: bazzarId, title: 'Загрузка фото товаров',          status: 'done',        tag: 'dev' },
      { pid: bazzarId, title: 'Настроить CDN для медиа',        status: 'backlog',     tag: 'ops' },
      { pid: bazzarId, title: 'Баг #312 — поиск на мобиле',    status: 'backlog',     tag: 'bug' },
      { pid: pixelId,  title: 'Брендбук для TechStart',        status: 'in_progress', tag: 'design' },
      { pid: pixelId,  title: 'Landing page PIXEL',            status: 'in_progress', tag: 'dev' },
      { pid: pixelId,  title: 'Презентация для инвестора',     status: 'review',      tag: 'design' },
      { pid: pixelId,  title: 'Логотип BAZZAR v2',             status: 'done',        tag: 'design' },
    ];

    const insertTask = db.prepare(
      'INSERT INTO tasks (id, project_id, title, status, tag) VALUES (?, ?, ?, ?, ?)',
    );
    for (const t of tasks) {
      insertTask.run(newId(), t.pid, t.title, t.status, t.tag);
    }
    console.log(`  ✓ ${tasks.length} задач создано`);

    // ── Финансы ────────────────────────────────────────────────
    const finance = [
      { pid: bazzarId, desc: 'Разработка платформы',    cat: 'dev',    sum: 180000, status: 'paid',    date: '2026-05-01' },
      { pid: bazzarId, desc: 'Дизайн UI/UX',           cat: 'design', sum: 75000,  status: 'paid',    date: '2026-05-05' },
      { pid: bazzarId, desc: 'Маркетинг/продвижение',  cat: 'ops',    sum: 40000,  status: 'pending', date: '2026-05-10' },
      { pid: bazzarId, desc: 'DevOps и инфраструктура', cat: 'ops',    sum: 55000,  status: 'paid',    date: '2026-05-12' },
      { pid: bazzarId, desc: 'QA тестирование',        cat: 'dev',    sum: 35000,  status: 'pending', date: '2026-05-20' },
      { pid: pixelId,  desc: 'Брендинг TechStart',     cat: 'design', sum: 95000,  status: 'paid',    date: '2026-05-03' },
      { pid: pixelId,  desc: 'UI Kit мобайл',          cat: 'design', sum: 60000,  status: 'paid',    date: '2026-05-08' },
      { pid: pixelId,  desc: 'Соцсети — ведение',      cat: 'design', sum: 30000,  status: 'pending', date: '2026-05-15' },
    ];

    const insertFin = db.prepare(
      'INSERT INTO finance (id, project_id, description, category, amount, status, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    for (const f of finance) {
      insertFin.run(newId(), f.pid, f.desc, f.cat, f.sum, f.status, f.date);
    }
    console.log(`  ✓ ${finance.length} финансовых записей создано`);

  } else {
    console.log('  ℹ️  БД уже содержит данные, пропускаем seed');
  }
});

console.log('\n✅ Seed завершён успешно!');
process.exit(0);
