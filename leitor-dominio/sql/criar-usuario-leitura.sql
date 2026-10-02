-- Usuário do leitor na Domínio (SQL Anywhere). Rodar UMA vez, por um DBA,
-- DEPOIS de confirmar que a licença da Thomson Reuters permite este acesso.
-- Só SELECT, e só nas tabelas que o leitor usa. Nenhum INSERT/UPDATE/DELETE.

CREATE USER leitor_portal IDENTIFIED BY 'troque-esta-senha';

GRANT SELECT ON bethadba.geempre                       TO leitor_portal;
GRANT SELECT ON bethadba.GEEMPRE_CONTATO               TO leitor_portal;
GRANT SELECT ON bethadba.PCRESPONSAVEL_EMPRESA         TO leitor_portal;
GRANT SELECT ON bethadba.CTCONTACAIXA_CONTA_BANCARIA   TO leitor_portal;
GRANT SELECT ON bethadba.CTLISTA_BANCOS_BANCO_CENTRAL  TO leitor_portal;
GRANT SELECT ON bethadba.ctcontas                      TO leitor_portal;
-- Diagnóstico inicial (pode ser revogado depois da primeira execução):
GRANT SELECT ON bethadba.GEEMPRESAS_MODULOWEB              TO leitor_portal;
GRANT SELECT ON bethadba.GEATENDIMENTO_PUBLICAR_DOCUMENTOS TO leitor_portal;
GRANT SELECT ON bethadba.PCVINCULO_PROCESSO                TO leitor_portal;

-- Conferência: este comando precisa FALHAR quando rodado como leitor_portal.
-- UPDATE bethadba.geempre SET nome_emp = nome_emp WHERE 1 = 0;
