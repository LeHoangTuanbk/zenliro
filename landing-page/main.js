// Scroll-triggered fade-in animations
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 },
);

document.querySelectorAll('.fade-in').forEach((el) => observer.observe(el));

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // Close mobile menu if open
    mobileMenu?.classList.add('hidden');
    mobileMenu?.classList.remove('flex');
  });
});

// Mobile menu toggle
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenuClose = document.getElementById('mobile-menu-close');
const mobileMenu = document.getElementById('mobile-menu');

function closeMobileMenu() {
  mobileMenu?.classList.add('hidden');
  mobileMenu?.classList.remove('flex');
}

function openMobileMenu() {
  mobileMenu?.classList.remove('hidden');
  mobileMenu?.classList.add('flex');
}

mobileMenuBtn?.addEventListener('click', openMobileMenu);
mobileMenuClose?.addEventListener('click', closeMobileMenu);

// GitHub stats (stars + total downloads) in nav
const GH_REPO = 'LeHoangTuanbk/zenliro';

function formatCount(n) {
  if (n >= 1000) {
    return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
  }
  return String(n);
}

async function loadGitHubStats() {
  try {
    const [repoRes, releasesRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${GH_REPO}`),
      fetch(`https://api.github.com/repos/${GH_REPO}/releases?per_page=100`),
    ]);

    if (repoRes.ok) {
      const { stargazers_count } = await repoRes.json();
      const starsEl = document.getElementById('gh-stars');
      if (starsEl && typeof stargazers_count === 'number') {
        starsEl.textContent = formatCount(stargazers_count);
      }
    }

    if (releasesRes.ok) {
      const releases = await releasesRes.json();
      const total = releases.reduce(
        (sum, r) => sum + (r.assets || []).reduce((s, a) => s + (a.download_count || 0), 0),
        0,
      );
      const dlEl = document.getElementById('gh-downloads');
      if (dlEl) dlEl.textContent = formatCount(total);
    }
  } catch {
    // leave placeholders if offline or rate-limited
  }
}

loadGitHubStats();
