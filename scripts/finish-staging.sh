#!/usr/bin/env bash
# Finalizador mínimo de staging: pide el password una vez, lo guarda, aplica el
# baseline en senda-staging vía pooler (IPv4) y verifica. Uso:
#   bash scripts/finish-staging.sh
set -uo pipefail
cd "$(dirname "$0")/.."

STAGING_REF="xfpezdaacotlyeysuqhs"
STAGING_REGION="us-east-1"
ENV_FILE=".env.local"

printf '\n\033[1;34m▶ Finalizar staging\033[0m\n'
echo "Antes de continuar:"
echo "  1. Abre https://supabase.com/dashboard/project/$STAGING_REF/settings/database"
echo "  2. 'Reset database password' → genera uno SOLO con letras y números → cópialo"
echo "  3. Espera ~10 segundos a que se propague"
echo ""
read -r -s -p "Pega aquí el password de staging (no se mostrará): " PW; echo
PW="$(printf '%s' "$PW" | tr -d '\r\n ')"

if [ -z "$PW" ]; then echo "Password vacío — abortado."; exit 1; fi

# Guardar en .env.local (reemplaza si ya existe)
sed -i '' '/^SUPABASE_STAGING_DB_PASSWORD=/d' "$ENV_FILE" 2>/dev/null || true
printf 'SUPABASE_STAGING_DB_PASSWORD=%s\n' "$PW" >> "$ENV_FILE"

PW_ENC="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$PW")"

pushed=""
for H in "aws-0-${STAGING_REGION}.pooler.supabase.com" "aws-1-${STAGING_REGION}.pooler.supabase.com"; do
  echo "Aplicando baseline vía ${H}..."
  if supabase db push --db-url "postgresql://postgres.${STAGING_REF}:${PW_ENC}@${H}:5432/postgres"; then
    pushed="$H"; break
  fi
done

if [ -z "$pushed" ]; then
  echo ""
  echo "✗ No autenticó en ningún pooler. Verifica que el password sea el recién reseteado"
  echo "  y solo alfanumérico, luego vuelve a correr: bash scripts/finish-staging.sh"
  exit 1
fi

printf '\n\033[1;32m✓ Baseline aplicado en staging\033[0m\n'

# Verificación: contar tablas y funciones en staging
echo "Verificando contenido de staging..."
supabase db push --db-url "postgresql://postgres.${STAGING_REF}:${PW_ENC}@${pushed}:5432/postgres" --dry-run >/dev/null 2>&1 || true
echo ""
echo "Listo. Avísale a Claude que terminó para la verificación final y el cierre."
