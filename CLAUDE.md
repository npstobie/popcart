# PopCart - Shopify Cart Drawer App

## Project Overview
A Shopify app to compete with Upcart, featuring a customizable slide-out cart drawer with gamification elements.

## Tech Stack
- **Framework**: Shopify Remix template
- **Frontend**: React, Polaris (Shopify's design system)
- **Database**: Prisma with SQLite (dev) / PostgreSQL (prod)
- **Theme Integration**: Theme App Extension
- **Runtime**: Node 20.19.5
- **Build**: Vite

## Development Commands
```bash
# Start development server (connects to dev store)
npm run dev

# Build for production
npm run build

# Deploy to Shopify
npm run deploy

# Generate Prisma client
npm run setup

# Lint code
npm run lint

# Generate new extension
npm run generate
```

## Project Structure
```
popcart/
├── app/                      # Remix app (admin UI)
│   ├── routes/              # Admin routes
│   │   ├── app._index.tsx   # Main admin dashboard
│   │   ├── app.tsx          # Admin layout
│   │   └── auth.*/          # OAuth routes
│   ├── shopify.server.ts    # Shopify API setup
│   └── db.server.ts         # Prisma client
├── extensions/              # Theme App Extension (cart drawer - to be created)
├── prisma/
│   └── schema.prisma        # Database schema
├── public/                  # Static assets
├── shopify.app.toml         # App configuration (client_id, scopes, webhooks)
└── shopify.web.toml         # Web server configuration
```

## App Config
- **Client ID**: c7d32db0d4433c762a3955d43cf26826
- **API Version**: 2026-04
- **Embedded**: Yes

## Notes
- Target launch: ~1 month
- Developer background: 7 years Shopify merchant experience (teema.co)

---

# UPCART FEATURE REFERENCE (Clone Target)

## Implementation Phases

### Phase 1: Core Cart Drawer
- [ ] Basic cart drawer with open/close (slide from right)
- [ ] Cart items display with product image, title, variant, price
- [ ] Quantity controls (+/- buttons)
- [ ] Remove item functionality
- [ ] Checkout button with dynamic total
- [ ] "Continue shopping" link

### Phase 2: Customization & Design
- [ ] Design settings (colors, fonts, cart width)
- [ ] Header customization
- [ ] Cart summary section
- [ ] Trust badges with preset payment icons
- [ ] Button styling (corner radius, colors)

### Phase 3: Revenue Features
- [ ] Upsells system (AI recommended + manual)
- [ ] Tiered rewards/progress bar (up to 3 tiers)
- [ ] Add-ons (shipping protection with tiered pricing)
- [ ] Discount codes input

### Phase 4: Advanced Features
- [ ] Announcements bar with countdown timer
- [ ] Recommendations for empty cart
- [ ] Subscription upgrades
- [ ] Triggered conditional rewards
- [ ] Express payments (Apple Pay, Google Pay, Shop Pay)

### Phase 5: Analytics & Polish
- [ ] Analytics dashboard (revenue, conversions, impressions)
- [ ] Custom templates system with code editor
- [ ] Sticky cart button
- [ ] Help & support section

---

## DETAILED FEATURE SPECIFICATIONS

### 1. CART DRAWER (Main Cart Editor)

#### 1.1 Global Cart Settings
- **Cart Status**: Active/Inactive toggle
- **Cart Version**: Version selector
- **Cart Editor Preview**: Dropdown (Items in cart, Empty cart)
- **Edit Cart in Sandbox**: Testing mode

#### 1.2 Design Settings
**General Options:**
- Inherit fonts from theme (toggle)
- Show strikethrough prices (toggle)
- Enable subtotal line (toggle)

**Cart Width:**
- Desktop: Wide/Normal/Narrow
- Mobile: Full/Wide/Normal

**Colors (hex pickers):**
- Background color
- Cart accent color
- Cart text color
- Savings text color

**Button Settings:**
- Corner radius (px slider)
- Button color
- Button text color
- Button text hover color

---

### 2. BODY COMPONENTS

#### 2.1 Announcements Bar
- Enable/Disable toggle
- Height: Slim, Normal, Thick
- Position: Before products, After products
- Timer with countdown (format mm:ss)
- Dynamic `{TIMER}` variable
- Rich text editor (Bold, Italic, Underline, Link)
- Font size slider (10px - 24px)
- Background/border color
- Custom template support

#### 2.2 Tiered Rewards (Progress Bar)
- Enable/Disable toggle
- Show rewards on empty cart toggle
- Bar colors (background, foreground, icons)
- Text after completing rewards
- **Rewards Calculation:**
  - Cart Total ($) - amount based
  - Cart Quantity (#) - quantity based
- **Tier Configuration (up to 3):**
  - Reward type: Discount, Free Shipping, Free Gift
  - Minimum threshold
  - Reward description
  - Title before achieving
- Shopify Discount API integration ("Create Discount" button)

#### 2.3 Triggered Rewards
- Conditional rewards (products in cart, customer type)
- Up to 10 rules
- Visual workflow diagram
- Custom template support

#### 2.4 Recommendations (Empty Cart)
- Header text customization
- 'Shop now' button toggle
- Button text/URL customization
- Max recommendations (numeric)
- Direction: Block/Inline
- Product reviews integration (Storefront API)

#### 2.5 Cart Items
- Custom templates: Skeleton, Product tile, Variant, Properties, Bundle, Price
- Code editor with Format/Compile

#### 2.6 Subscription Upgrades
- Button text with `{{selling_plan_group_name}}`
- Override subscription plan options
- Prevent downgrades toggle

#### 2.7 Upsells
- AI recommended upsells toggle
- Recommendation Algorithm (Related, etc.)
- Smart variant matching
- Manual upsells configuration
- Show if item already in cart toggle
- Limit upsells count toggle
- Product reviews toggle
- Title, add button text customization
- Position: Top/Bottom
- Direction: Block/Inline

#### 2.8 Additional Notes
- Notes title (rich text)
- Placeholder text
- Placement: Below/Above cart items

---

### 3. FOOTER COMPONENTS

#### 3.1 Add-ons (Shipping Protection)
- Add-on Types: Shipping protection, Product add-on
- Title (50 char limit), Description (80 char)
- **Pricing Tiers (up to 15):**
  - Cart value threshold
  - Price per tier
- Advanced: Include in count, Auto-fulfill, Pre-discount total, Tracking

#### 3.2 Discount Codes
- Input placeholder text
- Apply button text
- Limitations info panel

#### 3.3 Cart Summary
- Subtotal, discounts applied, total savings
- Remove discount functionality

#### 3.4 Express Payments
- Apple Pay, Google Pay, Shop Pay, PayPal
- Button height sliders (25-55px)
- Alignment, Row Gap
- Hide buyer consent toggle
- Shadow DOM option

#### 3.5 Trust Badges
- Badge upload area
- Preset icons: Apple Pay, Google Pay, PayPal, Amex, Visa, Mastercard, Maestro, Shop Pay
- Position: Top/Bottom

---

### 4. STICKY CART BUTTON
- Icon selection (bag, box, cart)
- Colors: Background, Icon, Quantity badge
- Position: Bottom Right/Left, etc.
- Device settings: All/Desktop/Mobile
- Custom CSS editor

---

### 5. ANALYTICS DASHBOARD
- Date range selector (7 days, 30 days, custom)
- Compare to previous period
- **Metrics:**
  - Revenue (with Add-ons/Upsells/Subscriptions filters)
  - Cart impressions
  - Conversion rate
  - Checkouts completed
- Top performing products
- Export functionality

---

### 6. TECHNICAL REQUIREMENTS

#### Data Model
- Cart state (items, total, quantity, discounts, notes, add-ons)
- Configuration per merchant (settings, templates, colors, toggles)
- Analytics (impressions, conversions, revenue attribution)

#### UI/UX
- Slide-out from right with overlay
- Close on backdrop click
- Responsive (desktop/mobile widths)
- Accessibility (focus, keyboard, screen readers)

#### Shopify Integration
- App Bridge (embedded, navigation, toasts, modals)
- Theme App Extension (cart drawer, sticky button)
- Webhooks (cart update, checkout, order completion)
- APIs: Storefront (reviews), Discounts (auto-create), Subscriptions

---

## Key Files
- `shopify.app.toml` - App configuration (scopes: write_products)
- `prisma/schema.prisma` - Database schema (Session model for auth)
- `app/routes/app._index.tsx` - Main admin page
- `extensions/` - Theme extension for cart drawer (to be created)

## Next Steps
1. Run `npm run dev` to start development
2. Create Theme App Extension for cart drawer: `npm run generate extension`
3. Build admin UI for merchant configuration
4. Implement cart drawer components
