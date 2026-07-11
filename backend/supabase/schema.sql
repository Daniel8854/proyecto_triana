-- Ejecutar esto en el SQL Editor de tu proyecto Supabase (Project > SQL Editor > New query)
-- Estas tablas solo se acceden desde el backend con la service_role key, nunca desde el
-- frontend con la anon key, así que no se definen policies de RLS.

create table if not exists clientes (
    id bigint generated always as identity primary key,
    nombre varchar(100) not null,
    telefono varchar(20) not null unique,
    producto varchar(100),
    estado varchar(20) not null default 'aldia',
    created_at timestamptz not null default now()
);

create table if not exists cuotas (
    id bigint generated always as identity primary key,
    cliente_id bigint not null references clientes(id) on delete cascade,
    numero int not null,
    total_cuotas int not null,
    valor numeric(10,2) not null,
    fecha_vencimiento date not null,
    estado varchar(20) not null default 'pendiente'
);

create table if not exists pagos (
    id bigint generated always as identity primary key,
    cliente_id bigint not null references clientes(id) on delete cascade,
    cuota_id bigint not null references cuotas(id) on delete cascade,
    monto numeric(10,2) not null,
    fecha timestamptz not null default now(),
    comprobante_url text
);

create index if not exists idx_cuotas_cliente on cuotas(cliente_id);
create index if not exists idx_cuotas_estado_vencimiento on cuotas(estado, fecha_vencimiento);
create index if not exists idx_pagos_cliente on pagos(cliente_id);
create index if not exists idx_pagos_fecha on pagos(fecha);

-- Bucket privado para las fotos de comprobantes (se sube vía service_role,
-- las URLs se generan firmadas si algún día hace falta mostrarlas en el frontend)
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;
