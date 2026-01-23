-- CreateTable
CREATE TABLE "CartSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cartTitle" TEXT NOT NULL DEFAULT 'Your Cart',
    "emptyCartText" TEXT NOT NULL DEFAULT 'Your cart is empty',
    "emptyCartBtnText" TEXT NOT NULL DEFAULT 'Continue Shopping',
    "emptyCartBtnUrl" TEXT NOT NULL DEFAULT '/collections/all',
    "announcementEnabled" BOOLEAN NOT NULL DEFAULT true,
    "announcementText" TEXT NOT NULL DEFAULT 'Free shipping on orders over $50!',
    "announcementBgColor" TEXT NOT NULL DEFAULT '#000000',
    "announcementTextColor" TEXT NOT NULL DEFAULT '#ffffff',
    "announcementLink" TEXT,
    "announcementIcon" TEXT,
    "progressBarEnabled" BOOLEAN NOT NULL DEFAULT true,
    "progressBarBgColor" TEXT NOT NULL DEFAULT '#e5e7eb',
    "progressBarFillColor" TEXT NOT NULL DEFAULT '#10b981',
    "progressBarTextColor" TEXT NOT NULL DEFAULT '#1a1a1a',
    "checkoutBtnText" TEXT NOT NULL DEFAULT 'Checkout',
    "checkoutBtnBgColor" TEXT NOT NULL DEFAULT '#000000',
    "checkoutBtnTextColor" TEXT NOT NULL DEFAULT '#ffffff',
    "showViewCartLink" BOOLEAN NOT NULL DEFAULT true,
    "showSubtotal" BOOLEAN NOT NULL DEFAULT true,
    "subtotalLabel" TEXT NOT NULL DEFAULT 'Subtotal',
    "taxShippingNote" TEXT NOT NULL DEFAULT 'Shipping & taxes calculated at checkout',
    "upsellsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "upsellsTitle" TEXT NOT NULL DEFAULT 'You may also like',
    "upsellsStyle" TEXT NOT NULL DEFAULT 'carousel',
    "addOnsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "addOnsTitle" TEXT NOT NULL DEFAULT 'Add to your order',
    "drawerWidth" INTEGER NOT NULL DEFAULT 420,
    "drawerPosition" TEXT NOT NULL DEFAULT 'right',
    "overlayColor" TEXT NOT NULL DEFAULT 'rgba(0, 0, 0, 0.5)',
    "drawerBgColor" TEXT NOT NULL DEFAULT '#ffffff',
    "drawerTextColor" TEXT NOT NULL DEFAULT '#1a1a1a',
    "drawerBorderRadius" INTEGER NOT NULL DEFAULT 0,
    "fontFamily" TEXT NOT NULL DEFAULT 'inherit',
    "showItemImage" BOOLEAN NOT NULL DEFAULT true,
    "showItemVariant" BOOLEAN NOT NULL DEFAULT true,
    "showItemVendor" BOOLEAN NOT NULL DEFAULT false,
    "showQuantitySelector" BOOLEAN NOT NULL DEFAULT true,
    "showRemoveButton" BOOLEAN NOT NULL DEFAULT true,
    "itemImageSize" INTEGER NOT NULL DEFAULT 80
);

-- CreateTable
CREATE TABLE "RewardTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "threshold" INTEGER NOT NULL,
    "rewardType" TEXT NOT NULL,
    "rewardValue" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "cartSettingsId" TEXT NOT NULL,
    CONSTRAINT "RewardTier_cartSettingsId_fkey" FOREIGN KEY ("cartSettingsId") REFERENCES "CartSettings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Upsell" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "productId" TEXT NOT NULL,
    "productHandle" TEXT,
    "titleOverride" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "showOnlyIfEmpty" BOOLEAN NOT NULL DEFAULT false,
    "cartSettingsId" TEXT NOT NULL,
    CONSTRAINT "Upsell_cartSettingsId_fkey" FOREIGN KEY ("cartSettingsId") REFERENCES "CartSettings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AddOn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "productId" TEXT NOT NULL,
    "productHandle" TEXT,
    "variantId" TEXT,
    "titleOverride" TEXT,
    "priceOverride" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "cartSettingsId" TEXT NOT NULL,
    CONSTRAINT "AddOn_cartSettingsId_fkey" FOREIGN KEY ("cartSettingsId") REFERENCES "CartSettings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CartSettings_shop_key" ON "CartSettings"("shop");
