/**
 * As consultas do leitor. Só o que o app usa: nada de folha, salários ou
 * lançamentos. Os nomes vão sem aspas, então valem no SQL Anywhere (que não
 * diferencia maiúsculas) e na simulação em Postgres dos testes.
 */
export const CONSULTAS = {
  empresas: `SELECT codi_emp, nome_emp, cgce_emp, email_emp, stat_emp, simples_emp, dddf_emp, fone_emp FROM geempre`,
  contatos: `SELECT CODI_EMP, NOME_CONTATO, EMAIL_CONTATO, TELEFONE_CONTATO FROM GEEMPRE_CONTATO`,
  responsaveis: `SELECT CODI_EMP, I_RESPONSAVEL, RESPONSAVEL_TIPO FROM PCRESPONSAVEL_EMPRESA`,
  contas: `SELECT c.CODI_EMP, c.I_CONTA_CAIXA, c.I_BANCO, c.AGENCIA, c.IDENTIFICADOR_CONTA, b.CODIGO_BANCO, b.DESCRICAO_BANCO
           FROM CTCONTACAIXA_CONTA_BANCARIA c LEFT JOIN CTLISTA_BANCOS_BANCO_CENTRAL b ON b.I_BANCO = c.I_BANCO`,
  // Diagnóstico inicial, uma vez só: o escritório já usa o Onvio e os Processos?
  diagModuloWeb: `SELECT count(*) AS n FROM GEEMPRESAS_MODULOWEB WHERE USA_DOMINIO_WEB = 'S'`,
  diagPublicados: `SELECT max(DATA_PUBLICADO) AS ultimo, count(*) AS n FROM GEATENDIMENTO_PUBLICAR_DOCUMENTOS`,
  diagProcessos: `SELECT count(*) AS n FROM PCVINCULO_PROCESSO`,
} as const;
