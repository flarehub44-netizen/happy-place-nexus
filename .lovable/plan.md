## Diagnóstico: o que falta para o Offer Radar AI ficar 100% funcional

O código está estruturalmente pronto (UI, server functions, schema, análise de IA, scraping de LP/checkout, keywords + cron). Faltam **6 peças de integração e produto** para o app rodar ponta a ponta em produção.

### 1. Secrets pendentes
Já configurados: `SB_SERVICE_ROLE_KEY`, `APIFY_TOKEN`, `LOVABLE_API_KEY`, `CRON_SECRET`.
Nenhum outro secret é obrigatório — o app tem o essencial. Só precisamos garantir que o `APIFY_TOKEN` está válido e tem créditos nos actors usados.

### 2. Autenticação (hoje o app é 100% público)
Todas as `createServerFn` estão sem `requireSupabaseAuth` — qualquer visitante do preview publicado pode disparar coletas Apify (gasto real de créditos) e chamar a IA.
Decisão necessária: **manter aberto** (protótipo interno) **ou** colocar atrás de login Supabase + tabela `user_roles` + gate `_authenticated`.

### 3. Agendamento do cron no Supabase (pg_cron + pg_net)
A rota `/api/public/cron-collect` existe e valida `x-cron-secret`, mas **nenhum job pg_cron está criado**. Sem isso, "coletas recorrentes" só rodam quando o usuário clica em ▶. É preciso rodar um SQL (via SQL Editor, não migration) que chame a URL estável do projeto a cada X minutos com o header do secret.

### 4. Robustez da coleta Apify
- `run-sync-get-dataset-items?timeout=120` estoura em queries grandes → migrar para `runs` assíncronas + polling, ou reduzir `limit` default.
- Upsert de `advertisers` usa `onConflict: "handle"` mas `handle` pode ser `null` (várias linhas colidem no `null`). Precisa fallback (usar `name` quando handle for null, ou índice único parcial).
- Sem deduplicação de `ads` por `external_id` → coletas repetidas duplicam linhas.
- `analyzeAd`/`scrapeLandingPage`/`scrapeCheckout` rodam inline dentro de `collectAds` (até 30 ads × 3 chamadas) — corre risco de timeout do handler. Melhor enfileirar (marcar `status='analyzing'` e processar em outro tick / cron separado).

### 5. Realtime + feedback de progresso
`collection_jobs` é atualizado só no fim. UI faz polling a cada 5s, o que funciona, mas o ideal é habilitar Realtime na tabela (`ALTER PUBLICATION supabase_realtime ADD TABLE`) e assinar no `CollectionPanel` — assim jobs longos mostram progresso sem esperar 5s.

### 6. Polimento de produto
- Header ainda mostra o selo "modo análise — dados mockados" — remover agora que a coleta é real.
- Sem página `/auth`, sem `_authenticated/` (relacionado ao item 2).
- Sem export CSV / share link de uma oferta específica (rota pública `/oferta/$id`) — comum nesse tipo de ferramenta.
- Falta paginação: `listAds` está fixo em `limit(200)`.

---

### Ordem sugerida de execução

1. **Decisão de auth** (item 2) — define se seguimos com gate ou não.
2. **Hardening de coleta** (item 4): dedup por `external_id`, fix do upsert de advertiser, mover enriquecimento para fora do handler síncrono.
3. **Cron real no Supabase** (item 3) — só faz sentido depois do item 4 estar sólido.
4. **Realtime + remover badge "mockado"** (itens 5 e 6).
5. **Paginação + share link + auth UI** (item 6).

### Perguntas antes de eu escrever o plano de implementação

- **Auth**: quero deixar público (protótipo pessoal) ou proteger com login Supabase? Se proteger, é single-user (só você) ou multi-usuário com convites?
- **Cron**: qual frequência mínima real de coleta? (a cada 15min, 1h, 6h?) Isso muda o custo Apify.
- **Prioridade agora**: preferes que eu ataque primeiro (a) hardening da coleta pra não duplicar/estourar, ou (b) auth + cron pra deixar autônomo?

Me responda essas 3 e eu volto com um plano de implementação executável.