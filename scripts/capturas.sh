#!/usr/bin/env bash
# Sobe o app em produção com DEV_LOGIN=1 numa porta própria, tira as capturas e derruba.
set -euo pipefail
PORTA=${PORTA:-3100}
export DEV_LOGIN=1 PORT=$PORTA APP_URL=http://localhost:$PORTA
if curl -sf http://localhost:$PORTA/entrar >/dev/null 2>&1; then
  echo "Já existe um servidor na porta $PORTA; derrube-o antes." >&2; exit 1
fi
# setsid: o servidor ganha um grupo de processos próprio, para o next-server filho cair junto.
setsid npx next start -p $PORTA > /tmp/pd-capturas-server.log 2>&1 &
PID=$!
trap 'kill -- -$PID 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -sf http://localhost:$PORTA/entrar >/dev/null && break; sleep 1; done
CAPTURAS_URL=http://localhost:$PORTA node --no-warnings --experimental-strip-types scripts/capturas.ts "$@"
