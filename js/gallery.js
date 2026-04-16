(function () {
  'use strict';

  const FALLBACK = [
    { id:1, src:'https://images.unsplash.com/photo-1534432182912-63863115e106?w=800&q=85', alt:'Intérieur de Tentation Lusitane – boulangerie artisanale à Clamart', ariaLabel:'Vue intérieure de la boutique',        colorClass:'gal-1', order:1 },
    { id:2, src:'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=85',    alt:'Pasteis de Nata frais du four, spécialité portugaise à Clamart',     ariaLabel:'Pasteis de Nata fraîchement cuits', colorClass:'gal-2', order:2 },
    { id:3, src:'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=85', alt:'Sélection de pains artisanaux chez Tentation Lusitane',               ariaLabel:'Notre sélection de pains artisanaux',colorClass:'gal-3', order:3 },
    { id:4, src:'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=85',    alt:'Croissants et viennoiseries artisanales Tentation Lusitane Clamart',  ariaLabel:'Viennoiseries et pâtisseries du matin',colorClass:'gal-4',order:4 },
    { id:5, src:'https://images.unsplash.com/photo-1612203985729-70726954388c?w=600&q=85', alt:'Ambiance chaleureuse et décoration portugaise, Tentation Lusitane',   ariaLabel:'Décoration et ambiance portugaise',  colorClass:'gal-5', order:5 }
  ];

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderGallery(items) {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    const sorted = [...items].sort((a, b) => a.order - b.order);
    grid.innerHTML = sorted.map(item => `
      <div class="gallery-item fade-up" role="listitem" aria-label="${esc(item.ariaLabel)}">
        <div class="gallery-item-bg ${esc(item.colorClass)}">
          <img
            src="${esc(item.src)}"
            alt="${esc(item.alt)}"
            loading="lazy"
            style="width:100%;height:100%;object-fit:cover;"
          />
        </div>
      </div>`).join('');

    // Re-attache l'observer sur les éléments générés dynamiquement
    if (window.fadeObserver) {
      grid.querySelectorAll('.fade-up').forEach(el => window.fadeObserver.observe(el));
    }
  }

  fetch('/api/gallery')
    .then(r => r.ok ? r.json() : Promise.reject(new Error('fetch')))
    .then(data => renderGallery(Array.isArray(data.items) ? data.items : FALLBACK))
    .catch(() => renderGallery(FALLBACK));
})();
