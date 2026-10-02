---
name: "estetica-dourada"
description: "Aplica o design system \"Glass Dourado\" (identidade do Contrato Facilitado / Acord.IA) a qualquer UI — glassmorphism sobre fundo animado, tema claro e escuro, e a COR DE DESTAQUE TROCÁVEL pelo usuário: seis paletas prontas (Dourado padrão, Cobre, Safira, Petróleo, Ametista, Grafite) sobre os tokens --destaque-*, com o atributo data-destaque no elemento html, script anti-piscada, teste de contraste e a regra do --on-destaque. Traz tokens CSS, fundo animado, receitas de painel de vidro, cartão, botões, inputs, pills, sidebar, tabs, modal, chat, anel de progresso, seletor de paleta e versão mobile. IMPORTANTE - ao ser acionada, SEMPRE perguntar primeiro a cor de destaque padrão (Dourada, Azul Marinho ou Mesclada) e se ela deve ser trocável pelo usuário, a menos que o usuário já tenha dito. Use sempre que for criar ou restilizar telas, modais ou componentes que devam seguir a estética do app, ou quando o usuário falar em paleta, cor de destaque, tema, cor do app, 'trocar a cor', vidro ou glassmorphism."
---

# Estética Dourada — Glass Dourado (glassmorphism)

Evolução do "Warm Minimal" do Contrato Facilitado. A estrutura das telas continua sóbria e contida (Notion-like), mas **todas as superfícies são vidro** flutuando sobre um **fundo animado**, com a cor de destaque no canto superior esquerdo e cinza no resto da tela.

Padrões fixos deste sistema:
- **Fundo:** modo **Manchas** (ou Gradiente), animado, velocidade **2×**, intensidade da cor de destaque **50%**.
- **Vidro:** intensidade **Sutil** (`--blur: 12px`).
- **Temas:** claro e escuro, com o **escuro como padrão**.
- **Cor de destaque:** o **dourado é o padrão**, não a única. O usuário troca em Configurações → Estética do App (seção 10). Tudo o que é dourado neste documento lê os tokens `--destaque-*`; os nomes `--gold-*` são apelidos.

## 0. PRIMEIRA AÇÃO OBRIGATÓRIA: perguntar a cor de destaque
Se o usuário ainda não disse, pergunte duas coisas:
1. Qual é a cor de destaque **padrão** da marca:
   - 🥇 **Dourada** (`#C9A961`). É a identidade clássica e a referência deste documento.
   - 🔵 **Azul Marinho** (`#16293F`). Use a paleta Safira da seção 10 como ponto de partida, ou o mapa da seção 9.
   - ⚜️ **Mesclada**. Navy é a estrutura (sidebar e header em vidro navy) e dourado é a ação (CTA, seleção, anel).
2. Se a cor de destaque deve ser **trocável pelo usuário** (recomendado: é o que faz o app parecer "dele" sem perder a identidade). Se sim, siga a seção 10 inteira; se não, a seção 10 continua valendo para os tokens, só sem a tela e a preferência.

## 1. Regra de ouro
- A cor de destaque é **destaque**, não papel de parede. Ela vai só no CTA principal, no ícone ativo, em seleções, no anel de progresso, no brilho do fundo e nos números de destaque (valores em mono).
- Todo o resto é vidro neutro, feito com os tokens `--glass`, `--glass-2`, `--glass-3` e `--gline`.
- Cores semânticas (ok, warn, info, danger) são **informação**, nunca decoração — e nunca seguem a paleta: "Rascunho" é âmbar, "Concluído" é verde, saldo baixo é vermelho, em qualquer cor de destaque.
- Nunca use fundos sólidos opacos dentro de um painel de vidro. Nada de "círculo preto" atrás de um texto: use máscara ou transparência.
- **Texto escrito sobre a cor de destaque usa sempre o `--on-destaque` da paleta.** Nunca `#1c1709` nem branco fixo: o Dourado e o Cobre pedem texto escuro, Safira, Petróleo, Ametista e Grafite pedem branco no tema claro, e a paleta é quem sabe.

## 2. Tokens (CSS variables)

Os valores abaixo são o **Dourado**, a paleta padrão. Os outros cinco conjuntos estão em `references/paletas.md`.

```css
:root, .dark {
  --base:#0F0E0C;
  --fg:#F2EFE7; --fg-2:#D8D2C6; --fg-3:#B3AB9C; --fg-4:#8E877A;

  /* Cor de destaque — o ÚNICO lugar do app onde ela é escrita. Tudo lê daqui. */
  --destaque:#C9A961; --destaque-text:var(--destaque);
  --destaque-glow:rgba(201,169,97,.10); --destaque-line:rgba(201,169,97,.30);
  --on-destaque:#1c1709;                  /* texto sobre o destaque (CTA, selo, check) */
  --destaque-rgb:201 169 97;              /* canais, para alfas: rgb(var(--destaque-rgb) / .3) */
  --destaque-2-rgb:184 152 80; --destaque-3-rgb:167 135 64;        /* degradês e hover */
  --destaque-claro-rgb:212 183 117; --destaque-escuro-rgb:138 111 48;
  --destaque-serie-1:#C9A961; --destaque-serie-2:#8A6F30; --destaque-serie-3:#E2CB92;
  --destaque-serie-4:#B08D4F; --destaque-serie-5:#D4B775; --destaque-serie-6:#6E5726;   /* gráficos */
  --cta:linear-gradient(90deg,#B8964F,#A3833D); --cta-hover:linear-gradient(90deg,#C4A35C,#B39150);
  --orb1:rgba(87,70,29,calc(.55 * var(--gi))); --orb3:rgba(80,64,28,calc(.40 * var(--gi)));   /* manchas do fundo */
  --orb1-rgb:87 70 29; --orb3-rgb:80 64 28; --gi:.5;
  --primary:42 49% 58%; --ring:42 49% 58%;   /* trios HSL para o shadcn/Tailwind: hsl(var(--primary)) */
  /* apelidos de transição */
  --gold:var(--destaque); --gold-text:var(--destaque-text); --gold-glow:var(--destaque-glow);
  --gold-line:var(--destaque-line); --on-gold:var(--on-destaque);

  --ok:#5DCE7F; --ok-soft:rgba(93,206,127,.12); --warn:#E6B450; --info:#6CA0E6; --danger:#E66565;
  --glass:linear-gradient(155deg, rgba(255,255,255,.075) 0%, rgba(255,255,255,.025) 38%, rgba(18,16,13,.38) 100%);
  --glass-2:rgba(255,255,255,.045); --glass-3:rgba(255,255,255,.09); --glass-solid:#1A1815;
  --gline:rgba(255,255,255,.10); --gline-2:rgba(255,255,255,.06);
  --ghl:inset 0 1px 0 rgba(255,255,255,.11), inset 0 0 0 1px rgba(255,255,255,.015);
  --gshadow:0 24px 60px -12px rgba(0,0,0,.55);
  --btn-bg:linear-gradient(180deg, rgba(255,255,255,.07), rgba(0,0,0,.10));
  --gmid:#23221F; --orb4:#161513;
  --blur:12px;
  --sans:Inter,system-ui,sans-serif; --serif:Merriweather,Georgia,serif; --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.light {
  --base:#EEE7D8;
  --fg:#1F1B14; --fg-2:#2C281E; --fg-3:#524C3B; --fg-4:#716A56;
  --destaque:#957832; --destaque-text:#6C5624;
  --destaque-glow:rgba(149,120,50,.13); --destaque-line:rgba(149,120,50,.36); --on-destaque:#1c1709;
  --destaque-rgb:149 120 50;
  --orb1:rgba(211,185,124,calc(.80 * var(--gi))); --orb3:rgba(205,181,126,calc(.62 * var(--gi)));
  --orb1-rgb:211 185 124; --orb3-rgb:205 181 126;
  --primary:42 50% 39%; --ring:42 50% 39%;
  --ok:#2F9F5E; --ok-soft:rgba(47,159,94,.12); --warn:#B87512; --info:#2F6CB6; --danger:#C03A3A;
  --glass:linear-gradient(155deg, rgba(255,255,255,.74) 0%, rgba(255,255,255,.44) 45%, rgba(255,250,240,.32) 100%);
  --glass-2:rgba(255,255,255,.42); --glass-3:rgba(255,255,255,.75); --glass-solid:#F7F3EA;
  --gline:rgba(255,255,255,.65); --gline-2:rgba(120,96,50,.12);
  --ghl:inset 0 1px 0 rgba(255,255,255,.9), 0 0 0 .5px rgba(120,96,50,.12);
  --gshadow:0 20px 50px -14px rgba(90,70,30,.24);
  --btn-bg:linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,.36));
  --gmid:rgba(150,148,142,.55); --orb4:#A9A59C;
}
```

Por que dois jeitos de escrever a mesma cor: `var(--destaque)` é a cor tematizada (um pouco mais escura no claro); `rgb(var(--destaque-rgb) / .3)` é o jeito de ter alfa sem `color-mix()`. Os canais vão **separados por espaço** para o Tailwind compor a opacidade:

```ts
// tailwind.config.ts
colors: {
  destaque: {
    DEFAULT: 'rgb(var(--destaque-rgb) / <alpha-value>)',
    2: 'rgb(var(--destaque-2-rgb) / <alpha-value>)', 3: 'rgb(var(--destaque-3-rgb) / <alpha-value>)',
    claro: 'rgb(var(--destaque-claro-rgb) / <alpha-value>)', escuro: 'rgb(var(--destaque-escuro-rgb) / <alpha-value>)',
  },
  'on-destaque': 'var(--on-destaque)',
}
// uso: text-destaque, bg-destaque/10, border-destaque/40, from-destaque to-destaque-2, text-on-destaque
```

Intensidade do vidro (`--blur`): **Sutil 12px (padrão)**, Médio 22px, Forte 36px.

## 3. Fundo animado (Gradiente ou Manchas, 2×)

Container `position:fixed; inset:0; pointer-events:none; overflow:hidden; background:var(--base)`, com as camadas dentro. Ele fica em `z-index:-1` no layout raiz, uma vez só.

```css
.bg-grad{position:absolute;inset:0;
  background:linear-gradient(135deg, var(--orb1) 0%, var(--orb3) 7.5%, var(--gmid) 24%, var(--orb4) 67%);
  background-size:150% 150%; animation:gdShift 20s ease-in-out infinite alternate}
.bg-orb{position:absolute;aspect-ratio:1;border-radius:50%;filter:blur(40px);will-change:transform}
.bg-orb-a{width:60%;min-width:380px;left:-15%;top:-20%;background:radial-gradient(circle, var(--orb1), transparent 66%)}
.bg-orb-c{width:55%;min-width:340px;left:30%;bottom:-30%;background:radial-gradient(circle, var(--orb3), transparent 66%)}
@keyframes gdShift{0%{background-position:0% 0%}50%{background-position:9% 4%}100%{background-position:3% 10%}}
@media (prefers-reduced-motion:reduce){.bg-grad,.bg-orb{animation:none}}
```

Regras do fundo:
- A velocidade base é 40s e 34s; a velocidade N× divide essas durações por N.
- A cor de destaque fica **só no canto superior esquerdo** e deve ser sutil; a página tem **ênfase no cinza**. A intensidade (`--gi`, 0 a 1,5) multiplica o alfa das manchas; cada paleta define a cor delas (`--orb1`/`--orb3`) e os canais (`--orb1-rgb`/`--orb3-rgb`).
- O ponto do meio (`--gmid`) é cinza escuro sólido no tema escuro. Isso evita uma faixa esbranquiçada no centro.
- **Mobile:** ângulo mais vertical e manchas com fator próprio, compondo a cor da paleta: `--orb1:rgb(var(--orb1-rgb) / calc(.55 * var(--gi)))`. Assim o celular troca de paleta junto com o computador.
- Alternativa: **Sólido**, só `var(--base)`. Imagem personalizada do usuário também é opção (com escurecer e desfocar).

## 4. Superfícies

| Nível | Uso | Receita | Raio |
|---|---|---|---|
| **Painel** | sidebar, área principal, header, painéis do editor, cards de login e onboarding | `background:var(--glass); backdrop-filter:blur(var(--blur)) saturate(150%); -webkit-backdrop-filter:(idem); border:1px solid var(--gline); box-shadow:var(--ghl), var(--gshadow)` | 22px (header/editor 18–20, auth 26–28) |
| **Cartão** | stats, linhas de lista, cards de template, blocos de formulário | `background:var(--glass-2); border:1px solid var(--gline); box-shadow:var(--ghl)` | 14–18px |
| **Ativo/hover** | item de nav, aba, segmentado, linha do índice | `background:var(--glass-3); border:1px solid var(--gline) ou var(--destaque-line); box-shadow:var(--ghl)` | 10–12px (pílula: 999px) |
| **Base sólida** | menus suspensos e balões sobre conteúdo denso (chat, tutorial) | `background:var(--grain), linear-gradient(160deg, rgba(255,255,255,.08), rgba(255,255,255,.02) 50%, rgba(0,0,0,.10)), var(--glass-solid); border:1px solid var(--gline)` | 18–22px |

Vidro transparente em cima de texto deixa o que está atrás "vazar" — por isso menus e balões usam **base sólida** com brilho, não a receita de Painel.

Layout desktop:
- Os painéis **flutuam**: página com `padding:14px`, `gap:14px` entre sidebar (232px, recolhida 64px) e main. No editor, `gap:12px`.
- Nav pública (landing, planos) é uma **pílula de vidro flutuante** (`border-radius:999px`, sticky `top:12px`).
- Linha de lista: `hover → background:var(--glass-3); border-color:var(--destaque-line)`.

## 5. Tipografia
- **Corpo:** Inter.
- **Títulos de seção:** Merriweather 30px/700, `letter-spacing:-.02em`.
- **Números de stat:** Merriweather 28–30px/700.
- **Eyebrow:** mono 11px, `letter-spacing:.08em`, uppercase, cor `--fg-4`.
- **Labels:** 11.5px/500, cor `--fg-3`.
- **Números e documentos** (CNPJ, valores, versões): mono. Valores monetários em `--destaque-text`.

## 6. Componentes

**Botão primário (cor de destaque)**
```css
background:var(--cta); border:1px solid rgb(var(--destaque-rgb) / .6); color:var(--on-destaque);
box-shadow:0 6px 20px rgb(var(--destaque-rgb) / .30), inset 0 1px 0 rgba(255,255,255,.35);
border-radius:999px; height:38px; padding:0 18px; font:600 13px Inter;
/* hover */ background:var(--cta-hover);
```
Um por contexto. Auth usa 46px com raio 14; mobile usa 56px com raio 16. Nunca escreva o degradê à mão: o `--cta` é o que muda com a paleta.

**Botão secundário (vidro)**
```css
background:var(--btn-bg); border:1px solid var(--gline); box-shadow:var(--ghl); color:var(--fg); border-radius:999px;
/* hover */ background:var(--glass-3);
```

**Botão de ícone/ghost:** fundo transparente, raio 50%, hover `var(--glass-3)`. Botões só com ícone (Histórico, Arquivos) são chips redondos de 30px com `title` e `aria-label`.

**Botão flutuante creme** ("Páginas A4", "Validar Contrato"): `background:rgba(250,246,236,.72); backdrop-filter:blur(12px); border:1px solid rgb(var(--destaque-rgb) / .40); color:#5E4715; height:44px; border-radius:999px`, ícone em `rgb(var(--destaque-escuro-rgb))`. Creme nos dois temas.

**Input**
```css
background:var(--glass-2); border:1px solid var(--gline); border-radius:12px; height:38–44px;
/* focus */ border-color:var(--destaque-line); box-shadow:0 0 0 3px var(--destaque-glow);
```
O campo de busca de lista usa raio 999px, com ícone de busca à esquerda. Select tem seta própria (`appearance:none` + SVG de fundo): a seta nativa soma ao padding e corta "SP" numa coluna de 72px. Editor de texto rico dentro de um painel usa a mesma pele do input; dentro do documento continua branco.

**Segmentado/abas:** container `background:var(--glass-2); border:1px solid var(--gline); border-radius:999px; padding:3px`. O item ativo usa `var(--glass-3)` com `--ghl`. Em abas de painel, o ativo tem texto `--destaque-text` e borda `--destaque-line`.

**Pill de status:** `border-radius:999px; padding:3px 10px; font:500 11px`, com ponto de 6px em `currentColor` e `box-shadow:0 0 6px currentColor`.
- Warn: bg `rgba(230,180,80,.13)`, borda `.30`.
- Ok: bg `var(--ok-soft)`, borda `rgba(93,206,127,.28)`.
- Destaque (plano, papel, "usa IA"): bg `var(--destaque-glow)`, borda `var(--destaque-line)`, texto `--destaque-text`. Status de trabalho (rascunho, concluído, prazo) **não** usa este.

**Quadrado de ícone de identidade:** 36×36, raio 11, `background:var(--destaque-glow); border:1px solid var(--destaque-line); color:var(--destaque-text)`.

**Barra de progresso ou créditos:** trilho `var(--gline)`, preenchimento `var(--cta)` com `box-shadow:0 0 10px rgb(var(--destaque-rgb) / .6)`, raio 999px, altura 5–6px. A barra de créditos troca para `--warn` com 25% ou menos e `--danger` com 10% ou menos — severidade, não paleta.

**Anel de progresso (vazado):** 38px com `conic-gradient(var(--destaque) N%, var(--gline) 0)` e a máscara abaixo. O texto `N%` vai por cima, em mono 10px/600 na cor de destaque. **Nunca** coloque um círculo sólido no centro.
```css
mask:radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3.5px))
```

**Modal:**
- Overlay: `rgba(0,0,0,.55)` com `backdrop-filter:blur(4px)`.
- Caixa: receita de **Painel** com raio 22.
- Header: quadrado de ícone na cor de destaque, título e subtítulo.
- Footer: CTA primário e secundário (vidro, nunca um bloco opaco).

**Chat IA:**
- Bolha do assistente: `var(--glass-2)` + `--gline`, raio 14, canto inferior esquerdo 4px.
- Bolha do usuário: `rgba(255,140,66,.15)` com borda `.30`.
- Input: container de vidro com raio 18, contendo ícones ghost, textarea **transparente** (classe própria com `background:transparent !important`, porque folhas antigas costumam forçar fundo escuro em toda textarea) e botão de enviar. O enviar é `--cta` quando há texto e `var(--glass-3)` quando vazio.
- Menus do cabeçalho do chat (nível de detalhamento etc.) usam **base sólida**, eyebrow em mono e a opção ativa num cartão `--destaque-glow` + `--destaque-line` com check.

**Documento (contrato):** folha **branca opaca** (`#fff`, raio 6, `box-shadow:0 20px 50px rgba(0,0,0,.25)`) dentro de um painel `var(--glass-2)`. O documento nunca fica transparente e **nunca segue a paleta**: prévia, PDF e estética por escritório são do cliente, não do usuário.

**Gráficos:** séries em `var(--destaque-serie-1..6)` direto no SVG (`stroke`/`fill`): o navegador resolve o `var()` e redesenha quando a paleta muda, sem `getComputedStyle`. Canvas precisa ler a variável por JS.

## 7. Mobile
- Os cards usam a receita de **Painel** (com blur), raio 16–18.
- **Tabbar** é uma pílula de vidro flutuante: `margin:0 16px 26px; height:62px; border-radius:24px; backdrop-filter:blur(var(--blur)) saturate(160%)`. Aba ativa em `--destaque-text`, peso 600.
- Rodapé sticky com `background:var(--glass)`, blur e `border-top:1px solid var(--gline)`.
- Chips com raio 999px; o ativo usa `background:var(--fg); color:var(--base)`.
- Alvos de toque de no mínimo 44px.
- O CSS do celular lê **os mesmos tokens** (`--destaque`, `--destaque-text`, `--cta`), então a paleta escolhida no computador vale no celular. Nada de dourado escrito à mão por lá.

## 8. Checklist
0. A cor de destaque padrão foi perguntada ou confirmada, e também se ela é trocável.
1. Os tokens da seção 2 estão aplicados, com tema claro e escuro alternáveis. O escuro é o padrão.
2. O fundo animado da seção 3 está presente, a 2×, com `prefers-reduced-motion`.
3. Toda superfície é Painel, Cartão, Ativo ou Base sólida. Não há cinzas opacos hardcoded.
4. O blur está em `var(--blur)`, com Sutil (12px) como padrão, e `-webkit-backdrop-filter` foi incluído.
5. A cor de destaque aparece só em CTA, ativo, seleção, progresso e valores — e **só via tokens**: `rg -i "c9a961|201, ?169, ?97|1c1709|b8964f|a3833d" src` não acha nada fora do bloco de tokens, das paletas geradas e dos ícones estáticos.
6. Texto sobre a cor de destaque usa `--on-destaque`; status usam cor semântica.
7. Os raios seguem a escala: painel 22, cartão 14–18, item 10–12, pílula 999.
8. Ícones são lucide, de 13–18px, com stroke 1.8.
9. Os textos passam no contraste mínimo: `--fg-3` e `--fg-4` só em texto secundário; as paletas passam no teste da seção 10.
10. Documento, prévia e PDF não mudam com a paleta; rotas públicas ficam na paleta padrão.

## 9. Outras paletas de identidade (quando a cor NÃO é trocável)
- **Azul Marinho:** troque `#C9A961→#16293F`, `#B8964F→#1E3A5F`, `#A3833D→#0F1D2E`. No escuro, use `#6C97C7` para `--destaque`, e as manchas passam a `rgba(108,151,199,.22)` e `.14`.
- **Mesclada:** sidebar e header em vidro navy (`background:linear-gradient(155deg, rgba(22,41,63,.75), rgba(15,29,46,.6))`), com texto `rgba(255,255,255,.9)` e ícone ativo dourado. CTA, seleção e anel continuam dourados. O fundo continua dourado→cinza.

## 10. Cor de destaque trocável pelo usuário (paletas)

É o que faz o app parecer do usuário sem perder a identidade. Seis paletas fechadas, o Dourado como padrão, e o resto do app não sabe que existe paleta: ele só lê tokens.

### 10.1 O que cada paleta define
Um conjunto **inteiro**, por tema (claro e escuro), tudo já calculado em hex/rgb/rgba — **sem `color-mix()`, `oklch()` nem cor calculada em CSS**, porque exportadores como o html2canvas 1.4.1 só entendem `rgb/rgba/hsl/hsla`:
- `--destaque`, `--destaque-text`, `--destaque-glow`, `--destaque-line`, `--on-destaque` (escuro ou branco, conforme o contraste);
- os canais `--destaque-rgb`, `-2-rgb`, `-3-rgb`, `-claro-rgb`, `-escuro-rgb` (degradês, hovers, variações);
- `--destaque-serie-1..6` (gráficos);
- `--cta` e `--cta-hover` (dois tons cada);
- as manchas do fundo `--orb1`/`--orb3` com `--orb1-rgb`/`--orb3-rgb`;
- `--primary` e `--ring` em trio HSL, para o shadcn/Tailwind.

As seis (Dourado, Cobre, Safira, Petróleo, Ametista, Grafite) estão prontas em `references/paletas.md`. Esmeralda e bordô ficaram de fora de propósito: confundem com o verde de "Concluído" e o vermelho de alerta.

### 10.2 Uma fonte, CSS gerado
Os valores vivem num módulo só (`src/lib/paletas.ts`: `IDS_PALETA`, `PALETAS`, `ehIdPaleta`, `declaracoesDoTema`). Um script (`npm run paletas`) gera, entre marcadores no `globals.css`, um bloco por paleta e tema:

```css
html[data-destaque="safira"] { --destaque:#467AD4; --destaque-text:#2757A8; --on-destaque:#FFFFFF; --destaque-rgb:70 122 212; /* … */ }
html.dark[data-destaque="safira"] { --destaque:#99B6E7; --destaque-text:#99B6E7; --on-destaque:#1c1709; /* … */ }
```

`html[data-destaque]` vence `:root` e `.dark` por especificidade. O Dourado é também o conteúdo dos tokens base, então a paleta padrão não precisa de atributo. Editar o bloco gerado à mão não adianta: o teste de contraste acusa o CSS desatualizado.

### 10.3 Trocar o dourado escrito à mão por tokens (primeiro passo, sem mudança visual)
Antes de existir paleta, o app todo precisa ler tokens. Troque `#C9A961` por `rgb(var(--destaque-rgb))` ou `text-destaque`, `rgba(201,169,97,.3)` por `rgb(var(--destaque-rgb) / .3)` ou `bg-destaque/30`, `#1c1709` por `var(--on-destaque)`, degradês fixos por `var(--cta)`. Num valor arbitrário do Tailwind, sem espaços: `shadow-[0_6px_20px_rgb(var(--destaque-rgb)/0.3)]`. Seletores de CSS legado que casam classes (`[class*="text-[#C9A961]"]`) precisam dos nomes novos. Depois, capturas antes/depois das telas principais, nos dois temas, comparadas pixel a pixel — zero diferença é o aceite; foi assim que apareceu um token apontando para si mesmo.

### 10.4 A preferência e a primeira pintura
- A escolha é **do usuário**, não do escritório: campo `destaque` nas preferências de estética, validado por **lista fechada** no mesmo normalizador que o servidor usa (`"<script>"`, id desconhecido ou número viram o padrão), gravado no JSONB que já existe. Sem migration.
- Aplicar é só o atributo: `document.documentElement.setAttribute('data-destaque', id)` (padrão e rotas públicas = sem atributo).
- **Sem piscada:** um script inline, **primeiro filho do `<body>`** (técnica do next-themes), lê o cache local (`cf.bgPrefs`), confere o id na lista e põe o atributo antes de o React montar. Em rota pública (landing, login, planos, termos, links de coleta) não aplica nada.
- O provider que aplica as preferências depende também do `pathname`: ir do login ao painel não recarrega a página. E na **primeira** aplicação ele usa o próprio cache, não o estado inicial (os padrões), senão apaga por um quadro o que o script já pintou.
- Favicon e ícones do PWA são estáticos e ficam na paleta padrão. A marca (SVG inline) pode seguir a paleta — foi a decisão do Acord.IA — ou ficar fixa; decida com o usuário.

### 10.5 A tela
Em Configurações → Estética do App, um cartão **"Cor de destaque"** no topo: seis amostras clicáveis (círculo de 34px com o degradê do CTA da paleta, check em `--on-destaque` na ativa, nome embaixo; cartão de vidro com borda `--destaque-line` quando ativa), `role="radiogroup"`. A prévia ao vivo mostra um CTA de amostra. O deslizante chama-se "Intensidade da cor de destaque". "Restaurar padrão" volta tudo ao padrão, paleta incluída.

### 10.6 Teste de contraste (`npm run contraste`)
Cada paleta × tema × intensidade do fundo 0 e 1,5 (24 combinações), contra os fundos em que o texto aparece de fato — os dois primeiros tons do vidro de painel e o cartão, sobre a base e sobre a mancha (a mancha a 70% do pico, que é o que chega sob um painel perto do centro dela):
- **4,5:1** para `--destaque-text` sobre esses fundos e para `--on-destaque` sobre os dois tons do CTA;
- **3:1** para `--destaque` como borda, `--ring` como anel e `--on-destaque` como ícone sobre o destaque sólido (WCAG 1.4.11).

O script falha se qualquer combinação não passar, se o CSS gerado estiver desatualizado ou se os tokens base divergirem do padrão. **Ajuste o tom da paleta, nunca o limite nem o deslizante.** Foi isso que escureceu o dourado do tema claro (`#B08A38 → #957832`) e deixou as manchas escuras mais discretas: no escuro a 150% a mancha clareia o painel, e a cor de destaque precisa continuar a 3:1 sobre ele.

### 10.7 O que nunca segue a paleta
Documento, prévia e PDF (exporte o mesmo contrato em cada paleta: as imagens das páginas têm de sair byte a byte iguais, sem "unsupported color function" no console); estética por escritório; cores semânticas; ícones estáticos.
