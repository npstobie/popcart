/**
 * PopCart - Cart Drawer JavaScript
 * Handles cart drawer interactions, AJAX cart updates, and dynamic settings
 */

(function() {
  'use strict';

  const SELECTORS = {
    drawer: '[data-popcart-drawer]',
    overlay: '[data-popcart-overlay]',
    close: '[data-popcart-close]',
    items: '[data-popcart-items]',
    item: '[data-popcart-item]',
    count: '[data-popcart-count]',
    subtotal: '[data-popcart-subtotal]',
    footer: '[data-popcart-footer]',
    increase: '[data-popcart-increase]',
    decrease: '[data-popcart-decrease]',
    quantity: '[data-popcart-quantity]',
    remove: '[data-popcart-remove]',
    progressBar: '[data-popcart-progress]',
    progressFill: '[data-popcart-progress-fill]',
    progressText: '[data-popcart-progress-text]',
    announcement: '[data-popcart-announcement]',
    tiersContainer: '[data-popcart-tiers]',
    upsellsSection: '[data-popcart-upsells]',
    upsellsContainer: '[data-popcart-upsells-items]',
    upsellAdd: '[data-popcart-upsell-add]',
    addOnsSection: '[data-popcart-addons]',
    addOnToggle: '[data-popcart-addon-toggle]',
  };

  const CLASSES = {
    open: 'is-open',
    loading: 'is-loading',
    hidden: 'is-hidden',
  };

  class PopCart {
    constructor() {
      this.drawer = document.querySelector(SELECTORS.drawer);
      if (!this.drawer) return;

      this.overlay = this.drawer.querySelector(SELECTORS.overlay);
      this.settings = null;
      this.rewardTiers = [];
      this.upsells = [];
      this.upsellProducts = {};
      this.addOns = [];
      this.bxgyOffers = [];
      this.cart = null;
      this.isApplyingBxgy = false;
      this.lastBxgyState = { earnedCycles: 0, earnedFreeItems: 0 };
      this.isInternalCartUpdate = false;
      this.bxgyFreeItemKeys = new Map(); // Map of itemKey -> freeQuantity
      this.selectionPickerActive = false;
      this.lastBxgyActionTime = 0;
      this.isAddingSelectionItem = false;
      this.remainingFreeSlots = 0;
      this.selectionProductsCache = null; // Cache for selection picker products
      this.selectionProductsLoading = false; // Flag to prevent duplicate loads
      this.timerInterval = null;
      this.timerEndTime = null;
      this.originalAnnouncementText = '';
      this.unlockedTierCount = 0;
      this.appliedRewards = new Set();
      this.lastRewardsState = { count: 0, hasShipping: false };

      this.init();
    }

    async init() {
      // Fetch settings from API
      await this.loadSettings();

      // Apply settings to UI
      this.applySettings();

      // Bind events
      this.bindEvents();
      this.interceptCartActions();

      // Disable theme cart if needed
      this.disableThemeCart();

      // Initial cart fetch
      await this.refreshCart();

      // Load upsell products
      await this.loadUpsellProducts();

      // Render add-ons
      this.renderAddOns();
    }

    async loadSettings() {
      try {
        const shop = window.Shopify?.shop || window.location.hostname;
        let response;
        let settingsLoaded = false;

        // Try app proxy first (stable URL that works regardless of tunnel)
        // App proxy URL: /apps/popcart
        try {
          console.log('PopCart: Trying app proxy /apps/popcart');
          response = await fetch(`/apps/popcart?shop=${shop}`);
          if (response.ok) {
            const data = await response.json();
            if (data.settings) {
              this.settings = data.settings;
              this.rewardTiers = data.rewardTiers || [];
              this.upsells = data.upsells || [];
              this.addOns = data.addOns || [];
              this.bxgyOffers = data.bxgyOffers || [];
              settingsLoaded = true;
              console.log('PopCart: Settings loaded via app proxy', this.settings);
            }
          }
        } catch (proxyError) {
          console.log('PopCart: App proxy failed, trying direct URL');
        }

        // Fallback to direct app URL if configured (for development)
        if (!settingsLoaded) {
          const appUrl = this.drawer.dataset.popcartAppUrl || '';
          if (appUrl) {
            console.log('PopCart: Trying direct URL:', appUrl);
            response = await fetch(`${appUrl}/api/settings?shop=${shop}`);
            if (response.ok) {
              const data = await response.json();
              if (data.settings) {
                this.settings = data.settings;
                this.rewardTiers = data.rewardTiers || [];
                this.upsells = data.upsells || [];
                this.addOns = data.addOns || [];
                this.bxgyOffers = data.bxgyOffers || [];
                settingsLoaded = true;
                console.log('PopCart: Settings loaded via direct URL', this.settings);
              }
            }
          }
        }

        if (!settingsLoaded) {
          console.warn('PopCart: Could not load settings from any source, using defaults');
        }

        // Pre-load selection products in background if BXGY selection mode is configured
        this.preloadSelectionProducts();
      } catch (error) {
        console.warn('PopCart: Could not load settings, using defaults', error);
      }
    }

    /**
     * Pre-load selection products in the background so they're ready when needed
     */
    async preloadSelectionProducts() {
      if (!this.settings?.bxgyEnabled || !this.bxgyOffers || this.bxgyOffers.length === 0) {
        return;
      }

      const offer = this.bxgyOffers[0];
      if (!offer || offer.rewardMode !== 'selection') {
        return;
      }

      const productHandles = (offer.selectionProductIds || '')
        .split(',')
        .map(h => h.trim())
        .filter(h => h);

      if (productHandles.length === 0) {
        return;
      }

      // Don't reload if already loading or cached
      if (this.selectionProductsLoading || this.selectionProductsCache) {
        return;
      }

      this.selectionProductsLoading = true;
      console.log('PopCart: Pre-loading selection products in background');

      try {
        const products = await Promise.all(
          productHandles.map(async handle => {
            try {
              const response = await fetch(`/products/${handle}.js`);
              if (response.ok) return await response.json();
            } catch (e) {}
            return null;
          })
        );

        // Filter out products that don't exist or are sold out
        this.selectionProductsCache = products.filter(p => {
          if (!p) return false;
          const hasAvailableVariant = p.variants?.some(v => v.available);
          return hasAvailableVariant;
        });

        console.log('PopCart: Selection products pre-loaded:', this.selectionProductsCache.length);

        // If cart is already loaded and threshold is met, trigger UI update to show picker
        if (this.cart && this.drawer) {
          await this.updateCartUI(this.cart);
        }
      } catch (error) {
        console.error('PopCart: Error pre-loading selection products:', error);
      } finally {
        this.selectionProductsLoading = false;
      }
    }

    applySettings() {
      if (!this.settings) return;

      const s = this.settings;
      const root = document.documentElement;

      // Apply CSS custom properties
      root.style.setProperty('--popcart-drawer-width', `${s.drawerWidth}px`);
      root.style.setProperty('--popcart-bg', s.drawerBgColor);
      root.style.setProperty('--popcart-text', s.drawerTextColor);
      root.style.setProperty('--popcart-overlay-bg', s.overlayColor);
      root.style.setProperty('--popcart-border-radius', `${s.drawerBorderRadius}px`);
      root.style.setProperty('--popcart-progress-bg', s.progressBarBgColor);
      root.style.setProperty('--popcart-progress-fill', s.progressBarFillColor);
      root.style.setProperty('--popcart-checkout-bg', s.checkoutBtnBgColor);
      root.style.setProperty('--popcart-checkout-text', s.checkoutBtnTextColor);
      root.style.setProperty('--popcart-announcement-bg', s.announcementBgColor);
      root.style.setProperty('--popcart-announcement-text', s.announcementTextColor);
      root.style.setProperty('--popcart-bxgy-bg', s.bxgyBgColor || '#e5e7eb');
      root.style.setProperty('--popcart-bxgy-fill', s.bxgyFillColor || '#6366f1');
      root.style.setProperty('--popcart-bxgy-text', s.bxgyTextColor || '#1a1a1a');

      // Apply drawer position
      if (s.drawerPosition === 'left') {
        this.drawer.classList.add('popcart-drawer--left');
      }

      // Toggle elements based on settings
      const announcement = this.drawer.querySelector(SELECTORS.announcement);
      if (announcement) {
        announcement.classList.toggle(CLASSES.hidden, !s.announcementEnabled);
        if (s.announcementEnabled && s.announcementText) {
          this.originalAnnouncementText = s.announcementText;
          const textEl = announcement.querySelector('[data-popcart-announcement-text]');
          if (textEl) {
            // Initialize timer if enabled (check for boolean, string, or number)
            const timerEnabled = s.timerEnabled === true || s.timerEnabled === "true" || s.timerEnabled === 1;
            console.log('PopCart: Timer check:', {
              timerEnabled,
              rawValue: s.timerEnabled,
              typeOf: typeof s.timerEnabled,
              hasTimerPlaceholder: s.announcementText?.includes('{TIMER}')
            });
            if (timerEnabled && s.announcementText?.includes('{TIMER}')) {
              this.initTimer(textEl, announcement);
            } else {
              textEl.innerHTML = s.announcementText || '';
            }
          }
        }
      }

      const progressWrapper = this.drawer.querySelector('[data-popcart-progress-wrapper]');
      if (progressWrapper) {
        progressWrapper.classList.toggle(CLASSES.hidden, !s.progressBarEnabled);
      }

      // Update checkout button
      const checkoutBtn = this.drawer.querySelector('[data-popcart-checkout]');
      if (checkoutBtn && s.checkoutBtnText) {
        checkoutBtn.textContent = s.checkoutBtnText;
      }

      // Show/hide view cart link
      const viewCartLink = this.drawer.querySelector('[data-popcart-viewcart]');
      if (viewCartLink) {
        viewCartLink.classList.toggle(CLASSES.hidden, !s.showViewCartLink);
      }

      // If PopCart is disabled, hide the drawer entirely
      if (!s.enabled) {
        this.drawer.style.display = 'none';
      }
    }

    initTimer(textEl, announcement) {
      const s = this.settings;
      console.log('PopCart: initTimer called with settings:', { timerType: s.timerType, timerDailyReset: s.timerDailyReset, timerFixedEnd: s.timerFixedEnd, timerDuration: s.timerDuration });

      // Calculate end time based on timer type
      this.timerEndTime = this.calculateTimerEndTime();
      console.log('PopCart: Calculated timer end time:', this.timerEndTime);

      if (!this.timerEndTime) {
        console.log('PopCart: No timer end time, removing {TIMER} placeholder');
        textEl.innerHTML = this.originalAnnouncementText.replace('{TIMER}', '');
        return;
      }

      // Start the countdown
      this.updateTimerDisplay(textEl, announcement);
      this.timerInterval = setInterval(() => {
        this.updateTimerDisplay(textEl, announcement);
      }, 1000);
    }

    calculateTimerEndTime() {
      const s = this.settings;
      const now = new Date();

      switch (s.timerType) {
        case 'daily': {
          // Timer resets daily at specified time
          const [hours, minutes] = (s.timerDailyReset || '00:00').split(':').map(Number);
          const resetTime = new Date();
          resetTime.setHours(hours, minutes, 0, 0);

          // If reset time has passed today, set to tomorrow
          if (now >= resetTime) {
            resetTime.setDate(resetTime.getDate() + 1);
          }

          return resetTime;
        }

        case 'fixed': {
          // Fixed end date/time
          if (!s.timerFixedEnd) return null;
          return new Date(s.timerFixedEnd);
        }

        case 'session': {
          // Session-based timer - store in sessionStorage
          const storageKey = 'popcart_timer_end';
          const stored = sessionStorage.getItem(storageKey);

          if (stored) {
            const storedTime = new Date(stored);
            if (storedTime > now) {
              return storedTime;
            }
          }

          // Create new session timer
          const duration = (s.timerDuration || 30) * 60 * 1000; // Convert to ms
          const endTime = new Date(now.getTime() + duration);
          sessionStorage.setItem(storageKey, endTime.toISOString());
          return endTime;
        }

        default:
          return null;
      }
    }

    updateTimerDisplay(textEl, announcement) {
      const now = new Date();
      const diff = this.timerEndTime - now;

      if (diff <= 0) {
        // Timer expired
        this.handleTimerExpired(textEl, announcement);
        return;
      }

      // Calculate time components
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Format timer string
      let timerString;
      if (hours > 0) {
        timerString = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      } else {
        timerString = `${minutes}:${String(seconds).padStart(2, '0')}`;
      }

      // Create styled timer HTML
      const timerHtml = `<span class="popcart-timer">${timerString}</span>`;

      // Replace {TIMER} placeholder
      textEl.innerHTML = this.originalAnnouncementText.replace('{TIMER}', timerHtml);
    }

    handleTimerExpired(textEl, announcement) {
      // Clear interval
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      const action = this.settings.timerExpiredAction || 'hide';

      if (action === 'hide') {
        announcement.classList.add(CLASSES.hidden);
      } else {
        // Show expired message - remove timer placeholder
        textEl.innerHTML = this.originalAnnouncementText.replace('{TIMER}', '<span class="popcart-timer popcart-timer--expired">Expired</span>');
      }
    }

    disableThemeCart() {
      // Prevent theme's cart drawer from opening
      // This injects a small script to intercept common cart drawer triggers
      const style = document.createElement('style');
      style.textContent = `
        /* Hide common theme cart drawers */
        .cart-drawer:not(.popcart-drawer),
        .drawer--cart:not(.popcart-drawer),
        #cart-drawer:not(.popcart-drawer),
        [data-cart-drawer]:not(.popcart-drawer),
        .mini-cart:not(.popcart-drawer),
        .ajax-cart:not(.popcart-drawer),
        .side-cart:not(.popcart-drawer) {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);

      // Also try to stop theme cart drawer events
      document.addEventListener('cart:open', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.open();
      }, true);

      document.addEventListener('theme:cart:open', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.open();
      }, true);
    }

    async loadUpsellProducts() {
      if (!this.settings?.upsellsEnabled || this.upsells.length === 0) return;

      // Fetch product data for each upsell using Shopify's product JSON endpoint
      const productPromises = this.upsells.map(async (upsell) => {
        if (this.upsellProducts[upsell.productId]) return;

        try {
          // Extract handle from productId or use productHandle
          const handle = upsell.productHandle || upsell.productId.split('/').pop();
          const response = await fetch(`/products/${handle}.js`);
          if (response.ok) {
            const product = await response.json();
            this.upsellProducts[upsell.productId] = product;
          }
        } catch (error) {
          console.warn('PopCart: Could not fetch upsell product', error);
        }
      });

      await Promise.all(productPromises);
      this.renderUpsells();
    }

    renderUpsells() {
      if (!this.settings?.upsellsEnabled) return;

      let upsellsSection = this.drawer.querySelector(SELECTORS.upsellsSection);

      // Create section if it doesn't exist
      if (!upsellsSection) {
        upsellsSection = document.createElement('div');
        upsellsSection.className = 'popcart-upsells';
        upsellsSection.setAttribute('data-popcart-upsells', '');

        // Insert before footer
        const footer = this.drawer.querySelector(SELECTORS.footer);
        const panel = this.drawer.querySelector('.popcart-panel');
        if (footer && panel) {
          panel.insertBefore(upsellsSection, footer);
        }
      }

      // Filter out products already in cart
      const cartProductIds = new Set(
        (this.cart?.items || []).map(item => item.product_id.toString())
      );

      const availableUpsells = this.upsells.filter(upsell => {
        const product = this.upsellProducts[upsell.productId];
        return product && !cartProductIds.has(product.id.toString());
      });

      if (availableUpsells.length === 0) {
        upsellsSection.classList.add(CLASSES.hidden);
        return;
      }

      // Don't show upsells if selection picker is active (it replaces upsells)
      if (this.selectionPickerActive) {
        upsellsSection.classList.add(CLASSES.hidden);
        return;
      }

      // Remove hidden class and force layout recalculation
      upsellsSection.classList.remove(CLASSES.hidden);
      // Force reflow to ensure layout recalculates properly
      upsellsSection.offsetHeight;

      const style = this.settings.upsellsStyle || 'list';

      // Calculate pagination
      const itemsPerPage = this.getUpsellsItemsPerPage(style);
      const totalPages = Math.ceil(availableUpsells.length / itemsPerPage);
      const needsPagination = totalPages > 1;

      // Build products HTML
      const productsHtml = availableUpsells.map(upsell => {
        const product = this.upsellProducts[upsell.productId];
        if (!product) return '';

        const variant = product.variants[0];
        const image = product.featured_image || (product.images && product.images[0]);
        const title = upsell.titleOverride || product.title;

        return `
          <div class="popcart-upsell-item" data-product-id="${product.id}">
            <div class="popcart-upsell-image">
              ${image ? `<img src="${image}" alt="${title}" loading="lazy">` : '<div class="popcart-item-placeholder"></div>'}
            </div>
            <div class="popcart-upsell-details">
              <a href="/products/${product.handle}" class="popcart-upsell-title">${title}</a>
              <div class="popcart-upsell-price">${this.formatMoney(variant.price)}</div>
            </div>
            <button class="popcart-upsell-add" data-popcart-upsell-add data-variant-id="${variant.id}" aria-label="Add to cart">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        `;
      }).join('');

      // Build pagination dots
      const paginationDots = needsPagination
        ? Array.from({ length: totalPages }, (_, i) =>
            `<button class="popcart-upsells-dot${i === 0 ? ' is-active' : ''}" data-page="${i}" aria-label="Page ${i + 1}"></button>`
          ).join('')
        : '';

      // Build navigation arrows
      const leftArrow = needsPagination
        ? `<button class="popcart-upsells-nav-arrow popcart-upsells-nav-arrow--left" data-direction="prev" disabled aria-label="Previous">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <path d="M15 18L9 12L15 6" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </button>`
        : '';

      const rightArrow = needsPagination
        ? `<button class="popcart-upsells-nav-arrow popcart-upsells-nav-arrow--right" data-direction="next" aria-label="Next">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <path d="M9 6L15 12L9 18" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </button>`
        : '';

      upsellsSection.innerHTML = `
        <div class="popcart-upsells-header">
          <h3 class="popcart-upsells-title">${this.settings.upsellsTitle || 'You may also like'}</h3>
        </div>
        <div class="popcart-upsells-nav-wrapper">
          ${leftArrow}
          <div class="popcart-upsells-items popcart-upsells-items--${style}${needsPagination ? ' has-pagination' : ''}" data-popcart-upsells-items data-page="0" data-total-pages="${totalPages}">
            ${productsHtml}
          </div>
          ${rightArrow}
        </div>
        ${paginationDots ? `<div class="popcart-upsells-pagination" data-popcart-upsells-pagination>${paginationDots}</div>` : ''}
      `;

      // Initialize navigation if needed
      if (needsPagination) {
        this.initUpsellsNavigation(upsellsSection, style);
      }
    }

    /**
     * Get number of items visible per page for upsells
     */
    getUpsellsItemsPerPage(displayStyle) {
      switch (displayStyle) {
        case 'carousel': return 2;
        case 'grid': return 4;
        case 'list': return 3;
        default: return 3;
      }
    }

    /**
     * Initialize navigation for upsells
     */
    initUpsellsNavigation(container, displayStyle) {
      const itemsContainer = container.querySelector('[data-popcart-upsells-items]');
      const pagination = container.querySelector('[data-popcart-upsells-pagination]');
      const prevBtn = container.querySelector('.popcart-upsells-nav-arrow--left');
      const nextBtn = container.querySelector('.popcart-upsells-nav-arrow--right');

      if (!itemsContainer) return;

      const items = itemsContainer.querySelectorAll('.popcart-upsell-item');
      const itemsPerPage = this.getUpsellsItemsPerPage(displayStyle);
      const totalPages = parseInt(itemsContainer.dataset.totalPages, 10);
      let currentPage = 0;

      const goToPage = (page) => {
        currentPage = Math.max(0, Math.min(page, totalPages - 1));
        updateNavigation();
      };

      const updateNavigation = () => {
        // Update arrow states
        if (prevBtn) prevBtn.disabled = currentPage === 0;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages - 1;

        // Update pagination dots
        if (pagination) {
          pagination.querySelectorAll('.popcart-upsells-dot').forEach((dot, i) => {
            dot.classList.toggle('is-active', i === currentPage);
          });
        }

        // For list mode, show/hide items by page
        if (displayStyle === 'list') {
          items.forEach((item, index) => {
            const itemPage = Math.floor(index / itemsPerPage);
            item.style.display = itemPage === currentPage ? '' : 'none';
          });
        } else {
          // Horizontal scroll for carousel and grid
          const itemWidth = items[0]?.offsetWidth || 120;
          const gap = 8;
          if (displayStyle === 'grid') {
            itemsContainer.scrollLeft = currentPage * 2 * (itemWidth + gap);
          } else {
            itemsContainer.scrollLeft = currentPage * itemsPerPage * (itemWidth + gap);
          }
        }

        itemsContainer.dataset.page = currentPage;
      };

      // Arrow click handlers
      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (currentPage > 0) {
            currentPage--;
            updateNavigation();
          }
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (currentPage < totalPages - 1) {
            currentPage++;
            updateNavigation();
          }
        });
      }

      // Pagination dot click handlers
      if (pagination) {
        pagination.addEventListener('click', (e) => {
          const dot = e.target.closest('.popcart-upsells-dot');
          if (dot) {
            e.preventDefault();
            e.stopPropagation();
            const page = parseInt(dot.dataset.page, 10);
            if (!isNaN(page) && page !== currentPage) {
              currentPage = page;
              updateNavigation();
            }
          }
        });
      }

      // Add drag/swipe functionality
      this.initDragNavigation(itemsContainer, totalPages, goToPage, () => currentPage);

      // Initial update
      updateNavigation();
    }

    renderAddOns() {
      if (!this.settings?.addOnsEnabled || this.addOns.length === 0) return;

      let addOnsSection = this.drawer.querySelector(SELECTORS.addOnsSection);

      // Create section if it doesn't exist
      if (!addOnsSection) {
        addOnsSection = document.createElement('div');
        addOnsSection.className = 'popcart-addons';
        addOnsSection.setAttribute('data-popcart-addons', '');

        // Insert before upsells or footer
        const upsells = this.drawer.querySelector(SELECTORS.upsellsSection);
        const footer = this.drawer.querySelector(SELECTORS.footer);
        const panel = this.drawer.querySelector('.popcart-panel');
        if (panel) {
          if (upsells) {
            panel.insertBefore(addOnsSection, upsells);
          } else if (footer) {
            panel.insertBefore(addOnsSection, footer);
          }
        }
      }

      addOnsSection.classList.remove(CLASSES.hidden);

      // Check which add-ons are already in cart
      const cartVariantIds = new Set(
        (this.cart?.items || []).map(item => item.variant_id.toString())
      );

      // Helper to extract numeric ID from GID
      const getNumericId = (id) => {
        if (!id) return null;
        return id.includes('/') ? id.split('/').pop() : id.toString();
      };

      addOnsSection.innerHTML = `
        <div class="popcart-addons-header">
          <span class="popcart-addons-title">${this.settings.addOnsTitle || 'Protect your order'}</span>
        </div>
        <div class="popcart-addons-list">
          ${this.addOns.map(addon => {
            const numericVariantId = getNumericId(addon.variantId);
            const isInCart = cartVariantIds.has(numericVariantId);
            const price = addon.priceOverride || 0;
            const icon = addon.icon || '🛡️';

            return `
              <label class="popcart-addon-item ${isInCart ? 'is-active' : ''}">
                <span class="popcart-addon-icon">${icon}</span>
                <span class="popcart-addon-info">
                  <span class="popcart-addon-name">${addon.titleOverride || 'Add-on'}</span>
                  <span class="popcart-addon-price">${this.formatMoney(price)}</span>
                </span>
                <input
                  type="checkbox"
                  class="popcart-addon-checkbox"
                  data-popcart-addon-toggle
                  data-variant-id="${addon.variantId}"
                  data-product-id="${addon.productId}"
                  ${isInCart ? 'checked' : ''}
                >
                <span class="popcart-addon-toggle"></span>
              </label>
            `;
          }).join('')}
        </div>
      `;
    }

    async toggleAddOn(variantId, productId, isChecked) {
      try {
        this.setLoading(true);

        // Extract numeric ID from GID format (gid://shopify/ProductVariant/12345 -> 12345)
        const numericVariantId = variantId.includes('/')
          ? variantId.split('/').pop()
          : variantId;

        if (isChecked) {
          // Add to cart
          await fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: numericVariantId,
              quantity: 1,
            }),
          });
        } else {
          // Remove from cart - find the line item key using numeric ID
          const lineItem = this.cart?.items?.find(
            item => item.variant_id.toString() === numericVariantId
          );
          if (lineItem) {
            await fetch('/cart/change.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: lineItem.key,
                quantity: 0,
              }),
            });
          }
        }

        await this.refreshCart();
      } catch (error) {
        console.error('PopCart: Error toggling add-on', error);
      } finally {
        this.setLoading(false);
      }
    }

    bindEvents() {
      // Close button
      this.drawer.querySelectorAll(SELECTORS.close).forEach(btn => {
        btn.addEventListener('click', () => this.close());
      });

      // Overlay click
      if (this.overlay) {
        this.overlay.addEventListener('click', () => this.close());
      }

      // Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen()) {
          this.close();
        }
      });

      // Quantity controls and upsell add buttons
      this.drawer.addEventListener('click', (e) => {
        const increase = e.target.closest(SELECTORS.increase);
        const decrease = e.target.closest(SELECTORS.decrease);
        const remove = e.target.closest(SELECTORS.remove);
        const upsellAdd = e.target.closest(SELECTORS.upsellAdd);

        if (increase) {
          const key = increase.dataset.lineKey;
          const input = this.drawer.querySelector(`${SELECTORS.quantity}[data-line-key="${key}"]`);
          if (input) {
            this.updateQuantity(key, parseInt(input.value) + 1);
          }
        }

        if (decrease) {
          const key = decrease.dataset.lineKey;
          const input = this.drawer.querySelector(`${SELECTORS.quantity}[data-line-key="${key}"]`);
          if (input) {
            const newQty = parseInt(input.value) - 1;
            if (newQty > 0) {
              this.updateQuantity(key, newQty);
            } else {
              this.removeItem(key);
            }
          }
        }

        if (remove) {
          this.removeItem(remove.dataset.lineKey);
        }

        if (upsellAdd) {
          e.preventDefault();
          e.stopPropagation();
          const variantId = upsellAdd.dataset.variantId;
          if (variantId) {
            this.addUpsellToCart(variantId);
          }
        }

        // Handle BXGY selection picker add
        const selectionAdd = e.target.closest('[data-popcart-selection-add]');
        if (selectionAdd && !selectionAdd.disabled && !this.isAddingSelectionItem) {
          e.preventDefault();
          e.stopPropagation();
          const variantId = selectionAdd.dataset.variantId;
          const offerTitle = selectionAdd.dataset.offerTitle || 'BXGY Offer';
          console.log('PopCart: Selection add clicked', { variantId, offerTitle });
          if (variantId) {
            // Disable button to prevent double clicks
            selectionAdd.disabled = true;
            selectionAdd.textContent = 'Adding...';
            this.addSelectionItem(variantId, offerTitle, selectionAdd);
          }
        }
      });

      // Quantity input change and add-on toggles
      this.drawer.addEventListener('change', (e) => {
        // Handle quantity input changes
        if (e.target.matches(SELECTORS.quantity)) {
          const key = e.target.dataset.lineKey;
          const qty = parseInt(e.target.value);
          if (qty > 0) {
            this.updateQuantity(key, qty);
          } else {
            this.removeItem(key);
          }
        }

        // Handle add-on toggle
        if (e.target.matches(SELECTORS.addOnToggle)) {
          const variantId = e.target.dataset.variantId;
          const productId = e.target.dataset.productId;
          const isChecked = e.target.checked;
          this.toggleAddOn(variantId, productId, isChecked);
        }
      });
    }

    interceptCartActions() {
      // Intercept add-to-cart forms
      document.addEventListener('submit', async (e) => {
        const form = e.target;
        if (!form.matches('form[action="/cart/add"]')) return;

        e.preventDefault();
        e.stopPropagation();
        const formData = new FormData(form);

        try {
          this.setLoading(true);
          const response = await fetch('/cart/add.js', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            await this.refreshCart();
            this.open();
          }
        } catch (error) {
          console.error('PopCart: Error adding to cart', error);
        } finally {
          this.setLoading(false);
        }
      }, true);

      // Intercept AJAX add to cart (for themes using fetch)
      const originalFetch = window.fetch;
      const self = this;
      window.fetch = async (...args) => {
        const response = await originalFetch.apply(window, args);

        // Skip if this is an internal PopCart update (prevents infinite loops)
        if (self.isInternalCartUpdate) {
          return response;
        }

        // Check if this was a cart add request
        const url = args[0]?.toString() || '';
        if (url.includes('/cart/add') || url.includes('/cart/change') || url.includes('/cart/update')) {
          // Clone response so we don't consume it
          const clonedResponse = response.clone();
          if (clonedResponse.ok) {
            setTimeout(() => {
              self.refreshCart();
              if (url.includes('/cart/add')) {
                self.open();
              }
            }, 100);
          }
        }

        return response;
      };

      // Intercept cart icon/link clicks
      document.addEventListener('click', (e) => {
        const cartLink = e.target.closest('a[href="/cart"], a[href*="/cart"], [data-cart-toggle], .cart-icon, .cart-link, [href="/cart"]');
        if (cartLink && !e.target.closest(SELECTORS.drawer)) {
          e.preventDefault();
          e.stopPropagation();
          this.open();
        }
      }, true);
    }

    async updateQuantity(key, quantity) {
      try {
        this.setLoading(true);
        const response = await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: key, quantity }),
        });

        if (response.ok) {
          await this.refreshCart();
        }
      } catch (error) {
        console.error('PopCart: Error updating quantity', error);
      } finally {
        this.setLoading(false);
      }
    }

    async removeItem(key) {
      await this.updateQuantity(key, 0);
    }

    async addUpsellToCart(variantId) {
      try {
        this.setLoading(true);
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: variantId,
            quantity: 1,
          }),
        });

        if (response.ok) {
          await this.refreshCart();
        }
      } catch (error) {
        console.error('PopCart: Error adding upsell to cart', error);
      } finally {
        this.setLoading(false);
      }
    }

    async refreshCart() {
      try {
        const response = await fetch('/cart.js');
        this.cart = await response.json();
        await this.updateCartUI(this.cart);
        this.updateProgressBar(this.cart);
        this.dispatchCartUpdate(this.cart);
      } catch (error) {
        console.error('PopCart: Error refreshing cart', error);
        await this.reloadDrawerSection();
      }
    }

    async updateCartUI(cart) {
      // Update count
      const countEl = this.drawer.querySelector(SELECTORS.count);
      if (countEl) {
        countEl.textContent = `(${cart.item_count})`;
      }

      // Update subtotal
      const subtotalEl = this.drawer.querySelector(SELECTORS.subtotal);
      if (subtotalEl) {
        subtotalEl.textContent = this.formatMoney(cart.total_price);
      }

      // Update header cart count (outside drawer)
      document.querySelectorAll('.cart-count, .cart-count-bubble, [data-cart-count], .cart-icon__count').forEach(el => {
        if (el.closest(SELECTORS.drawer)) return;
        el.textContent = cart.item_count;
      });

      // Show/hide footer based on cart contents
      const footer = this.drawer.querySelector(SELECTORS.footer);
      if (footer) {
        footer.style.display = cart.item_count > 0 ? '' : 'none';
      }

      // Render cart items
      this.renderItems(cart);

      // Re-render add-ons to update toggle states
      this.renderAddOns();

      // Update BXGY progress bar
      this.updateBxgyProgress(cart);

      // Apply rewards based on cart value
      await this.applyRewards(cart);

      // Apply BXGY rewards (this updates selectionPickerActive) - MUST await
      await this.applyBxgyRewards(cart);

      // Re-render upsells AFTER BXGY rewards so selectionPickerActive is set correctly
      this.renderUpsells();
    }

    renderItems(cart) {
      const itemsContainer = this.drawer.querySelector(SELECTORS.items);
      if (!itemsContainer) return;

      if (cart.item_count === 0) {
        // Show empty cart state
        const emptyBtnText = this.settings?.emptyCartBtnText || 'Continue Shopping';
        const emptyBtnUrl = this.settings?.emptyCartBtnUrl || '/collections/all';
        const emptyText = this.settings?.emptyCartText || 'Your cart is empty';

        itemsContainer.innerHTML = `
          <div class="popcart-empty" data-popcart-empty>
            <p data-popcart-empty-text>${emptyText}</p>
            <a href="${emptyBtnUrl}" class="popcart-continue-btn" data-popcart-empty-btn>${emptyBtnText}</a>
          </div>
        `;
        return;
      }

      // Render cart items
      const showImage = this.settings?.showItemImage !== false;
      const showVariant = this.settings?.showItemVariant !== false;
      const showVendor = this.settings?.showItemVendor === true;
      const showQuantity = this.settings?.showQuantitySelector !== false;
      const showRemove = this.settings?.showRemoveButton !== false;
      const imageSize = this.settings?.itemImageSize || 80;

      // Calculate max free items allowed for BXGY
      const offer = this.bxgyOffers?.[0];
      const qualifyingQty = offer ? this.calculateBxgyQualifyingQuantity(cart, offer) : 0;
      const buyQty = offer?.buyQuantity || 3;
      const getQty = offer?.getQuantity || 1;
      const maxFreeItems = Math.floor(qualifyingQty / buyQty) * getQty;

      // Count current BXGY free items in cart
      const currentFreeItems = cart.items.reduce((sum, item) => {
        if (item.properties?.['_popcart_bxgy_free'] === 'true') {
          return sum + item.quantity;
        }
        return sum;
      }, 0);

      // Are we at max free items? (for selection/automatic modes)
      const atMaxFreeItems = currentFreeItems >= maxFreeItems;

      // Calculate max cheapest-free items (for cheapest_in_cart mode)
      const rewardMode = offer?.rewardMode || 'cheapest_in_cart';
      const maxCheapestFree = rewardMode === 'cheapest_in_cart' ? getQty : 0;
      // Count current cheapest-free items from the map
      let totalCheapestFree = 0;
      if (this.bxgyFreeItemKeys) {
        for (const freeQty of this.bxgyFreeItemKeys.values()) {
          totalCheapestFree += freeQty;
        }
      }
      const atMaxCheapestFree = totalCheapestFree >= maxCheapestFree;

      // Build array of items to render, splitting items with partial free quantities
      const itemsToRender = [];
      for (const item of cart.items) {
        const freeQty = this.bxgyFreeItemKeys?.get(item.key) || 0;
        const paidQty = item.quantity - freeQty;

        // If item has both paid and free units, split into two tiles
        if (freeQty > 0 && paidQty > 0) {
          // First tile: paid units
          itemsToRender.push({
            ...item,
            displayQty: paidQty,
            isPaidPortion: true,
            isFreePortionSplit: false,
            final_line_price: item.price * paidQty
          });
          // Second tile: free units
          itemsToRender.push({
            ...item,
            displayQty: freeQty,
            isPaidPortion: false,
            isFreePortionSplit: true,
            final_line_price: item.price * freeQty
          });
        } else if (freeQty > 0 && paidQty === 0) {
          // All units are free
          itemsToRender.push({
            ...item,
            displayQty: item.quantity,
            isPaidPortion: false,
            isFreePortionSplit: false,
            isAllFree: true
          });
        } else {
          // Regular item (no free units from cheapest_in_cart)
          itemsToRender.push({
            ...item,
            displayQty: item.quantity,
            isPaidPortion: true,
            isFreePortionSplit: false
          });
        }
      }

      itemsContainer.innerHTML = itemsToRender.map(item => {
        const imageUrl = item.image ? this.getSizedImageUrl(item.image, imageSize * 2) : '';
        const variantTitle = item.variant_title && item.variant_title !== 'Default Title' ? item.variant_title : '';
        const isFreeGift = item.properties?.['_popcart_free_gift'] === 'true';
        const isBxgyFree = item.properties?.['_popcart_bxgy_free'] === 'true';
        // Check if this is a free portion from cheapest_in_cart split
        const isCheapestFree = item.isFreePortionSplit || item.isAllFree || false;
        const giftName = item.properties?.['_popcart_gift_name'] || 'Free Gift';

        // BXGY free items render as normal items but with $0.00 price
        // They can be removed AND have quantity edited (additional qty added as paid)
        // Only spend-threshold free gifts get the special styling
        const isSpendThresholdGift = isFreeGift && !isBxgyFree;
        // Check if this is a cheapest-free split tile (both paid and free portions can have qty controls)
        const isCheapestFreeTile = item.isFreePortionSplit || item.isAllFree;
        const canEditQuantity = !isSpendThresholdGift;
        const canRemove = !isSpendThresholdGift;
        // Disable + on cheapest-free tiles when at max free items
        const disablePlus = (isBxgyFree && atMaxFreeItems) || (isCheapestFreeTile && atMaxCheapestFree);

        return `
          <div class="popcart-item ${isSpendThresholdGift ? 'popcart-item--free-gift' : ''} ${isCheapestFree ? 'popcart-item--cheapest-free' : ''}" data-popcart-item data-line-key="${item.key}">
            ${showImage ? `
              <div class="popcart-item-image" style="width: ${imageSize}px; height: ${imageSize}px;">
                ${imageUrl ? `
                  <img src="${imageUrl}" alt="${this.escapeHtml(item.title)}" width="${imageSize}" height="${imageSize}" loading="lazy">
                ` : `
                  <div class="popcart-item-placeholder"></div>
                `}
                ${isSpendThresholdGift ? '<div class="popcart-item-gift-badge">🎁</div>' : ''}
                ${isCheapestFree ? '<div class="popcart-item-cheapest-badge">FREE</div>' : ''}
              </div>
            ` : ''}
            <div class="popcart-item-details">
              <a href="${item.url}" class="popcart-item-title">${this.escapeHtml(item.product_title)}</a>
              ${isSpendThresholdGift ? `
                <p class="popcart-item-gift-label">🎉 ${this.escapeHtml(giftName)}</p>
              ` : ''}
              ${isBxgyFree ? `
                <p class="popcart-item-bxgy-label">🛒 ${this.escapeHtml(giftName)}</p>
              ` : ''}
              ${isCheapestFree ? `
                <p class="popcart-item-gift-label">🏷️ Cheapest Item Free!</p>
              ` : ''}
              ${showVendor && item.vendor && !isSpendThresholdGift ? `
                <p class="popcart-item-vendor">${this.escapeHtml(item.vendor)}</p>
              ` : ''}
              ${showVariant && variantTitle ? `
                <p class="popcart-item-variant">${this.escapeHtml(variantTitle)}</p>
              ` : ''}
              <div class="popcart-item-bottom">
                <div class="popcart-item-price ${isBxgyFree || isSpendThresholdGift || isCheapestFree ? 'popcart-item-price--free' : ''}">
                  ${isCheapestFree ? `
                    <span class="popcart-price-original">${this.formatMoney(item.final_line_price)}</span>
                    <span class="popcart-free-label">FREE</span>
                  ` : isBxgyFree ? `
                    <span class="popcart-free-label">$0.00</span>
                  ` : isSpendThresholdGift ? '<span class="popcart-free-label">FREE</span>' : this.formatMoney(item.final_line_price)}
                </div>
                ${showQuantity && canEditQuantity ? `
                  <div class="popcart-quantity" data-popcart-quantity-wrapper>
                    <button class="popcart-qty-btn" data-popcart-decrease data-line-key="${item.key}" aria-label="Decrease quantity">−</button>
                    <input type="number" class="popcart-qty-input" value="${item.displayQty}" min="1" data-popcart-quantity data-line-key="${item.key}" aria-label="Quantity">
                    <button class="popcart-qty-btn${disablePlus ? ' popcart-qty-btn--disabled' : ''}" data-popcart-increase data-line-key="${item.key}" aria-label="Increase quantity"${disablePlus ? ' disabled' : ''}>+</button>
                  </div>
                ` : ''}
              </div>
            </div>
            ${showRemove && canRemove ? `
              <button class="popcart-item-remove" data-popcart-remove data-line-key="${item.key}" aria-label="Remove item">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
            ` : ''}
          </div>
        `;
      }).join('');
    }

    getSizedImageUrl(url, size) {
      if (!url) return '';
      // Handle Shopify CDN URLs
      if (url.includes('cdn.shopify.com')) {
        return url.replace(/(_\d+x\d+)?(\.[a-zA-Z]+)(\?.*)?$/, `_${size}x${size}$2$3`);
      }
      return url;
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    updateProgressBar(cart) {
      const progressWrapper = this.drawer.querySelector('[data-popcart-progress-wrapper]');
      if (!progressWrapper || !this.settings?.progressBarEnabled) return;

      const progressFill = progressWrapper.querySelector(SELECTORS.progressFill);
      const progressText = progressWrapper.querySelector(SELECTORS.progressText);

      if (!this.rewardTiers || this.rewardTiers.length === 0) {
        // Default free shipping threshold (from settings or default 5000 cents = $50)
        const threshold = 5000;
        const cartTotal = cart.total_price;
        const remaining = threshold - cartTotal;
        const progress = Math.min((cartTotal / threshold) * 100, 100);

        if (progressFill) {
          progressFill.style.width = `${progress}%`;
        }

        if (progressText) {
          if (remaining > 0) {
            progressText.innerHTML = `Add <strong>${this.formatMoney(remaining)}</strong> more for FREE shipping!`;
            progressText.classList.remove('popcart-progress-success');
          } else {
            progressText.innerHTML = `🎉 You've unlocked FREE shipping!`;
            progressText.classList.add('popcart-progress-success');
          }
        }
      } else {
        // Multi-tier rewards
        this.updateMultiTierProgress(cart, progressWrapper);
      }
    }

    updateMultiTierProgress(cart, wrapper) {
      const cartTotal = cart.total_price;
      const tiers = this.rewardTiers.sort((a, b) => a.threshold - b.threshold);
      const maxThreshold = tiers[tiers.length - 1]?.threshold || 5000;

      // Find current tier and next tier
      let currentTier = null;
      let nextTier = null;
      const unlockedTiers = [];

      for (let i = 0; i < tiers.length; i++) {
        if (cartTotal >= tiers[i].threshold) {
          currentTier = tiers[i];
          unlockedTiers.push(tiers[i]);
        } else {
          nextTier = tiers[i];
          break;
        }
      }

      // Check for newly unlocked tiers
      const prevUnlockedCount = this.unlockedTierCount || 0;
      const newlyUnlocked = unlockedTiers.length > prevUnlockedCount;
      this.unlockedTierCount = unlockedTiers.length;

      const progressFill = wrapper.querySelector(SELECTORS.progressFill);
      const progressText = wrapper.querySelector(SELECTORS.progressText);

      // Calculate progress based on position to max threshold
      const progress = Math.min((cartTotal / maxThreshold) * 100, 100);

      if (progressFill) {
        progressFill.style.width = `${progress}%`;
      }

      if (nextTier) {
        if (progressText) {
          const remaining = nextTier.threshold - cartTotal;
          progressText.innerHTML = `Add <strong>${this.formatMoney(remaining)}</strong> to unlock: <strong>${nextTier.title}</strong>`;
          progressText.classList.remove('popcart-progress-success');
        }
      } else if (currentTier) {
        // All tiers unlocked
        if (progressText) {
          progressText.innerHTML = `🎉 ${currentTier.message || 'All rewards unlocked!'}`;
          progressText.classList.add('popcart-progress-success');
        }
      }

      // Render tier indicators
      this.renderTierIndicators(wrapper, tiers, cartTotal, newlyUnlocked ? currentTier : null);
    }

    renderTierIndicators(wrapper, tiers, cartTotal, newlyUnlockedTier) {
      let tiersContainer = wrapper.querySelector(SELECTORS.tiersContainer);

      if (!tiersContainer) {
        tiersContainer = document.createElement('div');
        tiersContainer.className = 'popcart-tiers';
        tiersContainer.setAttribute('data-popcart-tiers', '');
        wrapper.appendChild(tiersContainer);
      }

      const maxThreshold = tiers[tiers.length - 1]?.threshold || 5000;

      tiersContainer.innerHTML = tiers.map(tier => {
        const position = (tier.threshold / maxThreshold) * 100;
        const isUnlocked = cartTotal >= tier.threshold;
        const isNewlyUnlocked = newlyUnlockedTier && tier.threshold === newlyUnlockedTier.threshold;

        return `
          <div class="popcart-tier ${isUnlocked ? 'is-unlocked' : ''} ${isNewlyUnlocked ? 'is-celebrating' : ''}" style="left: ${position}%">
            <div class="popcart-tier-icon">${isUnlocked ? '✓' : (tier.icon || '🎁')}</div>
            <div class="popcart-tier-label">${tier.title}</div>
            <div class="popcart-tier-amount">${this.formatMoney(tier.threshold)}</div>
          </div>
        `;
      }).join('');

      // Show celebration toast for newly unlocked tier
      if (newlyUnlockedTier) {
        this.showTierUnlockedToast(newlyUnlockedTier);
      }
    }

    showTierUnlockedToast(tier) {
      // Remove existing toast
      const existingToast = this.drawer.querySelector('.popcart-tier-toast');
      if (existingToast) existingToast.remove();

      // Create toast element
      const toast = document.createElement('div');
      toast.className = 'popcart-tier-toast';
      toast.innerHTML = `
        <div class="popcart-tier-toast-icon">${tier.icon || '🎉'}</div>
        <div class="popcart-tier-toast-content">
          <div class="popcart-tier-toast-title">Reward Unlocked!</div>
          <div class="popcart-tier-toast-message">${tier.message || tier.title}</div>
        </div>
      `;

      // Insert at top of panel
      const panel = this.drawer.querySelector('.popcart-panel');
      const header = this.drawer.querySelector('.popcart-header');
      if (panel && header) {
        header.after(toast);
      }

      // Animate in
      requestAnimationFrame(() => {
        toast.classList.add('is-visible');
      });

      // Remove after delay
      setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    }

    /**
     * Update BXGY (Buy X Get Y) progress bar based on cart quantities
     */
    updateBxgyProgress(cart) {
      // Check if BXGY is enabled and we have offers
      if (!this.settings?.bxgyEnabled || !this.bxgyOffers || this.bxgyOffers.length === 0) {
        // Hide BXGY section if it exists
        const existingSection = this.drawer.querySelector('[data-popcart-bxgy]');
        if (existingSection) {
          existingSection.classList.add(CLASSES.hidden);
        }
        // Clear any tracked free items for cheapest mode
        this.bxgyFreeItemKeys = new Map();
        return;
      }

      // Get the first active offer (could support multiple in the future)
      const offer = this.bxgyOffers[0];
      if (!offer) return;

      // Calculate qualifying quantity from cart (excluding BXGY free items)
      const qualifyingQty = this.calculateBxgyQualifyingQuantity(cart, offer);

      // Calculate earned free items based on reward mode
      const buyQty = offer.buyQuantity || 3;
      const getQty = offer.getQuantity || 1;
      const rewardMode = offer.rewardMode || 'cheapest_in_cart';

      let earnedFreeItems;
      if (rewardMode === 'cheapest_in_cart') {
        // For cheapest_in_cart: you must have MORE than buyQty to earn free items
        // Buy 3 Get 3: with 4 items = 1 free, 5 items = 2 free, 6 items = 3 free
        earnedFreeItems = Math.max(0, Math.min(getQty, qualifyingQty - buyQty));
      } else {
        // For selection/automatic modes: use cycle-based calculation
        earnedFreeItems = Math.floor(qualifyingQty / buyQty) * getQty;
      }

      // Track free items for cheapest_in_cart mode
      if (rewardMode === 'cheapest_in_cart') {
        this.bxgyFreeItemKeys = this.calculateCheapestFreeItems(cart, offer, earnedFreeItems);
      } else {
        this.bxgyFreeItemKeys = new Map();
      }

      // Count actual BXGY free items in cart (for selection/automatic modes)
      const freeItemsInCart = this.countBxgyFreeItemsInCart(cart);

      // Render or update the BXGY progress section
      this.renderBxgyProgress(offer, qualifyingQty, earnedFreeItems, freeItemsInCart);
    }

    /**
     * Count how many BXGY free items are currently in the cart
     */
    countBxgyFreeItemsInCart(cart) {
      if (!cart?.items) return 0;

      let count = 0;
      for (const item of cart.items) {
        if (item.properties?.['_popcart_bxgy_free'] === 'true') {
          count += item.quantity;
        }
      }
      return count;
    }

    /**
     * Calculate which items should be marked as free (cheapest items mode)
     * Returns a Map of item keys -> number of free units for that item
     */
    calculateCheapestFreeItems(cart, offer, numFreeItems) {
      if (numFreeItems <= 0) return new Map();

      // Get qualifying items sorted by price (cheapest first)
      const qualifyingItems = (cart?.items || [])
        .filter(item => {
          if (item.properties?.['_popcart_free_gift'] === 'true') return false;
          if (item.properties?.['_popcart_bxgy_free'] === 'true') return false;
          return this.itemQualifiesForBxgy(item, offer);
        })
        .map(item => ({
          key: item.key,
          unitPrice: item.price, // Price per unit
          quantity: item.quantity
        }))
        .sort((a, b) => a.unitPrice - b.unitPrice);

      // Collect keys and quantities of cheapest items up to numFreeItems
      const freeItemsMap = new Map();
      let remaining = numFreeItems;

      for (const item of qualifyingItems) {
        if (remaining <= 0) break;

        const freeFromThisItem = Math.min(item.quantity, remaining);
        // Track how many units of this item are free
        freeItemsMap.set(item.key, freeFromThisItem);
        remaining -= freeFromThisItem;
      }

      return freeItemsMap;
    }

    /**
     * Calculate how many qualifying items are in the cart for a BXGY offer
     */
    calculateBxgyQualifyingQuantity(cart, offer) {
      if (!cart?.items) return 0;

      let totalQty = 0;

      for (const item of cart.items) {
        // Skip any free items (spend threshold gifts or BXGY free items)
        if (item.properties?.['_popcart_free_gift'] === 'true') continue;
        if (item.properties?.['_popcart_bxgy_free'] === 'true') continue;

        // Check if this item qualifies based on offer configuration
        const qualifies = this.itemQualifiesForBxgy(item, offer);

        if (qualifies) {
          totalQty += item.quantity;
        }
      }

      return totalQty;
    }

    /**
     * Check if a cart item qualifies for a BXGY offer
     */
    itemQualifiesForBxgy(item, offer) {
      // If appliesToType is 'all', all items qualify
      if (offer.appliesToType === 'all') {
        return true;
      }

      // If appliesToType is 'collection', check collection (would need collection data)
      if (offer.appliesToType === 'collection') {
        // For now, we'll return true - proper implementation would check collection
        // This would require fetching product data to check collections
        return true;
      }

      // If appliesToType is 'products', check specific product IDs
      if (offer.appliesToType === 'products' && offer.productIds) {
        try {
          const productIds = JSON.parse(offer.productIds);
          const itemProductId = item.product_id.toString();
          // Check if the item's product ID is in the list
          return productIds.some(id => {
            // Handle both GID format and numeric ID
            const numericId = id.includes('/') ? id.split('/').pop() : id.toString();
            return numericId === itemProductId;
          });
        } catch (e) {
          return false;
        }
      }

      return false;
    }

    /**
     * Render the BXGY progress bar with numbered boxes
     * @param {Object} offer - The BXGY offer configuration
     * @param {number} currentQty - Current qualifying quantity in cart
     * @param {number} earnedFreeItems - Number of free items earned (based on threshold)
     * @param {number} freeItemsInCart - Actual BXGY free items currently in cart
     */
    renderBxgyProgress(offer, currentQty, earnedFreeItems, freeItemsInCart = 0) {
      let bxgySection = this.drawer.querySelector('[data-popcart-bxgy]');

      // Create section if it doesn't exist
      if (!bxgySection) {
        bxgySection = document.createElement('div');
        bxgySection.className = 'popcart-bxgy';
        bxgySection.setAttribute('data-popcart-bxgy', '');

        // Insert after progress wrapper (spend threshold) or after announcement
        const progressWrapper = this.drawer.querySelector('[data-popcart-progress-wrapper]');
        const announcement = this.drawer.querySelector(SELECTORS.announcement);
        const header = this.drawer.querySelector('.popcart-header');
        const panel = this.drawer.querySelector('.popcart-panel');

        if (progressWrapper && !progressWrapper.classList.contains(CLASSES.hidden)) {
          progressWrapper.after(bxgySection);
        } else if (announcement && !announcement.classList.contains(CLASSES.hidden)) {
          announcement.after(bxgySection);
        } else if (header) {
          header.after(bxgySection);
        } else if (panel) {
          panel.prepend(bxgySection);
        }
      }

      bxgySection.classList.remove(CLASSES.hidden);

      const buyQty = offer.buyQuantity || 3;
      const getQty = offer.getQuantity || 1;
      const totalSlots = buyQty + getQty;
      const rewardMode = offer.rewardMode || 'cheapest_in_cart';

      // Calculate progress differently based on mode
      let filledSlots, remaining, hasEarnedFree, modeInfo, shortMessage;

      if (rewardMode === 'cheapest_in_cart') {
        // For cheapest_in_cart: fill numbered boxes 1-buyQty, then FREE boxes light up for items beyond buyQty
        // Buy 3 Get 3: items 1-3 fill boxes 1-3, items 4-6 light up FREE boxes
        filledSlots = Math.min(currentQty, buyQty);
        remaining = Math.max(0, buyQty - currentQty + 1); // +1 because you need 1 more than buyQty to earn first free
        hasEarnedFree = earnedFreeItems > 0;

        // Messages for cheapest_in_cart mode
        if (currentQty <= buyQty) {
          // Still filling up the "buy" slots
          const itemsNeeded = buyQty - currentQty + 1; // Need 1 more than buyQty for first free
          shortMessage = `Add ${itemsNeeded} for free item`;
        } else if (earnedFreeItems < getQty) {
          // Have some free items, can earn more
          const moreForNextFree = 1; // Each additional item = 1 more free
          shortMessage = `🎉 ${earnedFreeItems} free! Add ${moreForNextFree} for ${earnedFreeItems + 1}`;
        } else {
          // Maxed out free items
          shortMessage = `🎉 ${earnedFreeItems} free!`;
        }

        // Mode info text
        if (earnedFreeItems > 0) {
          modeInfo = `<div class="popcart-bxgy-mode-info">The cheapest ${earnedFreeItems} item${earnedFreeItems > 1 ? 's' : ''} in your cart ${earnedFreeItems > 1 ? 'are' : 'is'} free!</div>`;
        } else if (currentQty >= buyQty) {
          modeInfo = `<div class="popcart-bxgy-mode-info">Add 1 more item to get the cheapest free!</div>`;
        } else {
          modeInfo = '';
        }
      } else {
        // For selection/automatic modes: use cycle-based calculation
        const completedCycles = Math.floor(currentQty / buyQty);
        const itemsInCurrentCycle = currentQty % buyQty;
        remaining = buyQty - itemsInCurrentCycle;
        const showComplete = currentQty >= buyQty;
        filledSlots = showComplete ? buyQty : itemsInCurrentCycle;
        hasEarnedFree = showComplete;

        // Messages for selection/automatic modes
        if (!showComplete) {
          shortMessage = `Add ${remaining} more`;
          modeInfo = '';
        } else {
          const totalEarned = getQty * completedCycles;
          const remainingFree = totalEarned - freeItemsInCart;

          if (rewardMode === 'selection') {
            if (remainingFree > 0) {
              shortMessage = `🎁 ${remainingFree} free to claim`;
              modeInfo = `<div class="popcart-bxgy-mode-info">Choose ${remainingFree} free item${remainingFree > 1 ? 's' : ''} below!</div>`;
            } else {
              shortMessage = `🎉 ${freeItemsInCart} free!`;
              modeInfo = `<div class="popcart-bxgy-mode-info">You've claimed all your free items!</div>`;
            }
          } else if (rewardMode === 'automatic') {
            if (remainingFree > 0) {
              shortMessage = `🎁 Adding free items...`;
              modeInfo = `<div class="popcart-bxgy-mode-info">Adding your free item${remainingFree > 1 ? 's' : ''}...</div>`;
            } else {
              shortMessage = `🎉 ${freeItemsInCart} free!`;
              modeInfo = `<div class="popcart-bxgy-mode-info">Your free item${freeItemsInCart > 1 ? 's have' : ' has'} been added!</div>`;
            }
          }
        }
      }

      // Build the boxes HTML
      const boxesHtml = Array.from({ length: totalSlots }, (_, i) => {
        const slotNum = i + 1;
        const isFreeSlot = slotNum > buyQty;
        const isFilled = !isFreeSlot && slotNum <= filledSlots;

        // For FREE slots, determine if they're "earned" (highlighted)
        let isFreeEarned = false;
        if (isFreeSlot) {
          const freeSlotIndex = slotNum - buyQty; // 1-based index of this free slot
          if (rewardMode === 'cheapest_in_cart') {
            // Cheapest items in cart: highlight based on earnedFreeItems
            isFreeEarned = freeSlotIndex <= earnedFreeItems;
          } else {
            // Selection/automatic: only highlight if free item is actually in cart
            isFreeEarned = hasEarnedFree && freeSlotIndex <= freeItemsInCart;
          }
        }

        let boxClass = 'popcart-bxgy-box';
        if (isFreeSlot) boxClass += ' popcart-bxgy-box--free';
        if (isFilled) boxClass += ' is-filled';
        if (isFreeEarned) boxClass += ' is-earned';

        const label = isFreeSlot ? 'FREE' : slotNum.toString();

        return `<div class="${boxClass}">${label}</div>`;
      }).join('');

      bxgySection.innerHTML = `
        <div class="popcart-bxgy-row">
          <div class="popcart-bxgy-boxes">
            ${boxesHtml}
          </div>
          <div class="popcart-bxgy-message">${shortMessage}</div>
        </div>
        ${modeInfo}
      `;
    }

    /**
     * Apply rewards based on cart value and unlocked tiers
     * This is called after cart updates to check if new rewards should be applied
     */
    async applyRewards(cart) {
      if (!this.rewardTiers || this.rewardTiers.length === 0) return;

      const cartTotal = cart.total_price;
      const tiers = this.rewardTiers.sort((a, b) => a.threshold - b.threshold);

      // Find all unlocked tiers
      const unlockedTiers = tiers.filter(tier => cartTotal >= tier.threshold);
      const unlockedRewardKeys = unlockedTiers.map(t => `${t.rewardType}-${t.threshold}`);

      // Check for newly unlocked rewards
      for (const tier of unlockedTiers) {
        const rewardKey = `${tier.rewardType}-${tier.threshold}`;

        // Skip if already applied
        if (this.appliedRewards.has(rewardKey)) continue;

        // Apply the reward based on type
        await this.applyReward(tier, cart);
        this.appliedRewards.add(rewardKey);
      }

      // Check for rewards that should be removed (cart total dropped below threshold)
      for (const appliedKey of this.appliedRewards) {
        if (!unlockedRewardKeys.includes(appliedKey)) {
          const [rewardType, threshold] = appliedKey.split('-');
          const tier = tiers.find(t => t.rewardType === rewardType && t.threshold === parseInt(threshold));
          if (tier) {
            await this.removeReward(tier, cart);
          }
          this.appliedRewards.delete(appliedKey);
        }
      }

      // Only update cart attributes if state changed
      const hasFreeShipping = unlockedTiers.some(t => t.rewardType === 'free_shipping');
      const stateChanged =
        unlockedTiers.length !== this.lastRewardsState.count ||
        hasFreeShipping !== this.lastRewardsState.hasShipping;

      if (stateChanged) {
        await this.updateCartAttributes(unlockedTiers);
        this.lastRewardsState = { count: unlockedTiers.length, hasShipping: hasFreeShipping };
      }
    }

    /**
     * Apply a specific reward
     */
    async applyReward(tier, cart) {
      console.log('PopCart: Applying reward:', tier.rewardType, tier);

      switch (tier.rewardType) {
        case 'free_gift':
          await this.addFreeGiftToCart(tier);
          break;

        case 'free_shipping':
          // Free shipping is typically handled via automatic discounts or cart attributes
          // The cart attribute will signal to checkout that free shipping is earned
          console.log('PopCart: Free shipping unlocked - will be applied via cart attributes');
          break;

        case 'discount_percent':
        case 'discount_fixed':
          // Discounts are typically handled via automatic discounts
          // The cart attribute will signal the discount amount earned
          console.log(`PopCart: Discount unlocked: ${tier.rewardValue}${tier.rewardType === 'discount_percent' ? '%' : ''}`);
          break;
      }
    }

    /**
     * Remove a reward that was previously applied
     */
    async removeReward(tier, cart) {
      console.log('PopCart: Removing reward:', tier.rewardType, tier);

      if (tier.rewardType === 'free_gift' && tier.rewardValue) {
        await this.removeFreeGiftFromCart(tier);
      }
    }

    /**
     * Add free gift product to cart
     */
    async addFreeGiftToCart(tier) {
      if (!tier.rewardValue) return;

      try {
        // Get the product info
        const handle = tier.rewardValue;
        const response = await fetch(`/products/${handle}.js`);

        if (!response.ok) {
          console.warn('PopCart: Could not find free gift product:', handle);
          return;
        }

        const product = await response.json();
        const variant = product.variants[0];

        // Check if already in cart
        const existingItem = this.cart?.items?.find(item =>
          item.variant_id === variant.id &&
          item.properties?.['_popcart_free_gift'] === 'true'
        );

        if (existingItem) {
          console.log('PopCart: Free gift already in cart');
          return;
        }

        // Add to cart with special properties
        this.isInternalCartUpdate = true;
        try {
          await fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: variant.id,
              quantity: 1,
              properties: {
                '_popcart_free_gift': 'true',
                '_popcart_tier_threshold': tier.threshold.toString(),
                '_popcart_gift_name': tier.title
              }
            })
          });

          console.log('PopCart: Free gift added to cart:', product.title);

          // Refresh cart to show the new item
          await this.refreshCart();
        } finally {
          this.isInternalCartUpdate = false;
        }

      } catch (error) {
        console.error('PopCart: Error adding free gift:', error);
      }
    }

    /**
     * Remove free gift from cart when threshold is no longer met
     */
    async removeFreeGiftFromCart(tier) {
      if (!this.cart?.items) return;

      // Find the free gift item
      const giftItem = this.cart.items.find(item =>
        item.properties?.['_popcart_free_gift'] === 'true' &&
        item.properties?.['_popcart_tier_threshold'] === tier.threshold.toString()
      );

      if (!giftItem) return;

      this.isInternalCartUpdate = true;
      try {
        await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: giftItem.key,
            quantity: 0
          })
        });

        console.log('PopCart: Free gift removed from cart');
        await this.refreshCart();

      } catch (error) {
        console.error('PopCart: Error removing free gift:', error);
      } finally {
        this.isInternalCartUpdate = false;
      }
    }

    /**
     * Update cart attributes with unlocked rewards info
     * This allows Shopify Scripts, Functions, or checkout customizations to read the rewards
     */
    async updateCartAttributes(unlockedTiers) {
      const attributes = {
        '_popcart_rewards_count': unlockedTiers.length.toString(),
        '_popcart_free_shipping': unlockedTiers.some(t => t.rewardType === 'free_shipping') ? 'true' : 'false',
      };

      // Add discount info if any discount tiers are unlocked
      const discountTiers = unlockedTiers.filter(t =>
        t.rewardType === 'discount_percent' || t.rewardType === 'discount_fixed'
      );

      if (discountTiers.length > 0) {
        // Use the highest discount
        const bestDiscount = discountTiers.reduce((best, tier) => {
          if (!best) return tier;
          if (tier.rewardType === 'discount_percent' && best.rewardType === 'discount_percent') {
            return parseFloat(tier.rewardValue) > parseFloat(best.rewardValue) ? tier : best;
          }
          if (tier.rewardType === 'discount_fixed' && best.rewardType === 'discount_fixed') {
            return parseFloat(tier.rewardValue) > parseFloat(best.rewardValue) ? tier : best;
          }
          // Prefer percentage discounts
          return tier.rewardType === 'discount_percent' ? tier : best;
        }, null);

        if (bestDiscount) {
          attributes['_popcart_discount_type'] = bestDiscount.rewardType;
          attributes['_popcart_discount_value'] = bestDiscount.rewardValue;
        }
      }

      try {
        this.isInternalCartUpdate = true;
        await fetch('/cart/update.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attributes })
        });
      } catch (error) {
        console.error('PopCart: Error updating cart attributes:', error);
      } finally {
        this.isInternalCartUpdate = false;
      }
    }

    /**
     * Apply BXGY rewards based on reward mode
     */
    async applyBxgyRewards(cart) {
      // Prevent recursive calls during BXGY updates
      if (this.isApplyingBxgy) return;

      // Cooldown to prevent rate limiting (minimum 2 seconds between cart-modifying BXGY actions)
      const now = Date.now();
      const timeSinceLastAction = now - this.lastBxgyActionTime;

      if (!this.settings?.bxgyEnabled || !this.bxgyOffers || this.bxgyOffers.length === 0) {
        this.hideSelectionPicker();
        return;
      }

      const offer = this.bxgyOffers[0];
      if (!offer) return;

      try {
      const rewardMode = offer.rewardMode || 'cheapest_in_cart';
      const qualifyingQty = this.calculateBxgyQualifyingQuantity(cart, offer);
      const buyQty = offer.buyQuantity || 3;
      const getQty = offer.getQuantity || 1;
      const earnedCycles = Math.floor(qualifyingQty / buyQty);
      const earnedFreeItems = earnedCycles * getQty;

      // Handle based on reward mode
      switch (rewardMode) {
        case 'cheapest_in_cart': {
          // No cart modifications needed - items are visually marked in renderItems
          // Just update the selection UI (hide selection picker if showing)
          this.hideSelectionPicker();
          break;
        }

        case 'selection': {
          // Count current free items in cart
          const currentSelectionFreeItems = (cart?.items || []).filter(item =>
            item.properties?.['_popcart_bxgy_free'] === 'true'
          ).reduce((sum, item) => sum + item.quantity, 0);

          // CRITICAL: Remove ALL free items immediately if threshold is lost (earnedFreeItems is 0)
          // This prevents cheating - no cooldown for removal when threshold is lost
          if (earnedFreeItems === 0 && currentSelectionFreeItems > 0) {
            console.log('PopCart: Threshold lost - removing ALL free items immediately');
            this.lastBxgyActionTime = now;
            await this.removeBxgyFreeItems(cart, currentSelectionFreeItems);
            this.hideSelectionPicker();
            break;
          }

          // Remove excess free items if cart dropped but still has some threshold
          if (currentSelectionFreeItems > earnedFreeItems) {
            // Only remove if cooldown has passed (prevent rate limiting)
            if (timeSinceLastAction < 2000) {
              console.log('PopCart: Skipping BXGY removal - cooldown active');
              break;
            }
            this.lastBxgyActionTime = now;
            const toRemove = currentSelectionFreeItems - earnedFreeItems;
            await this.removeBxgyFreeItems(cart, toRemove);
            // Don't call refreshCart here - let the next natural refresh handle it
            break;
          }

          // Show/hide the selection picker based on whether items are earned
          if (earnedFreeItems > 0) {
            this.showSelectionPicker(offer, earnedFreeItems, cart);
          } else {
            this.hideSelectionPicker();
          }
          break;
        }

        case 'automatic': {
          // Count current BXGY free items for automatic mode
          const currentAutomaticFreeItems = (cart?.items || []).filter(item =>
            item.properties?.['_popcart_bxgy_free'] === 'true'
          ).reduce((sum, item) => sum + item.quantity, 0);

          // CRITICAL: Remove ALL free items immediately if threshold is lost
          if (earnedFreeItems === 0 && currentAutomaticFreeItems > 0) {
            console.log('PopCart: Threshold lost - removing ALL automatic free items immediately');
            this.lastBxgyActionTime = now;
            await this.removeBxgyFreeItems(cart, currentAutomaticFreeItems);
            break;
          }

          // Auto-add or adjust the preset product when threshold is met
          // Only if cooldown has passed
          if (timeSinceLastAction >= 2000) {
            await this.applyAutomaticBxgyReward(offer, cart, earnedFreeItems);
          }
          break;
        }
      }

      // Update state tracking
      this.lastBxgyState = { earnedCycles, earnedFreeItems };
      } catch (error) {
        console.error('PopCart: Error applying BXGY rewards:', error);
      }
    }

    /**
     * Show the selection picker for "selection" mode
     */
    showSelectionPicker(offer, earnedFreeItems, cart) {
      // Count how many BXGY free items are already in cart
      const currentFreeItems = (cart?.items || []).filter(item =>
        item.properties?.['_popcart_bxgy_free'] === 'true'
      ).reduce((sum, item) => sum + item.quantity, 0);

      const remainingFreeSlots = Math.max(0, earnedFreeItems - currentFreeItems);

      // Store remaining free slots for use by addSelectionItem
      this.remainingFreeSlots = remainingFreeSlots;

      // If all free items have been claimed, hide the picker and show upsells
      if (remainingFreeSlots === 0) {
        this.hideSelectionPicker();
        return;
      }

      // Don't show picker until products are loaded (avoids "Loading..." flash)
      if (!this.selectionProductsCache && !this.selectionProductsLoading) {
        // Start loading in background
        this.preloadSelectionProducts();
        return;
      }

      if (this.selectionProductsLoading) {
        // Still loading, don't show picker yet - will be shown on next cart update
        return;
      }

      // Products are cached, show the picker
      this.selectionPickerActive = true;

      // Get or create selection section (replaces upsells when active)
      let selectionSection = this.drawer.querySelector('[data-popcart-bxgy-selection]');
      const upsellsSection = this.drawer.querySelector(SELECTORS.upsellsSection);

      if (!selectionSection) {
        selectionSection = document.createElement('div');
        selectionSection.className = 'popcart-bxgy-selection';
        selectionSection.setAttribute('data-popcart-bxgy-selection', '');

        // Insert where upsells would be, or before footer
        const footer = this.drawer.querySelector(SELECTORS.footer);
        const panel = this.drawer.querySelector('.popcart-panel');
        if (upsellsSection) {
          upsellsSection.after(selectionSection);
        } else if (footer && panel) {
          panel.insertBefore(selectionSection, footer);
        }
      }

      // Hide upsells when showing selection
      if (upsellsSection) {
        upsellsSection.classList.add(CLASSES.hidden);
      }

      selectionSection.classList.remove(CLASSES.hidden);

      // Check if we have cached products
      if (!this.selectionProductsCache || this.selectionProductsCache.length === 0) {
        selectionSection.innerHTML = `
          <div class="popcart-bxgy-selection-header">
            <span class="popcart-bxgy-selection-title">${offer.selectionTitle || 'Choose your free item(s)'}</span>
          </div>
          <p style="text-align: center; color: var(--popcart-text-muted); padding: 20px;">No free products available.</p>
        `;
        return;
      }

      // Render selection products from cache (no loading state)
      this.renderSelectionProducts(offer, remainingFreeSlots, selectionSection);
    }

    /**
     * Render selection products from cache
     */
    renderSelectionProducts(offer, remainingFreeSlots, container) {
      const displayStyle = offer.selectionDisplayStyle || 'list';
      const hasFreeSlots = remainingFreeSlots > 0;

      // Header message depends on whether there are free slots remaining
      const headerCount = hasFreeSlots
        ? `<span class="popcart-bxgy-selection-count">${remainingFreeSlots} free item${remainingFreeSlots > 1 ? 's' : ''} remaining</span>`
        : `<span class="popcart-bxgy-selection-count popcart-bxgy-selection-count--complete">All free items claimed!</span>`;

      const validProducts = this.selectionProductsCache || [];

      const productsHtml = validProducts.map(product => {
        const variant = product.variants.find(v => v.available) || product.variants[0];
        const image = product.featured_image || (product.images && product.images[0]);

        const priceHtml = hasFreeSlots
          ? `<span class="popcart-selection-price-original">${this.formatMoney(variant.price)}</span>
             <span class="popcart-selection-price-free">FREE</span>`
          : `<span class="popcart-selection-price-regular">${this.formatMoney(variant.price)}</span>`;

        const buttonText = hasFreeSlots ? 'Add Free' : 'Add';
        const buttonClass = hasFreeSlots ? 'popcart-selection-add' : 'popcart-selection-add popcart-selection-add--paid';

        return `
          <div class="popcart-selection-item" data-product-handle="${product.handle}">
            <div class="popcart-selection-image">
              ${image ? `<img src="${image}" alt="${product.title}" loading="lazy">` : '<div class="popcart-item-placeholder"></div>'}
            </div>
            <div class="popcart-selection-details">
              <span class="popcart-selection-title">${product.title}</span>
              <span class="popcart-selection-price">
                ${priceHtml}
              </span>
            </div>
            <button class="${buttonClass}" data-popcart-selection-add data-variant-id="${variant.id}" data-offer-title="${offer.title}" aria-label="Add item">
              ${buttonText}
            </button>
          </div>
        `;
      }).join('');

      // Calculate if pagination is needed
      const itemsPerPage = this.getSelectionItemsPerPage(displayStyle);
      const totalPages = Math.ceil(validProducts.length / itemsPerPage);
      const needsPagination = totalPages > 1;
      const wrapperClass = 'popcart-selection-nav-wrapper';

      // Build pagination dots
      const paginationDots = needsPagination
        ? Array.from({ length: totalPages }, (_, i) =>
            `<button class="popcart-selection-dot${i === 0 ? ' is-active' : ''}" data-page="${i}" aria-label="Page ${i + 1}"></button>`
          ).join('')
        : '';

      // Build navigation arrows (all modes use horizontal arrows)
      const leftArrow = needsPagination
        ? `<button class="popcart-selection-nav-arrow popcart-selection-nav-arrow--left" data-direction="prev" disabled aria-label="Previous">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <path d="M15 18L9 12L15 6" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </button>`
        : '';

      const rightArrow = needsPagination
        ? `<button class="popcart-selection-nav-arrow popcart-selection-nav-arrow--right" data-direction="next" aria-label="Next">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <path d="M9 6L15 12L9 18" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </button>`
        : '';

      container.innerHTML = `
        <div class="popcart-bxgy-selection-header">
          <span class="popcart-bxgy-selection-title">${offer.selectionTitle || 'Choose your free item(s)'}</span>
          ${headerCount}
        </div>
        <div class="${wrapperClass}">
          ${leftArrow}
          <div class="popcart-bxgy-selection-items popcart-bxgy-selection-items--${displayStyle}${needsPagination ? ' has-pagination' : ''}" data-popcart-selection-items data-page="0" data-total-pages="${totalPages}">
            ${productsHtml || '<p style="text-align: center; color: var(--popcart-text-muted); padding: 20px;">No products available.</p>'}
          </div>
          ${rightArrow}
        </div>
        ${paginationDots ? `<div class="popcart-selection-pagination" data-popcart-selection-pagination>${paginationDots}</div>` : ''}
      `;

      // Initialize scroll position and attach navigation handlers
      if (needsPagination) {
        this.initSelectionNavigation(container, displayStyle);
      }
    }

    /**
     * Get number of items visible per page for each display style
     */
    getSelectionItemsPerPage(displayStyle) {
      switch (displayStyle) {
        case 'carousel': return 2; // 2 items visible at once in carousel
        case 'grid': return 4;     // 2x2 grid per page
        case 'list': return 3;     // 3 items visible in list
        default: return 4;
      }
    }

    /**
     * Initialize navigation for selection picker
     */
    initSelectionNavigation(container, displayStyle) {
      const itemsContainer = container.querySelector('[data-popcart-selection-items]');
      const pagination = container.querySelector('[data-popcart-selection-pagination]');
      const prevBtn = container.querySelector('.popcart-selection-nav-arrow--left');
      const nextBtn = container.querySelector('.popcart-selection-nav-arrow--right');

      if (!itemsContainer) return;

      const items = itemsContainer.querySelectorAll('.popcart-selection-item');
      const itemsPerPage = this.getSelectionItemsPerPage(displayStyle);
      const totalPages = parseInt(itemsContainer.dataset.totalPages, 10);
      let currentPage = 0;

      const goToPage = (page) => {
        currentPage = Math.max(0, Math.min(page, totalPages - 1));
        updateNavigation();
      };

      const updateNavigation = () => {
        // Update arrow states
        if (prevBtn) prevBtn.disabled = currentPage === 0;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages - 1;

        // Update pagination dots
        if (pagination) {
          pagination.querySelectorAll('.popcart-selection-dot').forEach((dot, i) => {
            dot.classList.toggle('is-active', i === currentPage);
          });
        }

        // For list mode, show/hide items by page (no scrolling)
        if (displayStyle === 'list') {
          items.forEach((item, index) => {
            const itemPage = Math.floor(index / itemsPerPage);
            item.style.display = itemPage === currentPage ? '' : 'none';
          });
        } else {
          // Horizontal scroll for carousel and grid
          const itemWidth = items[0]?.offsetWidth || 120;
          const gap = 8;
          if (displayStyle === 'grid') {
            // Grid scrolls by page (2 items per row, so scroll by 2 items)
            itemsContainer.scrollLeft = currentPage * 2 * (itemWidth + gap);
          } else {
            // Carousel scrolls by items per page
            itemsContainer.scrollLeft = currentPage * itemsPerPage * (itemWidth + gap);
          }
        }

        // Update data attribute
        itemsContainer.dataset.page = currentPage;
      };

      // Arrow click handlers
      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (currentPage > 0) {
            currentPage--;
            updateNavigation();
          }
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (currentPage < totalPages - 1) {
            currentPage++;
            updateNavigation();
          }
        });
      }

      // Pagination dot click handlers
      if (pagination) {
        pagination.addEventListener('click', (e) => {
          const dot = e.target.closest('.popcart-selection-dot');
          if (dot) {
            e.preventDefault();
            e.stopPropagation();
            const page = parseInt(dot.dataset.page, 10);
            if (!isNaN(page) && page !== currentPage) {
              currentPage = page;
              updateNavigation();
            }
          }
        });
      }

      // Add drag/swipe functionality
      this.initDragNavigation(itemsContainer, totalPages, goToPage, () => currentPage);

      // Initial update
      updateNavigation();
    }

    /**
     * Initialize drag/swipe navigation for a container
     */
    initDragNavigation(container, totalPages, goToPage, getCurrentPage) {
      let isDragging = false;
      let startX = 0;
      let currentX = 0;
      const threshold = 50; // Minimum drag distance to trigger page change

      const handleDragStart = (e) => {
        isDragging = true;
        startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
        currentX = startX;
        container.style.cursor = 'grabbing';
      };

      const handleDragMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        currentX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
      };

      const handleDragEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        container.style.cursor = '';

        const diff = startX - currentX;
        const currentPage = getCurrentPage();

        if (Math.abs(diff) > threshold) {
          if (diff > 0 && currentPage < totalPages - 1) {
            // Swiped left - go to next page
            goToPage(currentPage + 1);
          } else if (diff < 0 && currentPage > 0) {
            // Swiped right - go to previous page
            goToPage(currentPage - 1);
          }
        }
      };

      // Mouse events
      container.addEventListener('mousedown', handleDragStart);
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);

      // Touch events
      container.addEventListener('touchstart', handleDragStart, { passive: true });
      container.addEventListener('touchmove', handleDragMove, { passive: false });
      container.addEventListener('touchend', handleDragEnd);

      // Prevent text selection during drag
      container.style.userSelect = 'none';
      container.style.webkitUserSelect = 'none';
    }

    /**
     * Load and render selection products (legacy - kept for compatibility)
     */
    async loadSelectionProducts(offer, productHandles, remainingFreeSlots, container) {
      // This function is now mostly replaced by renderSelectionProducts using cache
      // But kept for edge cases where cache might not be available

      const displayStyle = offer.selectionDisplayStyle || 'list';
      const hasFreeSlots = remainingFreeSlots > 0;

      // If we have cache, use it immediately
      if (this.selectionProductsCache && this.selectionProductsCache.length > 0) {
        this.renderSelectionProducts(offer, remainingFreeSlots, container);
        return;
      }

      // Otherwise fetch products (shouldn't normally happen since we preload)
      const products = await Promise.all(
        productHandles.map(async handle => {
          try {
            const response = await fetch(`/products/${handle}.js`);
            if (response.ok) return await response.json();
          } catch (e) {}
          return null;
        })
      );

      // Filter out products that don't exist or are sold out
      const validProducts = products.filter(p => {
        if (!p) return false;
        // Check if product has at least one available variant
        const hasAvailableVariant = p.variants?.some(v => v.available);
        return hasAvailableVariant;
      });

      // Cache for future use
      this.selectionProductsCache = validProducts;

      // Render using the shared function
      this.renderSelectionProducts(offer, remainingFreeSlots, container);
    }

    /**
     * Hide the selection picker
     */
    hideSelectionPicker() {
      // Mark selection picker as inactive (renderUpsells will show upsells based on this)
      this.selectionPickerActive = false;

      const selectionSection = this.drawer.querySelector('[data-popcart-bxgy-selection]');
      if (selectionSection) {
        selectionSection.classList.add(CLASSES.hidden);
      }
    }

    /**
     * Add a selection item to cart as free
     */
    async addSelectionItem(variantId, offerTitle, buttonElement) {
      // Prevent double-clicks or rapid clicks
      if (this.isAddingSelectionItem) {
        console.log('PopCart: Selection add skipped - already in progress');
        return;
      }

      // Check if there are free slots remaining
      const addAsFree = this.remainingFreeSlots > 0;
      console.log('PopCart: Adding selection item', { variantId, offerTitle, addAsFree, remainingFreeSlots: this.remainingFreeSlots });

      this.isAddingSelectionItem = true;
      this.isInternalCartUpdate = true;
      this.lastBxgyActionTime = Date.now();

      try {
        // Build request body - only add free properties if there are free slots
        const requestBody = {
          id: parseInt(variantId, 10),
          quantity: 1,
        };

        if (addAsFree) {
          requestBody.properties = {
            '_popcart_bxgy_free': 'true',
            '_popcart_bxgy_offer': offerTitle,
            '_popcart_gift_name': `${offerTitle} - Free Item`
          };
        }

        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('PopCart: Failed to add selection item', errorData);
          // Show error to user and re-enable button
          if (buttonElement) {
            buttonElement.textContent = 'Unavailable';
            buttonElement.classList.add('popcart-selection-add--error');
          }
          return;
        }

        console.log(`PopCart: Selection item added successfully (${addAsFree ? 'free' : 'paid'})`);
        // Refresh cart to update the UI
        await this.refreshCart();
      } catch (error) {
        console.error('PopCart: Error adding selection item:', error);
        if (buttonElement) {
          buttonElement.textContent = 'Error';
          buttonElement.disabled = false;
        }
      } finally {
        this.isInternalCartUpdate = false;
        this.isAddingSelectionItem = false;
      }
    }

    /**
     * Apply automatic BXGY reward - auto-add preset product
     */
    async applyAutomaticBxgyReward(offer, cart, earnedFreeItems) {
      const productHandle = offer.automaticProductHandle;
      if (!productHandle) {
        console.warn('PopCart: No automatic product handle configured for BXGY offer');
        return;
      }

      // Count current BXGY free items
      const currentFreeItems = (cart?.items || []).filter(item =>
        item.properties?.['_popcart_bxgy_free'] === 'true'
      ).reduce((sum, item) => sum + item.quantity, 0);

      // No action needed if already correct
      if (earnedFreeItems === currentFreeItems) return;

      // Set cooldown timestamp before any cart action
      this.lastBxgyActionTime = Date.now();

      // Check if we need to add or remove items
      if (earnedFreeItems > currentFreeItems) {
        const toAdd = earnedFreeItems - currentFreeItems;
        await this.addAutomaticBxgyItem(offer, productHandle, toAdd);
      } else if (earnedFreeItems < currentFreeItems) {
        const toRemove = currentFreeItems - earnedFreeItems;
        await this.removeBxgyFreeItems(cart, toRemove);
        // Don't call refreshCart - the fetch interceptor will handle it
      }
    }

    /**
     * Add automatic BXGY item to cart
     */
    async addAutomaticBxgyItem(offer, productHandle, quantity) {
      this.isInternalCartUpdate = true;
      this.isApplyingBxgy = true;

      try {
        const response = await fetch(`/products/${productHandle}.js`);
        if (!response.ok) {
          console.warn('PopCart: Could not find automatic BXGY product:', productHandle);
          return;
        }

        const product = await response.json();
        const variant = product.variants[0];

        await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: variant.id,
            quantity: quantity,
            properties: {
              '_popcart_bxgy_free': 'true',
              '_popcart_bxgy_offer': offer.title,
              '_popcart_gift_name': `${offer.title} - Free Item`
            }
          })
        });

        console.log('PopCart: Automatic BXGY item added:', quantity);
      } catch (error) {
        console.error('PopCart: Error adding automatic BXGY item:', error);
      } finally {
        this.isInternalCartUpdate = false;
        this.isApplyingBxgy = false;
        // Refresh cart after flags are reset
        setTimeout(() => this.refreshCart(), 100);
      }
    }

    /**
     * Remove extra BXGY free items from cart
     */
    async removeBxgyFreeItems(cart, quantity) {
      if (quantity <= 0) return;

      this.isInternalCartUpdate = true;
      try {
        const freeItems = (cart?.items || []).filter(item =>
          item.properties?.['_popcart_bxgy_free'] === 'true'
        );

        let remaining = quantity;

        for (const item of freeItems) {
          if (remaining <= 0) break;

          const removeQty = Math.min(item.quantity, remaining);
          const newQty = item.quantity - removeQty;

          await fetch('/cart/change.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: item.key,
              quantity: newQty
            })
          });

          remaining -= removeQty;
        }

        console.log('PopCart: Removed BXGY free items:', quantity);

      } catch (error) {
        console.error('PopCart: Error removing BXGY free items:', error);
      } finally {
        this.isInternalCartUpdate = false;
      }
    }

    /**
     * Update cart attributes with BXGY offer info
     */
    async updateBxgyCartAttributes(offer, completedCycles, earnedFreeItems) {
      const attributes = {
        '_popcart_bxgy_active': completedCycles > 0 ? 'true' : 'false',
        '_popcart_bxgy_cycles': completedCycles.toString(),
        '_popcart_bxgy_free_items': earnedFreeItems.toString(),
        '_popcart_bxgy_offer': offer.title
      };

      try {
        this.isInternalCartUpdate = true;
        await fetch('/cart/update.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attributes })
        });
      } catch (error) {
        console.error('PopCart: Error updating BXGY cart attributes:', error);
      } finally {
        this.isInternalCartUpdate = false;
      }
    }

    async reloadDrawerSection() {
      try {
        const response = await fetch(window.location.pathname + '?sections=cart-drawer');
        const data = await response.json();

        if (data['cart-drawer']) {
          const temp = document.createElement('div');
          temp.innerHTML = data['cart-drawer'];
          const newItems = temp.querySelector(SELECTORS.items);
          const currentItems = this.drawer.querySelector(SELECTORS.items);

          if (newItems && currentItems) {
            currentItems.innerHTML = newItems.innerHTML;
          }
        }
      } catch (error) {
        // Section rendering failed - could do full reload but that's jarring
        console.warn('PopCart: Could not reload section');
      }
    }

    formatMoney(cents) {
      // Use Shopify's money format if available
      if (window.Shopify?.formatMoney) {
        return window.Shopify.formatMoney(cents);
      }

      // Fallback to basic formatting
      const amount = (cents / 100).toFixed(2);
      const currencySymbol = window.Shopify?.currency?.symbol || '$';
      return currencySymbol + amount;
    }

    dispatchCartUpdate(cart) {
      document.dispatchEvent(new CustomEvent('popcart:updated', {
        detail: { cart }
      }));
    }

    open() {
      if (this.settings && !this.settings.enabled) return;

      this.drawer.classList.add(CLASSES.open);
      document.body.style.overflow = 'hidden';

      // Refresh cart when opening
      this.refreshCart();
    }

    close() {
      this.drawer.classList.remove(CLASSES.open);
      document.body.style.overflow = '';
    }

    isOpen() {
      return this.drawer.classList.contains(CLASSES.open);
    }

    setLoading(loading) {
      this.drawer.classList.toggle(CLASSES.loading, loading);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PopCart());
  } else {
    new PopCart();
  }

  // Expose to window for debugging
  window.PopCart = PopCart;
})();
