import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';

/** Arquivos de demonstração (PDF de extrato, foto de recibo, XML de NF-e e OFX). Determinísticos: o mesmo conteúdo sempre. */
export async function pdfDemo(titulo: string, linhas: string[]): Promise<Buffer> {
  const d = await PDFDocument.create();
  d.setCreationDate(new Date('2026-01-01T00:00:00Z')); d.setModificationDate(new Date('2026-01-01T00:00:00Z'));
  d.setProducer('demo'); d.setCreator('demo');
  const p = d.addPage([595, 842]);
  const f = await d.embedFont(StandardFonts.Helvetica);
  const b = await d.embedFont(StandardFonts.HelveticaBold);
  p.drawRectangle({ x: 0, y: 772, width: 595, height: 70, color: rgb(0.93, 0.36, 0.05) });
  p.drawText(titulo, { x: 40, y: 798, size: 20, font: b, color: rgb(1, 1, 1) });
  linhas.forEach((l, i) => p.drawText(l, { x: 40, y: 740 - i * 22, size: 11, font: f, color: rgb(0.15, 0.15, 0.15) }));
  for (let i = 0; i < 14; i++) {
    const y = 560 - i * 24;
    p.drawLine({ start: { x: 40, y: y - 6 }, end: { x: 555, y: y - 6 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    p.drawText(`${String(1 + i * 2).padStart(2, '0')}/09  PIX RECEBIDO CLIENTE ${i + 1}`, { x: 40, y, size: 10, font: f });
    p.drawText(`R$ ${(123.45 * (i + 1)).toFixed(2).replace('.', ',')}`, { x: 470, y, size: 10, font: f });
  }
  return Buffer.from(await d.save({ useObjectStreams: false }));
}

export async function fotoDemo(texto: string, cor = '#f4f1ea'): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="#3a3530"/>
    <g transform="rotate(-3 450 600)"><rect x="120" y="100" width="660" height="1000" fill="${cor}" rx="8"/>
    <text x="170" y="220" font-family="sans-serif" font-size="44" font-weight="700" fill="#222">${texto}</text>
    ${Array.from({ length: 14 }).map((_, i) => `<rect x="170" y="${290 + i * 52}" width="${420 + ((i * 37) % 140)}" height="16" fill="#bbb"/>`).join('')}
    </g></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

export function xmlNfeDemo(cnpjEmit: string, cnpjDest: string, dataEmissao: string, numero: number): Buffer {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe35260911222333000181550010000${numero}1000000000" versao="4.00">
<ide><cUF>35</cUF><nNF>${numero}</nNF><dhEmi>${dataEmissao}T10:00:00-03:00</dhEmi><tpNF>0</tpNF></ide>
<emit><CNPJ>${cnpjEmit}</CNPJ><xNome>Fornecedor Exemplo Ltda</xNome></emit>
<dest><CNPJ>${cnpjDest}</CNPJ><xNome>Destinatario</xNome></dest>
<total><ICMSTot><vNF>1500.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`, 'utf8');
}

export function ofxDemo(codigoBanco: string, agencia: string, conta: string, inicio: string, fim: string): Buffer {
  return Buffer.from(`OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL
<BANKACCTFROM><BANKID>${codigoBanco}<BRANCHID>${agencia}<ACCTID>${conta}<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>${inicio.replace(/-/g, '')}000000[-3:BRT]<DTEND>${fim.replace(/-/g, '')}235959[-3:BRT]
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>${inicio.replace(/-/g, '')}<TRNAMT>150.00<FITID>1<MEMO>PIX</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>
`, 'latin1');
}
