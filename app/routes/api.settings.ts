import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";

/**
 * Public API endpoint to fetch cart settings for a shop
 * Called by the cart drawer on the storefront
 *
 * GET /api/settings?shop=mystore.myshopify.com
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  // CORS headers for storefront access
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-cache, no-store, must-revalidate", // Disable caching during development
  };

  if (!shop) {
    return json({ error: "Shop parameter required" }, { status: 400, headers });
  }

  try {
    const settings = await prisma.cartSettings.findUnique({
      where: { shop },
      include: {
        rewardTiers: {
          orderBy: { sortOrder: "asc" },
        },
        upsells: {
          orderBy: { sortOrder: "asc" },
        },
        addOns: {
          orderBy: { sortOrder: "asc" },
        },
        bxgyOffers: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!settings) {
      // Return default settings if none exist
      return json({
        settings: getDefaultSettings(),
        rewardTiers: [],
        upsells: [],
        addOns: [],
        bxgyOffers: [],
      }, { headers });
    }

    // Remove sensitive/internal fields
    const { id, shop: shopDomain, createdAt, updatedAt, ...publicSettings } = settings;

    return json({
      settings: publicSettings,
      rewardTiers: settings.rewardTiers.map(({ id, cartSettingsId, createdAt, updatedAt, ...tier }) => tier),
      upsells: settings.upsells.map(({ id, cartSettingsId, createdAt, updatedAt, ...upsell }) => upsell),
      addOns: settings.addOns.map(({ id, cartSettingsId, createdAt, updatedAt, ...addon }) => addon),
      bxgyOffers: settings.bxgyOffers.map(({ id, cartSettingsId, createdAt, updatedAt, ...offer }) => offer),
    }, { headers });

  } catch (error) {
    console.error("Error fetching cart settings:", error);
    return json({ error: "Failed to fetch settings" }, { status: 500, headers });
  }
};

// Handle OPTIONS preflight requests
export const action = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  return json({ error: "Method not allowed" }, { status: 405 });
};

function getDefaultSettings() {
  return {
    enabled: true,
    cartTitle: "Your Cart",
    emptyCartText: "Your cart is empty",
    emptyCartBtnText: "Continue Shopping",
    emptyCartBtnUrl: "/collections/all",
    announcementEnabled: true,
    announcementText: "Free shipping on orders over $50!",
    announcementBgColor: "#000000",
    announcementTextColor: "#ffffff",
    announcementLink: null,
    announcementIcon: null,
    progressBarEnabled: true,
    progressBarBgColor: "#e5e7eb",
    progressBarFillColor: "#10b981",
    progressBarTextColor: "#1a1a1a",
    checkoutBtnText: "Checkout",
    checkoutBtnBgColor: "#000000",
    checkoutBtnTextColor: "#ffffff",
    showViewCartLink: true,
    showSubtotal: true,
    subtotalLabel: "Subtotal",
    taxShippingNote: "Shipping & taxes calculated at checkout",
    upsellsEnabled: false,
    upsellsTitle: "You may also like",
    upsellsStyle: "list",
    addOnsEnabled: false,
    addOnsTitle: "Add to your order",
    drawerWidth: 420,
    drawerPosition: "right",
    overlayColor: "rgba(0, 0, 0, 0.5)",
    drawerBgColor: "#ffffff",
    drawerTextColor: "#1a1a1a",
    drawerBorderRadius: 0,
    fontFamily: "inherit",
    showItemImage: true,
    showItemVariant: true,
    showItemVendor: false,
    showQuantitySelector: true,
    showRemoveButton: true,
    itemImageSize: 80,
  };
}
