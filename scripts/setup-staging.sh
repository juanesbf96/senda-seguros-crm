#!/usr/bin/env bash
# Setup del ambiente de staging (fase 0.2 del PLAN_EJECUCION_AUDITORIAS.md)
# Uso: bash scripts/setup-staging.sh
# Idempotente: se puede re-correr si algo falla a mitad de camino.
set -uo pipefail   # sin -e: manejamos errores explícitamente (grep sin match no debe matar el script)
cd "$(dirname "$0")/.."

# Docker vía Colima (el CLI de Supabase necesita el socket de Docker)
if [ -S "$HOME/.colima/default/docker.sock" ]; then
  export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
fi

PROD_REF="tqwkzquchktsjutksjdk"
ENV_FILE=".env.local"

paso() { printf "\n\033[1;34m▶ %s\033[0m\n" "$1"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$1"; }

# ── 1. Login ──────────────────────────────────────────────────────────
paso "1/6 Verificando autenticación del CLI"
if ! supabase orgs list >/dev/null 2>&1; then
  echo "No hay sesión activa — se abrirá el navegador."
  supabase login
fi
ok "CLI autenticado"

# ── 2. Crear (o reusar) proyecto de staging ───────────────────────────
paso "2/6 Proyecto senda-staging"
STAGING_REF="$(supabase projects list -o json 2>/dev/null | python3 -c "
import json,sys
projs=json.load(sys.stdin)
print(next((p.get('id') or p.get('ref','') for p in projs if p.get('name')=='senda-staging'),''))
" || true)"

if [ -z "$STAGING_REF" ]; then
  ORG_ID="$(supabase orgs list -o json | python3 -c "
import json,sys
orgs=json.load(sys.stdin)
print(orgs[0].get('id') or orgs[0].get('ref',''))
")"
  echo "Creando senda-staging en la organización $ORG_ID..."
  STAGING_PW="$(openssl rand -base64 24 | tr -d '/+=' )"
  supabase projects create senda-staging --org-id "$ORG_ID" --region us-east-1 --db-password "$STAGING_PW"
  # Guardar el password SOLO en .env.local (gitignored)
  printf '\nSUPABASE_STAGING_DB_PASSWORD=%s\n' "$STAGING_PW" >> "$ENV_FILE"
  echo "Password de staging guardado en $ENV_FILE (cópialo también a tu gestor de contraseñas)."
  STAGING_REF="$(supabase projects list -o json | python3 -c "
import json,sys
projs=json.load(sys.stdin)
print(next((p.get('id') or p.get('ref','') for p in projs if p.get('name')=='senda-staging'),''))
")"
  echo "Esperando 60s a que el proyecto termine de aprovisionarse..."
  sleep 60
else
  ok "senda-staging ya existe ($STAGING_REF)"
fi
printf 'STAGING_REF=%s\n' "$STAGING_REF"

# ── 3. Baseline: pull del schema de PRODUCCIÓN ────────────────────────
paso "3/6 Volcando schema de producción (baseline)"
# Limpiar baselines vacíos de intentos fallidos
find supabase/migrations -name '*_remote_schema.sql' -size 0 -delete 2>/dev/null || true
BASELINE_OK=""
for f in supabase/migrations/*_remote_schema.sql; do
  [ -s "$f" ] && BASELINE_OK="$f" && break
done 2>/dev/null
if [ -n "$BASELINE_OK" ]; then
  ok "Baseline ya existe y no está vacío ($BASELINE_OK) — se omite el pull"
else
  # Password de prod: desde .env.local (SUPABASE_DB_PASSWORD) o prompt interactivo
  PROD_PW="$(grep -E '^SUPABASE_DB_PASSWORD=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)"
  if [ -z "$PROD_PW" ]; then
    read -r -s -p "Password de la BD de PRODUCCIÓN (Dashboard → Settings → Database): " PROD_PW; echo
  fi
  SUPABASE_DB_PASSWORD="$PROD_PW" supabase link --project-ref "$PROD_REF" -p "$PROD_PW"

  # El pg_dump corre en Docker (sin IPv6) → usar el POOLER (IPv4), no el host directo.
  PROD_PW_ENC="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$PROD_PW")"
  PROD_REGION="$(supabase projects list -o json | python3 -c "
import json,sys
projs=json.load(sys.stdin)
print(next((p.get('region','') for p in projs if (p.get('id') or p.get('ref',''))=='$PROD_REF'),''))
")"
  echo "Región de producción: ${PROD_REGION:-desconocida}"
  PULLED=""
  for POOLER_HOST in "aws-0-${PROD_REGION}.pooler.supabase.com" "aws-1-${PROD_REGION}.pooler.supabase.com"; do
    DB_URL="postgresql://postgres.${PROD_REF}:${PROD_PW_ENC}@${POOLER_HOST}:5432/postgres"
    echo "Intentando pull vía ${POOLER_HOST}..."
    if supabase db pull --db-url "$DB_URL"; then PULLED="si"; break; fi
  done
  if [ -z "$PULLED" ]; then
    echo "Pooler no disponible — último intento por conexión directa:"
    supabase db pull -p "$PROD_PW"
  fi
  ok "Baseline creado en supabase/migrations/"
fi

# ── 4. Aplicar baseline en STAGING (vía pooler IPv4, igual que el pull) ─
paso "4/6 Aplicando baseline en senda-staging"
STAGING_PW="$(grep -E '^SUPABASE_STAGING_DB_PASSWORD=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r ' || true)"
STAGING_REGION="$(supabase projects list -o json | python3 -c "
import json,sys
projs=json.load(sys.stdin)
print(next((p.get('region','') for p in projs if (p.get('id') or p.get('ref',''))=='$STAGING_REF'),''))
")"
echo "Región de staging: ${STAGING_REGION:-desconocida}"

push_staging() {
  local pw="$1"
  local pw_enc; pw_enc="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$pw")"
  for POOLER_HOST in "aws-0-${STAGING_REGION}.pooler.supabase.com" "aws-1-${STAGING_REGION}.pooler.supabase.com"; do
    echo "Intentando push vía ${POOLER_HOST}..."
    if supabase db push --db-url "postgresql://postgres.${STAGING_REF}:${pw_enc}@${POOLER_HOST}:5432/postgres"; then
      return 0
    fi
  done
  return 1
}

# Reintentar hasta que un password funcione (o el usuario aborte con Ctrl+C)
ATTEMPT=0
while true; do
  if [ -n "$STAGING_PW" ] && push_staging "$STAGING_PW"; then
    break
  fi
  ATTEMPT=$((ATTEMPT+1))
  echo ""
  if [ -z "$STAGING_PW" ]; then
    echo "⚠ No hay password de staging guardado."
  else
    echo "⚠ El password de staging no autenticó (intento $ATTEMPT)."
  fi
  echo "  1. Abre: https://supabase.com/dashboard/project/$STAGING_REF/settings/database"
  echo "  2. 'Reset database password' → usa uno SOLO alfanumérico (letras y números, sin símbolos) → cópialo"
  echo "     (espera ~10s tras el reset para que se propague antes de pegar)"
  read -r -s -p "  3. Pégalo aquí (Ctrl+C para abortar): " STAGING_PW; echo
  STAGING_PW="$(printf '%s' "$STAGING_PW" | tr -d '\r ')"
  sed -i '' '/^SUPABASE_STAGING_DB_PASSWORD=/d' "$ENV_FILE" 2>/dev/null || true
  printf 'SUPABASE_STAGING_DB_PASSWORD=%s\n' "$STAGING_PW" >> "$ENV_FILE"
  echo "  (guardado en $ENV_FILE)"
done
ok "Staging tiene el schema de producción"

# ── 5. Guardar las URLs de staging en .env.local (comentadas) ─────────
paso "5/6 Anotando credenciales de staging en $ENV_FILE"
if ! grep -q "STAGING (senda-staging)" "$ENV_FILE" 2>/dev/null; then
  STAGING_ANON="$(supabase projects api-keys --project-ref "$STAGING_REF" -o json | python3 -c "
import json,sys
keys=json.load(sys.stdin)
print(next((k['api_key'] for k in keys if k.get('name')=='anon'),''))
" || true)"
  {
    printf '\n# --- STAGING (senda-staging) — descomentar para probar contra staging ---\n'
    printf '# NEXT_PUBLIC_SUPABASE_URL=https://%s.supabase.co\n' "$STAGING_REF"
    printf '# NEXT_PUBLIC_SUPABASE_ANON_KEY=%s\n' "$STAGING_ANON"
  } >> "$ENV_FILE"
fi
ok "Listo"

# ── 6. Resumen ────────────────────────────────────────────────────────
paso "6/6 Resumen"
echo "  • Proyecto staging: https://supabase.com/dashboard/project/$STAGING_REF"
echo "  • Baseline: $(ls supabase/migrations/ | head -5)"
echo "  • Link actual del repo: staging ($STAGING_REF)"
echo ""
echo "Siguiente: avísale a Claude que terminó para revisar drift, commitear el baseline y verificar staging."
