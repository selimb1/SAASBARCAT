# contabilizAR

> **"De la foto al asiento, sin tocar el teclado."**

SaaS de automatización contable para Argentina. Subí fotos o PDFs de comprobantes y exportalos listos para **Holistor**, **Tango Gestión** y **Bejerman**.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python 3.12) + SQLAlchemy |
| IA | Gemini 2.5 Flash + OpenCV (pre-procesado) |
| Queue | Celery + Redis |
| Storage | AWS S3 |
| DB | PostgreSQL |

---

## Setup local rápido

### Requisitos
- Python 3.12+
- Node.js 20+
- PostgreSQL 16+ o Docker
- Redis o Docker

### 1. Clonar y configurar

```bash
cd contabilizar/backend
cp .env.example .env
# Editá .env y agregá tu GEMINI_API_KEY y credenciales AWS S3
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### 4. Celery Worker (para procesamiento async)

```bash
cd backend
celery -A app.workers.tasks.celery_app worker --loglevel=info
```

### Con Docker (todo en uno)

```bash
docker compose up --build
```

---

## Variables de entorno obligatorias

| Variable | Descripción |
|---|---|
| `GEMINI_API_KEY` | API key de Google Gemini |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `AWS_ACCESS_KEY_ID` | Credenciales AWS para S3 |
| `AWS_SECRET_ACCESS_KEY` | Credenciales AWS para S3 |
| `S3_BUCKET_NAME` | Nombre del bucket S3 |
| `SECRET_KEY` | Clave secreta para JWT (mínimo 32 chars) |

---

## Exportadores disponibles

| Software | Formato | Módulo |
|---|---|---|
| Tango Gestión | TXT `\|` | Comprobantes a Pagar / Compras |
| Holistor | Excel `.xlsx` | Compras + Asientos |
| Bejerman | CSV `;` | Comprobantes de Compra |
| Bejerman Asientos | CSV `;` | Asientos Contables |
| CSV Genérico | CSV `;` | Todos los campos |

---

## API Endpoints principales

```
POST /api/v1/auth/register     → Registro de estudio + usuario
POST /api/v1/auth/login        → Login, retorna JWT
POST /api/v1/auth/refresh      → Refresh token

GET  /api/v1/dashboard/stats   → Stats del dashboard
GET  /api/v1/lotes             → Listar lotes
POST /api/v1/lotes             → Crear lote
POST /api/v1/lotes/{id}/upload → Subir archivos (multipart)
GET  /api/v1/lotes/{id}/stats  → Estado del procesamiento

GET  /api/v1/lotes/{id}/comprobantes  → Listar comprobantes del lote
PATCH /api/v1/comprobantes/{id}       → Editar comprobante
POST /api/v1/lotes/{id}/aprobar-todos → Aprobar todos pendientes
POST /api/v1/lotes/{id}/exportar      → Generar archivo descarga
```

Documentación interactiva (en modo DEBUG): `http://localhost:8000/docs`

---

## Tipos de comprobantes soportados

Facturas A/B/C/M/E · FCE MiPyMEs A/B · Notas de Débito/Crédito A/B/C · Recibos · Tiques · Remitos · Percepciones · Retenciones

---

## Privacidad y Seguridad

- Encriptación AES-256 en reposo (S3 SSE)
- TLS 1.3 en tránsito
- Cumplimiento **Ley 25.326** de Protección de Datos Personales
- Imágenes eliminadas a los 90 días (configurable)
- **No se usan tus comprobantes para entrenar modelos de IA**

---

*contabilizAR — Hecho para contadores argentinos · © 2026*
