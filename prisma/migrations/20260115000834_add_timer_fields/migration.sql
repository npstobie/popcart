-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CartSettings" (
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
    "timerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timerType" TEXT NOT NULL DEFAULT 'daily',
    "timerDailyReset" TEXT NOT NULL DEFAULT '00:00',
    "timerFixedEnd" DATETIME,
    "timerDuration" INTEGER NOT NULL DEFAULT 30,
    "timerExpiredAction" TEXT NOT NULL DEFAULT 'hide',
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
INSERT INTO "new_CartSettings" ("addOnsEnabled", "addOnsTitle", "announcementBgColor", "announcementEnabled", "announcementIcon", "announcementLink", "announcementText", "announcementTextColor", "cartTitle", "checkoutBtnBgColor", "checkoutBtnText", "checkoutBtnTextColor", "createdAt", "drawerBgColor", "drawerBorderRadius", "drawerPosition", "drawerTextColor", "drawerWidth", "emptyCartBtnText", "emptyCartBtnUrl", "emptyCartText", "enabled", "fontFamily", "id", "itemImageSize", "overlayColor", "progressBarBgColor", "progressBarEnabled", "progressBarFillColor", "progressBarTextColor", "shop", "showItemImage", "showItemVariant", "showItemVendor", "showQuantitySelector", "showRemoveButton", "showSubtotal", "showViewCartLink", "subtotalLabel", "taxShippingNote", "updatedAt", "upsellsEnabled", "upsellsStyle", "upsellsTitle") SELECT "addOnsEnabled", "addOnsTitle", "announcementBgColor", "announcementEnabled", "announcementIcon", "announcementLink", "announcementText", "announcementTextColor", "cartTitle", "checkoutBtnBgColor", "checkoutBtnText", "checkoutBtnTextColor", "createdAt", "drawerBgColor", "drawerBorderRadius", "drawerPosition", "drawerTextColor", "drawerWidth", "emptyCartBtnText", "emptyCartBtnUrl", "emptyCartText", "enabled", "fontFamily", "id", "itemImageSize", "overlayColor", "progressBarBgColor", "progressBarEnabled", "progressBarFillColor", "progressBarTextColor", "shop", "showItemImage", "showItemVariant", "showItemVendor", "showQuantitySelector", "showRemoveButton", "showSubtotal", "showViewCartLink", "subtotalLabel", "taxShippingNote", "updatedAt", "upsellsEnabled", "upsellsStyle", "upsellsTitle" FROM "CartSettings";
DROP TABLE "CartSettings";
ALTER TABLE "new_CartSettings" RENAME TO "CartSettings";
CREATE UNIQUE INDEX "CartSettings_shop_key" ON "CartSettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
