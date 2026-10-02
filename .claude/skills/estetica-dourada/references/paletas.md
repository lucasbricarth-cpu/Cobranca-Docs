# As seis paletas da cor de destaque

Valores prontos, já calculados (hex / rgb / rgba / trio HSL), nos dois temas. São os mesmos do
`src/lib/paletas.ts` do Contrato Facilitado, que passam no teste de contraste da SKILL.md §10.
Copie o bloco da paleta inteira: os tokens formam um conjunto, não escolha só a cor base.

| Paleta | Resumo | Texto sobre o CTA (claro / escuro) | Destaque claro | Destaque escuro |
|---|---|---|---|---|
| **Dourado** (`dourado`) | A identidade clássica do Acord.IA. | #1c1709 / #1c1709 | `#957832` | `#C9A961` |
| **Cobre** (`cobre`) | Quente e terroso, um degrau abaixo do dourado. | #1c1709 / #1c1709 | `#BF6233` | `#E1A88C` |
| **Safira** (`safira`) | Azul profundo, sóbrio e institucional. | #FFFFFF / #1c1709 | `#467AD4` | `#99B6E7` |
| **Petróleo** (`petroleo`) | Verde-azulado, frio e discreto. | #FFFFFF / #1c1709 | `#2A8792` | `#5AC4CF` |
| **Ametista** (`ametista`) | Violeta suave, para destacar sem gritar. | #FFFFFF / #1c1709 | `#9963C8` | `#C7A9E1` |
| **Grafite** (`grafite`) | Cinza-azulado, quase neutro. | #FFFFFF / #1c1709 | `#757C87` | `#B1B5BB` |

Blocos CSS gerados (o mesmo que `npm run paletas` escreve no `globals.css`). O Dourado também é o
conteúdo dos tokens base (`:root` claro e `.dark`), por isso a paleta padrão não precisa do atributo.

## Dourado — A identidade clássica do Acord.IA.

```css
html[data-destaque="dourado"] {
  --destaque: #957832;
  --destaque-text: #6C5624;
  --destaque-glow: rgba(149, 120, 50, 0.13);
  --destaque-line: rgba(149, 120, 50, 0.36);
  --on-destaque: #1c1709;
  --destaque-rgb: 149 120 50;
  --destaque-2-rgb: 184 152 80;
  --destaque-3-rgb: 167 135 64;
  --destaque-claro-rgb: 212 183 117;
  --destaque-escuro-rgb: 138 111 48;
  --destaque-serie-1: #C9A961;
  --destaque-serie-2: #8A6F30;
  --destaque-serie-3: #E2CB92;
  --destaque-serie-4: #B08D4F;
  --destaque-serie-5: #D4B775;
  --destaque-serie-6: #6E5726;
  --cta: linear-gradient(90deg, #B8964F, #A3833D);
  --cta-hover: linear-gradient(90deg, #C4A35C, #B39150);
  --orb1: rgba(211, 185, 124, calc(0.8 * var(--gi)));
  --orb3: rgba(206, 182, 126, calc(0.62 * var(--gi)));
  --orb1-rgb: 211 185 124;
  --orb3-rgb: 206 182 126;
  --primary: 42 50% 39%;
  --ring: 42 50% 39%;
}
html.dark[data-destaque="dourado"] {
  --destaque: #C9A961;
  --destaque-text: #C9A961;
  --destaque-glow: rgba(201, 169, 97, 0.1);
  --destaque-line: rgba(201, 169, 97, 0.3);
  --on-destaque: #1c1709;
  --destaque-rgb: 201 169 97;
  --destaque-2-rgb: 184 152 80;
  --destaque-3-rgb: 167 135 64;
  --destaque-claro-rgb: 212 183 117;
  --destaque-escuro-rgb: 138 111 48;
  --destaque-serie-1: #C9A961;
  --destaque-serie-2: #8A6F30;
  --destaque-serie-3: #E2CB92;
  --destaque-serie-4: #B08D4F;
  --destaque-serie-5: #D4B775;
  --destaque-serie-6: #6E5726;
  --cta: linear-gradient(90deg, #B8964F, #A3833D);
  --cta-hover: linear-gradient(90deg, #C4A35C, #B39150);
  --orb1: rgba(87, 70, 29, calc(0.55 * var(--gi)));
  --orb3: rgba(79, 65, 30, calc(0.4 * var(--gi)));
  --orb1-rgb: 87 70 29;
  --orb3-rgb: 79 65 30;
  --primary: 42 49% 58%;
  --ring: 42 49% 58%;
}
```

## Cobre — Quente e terroso, um degrau abaixo do dourado.

```css
html[data-destaque="cobre"] {
  --destaque: #BF6233;
  --destaque-text: #8A4725;
  --destaque-glow: rgba(191, 98, 51, 0.13);
  --destaque-line: rgba(191, 98, 51, 0.36);
  --on-destaque: #1c1709;
  --destaque-rgb: 191 98 51;
  --destaque-2-rgb: 196 100 52;
  --destaque-3-rgb: 182 93 48;
  --destaque-claro-rgb: 221 160 129;
  --destaque-escuro-rgb: 138 71 37;
  --destaque-serie-1: #BF6233;
  --destaque-serie-2: #8A4725;
  --destaque-serie-3: #E1A88C;
  --destaque-serie-4: #D07A4F;
  --destaque-serie-5: #D8916D;
  --destaque-serie-6: #6C371D;
  --cta: linear-gradient(90deg, #CD7042, #CA6838);
  --cta-hover: linear-gradient(90deg, #D07A4F, #CD7244);
  --orb1: rgba(222, 178, 157, calc(0.8 * var(--gi)));
  --orb3: rgba(217, 176, 155, calc(0.62 * var(--gi)));
  --orb1-rgb: 222 178 157;
  --orb3-rgb: 217 176 155;
  --primary: 20 58% 47%;
  --ring: 20 58% 47%;
}
html.dark[data-destaque="cobre"] {
  --destaque: #E1A88C;
  --destaque-text: #E1A88C;
  --destaque-glow: rgba(225, 168, 140, 0.1);
  --destaque-line: rgba(225, 168, 140, 0.3);
  --on-destaque: #1c1709;
  --destaque-rgb: 225 168 140;
  --destaque-2-rgb: 213 137 99;
  --destaque-3-rgb: 205 112 66;
  --destaque-claro-rgb: 235 199 181;
  --destaque-escuro-rgb: 162 83 43;
  --destaque-serie-1: #E1A88C;
  --destaque-serie-2: #A2532B;
  --destaque-serie-3: #EECEBE;
  --destaque-serie-4: #D28057;
  --destaque-serie-5: #E8BCA7;
  --destaque-serie-6: #7C3F21;
  --cta: linear-gradient(90deg, #D58963, #CD7042);
  --cta-hover: linear-gradient(90deg, #D99471, #D17D53);
  --orb1: rgba(108, 60, 36, calc(0.55 * var(--gi)));
  --orb3: rgba(96, 56, 37, calc(0.4 * var(--gi)));
  --orb1-rgb: 108 60 36;
  --orb3-rgb: 96 56 37;
  --primary: 20 59% 72%;
  --ring: 20 59% 72%;
}
```

## Safira — Azul profundo, sóbrio e institucional.

```css
html[data-destaque="safira"] {
  --destaque: #467AD4;
  --destaque-text: #2757A8;
  --destaque-glow: rgba(70, 122, 212, 0.13);
  --destaque-line: rgba(70, 122, 212, 0.36);
  --on-destaque: #FFFFFF;
  --destaque-rgb: 70 122 212;
  --destaque-2-rgb: 75 125 213;
  --destaque-3-rgb: 61 116 210;
  --destaque-claro-rgb: 143 175 229;
  --destaque-escuro-rgb: 39 87 168;
  --destaque-serie-1: #467AD4;
  --destaque-serie-2: #2757A8;
  --destaque-serie-3: #99B6E7;
  --destaque-serie-4: #6590DB;
  --destaque-serie-5: #7FA3E1;
  --destaque-serie-6: #1F4383;
  --cta: linear-gradient(90deg, #366ED0, #2C60BB);
  --cta-hover: linear-gradient(90deg, #4277D3, #3069CB);
  --orb1: rgba(167, 189, 226, calc(0.8 * var(--gi)));
  --orb3: rgba(165, 185, 221, calc(0.62 * var(--gi)));
  --orb1-rgb: 167 189 226;
  --orb3-rgb: 165 185 221;
  --primary: 218 62% 55%;
  --ring: 218 62% 55%;
}
html.dark[data-destaque="safira"] {
  --destaque: #99B6E7;
  --destaque-text: #99B6E7;
  --destaque-glow: rgba(153, 182, 231, 0.1);
  --destaque-line: rgba(153, 182, 231, 0.3);
  --on-destaque: #1c1709;
  --destaque-rgb: 153 182 231;
  --destaque-2-rgb: 118 156 223;
  --destaque-3-rgb: 91 137 216;
  --destaque-claro-rgb: 189 208 240;
  --destaque-escuro-rgb: 46 101 197;
  --destaque-serie-1: #99B6E7;
  --destaque-serie-2: #2E65C5;
  --destaque-serie-3: #C5D5F1;
  --destaque-serie-4: #6C95DD;
  --destaque-serie-5: #B0C7ED;
  --destaque-serie-6: #234E97;
  --cta: linear-gradient(90deg, #769CDF, #5B89D8);
  --cta-hover: linear-gradient(90deg, #82A5E2, #6993DC);
  --orb1: rgba(41, 72, 124, calc(0.55 * var(--gi)));
  --orb3: rgba(41, 66, 109, calc(0.4 * var(--gi)));
  --orb1-rgb: 41 72 124;
  --orb3-rgb: 41 66 109;
  --primary: 218 62% 75%;
  --ring: 218 62% 75%;
}
```

## Petróleo — Verde-azulado, frio e discreto.

```css
html[data-destaque="petroleo"] {
  --destaque: #2A8792;
  --destaque-text: #1F6269;
  --destaque-glow: rgba(42, 135, 146, 0.13);
  --destaque-line: rgba(42, 135, 146, 0.36);
  --on-destaque: #FFFFFF;
  --destaque-rgb: 42 135 146;
  --destaque-2-rgb: 43 138 149;
  --destaque-3-rgb: 40 129 139;
  --destaque-claro-rgb: 72 189 202;
  --destaque-escuro-rgb: 31 98 105;
  --destaque-serie-1: #2A8792;
  --destaque-serie-2: #1F6269;
  --destaque-serie-3: #5AC4CF;
  --destaque-serie-4: #319EAA;
  --destaque-serie-5: #37B1BF;
  --destaque-serie-6: #184C52;
  --cta: linear-gradient(90deg, #277C85, #226D75);
  --cta-hover: linear-gradient(90deg, #29848E, #25767F);
  --orb1: rgba(118, 200, 209, calc(0.8 * var(--gi)));
  --orb3: rgba(122, 196, 204, calc(0.62 * var(--gi)));
  --orb1-rgb: 118 200 209;
  --orb3-rgb: 122 196 204;
  --primary: 186 55% 37%;
  --ring: 186 55% 37%;
}
html.dark[data-destaque="petroleo"] {
  --destaque: #5AC4CF;
  --destaque-text: #5AC4CF;
  --destaque-glow: rgba(90, 196, 207, 0.1);
  --destaque-line: rgba(90, 196, 207, 0.3);
  --on-destaque: #1c1709;
  --destaque-rgb: 90 196 207;
  --destaque-2-rgb: 53 170 183;
  --destaque-3-rgb: 47 150 161;
  --destaque-claro-rgb: 152 218 225;
  --destaque-escuro-rgb: 36 115 123;
  --destaque-serie-1: #5AC4CF;
  --destaque-serie-2: #24737B;
  --destaque-serie-3: #A5DEE5;
  --destaque-serie-4: #33A3AF;
  --destaque-serie-5: #83D2DB;
  --destaque-serie-6: #1B585E;
  --cta: linear-gradient(90deg, #35AAB7, #2F96A1);
  --cta-hover: linear-gradient(90deg, #38B3C1, #32A0AD);
  --orb1: rgba(28, 79, 85, calc(0.55 * var(--gi)));
  --orb3: rgba(29, 72, 77, calc(0.4 * var(--gi)));
  --orb1-rgb: 28 79 85;
  --orb3-rgb: 29 72 77;
  --primary: 186 55% 58%;
  --ring: 186 55% 58%;
}
```

## Ametista — Violeta suave, para destacar sem gritar.

```css
html[data-destaque="ametista"] {
  --destaque: #9963C8;
  --destaque-text: #773CAA;
  --destaque-glow: rgba(153, 99, 200, 0.13);
  --destaque-line: rgba(153, 99, 200, 0.36);
  --on-destaque: #FFFFFF;
  --destaque-rgb: 153 99 200;
  --destaque-2-rgb: 156 103 202;
  --destaque-3-rgb: 148 92 198;
  --destaque-claro-rgb: 193 161 222;
  --destaque-escuro-rgb: 119 60 170;
  --destaque-serie-1: #9963C8;
  --destaque-serie-2: #773CAA;
  --destaque-serie-3: #C7A9E1;
  --destaque-serie-4: #AA7DD1;
  --destaque-serie-5: #B893D9;
  --destaque-serie-6: #5D2F85;
  --cta: linear-gradient(90deg, #9056C3, #8442BD);
  --cta-hover: linear-gradient(90deg, #9760C7, #8C4FC1);
  --orb1: rgba(204, 177, 228, calc(0.8 * var(--gi)));
  --orb3: rgba(201, 174, 224, calc(0.62 * var(--gi)));
  --orb1-rgb: 204 177 228;
  --orb3-rgb: 201 174 224;
  --primary: 272 48% 59%;
  --ring: 272 48% 59%;
}
html.dark[data-destaque="ametista"] {
  --destaque: #C7A9E1;
  --destaque-text: #C7A9E1;
  --destaque-glow: rgba(199, 169, 225, 0.1);
  --destaque-line: rgba(199, 169, 225, 0.3);
  --on-destaque: #1c1709;
  --destaque-rgb: 199 169 225;
  --destaque-2-rgb: 179 139 214;
  --destaque-3-rgb: 164 116 206;
  --destaque-claro-rgb: 219 199 235;
  --destaque-escuro-rgb: 137 74 191;
  --destaque-serie-1: #C7A9E1;
  --destaque-serie-2: #894ABF;
  --destaque-serie-3: #DFCEEE;
  --destaque-serie-4: #AE83D3;
  --destaque-serie-5: #D4BDE8;
  --destaque-serie-6: #6B3699;
  --cta: linear-gradient(90deg, #B38BD6, #A474CE);
  --cta-hover: linear-gradient(90deg, #BA95DA, #AC80D3);
  --orb1: rgba(96, 49, 138, calc(0.55 * var(--gi)));
  --orb3: rgba(88, 47, 123, calc(0.4 * var(--gi)));
  --orb1-rgb: 96 49 138;
  --orb3-rgb: 88 47 123;
  --primary: 272 48% 77%;
  --ring: 272 48% 77%;
}
```

## Grafite — Cinza-azulado, quase neutro.

```css
html[data-destaque="grafite"] {
  --destaque: #757C87;
  --destaque-text: #545A61;
  --destaque-glow: rgba(117, 124, 135, 0.13);
  --destaque-line: rgba(117, 124, 135, 0.36);
  --on-destaque: #FFFFFF;
  --destaque-rgb: 117 124 135;
  --destaque-2-rgb: 120 127 137;
  --destaque-3-rgb: 111 118 128;
  --destaque-claro-rgb: 169 174 180;
  --destaque-escuro-rgb: 84 90 97;
  --destaque-serie-1: #757C87;
  --destaque-serie-2: #545A61;
  --destaque-serie-3: #B1B5BB;
  --destaque-serie-4: #8B919A;
  --destaque-serie-5: #9DA2AA;
  --destaque-serie-6: #42464B;
  --cta: linear-gradient(90deg, #6B727B, #5E646C);
  --cta-hover: linear-gradient(90deg, #727983, #666D76);
  --orb1: rgba(184, 188, 193, calc(0.8 * var(--gi)));
  --orb3: rgba(180, 185, 190, calc(0.62 * var(--gi)));
  --orb1-rgb: 184 188 193;
  --orb3-rgb: 180 185 190;
  --primary: 217 7% 49%;
  --ring: 217 7% 49%;
}
html.dark[data-destaque="grafite"] {
  --destaque: #B1B5BB;
  --destaque-text: #B1B5BB;
  --destaque-glow: rgba(177, 181, 187, 0.1);
  --destaque-line: rgba(177, 181, 187, 0.3);
  --on-destaque: #1c1709;
  --destaque-rgb: 177 181 187;
  --destaque-2-rgb: 150 156 164;
  --destaque-3-rgb: 131 138 147;
  --destaque-claro-rgb: 204 207 211;
  --destaque-escuro-rgb: 99 105 114;
  --destaque-serie-1: #B1B5BB;
  --destaque-serie-2: #636972;
  --destaque-serie-3: #D2D4D8;
  --destaque-serie-4: #8F969E;
  --destaque-serie-5: #C2C6CA;
  --destaque-serie-6: #4C5057;
  --cta: linear-gradient(90deg, #969CA4, #838A93);
  --cta-hover: linear-gradient(90deg, #9FA4AC, #8D939C);
  --orb1: rgba(68, 73, 79, calc(0.55 * var(--gi)));
  --orb3: rgba(63, 67, 72, calc(0.4 * var(--gi)));
  --orb1-rgb: 68 73 79;
  --orb3-rgb: 63 67 72;
  --primary: 216 7% 71%;
  --ring: 216 7% 71%;
}
```
