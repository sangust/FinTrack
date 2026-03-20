const API = 'http://127.0.0.1:8000';
  let tipoAtual = 'receita';
  let chartPizza = null;
  let chartBarras = null;

  function setTipo(tipo) {
    tipoAtual = tipo;
    const tabR = document.getElementById('tab-receita');
    const tabD = document.getElementById('tab-despesa');
    const btn  = document.getElementById('btn-submit');

    tabR.className = 'tipo-tab' + (tipo === 'receita' ? ' active-receita' : '');
    tabD.className = 'tipo-tab' + (tipo === 'despesa' ? ' active-despesa' : '');
    btn.textContent = tipo === 'receita' ? '+ Adicionar Receita' : '+ Adicionar Despesa';
    btn.className = 'btn-submit' + (tipo === 'despesa' ? ' despesa-mode' : '');
  }

  function toast(msg, err = false) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'show' + (err ? ' error' : '');
    setTimeout(() => el.className = '', 3000);
  }


  const fmt = v => 'R$ ' + parseFloat(v).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});


  async function salvarTransacao() {
    const valor     = parseFloat(document.getElementById('valor').value);
    const categoria = document.getElementById('categoria').value;
    const descricao = document.getElementById('descricao').value;

    if (!valor || valor <= 0) return toast('Informe um valor válido.', true);
    if (!categoria)           return toast('Selecione uma categoria.', true);

    try {
      const res = await fetch(`${API}/transacoes`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({tipo: tipoAtual, valor, categoria, descricao})
      });
      if (!res.ok) throw new Error();
      toast('✅ Transação salva com sucesso!');
      document.getElementById('valor').value = '';
      document.getElementById('descricao').value = '';
      document.getElementById('categoria').value = '';
      await carregarTudo();
    } catch {
      toast('Erro ao salvar. Verifique se a API está rodando.', true);
    }
  }


  async function deletarTransacao(id) {
    if (!confirm('Deseja excluir esta transação?')) return;
    try {
      const res = await fetch(`${API}/transacoes/${id}`, {method: 'DELETE'});
      if (!res.ok) throw new Error();
      toast('🗑️ Transação removida.');
      await carregarTudo();
    } catch {
      toast('Erro ao deletar.', true);
    }
  }

  function renderHistorico(transacoes) {
    const list = document.getElementById('historico-list');
    if (!transacoes.length) {
      list.innerHTML = '<div class="empty-state">Nenhuma transação ainda.</div>';
      return;
    }
    list.innerHTML = transacoes.map(t => `
      <div class="tx-item">
        <div class="tx-dot ${t.tipo}"></div>
        <div class="tx-info">
          <div class="tx-desc">${t.descricao || t.categoria}</div>
          <div class="tx-meta">${t.categoria} · ${new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
        </div>
        <div class="tx-valor ${t.tipo}">${t.tipo === 'receita' ? '+' : '-'}${fmt(t.valor)}</div>
        <button class="tx-delete" onclick="deletarTransacao(${t.id})" title="Excluir">✕</button>
      </div>
    `).join('');
  }

  function renderResumo(r) {
    document.getElementById('total-receitas').textContent = fmt(r.receitas);
    document.getElementById('total-despesas').textContent = fmt(r.despesas);
    const saldoEl = document.getElementById('total-saldo');
    saldoEl.textContent = fmt(r.saldo);
    saldoEl.className = 'saldo-value ' + (r.saldo >= 0 ? 'green' : 'red');

    if (r.dica_economia) {
      document.getElementById('dica-box').style.display = 'block';
      document.getElementById('dica-text').textContent = r.dica_economia;
    } else {
      document.getElementById('dica-box').style.display = 'none';
    }

    const cats  = r.categorias_despesa.map(c => c.categoria);
    const vals  = r.categorias_despesa.map(c => c.total);
    const cores = ['#ff6b6b','#ffd166','#06d6a0','#118ab2','#9b5de5','#f15bb5','#00bbf9','#00f5d4'];

    if (chartPizza) chartPizza.destroy();
    chartPizza = new Chart(document.getElementById('chartPizza'), {
      type: 'doughnut',
      data: {
        labels: cats,
        datasets: [{data: vals, backgroundColor: cores, borderColor: '#1a1d24', borderWidth: 2}]
      },
      options: {
        plugins: {legend: {labels: {color: '#7a7f94', font: {family:'DM Mono', size:10}}}},
        cutout: '60%'
      }
    });

    if (chartBarras) chartBarras.destroy();
    chartBarras = new Chart(document.getElementById('chartBarras'), {
      type: 'bar',
      data: {
        labels: ['Receitas', 'Despesas'],
        datasets: [{
          data: [r.receitas, r.despesas],
          backgroundColor: ['rgba(0,229,160,0.2)', 'rgba(255,107,107,0.2)'],
          borderColor: ['#00e5a0', '#ff6b6b'],
          borderWidth: 2,
          borderRadius: 6,
        }]
      },
      options: {
        plugins: {legend: {display: false}},
        scales: {
          x: {ticks: {color:'#7a7f94', font:{family:'DM Mono'}}, grid: {color:'#2a2d36'}},
          y: {ticks: {color:'#7a7f94', font:{family:'DM Mono'}, callback: v => 'R$'+v}, grid: {color:'#2a2d36'}}
        }
      }
    });

    const catList = document.getElementById('cat-list');
    if (!r.categorias_despesa.length) {
      catList.innerHTML = '<div class="empty-state">Sem despesas registradas.</div>';
      return;
    }
    const max = r.categorias_despesa[0].total;
    catList.innerHTML = r.categorias_despesa.slice(0, 6).map(c => `
      <div class="cat-item">
        <div class="cat-name">${c.categoria}</div>
        <div class="cat-bar-wrap">
          <div class="cat-bar" style="width:${(c.total/max*100).toFixed(1)}%"></div>
        </div>
        <div class="cat-val">${fmt(c.total)}</div>
      </div>
    `).join('');
  }
  async function carregarTudo() {
    try {
      const [resTx, resResumo] = await Promise.all([
        fetch(`${API}/transacoes`),
        fetch(`${API}/resumo`)
      ]);
      const transacoes = await resTx.json();
      const resumo     = await resResumo.json();
      renderHistorico(transacoes);
      renderResumo(resumo);
    } catch {
      toast('Não foi possível conectar à API.', true);
    }
  }

  carregarTudo();