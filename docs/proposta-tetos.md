# Proposta: os dois tetos da D-034 (itens 3 e 5)

Data: 09/11/2026 · Para decisão do Emerson · IDs: IM-030, IM-031, IM-033, IM-034, IM-015, IM-006, IM-086, IM-089.

**Tudo aqui é SUGESTÃO.** Nada foi implementado. Só vale o que o Emerson aceitar; o aceite vira a D-035 e só então o trabalho é feito.

---

## Parte 1. Teto de pontos por indicador (S-03)

### Como é hoje
- Cada indicação válida dá **10 pontos** ao indicador (D-012; parâmetro `pontos_por_indicacao`, ajustável de 1 a 1000).
- "Válida" (D-031) = pedido de contato feito pelo link do indicador, no destino do link, com perfil disponível, que não seja autoindicação (IM-034) e esteja fora do intervalo de **30 dias** do mesmo WhatsApp de visitante no mesmo destino.
- Repetir o mesmo WhatsApp no mesmo destino não pontua de novo (IM-032, IM-033). Autoindicação não pontua, mas o contato é permitido e fica registrado (IM-034).
- Freios do contato (D-034 item 1, já ligados no dev): 20 pedidos por link por hora com atribuição (acima disso o pedido segue, sem pontos); 10 por origem (IP) por hora, com recusa; Turnstile no formulário.
- Os pontos não vencem e podem ser estornados pelo administrador, com motivo e auditoria (IM-035).

### O que ainda é possível abusar
- O visitante falso usa **um WhatsApp diferente a cada pedido** (a regra de 30 dias é por WhatsApp, então não segura). Quem tem vários IPs ou celulares contorna o limite por origem.
- Conta no pior caso: 20 pedidos por hora por link, 24 horas, 10 pontos = **até 4.800 pontos por dia por link**, e o indicador pode criar vários links. Hoje não existe teto por indicador.
- O estrago real é limitado por enquanto: **resgate de pontos está desativado** (IM-037, futuro). O risco cresce no dia em que o resgate for ligado, e é quando o teto precisa estar valendo.

### Opções

| | A. Máximo de pontos por indicador por dia | B. Máximo por indicador, por destino, por dia | C. Só conta pedido de visitante verificado |
|---|---|---|---|
| Regra | Passou do teto no dia, o pedido ainda é aceito e o visitante é atendido, mas **não pontua**. Fica registrado com o motivo "limite diário" | Cada indicador pontua no máximo N vezes por dia no mesmo destino | O WhatsApp do visitante precisa ser confirmado por código antes de pontuar |
| Valor sugerido | **100 pontos por dia (10 indicações)** | 3 indicações por destino por dia (30 pontos) | Não se aplica |
| Efeito no indicador honesto | Quase nenhum: 10 indicações válidas em um dia já é muito acima do uso normal | Quase nenhum | Perde pontos de visitantes que não confirmam; atrito no formulário |
| Freia o abuso? | Sim, o abuso fica em no máximo 100 pontos por dia por indicador, qualquer que seja o número de links, WhatsApps ou IPs | Só parcialmente: o fraudador espalha os pedidos por vários destinos | Sim, é a mais forte |
| Custo | Médio: 1 parâmetro novo, 1 motivo novo na decisão de pontos, ajuste na regra do banco, testes. Tela: o parâmetro entra na tela de administração; o indicador vê o motivo no histórico | Parecido com A | Alto: depende de verificação por SMS/WhatsApp (IM-010, futuro), com fornecedor e custo (IM-089) |
| Risco | Baixo. Teto muito baixo trava um indicador muito ativo; por isso o valor é um parâmetro, ajustável sem mudar código | Baixo, mas protege pouco | Alto: não dá para fazer agora |

### Recomendação (sugestão)
**Opção A, com 100 pontos por dia por indicador**, como parâmetro auditado (faixa 10 a 10.000, só o administrador geral altera, com motivo). O pedido de contato nunca é recusado por causa do teto: o visitante é atendido normalmente e só o ponto deixa de ser dado. A opção C fica para depois, junto com a verificação por código (IM-010). A B não vale o custo isoladamente.

Mensagem ao indicador no histórico (sugestão de texto): "Limite diário de pontos atingido. Este contato foi registrado, mas não gerou pontos."

Pontos que dependem do Emerson: confirmar o valor (100 por dia) e se esse contato deve aparecer ao indicador com a mensagem acima ou ficar só para o administrador.

---

## Parte 2. Teto de perfis, itens e rascunhos por conta (M-05)

### Como é hoje
- Não existe teto: `perfis_criar_rascunho` e `catalogo_criar_item` criam sem limite. Com a confirmação de e-mail desligada no dev (D-011), qualquer pessoa cria contas e enche o banco, o que pode gerar custo (IM-089).
- O que já limita: **6 fotos por perfil ou item**, 2 MB por imagem e **100 imagens por conta** (o plano grátis do Storage tem 1 GB no total).
- Uma conta é multifunção (IM-006): ela pode indicar, anunciar como particular e responder por vários perfis. **Não existe "tipo de conta" empresa, profissional ou particular.** O tipo é dado pelo que a conta cria (perfil comercial ou anúncio sem perfil). Por isso o teto é por conta e por o que ela cria, não por tipo.

### Valores sugeridos (por conta)

| O que | Teto sugerido | Observação |
|---|---|---|
| Perfis comerciais (empresa ou profissional) | **3** | Conta cobre vários negócios, mas poucos |
| Itens (produtos e serviços) por perfil comercial | **30** | |
| Anúncios particulares por conta (item sem perfil) | **10** | |
| Rascunhos abertos ao mesmo tempo (perfis e itens ainda não enviados), somados | **10** | Evita encher o banco com rascunhos |

Conta de administrador: sem teto (sugestão).

**Atenção, conflito a resolver:** hoje o teto é de 100 imagens por conta. 3 perfis com 30 itens cada, com 6 fotos, passam muito de 100. Duas saídas: (i) manter 100 imagens e o teto de itens vira, na prática, o de imagens; (ii) subir o teto de imagens, o que consome o Storage grátis mais depressa e exige nova decisão de custo. **Sugestão:** manter 100 imagens por conta por enquanto e rever depois dos primeiros usuários reais.

### Varia por plano ou é fixo?
**Fixo para todos agora.** Planos (IM-060) são futuros, e a Loja (IM-099, D-022) já será ligada a plano pago. Guardando os valores em parâmetros, dá para criar valores por plano mais tarde sem refazer a regra, mas isso não é proposto agora (IM-060 é F).

### Onde seria configurado
Parâmetros no banco, no mesmo padrão de `indicacoes_parametro` e `pontos_parametro`: valor com mínimo e máximo, leitura e alteração só pelo administrador geral, **motivo obrigatório e registro de auditoria** (autor, data, motivo, valor anterior). Os valores acima são só o ponto de partida.

### Mensagem ao usuário ao atingir o teto (sugestão de texto)
- Perfis: "Você chegou ao limite de 3 perfis por conta. Para criar outro, remova um perfil que não usa ou fale com o suporte."
- Itens: "Este perfil chegou ao limite de 30 itens. Remova um item para criar outro."
- Anúncios particulares: "Você chegou ao limite de 10 anúncios particulares."
- Rascunhos: "Você tem 10 rascunhos abertos. Envie ou exclua algum antes de criar outro."

Cada mensagem aparece como erro claro no formulário. O botão "criar" continua visível. Os itens já existentes não são afetados se o valor do teto for reduzido depois; só a criação de novos é barrada.

### Custo de implementar
Médio: uma migração (parâmetros, função de gravação auditada e a checagem dentro das duas funções de criar), erros e textos no código dos módulos perfis e catálogo, e uma tela de parâmetros para o administrador geral. Testes cobrem o teto exato (o 3º perfil passa, o 4º não), contas diferentes que não afetam umas às outras e a conta administradora.

### Recomendação (sugestão)
Aceitar os valores da tabela, fixos para todos, como parâmetros auditados. **Religar "Confirm email" antes do lançamento** continua valendo (D-034 item 5), pois o teto por conta sozinho não impede a criação de muitas contas.

---

## Parte 3. Lista para o Emerson responder

Responda "Aceito" ou "Não" (com o valor que prefere, se quiser mudar).

| # | Pergunta | Sugestão | Resposta |
|---|---|---|---|
| 1 | Adotar teto diário de pontos por indicador (opção A)? | Sim | |
| 2 | Valor do teto diário | 100 pontos por dia | |
| 3 | O contato acima do teto aparece ao indicador com a mensagem "Limite diário atingido"? | Sim | |
| 4 | Deixar a opção C (verificação do visitante) para depois, com IM-010? | Sim | |
| 5 | Teto de perfis comerciais por conta | 3 | |
| 6 | Teto de itens por perfil | 30 | |
| 7 | Teto de anúncios particulares por conta | 10 | |
| 8 | Teto de rascunhos abertos por conta | 10 | |
| 9 | Teto fixo para todos (não varia por plano agora)? | Sim | |
| 10 | Administradores sem teto? | Sim | |
| 11 | Manter 100 imagens por conta por ora? | Sim | |

### Impacto em IDs (se aceito)
- **IM-030** (pontuação configurável): ganha o teto diário como parâmetro central. **IM-033/IM-034/IM-032**: regras de duplicidade e autoindicação **não mudam**; o teto é uma regra a mais, depois delas.
- **IM-035** (histórico): nova razão "limite diário" aparece no histórico e na auditoria de decisões.
- **IM-065 / IM-042**: pontos continuam separados; o teto de pontos não toca comissões nem relacionamento.
- **IM-015, IM-006, IM-011, IM-014** (perfis, itens, anúncios): passam a ter teto de criação. **IM-086** (auditoria dos parâmetros); **IM-089** (limita custo de Storage e banco).
- **IM-037** (resgate, futuro): o teto deve estar valendo antes de ligar o resgate.
- Se o Emerson aceitar, a D-035 registra os valores. Nenhum ID novo é necessário; se o Emerson preferir, os tetos viram requisitos novos com o próximo ID livre do catálogo, sem renumerar.
- Pendências que continuam fora desta proposta: retenção de dados do visitante (IM-082, revisão jurídica) e verificação por código (IM-010).
