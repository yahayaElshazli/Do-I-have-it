// ---- Hamburger / Admin ----
  const menuBtn = document.getElementById('menuBtn');
  const drawer = document.getElementById('drawer');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const adminMenuBtn = document.getElementById('adminMenuBtn');
  function closeMenu() {
    drawer.classList.remove('open'); drawerBackdrop.classList.remove('open'); menuBtn.setAttribute('aria-expanded','false');
    menuBtn.classList.toggle('active', document.getElementById('tab-admin').classList.contains('active'));
  }
  function openAdmin() {
    document.querySelectorAll('nav button[data-tab]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-admin').classList.add('active');
    adminMenuBtn.classList.add('active');
    menuBtn.classList.add('active');
    closeMenu();
    stopScan();
  }
  menuBtn.addEventListener('click', () => {
    const open = !drawer.classList.contains('open');
    drawer.classList.toggle('open', open); drawerBackdrop.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.classList.toggle('active', open || document.getElementById('tab-admin').classList.contains('active'));
  });
  drawerBackdrop.addEventListener('click', closeMenu);
  adminMenuBtn.addEventListener('click', openAdmin);

  // ---- Tabs ----
  document.querySelectorAll('nav button[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('nav button[data-tab]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      adminMenuBtn.classList.remove('active');
      menuBtn.classList.remove('active');
      closeMenu();
      stopScan();
      if (btn.dataset.tab === 'library') renderLibrary();
      if (btn.dataset.tab === 'wishlist') renderWishlist();
    });
  });
