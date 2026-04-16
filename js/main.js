/* ── Navbar scroll + Hero parallax ── */
const navbar  = document.getElementById('navbar');
const heroBg  = document.querySelector('.hero-bg');
const heroH   = () => window.innerHeight; // hauteur du hero (~100vh)
let   rafId   = null;

function onScroll() {
  const s = window.scrollY;
  navbar.classList.toggle('scrolled', s > 80);
  document.getElementById('backTop').classList.toggle('visible', s > 400);
  if (heroBg && s <= heroH()) {
    if (!rafId) rafId = requestAnimationFrame(() => {
      heroBg.style.transform = `translateY(${s * 0.25}px)`;
      rafId = null;
    });
  }
}
window.addEventListener('scroll', onScroll, { passive: true });

/* ── Mobile nav ── */
const hamburger   = document.getElementById('hamburger');
const mobileNav   = document.getElementById('mobileNav');
const mobileClose = document.getElementById('mobileClose');

hamburger.addEventListener('click', () => {
  mobileNav.classList.add('open');
  hamburger.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
});

function closeMobileNav() {
  mobileNav.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

mobileClose.addEventListener('click', closeMobileNav);
mobileNav.addEventListener('click', e => { if (e.target === mobileNav) closeMobileNav(); });

/* ── Intersection Observer (fade-up animations) ── */
window.fadeObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      window.fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.fade-up').forEach(el => window.fadeObserver.observe(el));

/* ── Smooth anchor links ── */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = 80;
    const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});
