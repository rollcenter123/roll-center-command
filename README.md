# Central de Comando Roll Center

Sistema de gestão de clientes, campanhas de email (Mautic) e WhatsApp (UAZAPI + Cloud API) com métricas completas.

## Stack

- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Backend**: Supabase (Postgres, Auth, Edge Functions)
- **Integrações**: Mautic self-hosted, UAZAPI, WhatsApp Cloud API

## Setup

### 1. Banco de dados

Execute o SQL em [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql) no SQL Editor do Supabase.

Após criar sua conta, promova a admin:

```sql
UPDATE profiles SET role = 'admin' WHERE id = 'SEU_USER_ID';
```

### 2. Variáveis de ambiente

```bash
cp .env.example .env
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

### 3. Instalar e rodar

```bash
npm install
npm run dev
```

### 4. Secrets das Edge Functions

No painel Supabase > Edge Functions > Secrets, configure:

| Secret | Descrição |
|--------|-----------|
| `MAUTIC_BASE_URL` | URL do Mautic (ex: https://mautic.seudominio.com) |
| `MAUTIC_CLIENT_ID` | OAuth Client ID |
| `MAUTIC_CLIENT_SECRET` | OAuth Client Secret |
| `UAZAPI_SUBDOMAIN` | Subdomínio UAZAPI |
| `UAZAPI_ADMIN_TOKEN` | Token admin UAZAPI |
| `UAZAPI_INSTANCE_TOKEN` | Token da instância padrão |
| `WHATSAPP_CLOUD_TOKEN` | Token permanente Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone Number ID |
| `WHATSAPP_VERIFY_TOKEN` | Token de verificação do webhook |

### 5. Deploy das Edge Functions

```bash
npx supabase functions deploy mautic-sync-contact
npx supabase functions deploy mautic-list-campaigns
npx supabase functions deploy mautic-launch-campaign
npx supabase functions deploy mautic-webhook
npx supabase functions deploy whatsapp-send-uazapi
npx supabase functions deploy whatsapp-send-cloud
npx supabase functions deploy whatsapp-webhook-uazapi
npx supabase functions deploy whatsapp-webhook-meta
npx supabase functions deploy import-clients
npx supabase functions deploy aggregate-metrics
```

### 6. Webhooks

Configure nos serviços externos apontando para suas Edge Functions:

- **Mautic**: `https://SEU_PROJETO.supabase.co/functions/v1/mautic-webhook`
- **UAZAPI**: `https://SEU_PROJETO.supabase.co/functions/v1/whatsapp-webhook-uazapi`
- **Meta**: `https://SEU_PROJETO.supabase.co/functions/v1/whatsapp-webhook-meta`

### 7. Importar clientes da planilha

Coloque o arquivo em `data/clientes.xlsx` e execute:

```bash
npm run import:clients
```

Ou use a página **Importar** no sistema (upload drag-and-drop).

Colunas suportadas: Nome, Email, Telefone, Empresa, Status, Origem, Observações.

## Deploy na Netlify

O frontend é estático (Vite). O backend continua no Supabase.

### Opção A — GitHub + Netlify (recomendado)

1. Crie um repositório no GitHub e envie a pasta `roll-center-command` (não suba o `.env`).
2. Em [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project** → GitHub.
3. Configurações de build (já vêm do `netlify.toml`):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Em **Site configuration → Environment variables**, adicione:
   - `VITE_SUPABASE_URL` = `https://pcqelpbnhxyemxscchid.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = sua anon key do Supabase
5. Clique em **Deploy site**.
6. No Supabase → **Authentication → URL Configuration**, adicione a URL da Netlify (ex.: `https://seu-app.netlify.app`) em **Site URL** e **Redirect URLs**.

### Opção B — Deploy manual (rápido)

```bash
npm run build
```

Arraste a pasta `dist` para [app.netlify.com/drop](https://app.netlify.com/drop).  
As variáveis `VITE_*` precisam estar no `.env` **antes** do build (ficam embutidas no JS).

### Scripts locais (não rodam na Netlify)

`npm run sync:emails` e `npm run import:clients` continuam só no seu PC ou em CI separado — usam chaves que não devem ir para o frontend.

## Perfis de acesso

| Papel | Permissões |
|-------|-----------|
| **admin** | Acesso total, integrações, equipe |
| **operator** | Clientes, campanhas, importação |
| **viewer** | Somente leitura |

## Estrutura

```
src/
  components/   # UI e layout
  contexts/     # Auth
  pages/        # Dashboard, Clientes, Campanhas, Métricas
  lib/          # Supabase client, utils
  types/        # TypeScript types
supabase/
  migrations/   # SQL schema
  functions/    # Edge Functions
scripts/        # Import CLI
data/           # Planilhas de clientes
```
