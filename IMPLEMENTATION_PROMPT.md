# PopCart Implementation Prompt for Claude Code

Use this prompt to guide Claude Code in building out the PopCart Shopify app to match UpCart's functionality and design.

---

## MASTER PROMPT

```
I'm building PopCart, a Shopify app that clones UpCart's cart drawer functionality. Read CLAUDE.md for the full feature list.

The app has two main parts:
1. **Admin UI** (Remix app in /app) - Where merchants configure their cart settings
2. **Theme Extension** (in /extensions) - The actual cart drawer that appears on the storefront

Follow these design and implementation guidelines exactly.
```

---

## PART 1: ADMIN UI DESIGN GUIDELINES

### Overall Layout Structure
The admin UI should match UpCart's layout:
- **Left sidebar** (width: ~380px): Navigation menu + settings panels
- **Right panel** (remaining width): Live preview of the cart

### Navigation Structure
Create these admin routes:
```
/app                    → Dashboard (welcome page with setup guide)
/app/cart-editor        → Main cart customization (with sub-sections)
/app/sticky-cart        → Sticky cart button settings
/app/analytics          → Analytics dashboard
/app/help               → Help & tutorials
```

### Cart Editor Sub-Navigation
The cart editor page should have a scrollable left sidebar with these sections:

```
GENERAL
├── Design
└── Header

BODY
├── Announcements
├── Tiered rewards
├── Triggered rewards
├── Recommendations
├── Cart items
├── Subscription upgrades
├── Upsells
└── Additional notes

FOOTER
├── Add-ons
├── Discount codes
├── Cart summary
├── Express payments
├── Trust badges
└── Settings
```

Each section should:
- Have an icon on the left
- Show a toggle indicator (checkmark) if enabled
- Be clickable to show its settings in the main panel
- Highlight when active

### Settings Panel Design
Each settings section should follow this pattern:

```jsx
// Section header with enable toggle
<div className="section-header">
  <div className="section-icon">{icon}</div>
  <h2>{sectionName}</h2>
  <span className="status-badge">{enabled ? 'Enabled' : 'Disabled'}</span>
  <Button onClick={toggleEnable}>Enable/Disable</Button>
</div>

// Settings content (only show if section makes sense to configure)
<Card>
  <Card.Section title="Settings">
    {/* Form fields */}
  </Card.Section>
</Card>

// Custom template section (for advanced users)
<Card>
  <Card.Section title="Custom template">
    <Badge status="info">Technical skills required</Badge>
    <Tabs tabs={['Full', 'Skeleton']} />
    <CodeEditor />
    <ButtonGroup>
      <Button>Format</Button>
      <Button primary>Compile</Button>
    </ButtonGroup>
  </Card.Section>
</Card>
```

### Color Picker Implementation
Use hex color inputs with a color swatch preview:
```jsx
<TextField
  label="Background color"
  value={color}
  onChange={setColor}
  prefix={<div style={{ width: 20, height: 20, backgroundColor: color, borderRadius: 4 }} />}
/>
```

### Form Field Patterns

**Toggle fields:**
```jsx
<Checkbox
  label="Inherit fonts from theme"
  checked={inheritFonts}
  onChange={setInheritFonts}
/>
```

**Dropdown fields:**
```jsx
<Select
  label="Cart width"
  options={[
    { label: 'Wide', value: 'wide' },
    { label: 'Normal', value: 'normal' },
    { label: 'Narrow', value: 'narrow' },
  ]}
  value={cartWidth}
  onChange={setCartWidth}
/>
```

**Slider fields:**
```jsx
<RangeSlider
  label="Font size"
  min={10}
  max={24}
  value={fontSize}
  onChange={setFontSize}
  suffix={<p>{fontSize}px</p>}
/>
```

**Rich text fields:**
```jsx
<TextField
  label="Announcement text"
  value={text}
  onChange={setText}
  multiline={3}
  helpText="Use {TIMER} to show countdown timer"
/>
// Add formatting buttons: Bold, Italic, Underline, Link
```

---

## PART 2: LIVE PREVIEW PANEL

### Preview Container
The right side should show a mock browser window with the cart preview:

```jsx
<div className="preview-container">
  {/* Browser chrome */}
  <div className="preview-browser-bar">
    <div className="browser-dots">
      <span className="dot red" />
      <span className="dot yellow" />
      <span className="dot green" />
    </div>
    <div className="browser-url-bar" />
  </div>

  {/* Cart preview */}
  <div className="preview-content">
    <CartPreview settings={settings} />
  </div>
</div>
```

### Preview Styling
```css
.preview-container {
  background: #f6f6f7;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
}

.preview-browser-bar {
  background: #e4e5e7;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.browser-dots {
  display: flex;
  gap: 6px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.dot.red { background: #ff5f57; }
.dot.yellow { background: #febc2e; }
.dot.green { background: #28c840; }
```

---

## PART 3: CART DRAWER COMPONENT (Theme Extension)

### HTML Structure
```html
<div class="popcart-overlay" data-popcart-overlay>
  <div class="popcart-drawer" data-popcart-drawer>
    <!-- Header -->
    <div class="popcart-header">
      <h2 class="popcart-title">My Cart • <span data-cart-count>0</span></h2>
      <button class="popcart-close" data-popcart-close>×</button>
    </div>

    <!-- Announcement Bar -->
    <div class="popcart-announcement" data-popcart-announcement>
      <!-- Dynamic content -->
    </div>

    <!-- Rewards Progress Bar -->
    <div class="popcart-rewards" data-popcart-rewards>
      <div class="popcart-rewards-bar">
        <div class="popcart-rewards-progress" style="width: 60%"></div>
      </div>
      <div class="popcart-rewards-tiers">
        <!-- Tier icons -->
      </div>
    </div>

    <!-- Cart Items -->
    <div class="popcart-items" data-popcart-items>
      <!-- Cart line items -->
    </div>

    <!-- Upsells -->
    <div class="popcart-upsells" data-popcart-upsells>
      <h3>You'll love these</h3>
      <!-- Upsell products -->
    </div>

    <!-- Add-ons -->
    <div class="popcart-addons" data-popcart-addons>
      <!-- Checkbox add-ons -->
    </div>

    <!-- Discount Code -->
    <div class="popcart-discount" data-popcart-discount>
      <input type="text" placeholder="ENTER CODE" />
      <button>Apply</button>
    </div>

    <!-- Summary -->
    <div class="popcart-summary" data-popcart-summary>
      <div class="popcart-subtotal">
        <span>Subtotal</span>
        <span data-cart-subtotal>$0.00</span>
      </div>
      <div class="popcart-savings">
        <span>You save</span>
        <span data-cart-savings>$0.00</span>
      </div>
    </div>

    <!-- Express Checkout -->
    <div class="popcart-express" data-popcart-express>
      <!-- Dynamic buttons rendered by Shopify -->
    </div>

    <!-- Checkout Button -->
    <button class="popcart-checkout" data-popcart-checkout>
      Checkout • <span data-cart-total>$0.00</span>
    </button>

    <!-- Continue Shopping -->
    <a href="#" class="popcart-continue" data-popcart-close>
      Or continue shopping
    </a>

    <!-- Trust Badges -->
    <div class="popcart-trust" data-popcart-trust>
      <!-- Payment icons -->
    </div>
  </div>
</div>
```

### CSS Architecture
```css
/* CSS Custom Properties for merchant customization */
:root {
  --popcart-bg: #ffffff;
  --popcart-text: #000000;
  --popcart-accent: #6c7c9b;
  --popcart-savings: #2ea818;
  --popcart-button-bg: #6c7c9b;
  --popcart-button-text: #ffffff;
  --popcart-button-radius: 4px;
  --popcart-width-desktop: 420px;
  --popcart-width-mobile: 100%;
}

/* Overlay */
.popcart-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s, visibility 0.3s;
  z-index: 9999;
}

.popcart-overlay.is-open {
  opacity: 1;
  visibility: visible;
}

/* Drawer */
.popcart-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: var(--popcart-width-desktop);
  max-width: 100%;
  background: var(--popcart-bg);
  color: var(--popcart-text);
  transform: translateX(100%);
  transition: transform 0.3s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.popcart-overlay.is-open .popcart-drawer {
  transform: translateX(0);
}

@media (max-width: 768px) {
  .popcart-drawer {
    width: var(--popcart-width-mobile);
  }
}

/* Header */
.popcart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e5e5;
}

.popcart-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.popcart-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
}

/* Announcement Bar */
.popcart-announcement {
  background: var(--popcart-accent);
  color: #ffffff;
  padding: 10px 16px;
  text-align: center;
  font-size: 14px;
}

/* Rewards Progress Bar */
.popcart-rewards {
  padding: 16px 20px;
}

.popcart-rewards-bar {
  height: 8px;
  background: #e5e5e5;
  border-radius: 4px;
  overflow: hidden;
}

.popcart-rewards-progress {
  height: 100%;
  background: var(--popcart-accent);
  transition: width 0.3s ease;
}

.popcart-rewards-tiers {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
}

.popcart-rewards-tier {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 12px;
}

.popcart-rewards-tier-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #e5e5e5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.popcart-rewards-tier-icon.is-complete {
  background: var(--popcart-accent);
  color: #ffffff;
}

/* Cart Items */
.popcart-items {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.popcart-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #e5e5e5;
}

.popcart-item-image {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
}

.popcart-item-details {
  flex: 1;
}

.popcart-item-title {
  font-weight: 500;
  margin-bottom: 4px;
}

.popcart-item-variant {
  font-size: 12px;
  color: #666;
}

.popcart-item-price {
  display: flex;
  gap: 8px;
  align-items: center;
}

.popcart-item-compare-price {
  text-decoration: line-through;
  color: #999;
}

.popcart-item-sale-price {
  color: var(--popcart-savings);
}

.popcart-item-quantity {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.popcart-item-quantity button {
  width: 28px;
  height: 28px;
  border: 1px solid #e5e5e5;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
}

.popcart-item-quantity input {
  width: 40px;
  text-align: center;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  padding: 4px;
}

.popcart-item-remove {
  color: #999;
  cursor: pointer;
}

/* Upsells */
.popcart-upsells {
  padding: 16px 20px;
  border-top: 1px solid #e5e5e5;
}

.popcart-upsells h3 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}

.popcart-upsell {
  display: flex;
  gap: 12px;
  padding: 8px 0;
}

.popcart-upsell-image {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
}

.popcart-upsell-add {
  background: var(--popcart-accent);
  color: #fff;
  border: none;
  padding: 6px 12px;
  border-radius: var(--popcart-button-radius);
  cursor: pointer;
  font-size: 12px;
}

/* Add-ons */
.popcart-addons {
  padding: 16px 20px;
}

.popcart-addon {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 8px;
}

.popcart-addon-checkbox {
  width: 20px;
  height: 20px;
}

/* Discount Code */
.popcart-discount {
  padding: 0 20px 16px;
  display: flex;
  gap: 8px;
}

.popcart-discount input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #e5e5e5;
  border-radius: var(--popcart-button-radius);
}

.popcart-discount button {
  padding: 10px 16px;
  background: #f5f5f5;
  border: 1px solid #e5e5e5;
  border-radius: var(--popcart-button-radius);
  cursor: pointer;
}

/* Summary */
.popcart-summary {
  padding: 16px 20px;
  border-top: 1px solid #e5e5e5;
}

.popcart-subtotal,
.popcart-savings {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.popcart-savings {
  color: var(--popcart-savings);
}

/* Checkout Button */
.popcart-checkout {
  margin: 0 20px 12px;
  padding: 14px 20px;
  background: var(--popcart-button-bg);
  color: var(--popcart-button-text);
  border: none;
  border-radius: var(--popcart-button-radius);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.popcart-checkout:hover {
  opacity: 0.9;
}

/* Continue Shopping */
.popcart-continue {
  display: block;
  text-align: center;
  padding: 12px;
  color: var(--popcart-text);
  text-decoration: underline;
}

/* Trust Badges */
.popcart-trust {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #e5e5e5;
}

.popcart-trust img {
  height: 24px;
  opacity: 0.7;
}

/* Empty Cart State */
.popcart-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.popcart-empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.3;
}

.popcart-empty-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.popcart-empty-text {
  color: #666;
  margin-bottom: 20px;
}

.popcart-empty-button {
  background: var(--popcart-button-bg);
  color: var(--popcart-button-text);
  padding: 12px 24px;
  border: none;
  border-radius: var(--popcart-button-radius);
  cursor: pointer;
}
```

### JavaScript Logic
```javascript
// PopCart Main Controller
class PopCart {
  constructor(config) {
    this.config = config;
    this.cart = null;
    this.isOpen = false;

    this.init();
  }

  async init() {
    // Fetch initial cart
    await this.fetchCart();

    // Bind events
    this.bindEvents();

    // Apply merchant settings
    this.applySettings();

    // Render cart
    this.render();
  }

  bindEvents() {
    // Open cart triggers
    document.querySelectorAll('[data-popcart-trigger]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.open();
      });
    });

    // Close triggers
    document.querySelectorAll('[data-popcart-close]').forEach(el => {
      el.addEventListener('click', () => this.close());
    });

    // Overlay click to close
    document.querySelector('[data-popcart-overlay]')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.close();
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });

    // Quantity buttons
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-quantity-minus]')) {
        this.updateQuantity(e.target.dataset.key, -1);
      }
      if (e.target.matches('[data-quantity-plus]')) {
        this.updateQuantity(e.target.dataset.key, 1);
      }
      if (e.target.matches('[data-remove-item]')) {
        this.removeItem(e.target.dataset.key);
      }
      if (e.target.matches('[data-add-upsell]')) {
        this.addUpsell(e.target.dataset.variantId);
      }
    });

    // Discount code form
    document.querySelector('[data-discount-form]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.applyDiscount(e.target.querySelector('input').value);
    });

    // Listen for cart updates from other sources
    document.addEventListener('cart:updated', () => this.fetchCart());
  }

  async fetchCart() {
    const response = await fetch('/cart.js');
    this.cart = await response.json();
    this.render();
    this.dispatchEvent('cart:fetched');
  }

  async updateQuantity(key, delta) {
    const item = this.cart.items.find(i => i.key === key);
    if (!item) return;

    const newQuantity = Math.max(0, item.quantity + delta);

    await fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: key, quantity: newQuantity })
    });

    await this.fetchCart();
  }

  async removeItem(key) {
    await this.updateQuantity(key, -Infinity);
  }

  async addUpsell(variantId) {
    await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: 1 })
    });

    await this.fetchCart();
  }

  async applyDiscount(code) {
    // Note: Shopify doesn't have a direct API for this in the cart
    // Redirect to checkout with discount code
    window.location.href = `/checkout?discount=${encodeURIComponent(code)}`;
  }

  open() {
    this.isOpen = true;
    document.querySelector('[data-popcart-overlay]')?.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    this.dispatchEvent('cart:opened');
  }

  close() {
    this.isOpen = false;
    document.querySelector('[data-popcart-overlay]')?.classList.remove('is-open');
    document.body.style.overflow = '';
    this.dispatchEvent('cart:closed');
  }

  applySettings() {
    const root = document.documentElement;
    const s = this.config.settings;

    if (s.backgroundColor) root.style.setProperty('--popcart-bg', s.backgroundColor);
    if (s.textColor) root.style.setProperty('--popcart-text', s.textColor);
    if (s.accentColor) root.style.setProperty('--popcart-accent', s.accentColor);
    if (s.savingsColor) root.style.setProperty('--popcart-savings', s.savingsColor);
    if (s.buttonColor) root.style.setProperty('--popcart-button-bg', s.buttonColor);
    if (s.buttonTextColor) root.style.setProperty('--popcart-button-text', s.buttonTextColor);
    if (s.buttonRadius) root.style.setProperty('--popcart-button-radius', `${s.buttonRadius}px`);
  }

  render() {
    this.renderCartCount();
    this.renderItems();
    this.renderRewards();
    this.renderUpsells();
    this.renderSummary();
    this.renderAnnouncement();
  }

  renderCartCount() {
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      el.textContent = this.cart?.item_count || 0;
    });
  }

  renderItems() {
    const container = document.querySelector('[data-popcart-items]');
    if (!container) return;

    if (!this.cart?.items?.length) {
      container.innerHTML = this.renderEmptyState();
      return;
    }

    container.innerHTML = this.cart.items.map(item => this.renderItem(item)).join('');
  }

  renderItem(item) {
    const hasComparePrice = item.original_line_price > item.final_line_price;

    return `
      <div class="popcart-item" data-item-key="${item.key}">
        <img class="popcart-item-image" src="${item.image}" alt="${item.title}">
        <div class="popcart-item-details">
          <div class="popcart-item-title">${item.product_title}</div>
          <div class="popcart-item-variant">${item.variant_title || ''}</div>
          <div class="popcart-item-price">
            ${hasComparePrice ? `<span class="popcart-item-compare-price">${this.formatMoney(item.original_line_price)}</span>` : ''}
            <span class="${hasComparePrice ? 'popcart-item-sale-price' : ''}">${this.formatMoney(item.final_line_price)}</span>
            ${hasComparePrice ? `<span class="popcart-item-savings">(Save ${this.formatMoney(item.original_line_price - item.final_line_price)})</span>` : ''}
          </div>
          <div class="popcart-item-quantity">
            <button data-quantity-minus data-key="${item.key}">-</button>
            <input type="text" value="${item.quantity}" readonly>
            <button data-quantity-plus data-key="${item.key}">+</button>
            <button class="popcart-item-remove" data-remove-item data-key="${item.key}">🗑</button>
          </div>
        </div>
      </div>
    `;
  }

  renderEmptyState() {
    return `
      <div class="popcart-empty">
        <div class="popcart-empty-icon">🛒</div>
        <div class="popcart-empty-title">Your cart is empty</div>
        <div class="popcart-empty-text">Add your favourite items to your cart.</div>
        <button class="popcart-empty-button" data-popcart-close>Shop Now</button>
      </div>
    `;
  }

  renderRewards() {
    if (!this.config.rewards?.enabled) return;

    const container = document.querySelector('[data-popcart-rewards]');
    if (!container) return;

    const { tiers, calculationType } = this.config.rewards;
    const currentValue = calculationType === 'total'
      ? this.cart?.total_price || 0
      : this.cart?.item_count || 0;

    const maxTier = tiers[tiers.length - 1];
    const progress = Math.min(100, (currentValue / maxTier.threshold) * 100);

    container.querySelector('.popcart-rewards-progress').style.width = `${progress}%`;

    // Update tier icons
    const tierContainer = container.querySelector('.popcart-rewards-tiers');
    tierContainer.innerHTML = tiers.map((tier, i) => {
      const isComplete = currentValue >= tier.threshold;
      return `
        <div class="popcart-rewards-tier">
          <div class="popcart-rewards-tier-icon ${isComplete ? 'is-complete' : ''}">
            ${tier.icon}
          </div>
          <span>${tier.label}</span>
        </div>
      `;
    }).join('');
  }

  renderUpsells() {
    // Fetch and render upsells based on config
    // This would call the app backend for AI recommendations or use manual config
  }

  renderSummary() {
    document.querySelectorAll('[data-cart-subtotal]').forEach(el => {
      el.textContent = this.formatMoney(this.cart?.total_price || 0);
    });

    document.querySelectorAll('[data-cart-total]').forEach(el => {
      el.textContent = this.formatMoney(this.cart?.total_price || 0);
    });

    const savings = (this.cart?.original_total_price || 0) - (this.cart?.total_price || 0);
    document.querySelectorAll('[data-cart-savings]').forEach(el => {
      el.textContent = this.formatMoney(savings);
      el.closest('.popcart-savings').style.display = savings > 0 ? '' : 'none';
    });
  }

  renderAnnouncement() {
    if (!this.config.announcement?.enabled) return;

    const container = document.querySelector('[data-popcart-announcement]');
    if (!container) return;

    let text = this.config.announcement.text;

    // Handle timer
    if (text.includes('{TIMER}') && this.config.announcement.timer) {
      this.startAnnouncementTimer(container, text);
    } else {
      container.innerHTML = text;
    }
  }

  startAnnouncementTimer(container, text) {
    let seconds = this.parseTimer(this.config.announcement.timer);

    const update = () => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      container.innerHTML = text.replace('{TIMER}', `${mins}:${secs.toString().padStart(2, '0')}`);

      if (seconds > 0) {
        seconds--;
        setTimeout(update, 1000);
      }
    };

    update();
  }

  parseTimer(timerString) {
    const [mins, secs] = timerString.split(':').map(Number);
    return (mins * 60) + (secs || 0);
  }

  formatMoney(cents) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.config.currency || 'USD'
    }).format(cents / 100);
  }

  dispatchEvent(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail: { ...detail, cart: this.cart } }));
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.popCart = new PopCart(window.popCartConfig || {});
});
```

---

## PART 4: DATABASE SCHEMA

```prisma
// prisma/schema.prisma

model Shop {
  id        String   @id @default(cuid())
  domain    String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  settings  CartSettings?
  analytics AnalyticsEvent[]
}

model CartSettings {
  id     String @id @default(cuid())
  shopId String @unique
  shop   Shop   @relation(fields: [shopId], references: [id])

  // Global
  isActive    Boolean @default(true)
  cartVersion String  @default("2.0")

  // Design
  backgroundColor   String @default("#ffffff")
  textColor         String @default("#000000")
  accentColor       String @default("#6c7c9b")
  savingsColor      String @default("#2ea818")
  buttonColor       String @default("#6c7c9b")
  buttonTextColor   String @default("#ffffff")
  buttonRadius      Int    @default(4)
  inheritFonts      Boolean @default(true)
  showStrikethrough Boolean @default(true)
  desktopWidth      String @default("wide")
  mobileWidth       String @default("full")

  // Announcements
  announcementEnabled Boolean @default(false)
  announcementText    String  @default("")
  announcementTimer   String?
  announcementHeight  String  @default("normal")
  announcementPosition String @default("before")
  announcementBgColor String @default("#6c7c9b")
  announcementBorderColor String?

  // Rewards
  rewardsEnabled     Boolean @default(false)
  rewardsShowOnEmpty Boolean @default(false)
  rewardsCalcType    String  @default("total") // "total" or "quantity"
  rewardsTiers       Json    @default("[]")

  // Upsells
  upsellsEnabled       Boolean @default(false)
  upsellsUseAI         Boolean @default(true)
  upsellsAlgorithm     String  @default("related")
  upsellsManualProducts Json   @default("[]")
  upsellsTitle         String  @default("You'll love these")
  upsellsPosition      String  @default("bottom")

  // Add-ons
  addonsEnabled      Boolean @default(false)
  addonsConfig       Json    @default("[]")

  // Discount codes
  discountEnabled    Boolean @default(false)
  discountPlaceholder String @default("ENTER CODE")
  discountButtonText String  @default("Apply")

  // Express payments
  expressEnabled     Boolean @default(false)
  expressButtonHeight Int    @default(42)
  expressAlignment   String  @default("center")

  // Trust badges
  trustEnabled       Boolean @default(false)
  trustBadges        Json    @default("[]")
  trustPosition      String  @default("bottom")

  // Sticky cart
  stickyEnabled      Boolean @default(false)
  stickyIcon         String  @default("bag")
  stickyBgColor      String  @default("#000000")
  stickyIconColor    String  @default("#ffffff")
  stickyBadgeBgColor String  @default("#e42626")
  stickyBadgeTextColor String @default("#ffffff")
  stickyPosition     String  @default("bottom-right")
  stickyDevices      String  @default("all")
  stickyCustomCss    String  @default("")

  // Notes
  notesEnabled       Boolean @default(false)
  notesTitle         String  @default("Add special instructions")
  notesPlaceholder   String  @default("Special instructions for your order")
  notesPosition      String  @default("below")

  // Custom templates (JSON with template strings)
  customTemplates    Json    @default("{}")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model AnalyticsEvent {
  id        String   @id @default(cuid())
  shopId    String
  shop      Shop     @relation(fields: [shopId], references: [id])

  eventType String   // "impression", "checkout", "upsell_add", "addon_add"
  revenue   Int?     // in cents
  source    String?  // "upsell", "addon", "subscription"
  productId String?
  metadata  Json?

  createdAt DateTime @default(now())
}
```

---

## PART 5: API ROUTES

Create these API routes in the Remix app:

```typescript
// app/routes/api.settings.ts - Get/update settings
// app/routes/api.analytics.ts - Track events, get dashboard data
// app/routes/api.upsells.ts - Get AI recommendations
// app/routes/api.discounts.ts - Create Shopify discounts
```

---

## USAGE

Copy this entire file into your conversation with Claude Code, or reference specific sections as needed. Start with:

```
Read CLAUDE.md and IMPLEMENTATION_PROMPT.md, then let's start building Phase 1 - the core cart drawer.
```
