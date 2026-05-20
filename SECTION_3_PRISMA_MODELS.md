В проекте используется ORM **Prisma** [4]. Prisma позволяет описывать таблицы в виде моделей в декларативной схеме (`schema.prisma`), выполнять запросы к базе данных в объектном стиле через сгенерированный клиент `@prisma/client` и декларативно задавать связи между сущностями. В отличие от подхода с явным объявлением моделей на JavaScript, характерного для Sequelize, в данном проекте единый источник истины — файл схемы; по нему генерируется типобезопасный клиент, а физическая структура таблиц в PostgreSQL применяется миграциями.

Сопоставление моделей Prisma с именами таблиц в базе данных представлено в таблице 3.1. Далее для каждой модели приводится листинг исходного кода из репозитория проекта и пояснение назначения полей и связей.

**Таблица 3.1 – Сопоставление моделей, используемых в Prisma**

| Название модели Prisma | Название таблицы |
| ---------------------- | ---------------- |
| User                   | users            |
| Client                 | clients          |
| Deal                   | deals            |
| Task                   | tasks            |
| Call                   | calls            |
| Document               | documents        |

Имена моделей в схеме задаются в единственном числе (PascalCase), а физические таблицы в PostgreSQL — во множественном числе в нижнем регистре (`@@map`), что соответствует принятой практике именования в реляционных СУБД. Дополнительно в проекте все связи «один-ко-многим» объявлены в том же файле `backend/prisma/schema.prisma` через поля внешних ключей и навигационные свойства (`@relation`). Связи «многие-ко-многим» в предметной модели CRM не используются: каждая связь реализована прямым внешним ключом. Такой подход облегчает сопровождение: изменение связи выполняется в одном файле схемы и учитывается при запросах с `include`. Для разработчика это означает предсказуемое соответствие между листингами моделей ниже и физической структурой базы, приведённой в **приложении А**. Начальное заполнение учётных записей — в **приложении Б**.

Код, описывающий модель **User**, приведён в листинге 3.1.

```prisma
model User {
  id         Int        @id @default(autoincrement())
  fullName   String     @map("full_name") @db.VarChar(255)
  email      String     @unique @db.VarChar(255)
  password   String     @map("password_hash") @db.VarChar(255)
  telegramLink   String?    @map("telegram_link") @db.VarChar(255)
  telegramChatId String?    @map("telegram_chat_id") @db.VarChar(64)
  role       String     @default("manager") @db.VarChar(20)
  phone      String?    @db.VarChar(30)
  clients    Client[]
  deals      Deal[]
  tasks      Task[]     @relation("TaskAuthor")
  calls      Call[]     @relation("CallCaller")
  documents  Document[] @relation("DocumentUploader")
  createdAt  DateTime   @default(now()) @map("created_at")
  updatedAt  DateTime   @default(now()) @map("updated_at")

  @@map("users")
}
```

**Листинг 3.1 – Модель User**

Модель **User** в Prisma описывает учётную запись пользователя CRM-системы. Поле `id` — первичный ключ с автоинкрементом. Поля `fullName` и `email` задают отображаемое имя и уникальный адрес почты для входа. Поле `password` (в таблице `password_hash`) хранит криптографический хеш пароля (алгоритм bcrypt на сервере). Поле `role` различает администратора и менеджера (`admin` / `manager`): при значении, соответствующем администратору, пользователь получает расширенный доступ к данным и операциям. Поля `telegramLink` и `telegramChatId` поддерживают привязку учётной записи к Telegram для уведомлений о задачах и сделках. Поле `phone` хранит контактный телефон сотрудника.

Атрибут `@unique` на поле `email` дублирует на уровне ORM требование уникальности, заданное в базе данных, и позволяет Prisma корректно обрабатывать конфликты при создании пользователя. Поля `createdAt` и `updatedAt` автоматически фиксируют момент создания и последнего обновления записи. Навигационные свойства `clients`, `deals`, `tasks`, `calls`, `documents` описывают связи «один-ко-многим» с остальными сущностями и используются при запросах с `include`. Таким образом, модель одновременно служит контрактом для слоя репозиториев и для серверной логики авторизации и разграничения доступа по роли.

Код, описывающий модель **Client**, приведён в листинге 3.2.

```prisma
model Client {
  id         Int        @id @default(autoincrement())
  name       String
  company    String?
  phone      String?
  email      String?
  address    String?
  notes      String?
  managerId  Int        @map("manager_id")
  manager    User       @relation(fields: [managerId], references: [id], onDelete: Restrict)
  deals      Deal[]
  tasks      Task[]
  calls      Call[]
  documents  Document[]
  createdAt  DateTime   @default(now()) @map("created_at")
  updatedAt  DateTime   @default(now()) @map("updated_at")

  @@map("clients")
}
```

**Листинг 3.2 – Модель Client**

Модель **Client** описывает клиента организации: уникальный идентификатор, обязательное поле `name`, реквизиты компании (`company`), контакты (`phone`, `email`, `address`) и текстовые заметки (`notes`). Поле `managerId` связывает клиента с ответственным менеджером (`User`); ограничение `onDelete: Restrict` не позволяет удалить пользователя, пока на него ссылаются клиенты. Через навигационные свойства клиент агрегирует сделки, задачи, звонки и документы, относящиеся к данному контрагенту.

Код, описывающий модель **Deal**, приведён в листинге 3.3.

```prisma
model Deal {
  id          Int       @id @default(autoincrement())
  title       String
  description String?
  amount      Decimal?  @db.Decimal(12, 2)
  stage       String    @default("new")
  closingDate DateTime? @map("closing_date") @db.Date
  clientId    Int       @map("client_id")
  managerId   Int       @map("manager_id")
  client      Client    @relation(fields: [clientId], references: [id], onDelete: Cascade)
  manager     User      @relation(fields: [managerId], references: [id], onDelete: Restrict)
  tasks       Task[]
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @default(now()) @map("updated_at")

  @@map("deals")
}
```

**Листинг 3.3 – Модель Deal**

Модель **Deal** описывает сделку: название (`title`), описание, сумму `amount` типа `Decimal(12, 2)`, этап воронки `stage` (по умолчанию `new`), плановую дату закрытия `closingDate`. Поля `clientId` и `managerId` связывают сделку с клиентом и ответственным менеджером. При удалении клиента связанные сделки удаляются каскадно (`onDelete: Cascade`); удаление менеджера запрещено при наличии сделок (`Restrict`). Связанные задачи доступны через поле `tasks`.

Код, описывающий модель **Task**, приведён в листинге 3.4.

```prisma
model Task {
  id          Int       @id @default(autoincrement())
  title       String
  description String?
  status      String    @default("new")
  priority    String    @default("medium")
  dueDate     DateTime? @map("due_date")
  authorId    Int       @map("author_id")
  clientId    Int?      @map("client_id")
  dealId      Int?      @map("deal_id")
  author      User      @relation("TaskAuthor", fields: [authorId], references: [id], onDelete: Restrict)
  client      Client?   @relation(fields: [clientId], references: [id], onDelete: SetNull)
  deal        Deal?     @relation(fields: [dealId], references: [id], onDelete: SetNull)
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @default(now()) @map("updated_at")

  @@map("tasks")
}
```

**Листинг 3.4 – Модель Task**

Модель **Task** хранит задачу CRM: заголовок, описание, статус выполнения (`status`, по умолчанию `new`), приоритет (`priority`, по умолчанию `medium`) и срок `dueDate`. Поле `authorId` указывает автора задачи (менеджера). Поля `clientId` и `dealId` необязательны и позволяют привязать задачу к клиенту и/или сделке; при удалении клиента или сделки соответствующие ссылки обнуляются (`onDelete: SetNull`). Сопоставление статуса и просрочки с уведомлениями в Telegram выполняется в бизнес-логике сервиса задач.

Код, описывающий модель **Call**, приведён в листинге 3.5.

```prisma
model Call {
  id               Int       @id @default(autoincrement())
  clientId         Int       @map("client_id")
  callerId         Int       @map("caller_id")
  direction        String    @default("out")
  status           String    @default("completed")
  duration         Int?
  recordingUrl     String?   @map("recording_url")
  startedAt        DateTime  @map("started_at")
  endedAt          DateTime? @map("ended_at")
  client           Client    @relation(fields: [clientId], references: [id], onDelete: Cascade)
  caller           User      @relation("CallCaller", fields: [callerId], references: [id], onDelete: Restrict)

  @@map("calls")
}
```

**Листинг 3.5 – Модель Call**

Модель **Call** фиксирует звонок по клиенту: направление (`direction`, входящий/исходящий), статус (`status`, в том числе пропущенный), длительность в секундах, ссылку на запись разговора `recordingUrl`, время начала `startedAt` и окончания `endedAt`. Поля `clientId` и `callerId` связывают звонок с клиентом и инициатором (пользователем). Записи используются в журнале коммуникаций и на панели управления при формировании предупреждений о пропущенных звонках.

Код, описывающий модель **Document**, приведён в листинге 3.6.

```prisma
model Document {
  id          Int       @id @default(autoincrement())
  clientId    Int       @map("client_id")
  uploaderId  Int       @map("uploader_id")
  filename    String
  filePath    String    @map("file_path")
  fileSize    Int?      @map("file_size")
  mimeType    String?   @map("mime_type")
  uploadedAt  DateTime  @default(now()) @map("uploaded_at")
  client      Client    @relation(fields: [clientId], references: [id], onDelete: Cascade)
  uploader    User      @relation("DocumentUploader", fields: [uploaderId], references: [id], onDelete: Restrict)

  @@map("documents")
}
```

**Листинг 3.6 – Модель Document**

Модель **Document** описывает файл, прикреплённый к клиенту: имя `filename`, путь `filePath` (относительный URL в каталоге загрузок), размер `fileSize`, MIME-тип `mimeType` и время загрузки `uploadedAt`. Поля `clientId` и `uploaderId` связывают документ с клиентом и пользователем, выполнившим загрузку. Физическое хранение файла выполняется на файловой системе сервера; в базе сохраняются метаданные для отображения в интерфейсе и проверки прав доступа менеджера к карточке клиента.

В приведённых фрагментах объявлены отношения «один-ко-многим»: пользователь — клиенты, сделки, задачи, звонки, документы; клиент — сделки, задачи, звонки, документы; сделка — задачи. Полный текст схемы содержит блоки `generator` и `datasource` для генерации клиента Prisma и подключения к PostgreSQL по переменной окружения `DATABASE_URL`; файл расположен в репозитории по пути `backend/prisma/schema.prisma`.
