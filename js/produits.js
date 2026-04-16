(function () {
  'use strict';

  const FALLBACK_CATS = [
    { id: 'all',           label: 'Tout voir' },
    { id: 'pains',         label: '🍞 Pains' },
    { id: 'viennoiseries', label: '🥐 Viennoiseries' },
    { id: 'patisseries',   label: '🍮 Pâtisseries' },
    { id: 'snacks',        label: '🥪 Snacks' },
    { id: 'boissons',      label: '☕ Boissons' }
  ];

  const FALLBACK_ITEMS = [
    { id:1,  emoji:'🍞', name:'Pain de Campagne',   description:'Mie alvéolée, croûte dorée et croustillante, levain naturel 48h',          price:'3,50 €', category:'pains',         visible:true, order:1  },
    { id:2,  emoji:'🌾', name:'Baguette Tradition',  description:'Façonnée à la main, farine Label Rouge, cuisson sur sole',                  price:'1,35 €', category:'pains',         visible:true, order:2  },
    { id:3,  emoji:'🫓', name:'Pão Alentejano',       description:'Pain portugais de l\'Alentejo, dense et savoureux, idéal pour les soupes',  price:'4,20 €', category:'pains',         visible:true, order:3  },
    { id:4,  emoji:'🥐', name:'Croissant au Beurre',  description:'Feuilletage délicat, beurre AOC Charentes-Poitou, croustillant à souhait',  price:'1,60 €', category:'viennoiseries', visible:true, order:4  },
    { id:5,  emoji:'🍫', name:'Pain au Chocolat',     description:'Deux barres de chocolat noir Valrhona, pâte feuilletée maison',             price:'1,80 €', category:'viennoiseries', visible:true, order:5  },
    { id:6,  emoji:'🍮', name:'Pastel de Nata',       description:'Crème à l\'œuf vanillée, pâte feuilletée croustillante, recette de Belém',  price:'1,80 €', category:'patisseries',   visible:true, order:6  },
    { id:7,  emoji:'🎂', name:'Tarte aux Fruits',     description:'Pâte sablée, crème pâtissière, fruits de saison frais',                    price:'4,50 €', category:'patisseries',   visible:true, order:7  },
    { id:8,  emoji:'🥪', name:'Francesinha',          description:'Sandwich chaud typique de Porto, sauce épicée, fromage fondu',             price:'7,50 €', category:'snacks',        visible:true, order:8  },
    { id:9,  emoji:'🫔', name:'Croquete de Carne',    description:'Croquette de bœuf à la portugaise, panée et croustillante (x3)',           price:'5,00 €', category:'snacks',        visible:true, order:9  },
    { id:10, emoji:'☕', name:'Bica (Expresso)',       description:'L\'expresso portugais, intense et velouté — la vraie Bica de Lisbonne',    price:'1,40 €', category:'boissons',      visible:true, order:10 },
    { id:11, emoji:'🧋', name:'Galão',                description:'Café au lait mousseux à la portugaise, servi dans un grand verre',         price:'2,80 €', category:'boissons',      visible:true, order:11 },
    { id:12, emoji:'🍪', name:'Broas de Mel',          description:'Petits gâteaux moelleux au miel et aux épices douces, recette de Madère', price:'2,00 €', category:'patisseries',   visible:true, order:12 }
  ];

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  let allItems = [];
  let activeCat = 'all';

  window.filterProducts = function (cat, btn) {
    activeCat = cat;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    if (btn) {
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
    }
    renderCards(allItems);
  };

  function renderTabs(categories) {
    const tabs = document.getElementById('productsTabs');
    if (!tabs) return;
    tabs.innerHTML = categories.map(cat => `
      <button
        class="tab-btn${cat.id === 'all' ? ' active' : ''}"
        role="tab"
        aria-selected="${cat.id === 'all' ? 'true' : 'false'}"
        onclick="filterProducts('${esc(cat.id)}', this)"
      >${esc(cat.label)}</button>`).join('');
  }

  function renderCards(items) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    const visible = items
      .filter(i => i.visible !== false && (activeCat === 'all' || i.category === activeCat))
      .sort((a, b) => a.order - b.order);

    grid.innerHTML = visible.map(item => `
      <div class="product-card" data-cat="${esc(item.category)}">
        <div class="product-card-img" aria-hidden="true">${esc(item.emoji)}</div>
        <div class="product-card-body">
          <h4>${esc(item.name)}</h4>
          <p>${esc(item.description)}</p>
          <div class="product-card-price">${esc(item.price)}</div>
        </div>
      </div>`).join('');
  }

  fetch('/api/produits')
    .then(r => r.ok ? r.json() : Promise.reject(new Error('fetch')))
    .then(data => {
      const cats  = Array.isArray(data.categories) ? data.categories : FALLBACK_CATS;
      allItems    = Array.isArray(data.items)      ? data.items      : FALLBACK_ITEMS;
      renderTabs(cats);
      renderCards(allItems);
    })
    .catch(() => {
      allItems = FALLBACK_ITEMS;
      renderTabs(FALLBACK_CATS);
      renderCards(FALLBACK_ITEMS);
    });
})();
