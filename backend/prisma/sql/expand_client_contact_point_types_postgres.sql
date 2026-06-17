-- Расширение допустимых типов контактных точек клиента.
-- Выполнить ОДИН РАЗ под postgres, если таблица уже создана с CHECK (phone, fax, email):
--
--   psql -U postgres -h localhost -d crm_course -v ON_ERROR_STOP=1 -f prisma/sql/expand_client_contact_point_types_postgres.sql

ALTER TABLE public.client_contact_points
  DROP CONSTRAINT IF EXISTS client_contact_points_type_check;

ALTER TABLE public.client_contact_points
  ADD CONSTRAINT client_contact_points_type_check CHECK (type IN (
    'mobile',
    'landline',
    'phone',
    'fax',
    'email',
    'website',
    'telegram',
    'viber',
    'whatsapp',
    'skype',
    'instagram',
    'vk',
    'ok',
    'linkedin'
  ));
