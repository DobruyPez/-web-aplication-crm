-- Очищаем в порядке обратных зависимостей
DELETE FROM "documents";
DELETE FROM "calls";
DELETE FROM "tasks";
DELETE FROM "deals";
DELETE FROM "clients";
DELETE FROM "users";

-- Сбрасываем автоинкремент
ALTER SEQUENCE "user_id_seq" RESTART WITH 1;
ALTER SEQUENCE "client_id_seq" RESTART WITH 1;
ALTER SEQUENCE "deal_id_seq" RESTART WITH 1;
ALTER SEQUENCE "task_id_seq" RESTART WITH 1;
ALTER SEQUENCE "call_id_seq" RESTART WITH 1;
ALTER SEQUENCE "document_id_seq" RESTART WITH 1;

ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE clients_id_seq RESTART WITH 1;
ALTER SEQUENCE deals_id_seq RESTART WITH 1;
ALTER SEQUENCE tasks_id_seq RESTART WITH 1;
ALTER SEQUENCE calls_id_seq RESTART WITH 1;
ALTER SEQUENCE documents_id_seq RESTART WITH 1;

INSERT INTO users (full_name, email, password_hash, role, phone) VALUES
  ('Администратор Системы', 'admin@crm.by', 'admin123', 'admin', '+375291111111'),
  ('Иванов Иван Иванович', 'ivanov@crm.by', 'manager123', 'manager', '+375292222222'),
  ('Петрова Анна Сергеевна', 'petrova@crm.by', 'manager123', 'manager', '+375293333333'),
  ('Сидоров Алексей Петрович', 'sidorov@crm.by', 'manager123', 'manager', '+375294444444');

SELECT * FROM users;

  -- Клиенты менеджера Иванова (id=2)
INSERT INTO clients (name, company, phone, email, address, notes, manager_id) VALUES
  ('ООО "БелТехСервис"', 'БелТехСервис', '+375171001001', 'info@beltech.by', 'Минск, ул. Пушкина 10', 'Крупный заказчик оборудования', 2),
  ('ЗАО "АгроПром"', 'АгроПром', '+375171002002', 'office@agroprom.by', 'Гродно, ул. Советская 25', 'Поставки с/х техники', 2),
  ('ИП "СтройМаркет"', 'СтройМаркет', '+375291003003', 'stroymarket@mail.ru', 'Брест, ул. Ленина 7', 'Мелкий опт, стройматериалы', 2);

-- Клиенты менеджера Петровой (id=3)
INSERT INTO clients (name, company, phone, email, address, notes, manager_id) VALUES
  ('ЧУП "IT-Решения"', 'IT-Решения', '+375171004004', 'info@itsolutions.by', 'Минск, ул. Кальварийская 15', 'Разработка ПО', 3),
  ('ООО "МедСервис"', 'МедСервис', '+375171005005', 'med@medservice.by', 'Витебск, ул. Правды 3', 'Медицинское оборудование', 3);

-- Клиенты менеджера Сидорова (id=4)
INSERT INTO clients (name, company, phone, email, address, notes, manager_id) VALUES
  ('ОАО "ТрансЛогистик"', 'ТрансЛогистик', '+375171006006', 'info@translog.by', 'Минск, ул. Жукова 20', 'Транспортные услуги', 4);

  -- Сделки менеджера Иванова (id=2)
INSERT INTO deals (title, description, amount, stage, closing_date, client_id, manager_id) VALUES
  ('Поставка серверного оборудования', 'Комплексная поставка серверов для ООО "БелТехСервис"', 25000.00, 'переговоры', '2026-06-15', 1, 2),
  ('Техническое обслуживание', 'Годовой контракт на обслуживание оборудования', 8000.00, 'новый', '2026-05-20', 1, 2),
  ('Продажа сельхозтехники', 'Тракторы и комбайны для ЗАО "АгроПром"', 150000.00, 'закрыт', '2026-03-01', 2, 2),
  ('Поставка стройматериалов', 'Цемент, кирпич, арматура', 45000.00, 'новый', '2026-07-01', 3, 2);

-- Сделки менеджера Петровой (id=3)
INSERT INTO deals (title, description, amount, stage, closing_date, client_id, manager_id) VALUES
  ('Разработка CRM-модуля', 'Создание модуля аналитики для ЧУП "IT-Решения"', 35000.00, 'переговоры', '2026-08-01', 4, 3),
  ('Внедрение 1С в МедСервис', 'Автоматизация документооборота', 18000.00, 'новый', '2026-06-10', 5, 3);

-- Сделки менеджера Сидорова (id=4)
INSERT INTO deals (title, description, amount, stage, closing_date, client_id, manager_id) VALUES
  ('Перевозка грузов', 'Международные перевозки для ОАО "ТрансЛогистик"', 120000.00, 'новый', '2026-09-01', 6, 4);


 -- Задачи менеджера Иванова (id=2)
INSERT INTO tasks (title, description, status, priority, due_date, author_id, client_id, deal_id) VALUES
  ('Позвонить в БелТехСервис', 'Уточнить технические требования к серверам', 'completed', 'high', '2026-04-15 14:00:00', 2, 1, 1),
  ('Подготовить КП для БелТехСервис', 'Коммерческое предложение на поставку оборудования', 'new', 'high', '2026-04-28 18:00:00', 2, 1, 1),
  ('Согласовать договор с АгроПром', 'Договор на поставку техники, проверить спецификацию', 'new', 'medium', '2026-05-05 12:00:00', 2, 2, 3),
  ('Встреча со СтройМаркет', 'Обсудить ассортимент и скидки', 'new', 'low', '2026-05-10 10:00:00', 2, 3, 4);

-- Задачи менеджера Петровой (id=3)
INSERT INTO tasks (title, description, status, priority, due_date, author_id, client_id, deal_id) VALUES
  ('Собрать требования для CRM-модуля', 'Провести интервью с заказчиком', 'new', 'high', '2026-05-01 16:00:00', 3, 4, 5),
  ('Демо для МедСервис', 'Показать прототип модуля автоматизации', 'new', 'medium', '2026-05-15 11:00:00', 3, 5, 6);

-- Задачи менеджера Сидорова (id=4)
INSERT INTO tasks (title, description, status, priority, due_date, author_id, client_id, deal_id) VALUES
  ('Расчёт стоимости перевозок', 'Подготовить тарифы для ТрансЛогистик', 'new', 'high', '2026-04-30 15:00:00', 4, 6, 7);


  -- Звонки менеджера Иванова
INSERT INTO calls (client_id, caller_id, direction, status, duration, recording_url, started_at, ended_at) VALUES
  (1, 2, 'out', 'completed', 320, 'https://storage/calls/call_001.mp3', '2026-04-10 10:00:00', '2026-04-10 10:05:20'),
  (1, 2, 'in', 'completed', 180, 'https://storage/calls/call_002.mp3', '2026-04-12 14:30:00', '2026-04-12 14:33:00'),
  (2, 2, 'out', 'completed', 420, 'https://storage/calls/call_003.mp3', '2026-04-15 09:00:00', '2026-04-15 09:07:00'),
  (3, 2, 'out', 'missed', 0, NULL, '2026-04-18 11:00:00', NULL),
  (1, 2, 'out', 'completed', 250, 'https://storage/calls/call_004.mp3', '2026-04-20 16:00:00', '2026-04-20 16:04:10');

-- Звонки менеджера Петровой
INSERT INTO calls (client_id, caller_id, direction, status, duration, recording_url, started_at, ended_at) VALUES
  (4, 3, 'out', 'completed', 280, 'https://storage/calls/call_005.mp3', '2026-04-08 15:00:00', '2026-04-08 15:04:40'),
  (5, 3, 'in', 'completed', 150, 'https://storage/calls/call_006.mp3', '2026-04-14 10:00:00', '2026-04-14 10:02:30');

-- Звонки менеджера Сидорова
INSERT INTO calls (client_id, caller_id, direction, status, duration, recording_url, started_at, ended_at) VALUES
  (6, 4, 'out', 'completed', 350, 'https://storage/calls/call_007.mp3', '2026-04-16 12:00:00', '2026-04-16 12:05:50'),
  (6, 4, 'out', 'completed', 200, 'https://storage/calls/call_008.mp3', '2026-04-22 09:30:00', '2026-04-22 09:33:20');

  -- Документы менеджера Иванова
INSERT INTO documents (client_id, uploader_id, filename, file_path, file_size, mime_type) VALUES
  (1, 2, 'dogovor_beltech.pdf', '/uploads/dogovor_beltech.pdf', 245760, 'application/pdf'),
  (1, 2, 'specifikatsiya.docx', '/uploads/spec_beltech.docx', 51200, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  (2, 2, 'smeta_agroprom.xlsx', '/uploads/smeta_agroprom.xlsx', 102400, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
  (3, 2, 'praice_stroymarket.pdf', '/uploads/praice_stroymarket.pdf', 156000, 'application/pdf');

-- Документы менеджера Петровой
INSERT INTO documents (client_id, uploader_id, filename, file_path, file_size, mime_type) VALUES
  (4, 3, 'tz_itsolutions.docx', '/uploads/tz_itsolutions.docx', 89000, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  (5, 3, 'contract_medservice.pdf', '/uploads/contract_medservice.pdf', 320000, 'application/pdf');

-- Документы менеджера Сидорова
INSERT INTO documents (client_id, uploader_id, filename, file_path, file_size, mime_type) VALUES
  (6, 4, 'tarify_translog.xlsx', '/uploads/tarify_translog.xlsx', 78000, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  