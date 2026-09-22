# Controla Gestão BPO

Plataforma de gestão comercial + financeira do Controla Gestão BPO. Reformulação do
[controla-crm](https://github.com/controlagestaobpo/controla-crm), mantendo o mesmo
projeto Supabase (prospects/metas já existentes) e adicionando os módulos de
Clientes Ativos, Financeiro, Histórico e Metas Inteligentes.

## Stack

- HTML + CSS (variáveis) + JavaScript puro — sem build step
- [Supabase](https://supabase.com) (autenticação + banco de dados) — mesmo projeto do controla-crm
- [Chart.js](https://www.chartjs.org/) para os gráficos

## Rodando localmente

Qualquer servidor estático funciona, por exemplo:

```bash
python3 -m http.server 5177
```

Depois abra `http://localhost:5177`.

## Estrutura

```
index.html          shell da aplicação (login + navbar + 6 abas)
css/styles.css       design system (cores, cards, modais)
js/supabase-client.js  conexão com o Supabase
js/utils.js          helpers de data/formatação
js/app.js            login/logout + navegação entre abas
js/tabs/*.js          uma renderização por aba (dashboard, comercial, financeiro, historico, metas, config)
```

## Status

- **Fase 1 (concluída):** estrutura das 6 abas, autenticação, tabelas novas no Supabase.
- **Fase 2:** Dashboard, Comercial, Financeiro (lançamentos), Histórico, Configurações.
- **Fase 3:** Metas Inteligentes, gráficos, fluxo integrado fechamento → financeiro, insights, DRE.
- **Fase 4:** Relatórios em PDF e polish.
