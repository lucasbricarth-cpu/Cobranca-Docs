/** Barra com dois números: recebidos e conferidos de N (prompt §3). */
export function Progresso({ recebidos, conferidos, total, compacta = false }: { recebidos: number; conferidos: number; total: number; compacta?: boolean }) {
  const pr = total ? Math.round((recebidos / total) * 100) : 0;
  const pc = total ? Math.round((conferidos / total) * 100) : 0;
  const completo = total > 0 && conferidos === total;
  return (
    <div>
      {!compacta && (
        <div className="flex items-center justify-between text-[12px] mb-1.5">
          <span className="text-fg-2">
            <b className="mono texto-destaque">{recebidos}</b> recebidos, <b className="mono texto-destaque">{conferidos}</b> conferidos de <b className="mono">{total}</b>
          </span>
          {completo && <span className="pill st-conferido">Mês completo</span>}
        </div>
      )}
      <div className="barra" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={conferidos} aria-label={`${recebidos} recebidos, ${conferidos} conferidos de ${total}`}>
        <i className="b-recebidos" style={{ width: `${pr}%` }} />
        <i className="b-conferidos" style={{ width: `${pc}%` }} />
      </div>
    </div>
  );
}
