# Prompt — Sistema "Eleitor Certo"

## Contexto e Objetivo

Você é um engenheiro de software sênior full-stack. Sua tarefa é desenvolver um sistema web completo chamado **"Eleitor Certo"**, voltado para candidatos políticos brasileiros. O sistema permite que o político visualize, em um mapa interativo com camadas geográficas, as áreas onde foi mais ou menos votado, com base em uma base de dados eleitorais nacional (~27 GB) referente às eleições de 2024.

O sistema possui dois fluxos principais:

1. **Configuração do Copiloto** — formulário em blocos onde o candidato preenche seu perfil eleitoral.
2. **Mapa Interativo** — visualização geoespacial com camadas, cores e tooltips informativos, exibida após a ativação do copiloto.

---

## Stack Técnica Obrigatória

- **Backend:** Node.js (versão LTS atual) com Express.js ou Fastify.
- **Frontend:** React (versão 18+) com Vite ou Next.js.
- **Linguagem:** TypeScript em ambos backend e frontend.
- **Banco de Dados:** PostgreSQL com extensão **PostGIS** habilitada (para suporte a dados geoespaciais).
- **ORM:** Prisma ou TypeORM.
- **Validação:** Zod (frontend e backend) ou Yup.
- **Estilização:** TailwindCSS + shadcn/ui (ou Material UI, se preferível).
- **Mapa:** **Leaflet.js** com **React-Leaflet** (preferencial pela simplicidade) ou **Mapbox GL JS**. Use camadas de polígonos GeoJSON para representar zonas eleitorais.
- **Gerenciamento de estado:** Zustand ou Redux Toolkit.
- **Autenticação:** JWT com refresh token.
- **Containerização:** Docker e docker-compose para ambiente de desenvolvimento.

---

## Arquitetura Geral

### Estrutura de Pastas Sugerida

```
eleitor-certo/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── middlewares/
│   │   ├── validators/
│   │   ├── database/
│   │   │   ├── migrations/
│   │   │   └── seeds/
│   │   └── utils/
│   └── prisma/schema.prisma
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/api/
│   │   ├── stores/
│   │   ├── types/
│   │   └── utils/
└── docker-compose.yml
```

---

## Modelagem do Banco de Dados

Crie no mínimo as seguintes tabelas (use migrations):

### `users` (políticos cadastrados)
- `id` (UUID, PK)
- `email` (unique)
- `password_hash`
- `created_at`, `updated_at`

### `candidates` (perfil do candidato/copiloto)
- `id` (UUID, PK)
- `user_id` (FK → users)
- `nome_completo`
- `nome_urna`
- `numero_urna` (nullable)
- `partido_sigla`
- `partido_nome`
- `cpf` (unique, validado)
- `titulo_eleitor`
- `email_contato`
- `telefone` (com DDD)
- `cargo` (enum)
- `estado` (UF)
- `cidade` (nullable, depende do cargo)
- `macro_regiao` (nullable, JSON array — pode ser "todas")
- `micro_regiao` (nullable, JSON array — pode ser "todas")
- `bandeiras` (JSON array — exatamente 3 itens)
- `perfil_atuacao` (string)
- `copiloto_ativo` (boolean, default false)
- `created_at`, `updated_at`

### `partidos`
- `id`, `sigla`, `nome`, `numero` (popular via seed a partir da lista do TSE).

### `zonas_eleitorais`
- `id` (PK)
- `numero_zona`
- `municipio`
- `uf`
- `latitude` (decimal)
- `longitude` (decimal)
- `geometria` (tipo `geometry(Polygon, 4326)` via PostGIS — opcional, mas recomendado para camadas)

### `votos_2024`
- `id` (PK)
- `zona_eleitoral_id` (FK → zonas_eleitorais, indexado)
- `candidato_nome`
- `candidato_numero`
- `partido_sigla`
- `cargo`
- `uf`
- `municipio`
- `quantidade_votos` (integer)
- Índices compostos em `(uf, municipio, cargo)` e `(candidato_numero, uf)` para consultas rápidas.

> **Atenção:** Como a base tem ~27 GB, configure particionamento da tabela `votos_2024` por UF (PARTITION BY LIST). Crie índices BRIN nos campos geoespaciais e B-tree nas colunas de filtro mais comuns.

---

## Fluxo 1 — Tela do Copiloto

### Cabeçalho da Tela
Exiba o título e subtítulo:

> **"Configure o seu Copiloto de Campanha"**
> *"Personalize seu copiloto inteligente para apoiar você nas decisões estratégicas mais certeiras da sua campanha."*

### Comportamento Geral
- Formulário multi-etapa (wizard/stepper) com **5 blocos numerados**.
- Indicador de progresso visual no topo (barra ou stepper).
- Botões **"Voltar"** e **"Avançar"** em cada bloco.
- Validação por bloco antes de permitir avançar.
- Persistência do estado (use Zustand com `persist`) para evitar perda de dados ao recarregar.
- Ao final, botão **"Ativar Copiloto"** que salva tudo via `POST /api/candidates` e redireciona para `/mapa`.

---

### Bloco 1 — Identificação do Candidato

Campos obrigatórios (todos com validação inline):

| Campo | Tipo | Validação |
|---|---|---|
| Nome Completo | text | mínimo 3 palavras |
| Nome de Urna | text | máximo 30 caracteres |
| Número de Urna | number | opcional, 2 a 5 dígitos |
| Partido | select | carregar lista oficial do TSE: https://www.tse.jus.br/partidos/partidos-registrados-no-tse — popule via seed no banco |
| CPF | text | **validar dígitos verificadores** (algoritmo oficial), máscara `000.000.000-00` |
| Título de Eleitor | text | 12 dígitos, máscara `0000 0000 0000` |
| E-mail | email | regex padrão RFC 5322 |
| Telefone | tel | obrigatório DDD, máscara `(00) 00000-0000` |

> Implemente o validador de CPF como função pura em `utils/validators/cpf.ts` — não use `regex` simples, valide os dígitos verificadores.

---

### Bloco 2 — Cargo Pretendido

Componente: select único (radio cards visuais ficam ainda mais elegantes).

Opções:
- Vereador
- Prefeito/Vice
- Deputado Estadual
- Deputado Federal
- Senador
- Governador/Vice
- Presidente/Vice

A escolha aqui **determina dinamicamente o que aparece no Bloco 3**.

---

### Bloco 3 — Reduto Eleitoral Pretendido

Renderização condicional baseada no cargo selecionado no Bloco 2:

| Cargo | Campos exibidos |
|---|---|
| Vereador | Estado (select de UFs) + Cidade (select dependente da UF) |
| Prefeito/Vice | Estado + Cidade (idem acima) |
| Deputado Estadual | Estado + Macro Região (multi-select com opção "Todas") + Micro Região (multi-select dependente, com opção "Todas") |
| Deputado Federal | Idem Deputado Estadual |
| Senador | Estado (apenas) |
| Governador/Vice | Estado (apenas) |
| Presidente/Vice | **Pular este bloco** — exibir mensagem: *"Sua candidatura abrange todo o território nacional."* |

#### Endpoints auxiliares para este bloco:
- `GET /api/geo/estados` → lista de UFs.
- `GET /api/geo/cidades?uf=SP` → cidades por UF.
- `GET /api/geo/macro-regioes?uf=SP` → macrorregiões do estado.
- `GET /api/geo/micro-regioes?uf=SP&macro=ID` → microrregiões dependentes.

> Use a base do **IBGE** para popular essas tabelas geográficas (mesorregiões e microrregiões oficiais).

---

### Bloco 4 — Bandeiras (escolher exatamente 3)

Componente: grid de checkboxes ou cards selecionáveis. **Bloquear avanço enquanto não houver exatamente 3 selecionadas.** Mostrar contador "X de 3 selecionadas".

Opções:
1. Saúde
2. Educação
3. Segurança pública
4. Economia e emprego
5. Infraestrutura e mobilidade
6. Desenvolvimento urbano e habitação
7. Desenvolvimento rural e agronegócio
8. Meio ambiente e sustentabilidade
9. Assistência social e combate à pobreza
10. Cultura, esporte e lazer
11. Ciência, tecnologia e inovação
12. Direitos e cidadania
13. Gestão pública e combate à corrupção
14. Tributação e reforma do Estado
15. Família e valores
16. Juventude
17. Mulheres
18. Pessoa idosa
19. Pessoas com deficiência
20. Defesa e soberania

---

### Bloco 5 — Perfil de Atuação

Componente: select único (radio cards).

Opções:
- Político tradicional
- Técnico / Gestor Público
- Empresarial
- Comunitário / Liderança Local
- Religioso
- Sindical / Classista
- Midiático / Comunicador
- Acadêmico / Intelectual
- Esportivo / Cultural
- Ativista / Causa específica
- Segurança Pública
- Saúde
- Jurídico
- Jovem / Renovação

---

### Tela de Confirmação Final
Antes de ativar, mostrar um **resumo de todas as respostas** em formato de card, com botão **"Editar"** ao lado de cada bloco e o botão final **"Ativar Copiloto"**.

---

## Fluxo 2 — Tela do Mapa

### Comportamento Geral
- Após ativar o copiloto, o usuário é redirecionado automaticamente para `/mapa`.
- O mapa deve carregar centralizado no reduto eleitoral do candidato (ou no Brasil inteiro se for Presidente).
- Use **React-Leaflet** com tile layer do **OpenStreetMap** ou **CartoDB Positron** (mais limpo).

### Camadas Geográficas (referências de inspiração)
Baseie-se em:
- https://help.tableau.com/current/pro/desktop/pt-br/maps_marks_layers.htm
- https://datlo.com/

### Funcionalidades Mínimas do Mapa

1. **Camada de polígonos** (GeoJSON) representando zonas eleitorais ou municípios do reduto.
2. **Coloração por intensidade de votos** (heatmap por choropleth):
   - Verde escuro → mais votado
   - Verde claro → médio
   - Amarelo → poucos votos
   - Vermelho → menos votado
   - Use escala de cores **D3 scale-chromatic** (`d3.interpolateRdYlGn`).
3. **Tooltip ao passar o mouse** exibindo:
   - Nome do município/zona
   - Número de votos do candidato naquela área
   - Posição (ranking) entre todos os candidatos do mesmo cargo
   - Percentual de votos válidos
4. **Popup ao clicar** com detalhamento expandido e gráfico de barras dos top 5 candidatos da zona.
5. **Painel lateral (sidebar)** com:
   - Resumo: total de votos, ranking geral, % de zonas onde foi top 1, top 3, top 10.
   - Filtros: por cargo, por turno, por adversários (comparativo).
   - Toggle de camadas: zonas eleitorais / municípios / mesorregiões.
6. **Legenda fixa** no canto inferior com escala de cores.
7. **Controles de zoom e busca** (geocoding por município).

### Endpoints do Mapa

- `GET /api/mapa/dados?candidato_id=X` → retorna GeoJSON com features e propriedades (votos, ranking, etc.) já agregadas no backend. **Nunca envie 27 GB para o frontend** — agregue server-side e retorne apenas o necessário ao reduto do candidato.
- `GET /api/mapa/zona/:id/detalhes` → detalhes expandidos de uma zona específica.
- `GET /api/mapa/comparativo?candidatos=1,2,3` → para comparações.

> Use **cache em Redis** para respostas do mapa (TTL de 1h é suficiente, pois os dados de 2024 são estáticos).

---

## Performance e Otimização

- **Backend:** use streaming/cursor para queries grandes; pagine quando aplicável.
- **PostGIS:** crie índices `GIST` nas colunas de geometria.
- **Materialized Views:** crie views materializadas pré-agregadas por (cargo, uf, candidato) para consultas instantâneas.
- **Frontend:** lazy-loading dos polígonos por viewport (só carregue o que está visível); use `react-leaflet-cluster` para marcadores se houver muitos.
- **GeoJSON simplificado:** use `mapshaper` ou `topojson-simplify` para reduzir o tamanho dos polígonos antes de servir.
- **Compression:** habilite `gzip`/`brotli` no Express.

---

## Segurança

- Hash de senha com **bcrypt** (cost 12).
- Validação de input em todas as rotas (Zod).
- Rate limiting (`express-rate-limit`).
- CORS configurado restritivamente.
- Helmet.js para headers HTTP.
- Sanitização de queries (Prisma já protege contra SQL injection, mas valide tipos).
- Não exponha o CPF nem o título de eleitor em respostas de API — sempre criptografe em repouso.
- LGPD: implemente endpoint para exportação e exclusão de dados do candidato.

---

## Entregáveis

1. Repositório monorepo (ou dois repos separados) com `README.md` detalhado contendo:
   - Pré-requisitos.
   - Instruções de setup (`docker-compose up`).
   - Como rodar migrations e seeds.
   - Como popular a base de votos (script de ETL para CSV → PostgreSQL com `COPY` em vez de `INSERT`).
2. Migrations versionadas.
3. Seeds para: partidos (TSE), estados, cidades, regiões IBGE.
4. Script ETL separado para ingestão da base de 27 GB (use streaming, não carregue tudo na memória).
5. Testes unitários mínimos para: validador de CPF, validações de cada bloco do copiloto, agregação de votos no mapa.
6. Variáveis sensíveis em `.env` (commitar `.env.example`).

---

## Critérios de Aceitação

- O candidato consegue completar os 5 blocos do copiloto sem erros de validação.
- Após "Ativar Copiloto", é redirecionado em menos de 2s para o mapa.
- O mapa carrega o reduto eleitoral em menos de 3s, com cores e tooltips funcionando.
- Hover em qualquer região exibe número de votos corretamente.
- A base de 27 GB é consultada sem travar o sistema (resposta de API < 500ms para queries do mapa).
- Todos os fluxos funcionam em desktop (Chrome, Firefox, Edge).

---

## Observações Finais

- Priorize **funcionamento** sobre perfeição visual — o mapa precisa ser funcional antes de ser bonito.
- Comente o código em pontos críticos (ETL, validações, agregações).
- Use **Conventional Commits** no Git.
- Siga **Clean Architecture** sempre que possível: controllers finos, lógica de negócio em services, acesso a dados em repositories.
