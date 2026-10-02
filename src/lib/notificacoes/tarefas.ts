import { registrarTarefa } from '@/lib/fila';
import { avisarClientes, avisarConferir, type EtapaCliente } from './avisos';

registrarTarefa('avisar_itens', async (d) => { await avisarClientes(d.ids as string[], d.etapa as EtapaCliente); });
registrarTarefa('avisar_conferir', async (d) => { await avisarConferir(String(d.documentoId)); });
