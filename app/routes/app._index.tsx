import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Checkbox,
  Select,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Box,
  Banner,
  Divider,
  RangeSlider,
  Badge,
  Icon,
} from "@shopify/polaris";
import {
  SettingsIcon,
  PaintBrushFlatIcon,
  TextIcon,
  CartIcon,
  CreditCardIcon,
  StarFilledIcon,
  NotificationIcon,
  ProductIcon,
  PlusCircleIcon,
  GiftCardIcon,
} from "@shopify/polaris-icons";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

interface UpsellProduct {
  id: string;
  productId: string;
  productHandle?: string;
  title: string;
  image?: string;
  sortOrder: number;
}

interface AddOnItem {
  id: string;
  productId: string;
  variantId?: string;
  productHandle?: string;
  title: string;
  description?: string;
  price: number;
  icon?: string;
  sortOrder: number;
}

interface BxgySelectionProduct {
  productId: string;
  productHandle: string;
  title: string;
  image?: string;
}

interface BxgyOffer {
  id: string;
  title: string;
  buyQuantity: number;
  getQuantity: number;
  rewardMode: string; // cheapest_in_cart, selection, automatic
  appliesToType: string;
  collectionId?: string;
  productIds?: string;
  // Selection mode settings
  selectionProducts: BxgySelectionProduct[];
  selectionDisplayStyle: string;
  selectionTitle: string;
  // Automatic mode settings
  automaticProductId?: string;
  automaticProductHandle?: string;
  automaticProductTitle?: string;
  automaticProductImage?: string;
  // Messages
  message: string;
  completedMessage: string;
  sortOrder: number;
}

import prisma from "../db.server";

// Default settings for new shops
const defaultSettings = {
  enabled: true,
  cartTitle: "Your Cart",
  emptyCartText: "Your cart is empty",
  emptyCartBtnText: "Continue Shopping",
  emptyCartBtnUrl: "/collections/all",
  announcementEnabled: true,
  announcementText: "Free shipping on orders over $50!",
  announcementBgColor: "#000000",
  announcementTextColor: "#ffffff",
  announcementLink: "",
  timerEnabled: false,
  timerType: "daily",
  timerDailyReset: "00:00",
  timerFixedEnd: null,
  timerDuration: 30,
  timerExpiredAction: "hide",
  progressBarEnabled: true,
  progressBarBgColor: "#e5e7eb",
  progressBarFillColor: "#10b981",
  progressBarTextColor: "#1a1a1a",
  bxgyEnabled: false,
  bxgyBgColor: "#e5e7eb",
  bxgyFillColor: "#6366f1",
  bxgyTextColor: "#1a1a1a",
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let settings = await prisma.cartSettings.findUnique({
    where: { shop },
    include: {
      rewardTiers: { orderBy: { sortOrder: "asc" } },
      upsells: { orderBy: { sortOrder: "asc" } },
      addOns: { orderBy: { sortOrder: "asc" } },
      bxgyOffers: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!settings) {
    settings = await prisma.cartSettings.create({
      data: { shop, ...defaultSettings },
      include: {
        rewardTiers: { orderBy: { sortOrder: "asc" } },
        upsells: { orderBy: { sortOrder: "asc" } },
        addOns: { orderBy: { sortOrder: "asc" } },
        bxgyOffers: { orderBy: { sortOrder: "asc" } },
      },
    });
  }

  return json({ settings, shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const updates: Record<string, any> = {};
  let rewardTiersData: any[] = [];
  let upsellsData: any[] = [];
  let addOnsData: any[] = [];
  let bxgyOffersData: any[] = [];

  const nullableFields = new Set(["announcementLink", "announcementIcon", "timerFixedEnd"]);

  for (const [key, value] of formData.entries()) {
    if (key === "_action") continue;

    if (key === "_rewardTiers") {
      try { rewardTiersData = JSON.parse(value as string); } catch (e) {}
      continue;
    }
    if (key === "_upsells") {
      try { upsellsData = JSON.parse(value as string); } catch (e) {}
      continue;
    }
    if (key === "_addOns") {
      try { addOnsData = JSON.parse(value as string); } catch (e) {}
      continue;
    }
    if (key === "_bxgyOffers") {
      try { bxgyOffersData = JSON.parse(value as string); } catch (e) {}
      continue;
    }

    if (value === "null" || value === "" || value === "undefined") {
      if (nullableFields.has(key)) updates[key] = null;
      continue;
    }

    if (value === "true" || value === "false") {
      updates[key] = value === "true";
    } else if (key === "drawerWidth" || key === "drawerBorderRadius" || key === "itemImageSize" || key === "timerDuration") {
      updates[key] = parseInt(value as string, 10);
    } else if (key === "timerFixedEnd") {
      updates[key] = new Date(value as string);
    } else {
      updates[key] = value;
    }
  }

  const cartSettings = await prisma.cartSettings.upsert({
    where: { shop },
    update: updates,
    create: { shop, ...defaultSettings, ...updates },
  });

  if (rewardTiersData.length >= 0) {
    await prisma.rewardTier.deleteMany({ where: { cartSettingsId: cartSettings.id } });
    if (rewardTiersData.length > 0) {
      await prisma.rewardTier.createMany({
        data: rewardTiersData.map((tier, index) => ({
          cartSettingsId: cartSettings.id,
          threshold: tier.threshold,
          rewardType: tier.rewardType,
          rewardValue: tier.rewardValue || null,
          title: tier.title,
          message: tier.message,
          icon: tier.icon || null,
          sortOrder: index,
        })),
      });
    }
  }

  if (upsellsData.length >= 0) {
    await prisma.upsell.deleteMany({ where: { cartSettingsId: cartSettings.id } });
    if (upsellsData.length > 0) {
      await prisma.upsell.createMany({
        data: upsellsData.map((upsell, index) => ({
          cartSettingsId: cartSettings.id,
          productId: upsell.productId,
          productHandle: upsell.productHandle || null,
          titleOverride: upsell.titleOverride || null,
          sortOrder: index,
        })),
      });
    }
  }

  if (addOnsData.length >= 0) {
    await prisma.addOn.deleteMany({ where: { cartSettingsId: cartSettings.id } });
    if (addOnsData.length > 0) {
      await prisma.addOn.createMany({
        data: addOnsData.map((addon, index) => ({
          cartSettingsId: cartSettings.id,
          productId: addon.productId,
          productHandle: addon.productHandle || null,
          variantId: addon.variantId || null,
          titleOverride: addon.title || null,
          priceOverride: addon.priceOverride || null,
          icon: addon.icon || null,
          sortOrder: index,
        })),
      });
    }
  }

  if (bxgyOffersData.length >= 0) {
    await prisma.buyXGetYOffer.deleteMany({ where: { cartSettingsId: cartSettings.id } });
    if (bxgyOffersData.length > 0) {
      await prisma.buyXGetYOffer.createMany({
        data: bxgyOffersData.map((offer, index) => ({
          cartSettingsId: cartSettings.id,
          title: offer.title || "Buy More, Save More",
          buyQuantity: offer.buyQuantity || 3,
          getQuantity: offer.getQuantity || 1,
          rewardMode: offer.rewardMode || "cheapest_in_cart",
          appliesToType: offer.appliesToType || "all",
          collectionId: offer.collectionId || null,
          productIds: offer.productIds || null,
          selectionProductIds: offer.selectionProductIds || null,
          selectionDisplayStyle: offer.selectionDisplayStyle || "list",
          selectionTitle: offer.selectionTitle || "Choose your free item(s)",
          automaticProductId: offer.automaticProductId || null,
          automaticProductHandle: offer.automaticProductHandle || null,
          message: offer.message || "Add {remaining} more to get {free} free!",
          completedMessage: offer.completedMessage || "🎉 You've unlocked {free} free item(s)!",
          sortOrder: index,
        })),
      });
    }
  }

  return json({ success: true });
};

// Navigation items
const navSections = [
  {
    title: "General",
    items: [
      { id: "design", label: "Design", icon: PaintBrushFlatIcon },
      { id: "header", label: "Header", icon: TextIcon },
    ],
  },
  {
    title: "Body",
    items: [
      { id: "announcement", label: "Announcements", icon: NotificationIcon },
      { id: "rewards", label: "Spend rewards", icon: StarFilledIcon },
      { id: "bxgy", label: "Buy X Get Y", icon: GiftCardIcon },
      { id: "cart-items", label: "Cart items", icon: CartIcon },
      { id: "upsells", label: "Upsells", icon: ProductIcon },
    ],
  },
  {
    title: "Footer",
    items: [
      { id: "addons", label: "Add-ons", icon: PlusCircleIcon },
      { id: "checkout", label: "Cart summary", icon: CreditCardIcon },
    ],
  },
  {
    title: "",
    items: [
      { id: "settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

export default function Settings() {
  const { settings, shop } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const isLoading = navigation.state === "submitting";

  const [activeSection, setActiveSection] = useState("design");
  const [formState, setFormState] = useState(settings);
  const [rewardTiers, setRewardTiers] = useState(settings.rewardTiers || []);
  const [upsells, setUpsells] = useState<UpsellProduct[]>(
    (settings.upsells || []).map((u: any) => ({
      id: u.id,
      productId: u.productId,
      productHandle: u.productHandle,
      title: u.titleOverride || u.productId.split("/").pop() || "Product",
      sortOrder: u.sortOrder,
    }))
  );
  const [addOns, setAddOns] = useState<AddOnItem[]>(
    (settings.addOns || []).map((a: any) => ({
      id: a.id,
      productId: a.productId,
      variantId: a.variantId,
      productHandle: a.productHandle,
      title: a.titleOverride || "Add-on",
      price: a.priceOverride || 0,
      icon: a.icon || "🛡️",
      sortOrder: a.sortOrder,
    }))
  );
  const [bxgyOffers, setBxgyOffers] = useState<BxgyOffer[]>(
    (settings.bxgyOffers || []).map((o: any) => {
      // Parse selectionProductIds from JSON string to array of products
      let selectionProducts: BxgySelectionProduct[] = [];
      if (o.selectionProductIds) {
        try {
          const handles = o.selectionProductIds.split(',').map((h: string) => h.trim()).filter((h: string) => h);
          selectionProducts = handles.map((handle: string) => ({
            productId: '', productHandle: handle, title: handle
          }));
        } catch (e) {}
      }
      return {
        id: o.id,
        title: o.title || "Buy More, Save More",
        buyQuantity: o.buyQuantity || 3,
        getQuantity: o.getQuantity || 1,
        rewardMode: o.rewardMode || "cheapest_in_cart",
        appliesToType: o.appliesToType || "all",
        collectionId: o.collectionId,
        productIds: o.productIds,
        selectionProducts,
        selectionDisplayStyle: o.selectionDisplayStyle || "grid",
        selectionTitle: o.selectionTitle || "Choose your free item(s)",
        automaticProductId: o.automaticProductId,
        automaticProductHandle: o.automaticProductHandle,
        message: o.message || "Add {remaining} more to get {free} free!",
        completedMessage: o.completedMessage || "🎉 You've unlocked {free} free item(s)!",
        sortOrder: o.sortOrder || 0,
      };
    })
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [previewCartValue, setPreviewCartValue] = useState(0);
  const [previewBxgyQuantity, setPreviewBxgyQuantity] = useState(0);

  useEffect(() => {
    setFormState(settings);
    setRewardTiers(settings.rewardTiers || []);
    setUpsells(
      (settings.upsells || []).map((u: any) => ({
        id: u.id, productId: u.productId, productHandle: u.productHandle,
        title: u.titleOverride || u.productId.split("/").pop() || "Product", sortOrder: u.sortOrder,
      }))
    );
    setAddOns(
      (settings.addOns || []).map((a: any) => ({
        id: a.id, productId: a.productId, variantId: a.variantId, productHandle: a.productHandle,
        title: a.titleOverride || "Add-on", price: a.priceOverride || 0, icon: a.icon || "🛡️", sortOrder: a.sortOrder,
      }))
    );
    setBxgyOffers(
      (settings.bxgyOffers || []).map((o: any) => {
        let selectionProducts: BxgySelectionProduct[] = [];
        if (o.selectionProductIds) {
          try {
            const handles = o.selectionProductIds.split(',').map((h: string) => h.trim()).filter((h: string) => h);
            selectionProducts = handles.map((handle: string) => ({
              productId: '', productHandle: handle, title: handle
            }));
          } catch (e) {}
        }
        return {
          id: o.id, title: o.title, buyQuantity: o.buyQuantity, getQuantity: o.getQuantity,
          rewardMode: o.rewardMode || "cheapest_in_cart", appliesToType: o.appliesToType,
          collectionId: o.collectionId, productIds: o.productIds,
          selectionProducts, selectionDisplayStyle: o.selectionDisplayStyle || "grid",
          selectionTitle: o.selectionTitle || "Choose your free item(s)",
          automaticProductId: o.automaticProductId, automaticProductHandle: o.automaticProductHandle,
          message: o.message, completedMessage: o.completedMessage, sortOrder: o.sortOrder,
        };
      })
    );
  }, [settings]);

  useEffect(() => {
    const settingsChanged = JSON.stringify(formState) !== JSON.stringify(settings);
    const tiersChanged = JSON.stringify(rewardTiers) !== JSON.stringify(settings.rewardTiers || []);
    const bxgyChanged = JSON.stringify(bxgyOffers) !== JSON.stringify(settings.bxgyOffers || []);
    setHasChanges(settingsChanged || tiersChanged || bxgyChanged);
  }, [formState, settings, rewardTiers, upsells, addOns, bxgyOffers]);

  const updateField = useCallback((field: string, value: any) => {
    setFormState((prev: any) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    Object.entries(formState).forEach(([key, value]) => {
      if (!["id", "shop", "createdAt", "updatedAt", "rewardTiers", "upsells", "addOns", "bxgyOffers"].includes(key)) {
        formData.append(key, String(value));
      }
    });
    formData.append("_rewardTiers", JSON.stringify(rewardTiers));
    formData.append("_upsells", JSON.stringify(upsells.map(u => ({
      productId: u.productId, productHandle: u.productHandle,
      titleOverride: u.title !== u.productId.split("/").pop() ? u.title : null,
    }))));
    formData.append("_addOns", JSON.stringify(addOns.map(a => ({
      productId: a.productId, variantId: a.variantId, productHandle: a.productHandle,
      title: a.title, priceOverride: a.price > 0 ? a.price : null, icon: a.icon,
    }))));
    formData.append("_bxgyOffers", JSON.stringify(bxgyOffers.map(offer => ({
      ...offer,
      // Convert selectionProducts array to comma-separated handles string
      selectionProductIds: offer.selectionProducts.map(p => p.productHandle).join(', '),
      selectionProducts: undefined, // Don't send the array to backend
    }))));
    submit(formData, { method: "post" });
  }, [formState, rewardTiers, upsells, addOns, bxgyOffers, submit]);

  const openProductPicker = useCallback(async () => {
    const products = await shopify.resourcePicker({ type: "product", multiple: true, action: "select", filter: { variants: false } });
    if (products && products.length > 0) {
      const newUpsells: UpsellProduct[] = products.map((product: any, index: number) => ({
        id: `new-${Date.now()}-${index}`, productId: product.id, productHandle: product.handle,
        title: product.title, image: product.images?.[0]?.originalSrc || product.images?.[0]?.src,
        sortOrder: upsells.length + index,
      }));
      const existingIds = new Set(upsells.map(u => u.productId));
      setUpsells([...upsells, ...newUpsells.filter(u => !existingIds.has(u.productId))]);
    }
  }, [shopify, upsells]);

  const openAddOnPicker = useCallback(async () => {
    const products = await shopify.resourcePicker({ type: "product", multiple: true, action: "select" });
    if (products && products.length > 0) {
      const newAddOns: AddOnItem[] = products.map((product: any, index: number) => {
        const variant = product.variants?.[0];
        return {
          id: `new-${Date.now()}-${index}`, productId: product.id, variantId: variant?.id,
          productHandle: product.handle, title: product.title,
          price: variant?.price ? Math.round(parseFloat(variant.price) * 100) : 0,
          icon: "🛡️", sortOrder: addOns.length + index,
        };
      });
      const existingIds = new Set(addOns.map(a => a.productId));
      setAddOns([...addOns, ...newAddOns.filter(a => !existingIds.has(a.productId))]);
    }
  }, [shopify, addOns]);

  // Open product picker for BXGY selection mode
  const openBxgySelectionPicker = useCallback(async (offerId: string) => {
    const products = await shopify.resourcePicker({ type: "product", multiple: true, action: "select", filter: { variants: false } });
    if (products && products.length > 0) {
      const newProducts: BxgySelectionProduct[] = products.map((product: any) => ({
        productId: product.id,
        productHandle: product.handle,
        title: product.title,
        image: product.images?.[0]?.originalSrc || product.images?.[0]?.src,
      }));
      setBxgyOffers(bxgyOffers.map(offer => {
        if (offer.id !== offerId) return offer;
        const existingHandles = new Set(offer.selectionProducts.map(p => p.productHandle));
        return {
          ...offer,
          selectionProducts: [...offer.selectionProducts, ...newProducts.filter(p => !existingHandles.has(p.productHandle))]
        };
      }));
    }
  }, [shopify, bxgyOffers]);

  // Open product picker for BXGY automatic mode
  const openBxgyAutomaticPicker = useCallback(async (offerId: string) => {
    const products = await shopify.resourcePicker({ type: "product", multiple: false, action: "select", filter: { variants: false } });
    if (products && products.length > 0) {
      const product = products[0] as any;
      setBxgyOffers(bxgyOffers.map(offer => {
        if (offer.id !== offerId) return offer;
        return {
          ...offer,
          automaticProductId: product.id,
          automaticProductHandle: product.handle,
          automaticProductTitle: product.title,
          automaticProductImage: product.images?.[0]?.originalSrc || product.images?.[0]?.src,
        };
      }));
    }
  }, [shopify, bxgyOffers]);

  // Format money helper
  const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#f6f6f7" }}>
      {/* Left Sidebar Navigation */}
      <div style={{
        width: 260,
        background: "#ffffff",
        borderRight: "1px solid #e1e3e5",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e1e3e5" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text as="h1" variant="headingMd">Cart editor</Text>
            <Badge tone="success">Active</Badge>
          </div>
          <Select
            label=""
            labelHidden
            options={[{ label: "Show items in cart", value: "items" }, { label: "Show empty cart", value: "empty" }]}
            value="items"
            onChange={() => {}}
          />
        </div>

        {/* Navigation */}
        <div style={{ flex: 1, overflow: "auto", padding: "12px 0" }}>
          {navSections.map((section, sIdx) => (
            <div key={sIdx} style={{ marginBottom: 16 }}>
              {section.title && (
                <div style={{ padding: "8px 16px", color: "#6d7175", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {section.title}
                </div>
              )}
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "10px 16px",
                    border: "none",
                    background: activeSection === item.id ? "#f2f7fe" : "transparent",
                    color: activeSection === item.id ? "#2c6ecb" : "#202223",
                    cursor: "pointer",
                    fontSize: 14,
                    textAlign: "left",
                    borderLeft: activeSection === item.id ? "3px solid #2c6ecb" : "3px solid transparent",
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, flexShrink: 0 }}>
                    <Icon source={item.icon} />
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div style={{ padding: 16, borderTop: "1px solid #e1e3e5" }}>
          <Button
            fullWidth
            url={`https://${shop}`}
            target="_blank"
          >
            Preview on store
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {/* Save Bar */}
          {hasChanges && (
            <div style={{
              position: "sticky",
              top: 0,
              zIndex: 100,
              background: "#1a1a1a",
              color: "white",
              padding: "12px 16px",
              borderRadius: 8,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <Text as="span" variant="bodyMd">Unsaved changes</Text>
              <InlineStack gap="200">
                <Button onClick={() => setFormState(settings)}>Discard</Button>
                <Button variant="primary" onClick={handleSave} loading={isLoading}>Save</Button>
              </InlineStack>
            </div>
          )}

          {/* Design Section */}
          {activeSection === "design" && (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Design</Text>
                <Divider />

                <Text as="h3" variant="headingSm">Cart width</Text>
                <RangeSlider
                  label="Desktop width"
                  value={formState.drawerWidth}
                  onChange={(value) => updateField("drawerWidth", value)}
                  min={320}
                  max={600}
                  step={10}
                  output
                  suffix={<Text as="span" variant="bodyMd">{formState.drawerWidth}px</Text>}
                />

                <Divider />
                <Text as="h3" variant="headingSm">Colors</Text>

                <TextField
                  label="Background color"
                  value={formState.drawerBgColor}
                  onChange={(value) => updateField("drawerBgColor", value)}
                  autoComplete="off"
                  prefix={<div style={{ width: 20, height: 20, background: formState.drawerBgColor, borderRadius: 4, border: "1px solid #ccc" }} />}
                />
                <TextField
                  label="Text color"
                  value={formState.drawerTextColor}
                  onChange={(value) => updateField("drawerTextColor", value)}
                  autoComplete="off"
                  prefix={<div style={{ width: 20, height: 20, background: formState.drawerTextColor, borderRadius: 4, border: "1px solid #ccc" }} />}
                />

                <Divider />
                <Text as="h3" variant="headingSm">Button settings</Text>

                <RangeSlider
                  label="Corner radius"
                  value={formState.drawerBorderRadius}
                  onChange={(value) => updateField("drawerBorderRadius", value)}
                  min={0}
                  max={24}
                  step={2}
                  output
                  suffix={<Text as="span" variant="bodyMd">{formState.drawerBorderRadius}px</Text>}
                />
                <TextField
                  label="Button color"
                  value={formState.checkoutBtnBgColor}
                  onChange={(value) => updateField("checkoutBtnBgColor", value)}
                  autoComplete="off"
                  prefix={<div style={{ width: 20, height: 20, background: formState.checkoutBtnBgColor, borderRadius: 4, border: "1px solid #ccc" }} />}
                />
                <TextField
                  label="Button text color"
                  value={formState.checkoutBtnTextColor}
                  onChange={(value) => updateField("checkoutBtnTextColor", value)}
                  autoComplete="off"
                  prefix={<div style={{ width: 20, height: 20, background: formState.checkoutBtnTextColor, borderRadius: 4, border: "1px solid #ccc" }} />}
                />
              </BlockStack>
            </Card>
          )}

          {/* Header Section */}
          {activeSection === "header" && (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Header</Text>
                <Divider />
                <TextField
                  label="Cart title"
                  value={formState.cartTitle}
                  onChange={(value) => updateField("cartTitle", value)}
                  autoComplete="off"
                />
                <Select
                  label="Drawer position"
                  options={[
                    { label: "Right", value: "right" },
                    { label: "Left", value: "left" },
                  ]}
                  value={formState.drawerPosition}
                  onChange={(value) => updateField("drawerPosition", value)}
                />
              </BlockStack>
            </Card>
          )}

          {/* Announcement Section */}
          {activeSection === "announcement" && (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Announcements</Text>
                  <Checkbox
                    label=""
                    labelHidden
                    checked={formState.announcementEnabled}
                    onChange={(checked) => updateField("announcementEnabled", checked)}
                  />
                </InlineStack>
                <Divider />

                {formState.announcementEnabled && (
                  <>
                    <TextField
                      label="Announcement text"
                      value={formState.announcementText}
                      onChange={(value) => updateField("announcementText", value)}
                      autoComplete="off"
                      multiline={2}
                      helpText="Use {TIMER} to show countdown timer"
                    />
                    <InlineStack gap="400">
                      <TextField
                        label="Background color"
                        value={formState.announcementBgColor}
                        onChange={(value) => updateField("announcementBgColor", value)}
                        autoComplete="off"
                        prefix={<div style={{ width: 20, height: 20, background: formState.announcementBgColor, borderRadius: 4, border: "1px solid #ccc" }} />}
                      />
                      <TextField
                        label="Text color"
                        value={formState.announcementTextColor}
                        onChange={(value) => updateField("announcementTextColor", value)}
                        autoComplete="off"
                        prefix={<div style={{ width: 20, height: 20, background: formState.announcementTextColor, borderRadius: 4, border: "1px solid #ccc" }} />}
                      />
                    </InlineStack>

                    <Divider />
                    <Checkbox
                      label="Enable countdown timer"
                      checked={formState.timerEnabled || false}
                      onChange={(checked) => updateField("timerEnabled", checked)}
                    />

                    {formState.timerEnabled && (
                      <>
                        <Select
                          label="Timer type"
                          options={[
                            { label: "Daily (resets at midnight)", value: "daily" },
                            { label: "Fixed end date", value: "fixed" },
                            { label: "Session (per visitor)", value: "session" },
                          ]}
                          value={formState.timerType || "daily"}
                          onChange={(value) => updateField("timerType", value)}
                        />
                        {formState.timerType === "session" && (
                          <TextField
                            label="Duration (minutes)"
                            type="number"
                            value={String(formState.timerDuration || 30)}
                            onChange={(value) => updateField("timerDuration", parseInt(value) || 30)}
                            autoComplete="off"
                          />
                        )}
                      </>
                    )}
                  </>
                )}
              </BlockStack>
            </Card>
          )}

          {/* Rewards Section */}
          {activeSection === "rewards" && (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Tiered Rewards</Text>
                  <Checkbox
                    label=""
                    labelHidden
                    checked={formState.progressBarEnabled}
                    onChange={(checked) => updateField("progressBarEnabled", checked)}
                  />
                </InlineStack>
                <Divider />

                {formState.progressBarEnabled && (
                  <>
                    {/* Reward Tiers Configuration */}
                    <BlockStack gap="400">
                      <InlineStack align="space-between">
                        <BlockStack gap="100">
                          <Text as="span" variant="headingSm">Reward Tiers</Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            Set spending thresholds and rewards to motivate customers
                          </Text>
                        </BlockStack>
                        <Button
                          onClick={() => {
                            const nextThreshold = rewardTiers.length === 0 ? 5000 :
                              Math.max(...rewardTiers.map(t => t.threshold)) + 2500;
                            setRewardTiers([...rewardTiers, {
                              id: `new-${Date.now()}`,
                              threshold: nextThreshold,
                              rewardType: "free_shipping",
                              rewardValue: "",
                              title: rewardTiers.length === 0 ? "Free Shipping" : `Tier ${rewardTiers.length + 1}`,
                              message: rewardTiers.length === 0 ? "You've unlocked FREE shipping!" : "Reward unlocked!",
                              icon: rewardTiers.length === 0 ? "🚚" : "🎁",
                              sortOrder: rewardTiers.length,
                            }]);
                          }}
                        >
                          Add tier
                        </Button>
                      </InlineStack>

                      {rewardTiers.length === 0 ? (
                        <Banner tone="info">
                          <p>Add reward tiers to create a gamified progress bar that encourages customers to spend more.</p>
                        </Banner>
                      ) : (
                        <BlockStack gap="400">
                          {rewardTiers.sort((a, b) => a.threshold - b.threshold).map((tier, index) => (
                            <Card key={tier.id} padding="400" background="bg-surface-secondary">
                              <BlockStack gap="400">
                                {/* Tier Header */}
                                <InlineStack align="space-between" blockAlign="center">
                                  <InlineStack gap="200" blockAlign="center">
                                    <div style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: "50%",
                                      background: formState.progressBarFillColor,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "18px"
                                    }}>
                                      {tier.icon || "🎁"}
                                    </div>
                                    <BlockStack gap="0">
                                      <Text as="span" variant="headingSm">{tier.title || `Tier ${index + 1}`}</Text>
                                      <Text as="span" variant="bodySm" tone="subdued">
                                        Spend ${(tier.threshold / 100).toFixed(0)} to unlock
                                      </Text>
                                    </BlockStack>
                                  </InlineStack>
                                  <Button variant="plain" tone="critical" onClick={() => setRewardTiers(rewardTiers.filter(t => t.id !== tier.id))}>
                                    Remove
                                  </Button>
                                </InlineStack>

                                <Divider />

                                {/* Threshold and Reward Type Row */}
                                <InlineStack gap="300" wrap={false}>
                                  <div style={{ flex: 1 }}>
                                    <TextField
                                      label="Spending threshold"
                                      type="number"
                                      value={String(tier.threshold / 100)}
                                      onChange={(value) => setRewardTiers(rewardTiers.map(t => t.id === tier.id ? { ...t, threshold: Number(value) * 100 } : t))}
                                      autoComplete="off"
                                      prefix="$"
                                      helpText="Cart total to unlock this reward"
                                    />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <Select
                                      label="Reward type"
                                      options={[
                                        { label: "🚚 Free Shipping", value: "free_shipping" },
                                        { label: "💰 Percentage Discount", value: "discount_percent" },
                                        { label: "💵 Fixed Discount", value: "discount_fixed" },
                                        { label: "🎁 Free Gift", value: "free_gift" },
                                      ]}
                                      value={tier.rewardType}
                                      onChange={(value) => setRewardTiers(rewardTiers.map(t => t.id === tier.id ? { ...t, rewardType: value, rewardValue: "" } : t))}
                                    />
                                  </div>
                                </InlineStack>

                                {/* Conditional Reward Value Field */}
                                {tier.rewardType === "discount_percent" && (
                                  <TextField
                                    label="Discount percentage"
                                    type="number"
                                    value={tier.rewardValue || ""}
                                    onChange={(value) => setRewardTiers(rewardTiers.map(t => t.id === tier.id ? { ...t, rewardValue: value } : t))}
                                    autoComplete="off"
                                    suffix="%"
                                    helpText="e.g., 10 for 10% off"
                                  />
                                )}
                                {tier.rewardType === "discount_fixed" && (
                                  <TextField
                                    label="Discount amount"
                                    type="number"
                                    value={tier.rewardValue || ""}
                                    onChange={(value) => setRewardTiers(rewardTiers.map(t => t.id === tier.id ? { ...t, rewardValue: value } : t))}
                                    autoComplete="off"
                                    prefix="$"
                                    helpText="Fixed dollar amount off the order"
                                  />
                                )}
                                {tier.rewardType === "free_gift" && (
                                  <TextField
                                    label="Free gift product ID"
                                    value={tier.rewardValue || ""}
                                    onChange={(value) => setRewardTiers(rewardTiers.map(t => t.id === tier.id ? { ...t, rewardValue: value } : t))}
                                    autoComplete="off"
                                    helpText="Enter the Shopify product ID or handle for the free gift"
                                    placeholder="e.g., gift-with-purchase"
                                  />
                                )}

                                {/* Title and Message Row */}
                                <InlineStack gap="300" wrap={false}>
                                  <div style={{ flex: 1 }}>
                                    <TextField
                                      label="Display title"
                                      value={tier.title}
                                      onChange={(value) => setRewardTiers(rewardTiers.map(t => t.id === tier.id ? { ...t, title: value } : t))}
                                      autoComplete="off"
                                      placeholder="e.g., Free Shipping"
                                    />
                                  </div>
                                  <div style={{ width: 80 }}>
                                    <TextField
                                      label="Icon"
                                      value={tier.icon || ""}
                                      onChange={(value) => setRewardTiers(rewardTiers.map(t => t.id === tier.id ? { ...t, icon: value } : t))}
                                      autoComplete="off"
                                      placeholder="🎁"
                                      helpText="Emoji"
                                    />
                                  </div>
                                </InlineStack>

                                <TextField
                                  label="Unlock message"
                                  value={tier.message || ""}
                                  onChange={(value) => setRewardTiers(rewardTiers.map(t => t.id === tier.id ? { ...t, message: value } : t))}
                                  autoComplete="off"
                                  placeholder="e.g., You've unlocked FREE shipping!"
                                  helpText="Shown when customer reaches this tier"
                                />
                              </BlockStack>
                            </Card>
                          ))}
                        </BlockStack>
                      )}
                    </BlockStack>

                    {/* Progress Bar Preview */}
                    {rewardTiers.length > 0 && (
                      <>
                        <Divider />
                        <BlockStack gap="400">
                          <Text as="h3" variant="headingSm">Preview</Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            Drag the slider to see how the progress bar looks at different cart values
                          </Text>

                          {/* Simulated Cart Value Slider */}
                          <RangeSlider
                            label="Simulated cart value"
                            value={previewCartValue}
                            onChange={(value) => setPreviewCartValue(value as number)}
                            min={0}
                            max={Math.max(...rewardTiers.map(t => t.threshold)) * 1.2 / 100}
                            step={5}
                            output
                            suffix={<Text as="span" variant="bodyMd">${previewCartValue}</Text>}
                          />

                          {/* Progress Bar Preview */}
                          <div style={{
                            background: "#f9fafb",
                            borderRadius: 12,
                            padding: 16,
                            border: "1px solid #e5e7eb"
                          }}>
                            {/* Progress Text */}
                            <div style={{ textAlign: "center", marginBottom: 12, fontSize: 14 }}>
                              {(() => {
                                const sortedTiers = [...rewardTiers].sort((a, b) => a.threshold - b.threshold);
                                const cartCents = previewCartValue * 100;
                                const nextTier = sortedTiers.find(t => t.threshold > cartCents);
                                const currentTier = [...sortedTiers].reverse().find(t => t.threshold <= cartCents);

                                if (!nextTier && currentTier) {
                                  return <span style={{ color: "#059669", fontWeight: 600 }}>🎉 {currentTier.message || "All rewards unlocked!"}</span>;
                                } else if (nextTier) {
                                  const remaining = (nextTier.threshold - cartCents) / 100;
                                  return <span>Add <strong>${remaining.toFixed(2)}</strong> more to unlock: <strong>{nextTier.title}</strong></span>;
                                }
                                return <span>Add items to your cart to start earning rewards!</span>;
                              })()}
                            </div>

                            {/* Progress Bar */}
                            <div style={{
                              position: "relative",
                              height: 10,
                              background: formState.progressBarBgColor,
                              borderRadius: 5,
                              overflow: "visible",
                              marginBottom: 40
                            }}>
                              {/* Fill */}
                              <div style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                height: "100%",
                                width: `${Math.min((previewCartValue * 100 / Math.max(...rewardTiers.map(t => t.threshold))) * 100, 100)}%`,
                                background: formState.progressBarFillColor,
                                borderRadius: 5,
                                transition: "width 0.3s ease"
                              }} />

                              {/* Tier Markers */}
                              {[...rewardTiers].sort((a, b) => a.threshold - b.threshold).map((tier, index) => {
                                const maxThreshold = Math.max(...rewardTiers.map(t => t.threshold));
                                const position = (tier.threshold / maxThreshold) * 100;
                                const isUnlocked = previewCartValue * 100 >= tier.threshold;

                                return (
                                  <div
                                    key={tier.id}
                                    style={{
                                      position: "absolute",
                                      left: `${position}%`,
                                      top: "50%",
                                      transform: "translate(-50%, -50%)",
                                      transition: "all 0.3s ease"
                                    }}
                                  >
                                    <div style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: "50%",
                                      background: isUnlocked ? formState.progressBarFillColor : "#e5e7eb",
                                      border: `2px solid ${isUnlocked ? formState.progressBarFillColor : "#d1d5db"}`,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: 14,
                                      boxShadow: isUnlocked ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                                      transition: "all 0.3s ease"
                                    }}>
                                      {isUnlocked ? "✓" : tier.icon || "🎁"}
                                    </div>
                                    <div style={{
                                      position: "absolute",
                                      top: 32,
                                      left: "50%",
                                      transform: "translateX(-50%)",
                                      whiteSpace: "nowrap",
                                      fontSize: 11,
                                      color: isUnlocked ? "#059669" : "#6b7280",
                                      fontWeight: isUnlocked ? 600 : 400,
                                      textAlign: "center"
                                    }}>
                                      <div>{tier.title}</div>
                                      <div style={{ fontSize: 10, color: "#9ca3af" }}>${(tier.threshold / 100).toFixed(0)}</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </BlockStack>
                      </>
                    )}

                    <Divider />

                    {/* Progress Bar Colors */}
                    <Text as="h3" variant="headingSm">Progress bar colors</Text>
                    <InlineStack gap="400">
                      <TextField label="Background" value={formState.progressBarBgColor} onChange={(value) => updateField("progressBarBgColor", value)} autoComplete="off" prefix={<div style={{ width: 20, height: 20, background: formState.progressBarBgColor, borderRadius: 4, border: "1px solid #ccc" }} />} />
                      <TextField label="Fill color" value={formState.progressBarFillColor} onChange={(value) => updateField("progressBarFillColor", value)} autoComplete="off" prefix={<div style={{ width: 20, height: 20, background: formState.progressBarFillColor, borderRadius: 4, border: "1px solid #ccc" }} />} />
                    </InlineStack>
                  </>
                )}
              </BlockStack>
            </Card>
          )}

          {/* Buy X Get Y Section */}
          {activeSection === "bxgy" && (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Buy X Get Y</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Create quantity-based promotions like "Buy 3 Get 2 Free" to encourage customers to add more items
                </Text>
                <Divider />

                <Checkbox
                  label="Enable Buy X Get Y progress bar"
                  checked={formState.bxgyEnabled}
                  onChange={(checked) => updateField("bxgyEnabled", checked)}
                />

                {formState.bxgyEnabled && (
                  <>
                    {/* BXGY Offers Configuration */}
                    <BlockStack gap="400">
                      <InlineStack align="space-between">
                        <Text as="span" variant="headingSm">Offers</Text>
                        <Button
                          onClick={() => {
                            setBxgyOffers([...bxgyOffers, {
                              id: `new-${Date.now()}`,
                              title: "Buy More, Save More",
                              buyQuantity: 3,
                              getQuantity: 1,
                              rewardMode: "cheapest_in_cart",
                              appliesToType: "all",
                              collectionId: undefined,
                              productIds: undefined,
                              selectionProducts: [],
                              selectionDisplayStyle: "list",
                              selectionTitle: "Choose your free item(s)",
                              automaticProductId: undefined,
                              automaticProductHandle: undefined,
                              message: "Add {remaining} more to get {free} free!",
                              completedMessage: "🎉 You've unlocked {free} free item(s)!",
                              sortOrder: bxgyOffers.length,
                            }]);
                          }}
                        >
                          Add offer
                        </Button>
                      </InlineStack>

                      {bxgyOffers.length === 0 ? (
                        <Banner tone="info">
                          <p>Add a Buy X Get Y offer to create a quantity-based progress bar.</p>
                        </Banner>
                      ) : (
                        <BlockStack gap="400">
                          {bxgyOffers.map((offer, index) => (
                            <Card key={offer.id} padding="400" background="bg-surface-secondary">
                              <BlockStack gap="400">
                                {/* Offer Header */}
                                <InlineStack align="space-between" blockAlign="center">
                                  <InlineStack gap="200" blockAlign="center">
                                    <div style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: "50%",
                                      background: formState.bxgyFillColor,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "18px",
                                      color: "white",
                                      fontWeight: 700
                                    }}>
                                      {offer.buyQuantity}
                                    </div>
                                    <BlockStack gap="0">
                                      <Text as="span" variant="headingSm">{offer.title}</Text>
                                      <Text as="span" variant="bodySm" tone="subdued">
                                        Buy {offer.buyQuantity}, Get {offer.getQuantity} Free
                                      </Text>
                                    </BlockStack>
                                  </InlineStack>
                                  <Button variant="plain" tone="critical" onClick={() => setBxgyOffers(bxgyOffers.filter(o => o.id !== offer.id))}>
                                    Remove
                                  </Button>
                                </InlineStack>

                                <Divider />

                                <TextField
                                  label="Offer title"
                                  value={offer.title}
                                  onChange={(value) => setBxgyOffers(bxgyOffers.map(o => o.id === offer.id ? { ...o, title: value } : o))}
                                  autoComplete="off"
                                  placeholder="e.g., Buy More, Save More"
                                />

                                {/* Buy/Get Quantities */}
                                <InlineStack gap="300" wrap={false}>
                                  <div style={{ flex: 1 }}>
                                    <TextField
                                      label="Buy quantity"
                                      type="number"
                                      value={String(offer.buyQuantity)}
                                      onChange={(value) => setBxgyOffers(bxgyOffers.map(o => o.id === offer.id ? { ...o, buyQuantity: parseInt(value) || 1 } : o))}
                                      autoComplete="off"
                                      helpText="Items needed to qualify"
                                    />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <TextField
                                      label="Get quantity (free)"
                                      type="number"
                                      value={String(offer.getQuantity)}
                                      onChange={(value) => setBxgyOffers(bxgyOffers.map(o => o.id === offer.id ? { ...o, getQuantity: parseInt(value) || 1 } : o))}
                                      autoComplete="off"
                                      helpText="Free items rewarded"
                                    />
                                  </div>
                                </InlineStack>

                                <Divider />

                                {/* Reward Mode Selection */}
                                <Select
                                  label="How customers get free items"
                                  options={[
                                    { label: "Cheapest items in cart become free", value: "cheapest_in_cart" },
                                    { label: "Customer picks from a selection", value: "selection" },
                                    { label: "Automatic - preset item added to cart", value: "automatic" },
                                  ]}
                                  value={offer.rewardMode}
                                  onChange={(value) => setBxgyOffers(bxgyOffers.map(o => o.id === offer.id ? { ...o, rewardMode: value } : o))}
                                  helpText={
                                    offer.rewardMode === "cheapest_in_cart"
                                      ? "The cheapest items in the cart will automatically be marked as free"
                                      : offer.rewardMode === "selection"
                                      ? "Customer will choose their free items from a preset selection"
                                      : "A preset product will be automatically added to the cart"
                                  }
                                />

                                {/* Selection Mode Options */}
                                {offer.rewardMode === "selection" && (
                                  <Card padding="300" background="bg-surface">
                                    <BlockStack gap="300">
                                      <Text as="span" variant="headingSm">Selection Mode Settings</Text>
                                      <TextField
                                        label="Selection title"
                                        value={offer.selectionTitle}
                                        onChange={(value) => setBxgyOffers(bxgyOffers.map(o => o.id === offer.id ? { ...o, selectionTitle: value } : o))}
                                        autoComplete="off"
                                        placeholder="Choose your free item(s)"
                                      />
                                      <Select
                                        label="Display style"
                                        options={[
                                          { label: "Grid", value: "grid" },
                                          { label: "Carousel", value: "carousel" },
                                          { label: "List", value: "list" },
                                        ]}
                                        value={offer.selectionDisplayStyle}
                                        onChange={(value) => setBxgyOffers(bxgyOffers.map(o => o.id === offer.id ? { ...o, selectionDisplayStyle: value } : o))}
                                      />
                                      <BlockStack gap="200">
                                        <Text as="span" variant="bodyMd">Free products for selection</Text>
                                        <Button onClick={() => openBxgySelectionPicker(offer.id)} icon={PlusCircleIcon}>
                                          Add Products
                                        </Button>
                                        {offer.selectionProducts.length === 0 ? (
                                          <Text as="span" variant="bodySm" tone="subdued">No products selected. Add products customers can choose from.</Text>
                                        ) : (
                                          <BlockStack gap="100">
                                            {offer.selectionProducts.map((product, productIndex) => (
                                              <Card key={product.productHandle + productIndex} padding="200">
                                                <InlineStack align="space-between" blockAlign="center">
                                                  <InlineStack gap="200" blockAlign="center">
                                                    {product.image && (
                                                      <img
                                                        src={product.image}
                                                        alt={product.title}
                                                        style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }}
                                                      />
                                                    )}
                                                    <Text as="span" variant="bodyMd">{product.title}</Text>
                                                  </InlineStack>
                                                  <Button
                                                    variant="plain"
                                                    tone="critical"
                                                    onClick={() => setBxgyOffers(bxgyOffers.map(o =>
                                                      o.id === offer.id
                                                        ? { ...o, selectionProducts: o.selectionProducts.filter((_, i) => i !== productIndex) }
                                                        : o
                                                    ))}
                                                  >
                                                    Remove
                                                  </Button>
                                                </InlineStack>
                                              </Card>
                                            ))}
                                          </BlockStack>
                                        )}
                                      </BlockStack>
                                    </BlockStack>
                                  </Card>
                                )}

                                {/* Automatic Mode Options */}
                                {offer.rewardMode === "automatic" && (
                                  <Card padding="300" background="bg-surface">
                                    <BlockStack gap="300">
                                      <Text as="span" variant="headingSm">Automatic Mode Settings</Text>
                                      <BlockStack gap="200">
                                        <Text as="span" variant="bodyMd">Free product to auto-add</Text>
                                        {!offer.automaticProductHandle ? (
                                          <>
                                            <Button onClick={() => openBxgyAutomaticPicker(offer.id)} icon={PlusCircleIcon}>
                                              Select Product
                                            </Button>
                                            <Text as="span" variant="bodySm" tone="subdued">Select the product that will be automatically added to cart.</Text>
                                          </>
                                        ) : (
                                          <Card padding="200">
                                            <InlineStack align="space-between" blockAlign="center">
                                              <InlineStack gap="200" blockAlign="center">
                                                {offer.automaticProductImage && (
                                                  <img
                                                    src={offer.automaticProductImage}
                                                    alt={offer.automaticProductTitle || offer.automaticProductHandle}
                                                    style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }}
                                                  />
                                                )}
                                                <Text as="span" variant="bodyMd">{offer.automaticProductTitle || offer.automaticProductHandle}</Text>
                                              </InlineStack>
                                              <InlineStack gap="100">
                                                <Button
                                                  variant="plain"
                                                  onClick={() => openBxgyAutomaticPicker(offer.id)}
                                                >
                                                  Change
                                                </Button>
                                                <Button
                                                  variant="plain"
                                                  tone="critical"
                                                  onClick={() => setBxgyOffers(bxgyOffers.map(o =>
                                                    o.id === offer.id
                                                      ? { ...o, automaticProductId: undefined, automaticProductHandle: undefined, automaticProductTitle: undefined, automaticProductImage: undefined }
                                                      : o
                                                  ))}
                                                >
                                                  Remove
                                                </Button>
                                              </InlineStack>
                                            </InlineStack>
                                          </Card>
                                        )}
                                      </BlockStack>
                                    </BlockStack>
                                  </Card>
                                )}

                                {/* Cheapest Mode Info */}
                                {offer.rewardMode === "cheapest_in_cart" && (
                                  <Banner tone="info">
                                    <p>The {offer.getQuantity} cheapest item{offer.getQuantity > 1 ? 's' : ''} in the cart will be marked as free when the customer has {offer.buyQuantity} or more items.</p>
                                  </Banner>
                                )}

                                <Divider />

                                {/* Applies To */}
                                <Select
                                  label="Qualifying products (count toward Buy X)"
                                  options={[
                                    { label: "All products", value: "all" },
                                    { label: "Specific collection", value: "collection" },
                                    { label: "Specific products", value: "products" },
                                  ]}
                                  value={offer.appliesToType}
                                  onChange={(value) => setBxgyOffers(bxgyOffers.map(o => o.id === offer.id ? { ...o, appliesToType: value } : o))}
                                  helpText="Which products count toward the buy requirement"
                                />

                                {offer.appliesToType === "collection" && (
                                  <TextField
                                    label="Collection ID"
                                    value={offer.collectionId || ""}
                                    onChange={(value) => setBxgyOffers(bxgyOffers.map(o => o.id === offer.id ? { ...o, collectionId: value } : o))}
                                    autoComplete="off"
                                    placeholder="e.g., 12345678"
                                    helpText="Shopify collection ID"
                                  />
                                )}

                                {/* Messages */}
                                <TextField
                                  label="Progress message"
                                  value={offer.message}
                                  onChange={(value) => setBxgyOffers(bxgyOffers.map(o => o.id === offer.id ? { ...o, message: value } : o))}
                                  autoComplete="off"
                                  helpText="Use {remaining} for items left, {free} for free items count"
                                />

                                <TextField
                                  label="Completed message"
                                  value={offer.completedMessage}
                                  onChange={(value) => setBxgyOffers(bxgyOffers.map(o => o.id === offer.id ? { ...o, completedMessage: value } : o))}
                                  autoComplete="off"
                                  helpText="Shown when offer is unlocked"
                                />
                              </BlockStack>
                            </Card>
                          ))}
                        </BlockStack>
                      )}
                    </BlockStack>

                    {/* BXGY Preview */}
                    {bxgyOffers.length > 0 && (
                      <>
                        <Divider />
                        <BlockStack gap="400">
                          <Text as="h3" variant="headingSm">Preview</Text>

                          <RangeSlider
                            label="Simulated quantity in cart"
                            value={previewBxgyQuantity}
                            onChange={(value) => setPreviewBxgyQuantity(value as number)}
                            min={0}
                            max={(bxgyOffers[0]?.buyQuantity || 3) + (bxgyOffers[0]?.getQuantity || 1) + 1}
                            step={1}
                            output
                            suffix={<Text as="span" variant="bodyMd">{previewBxgyQuantity} items</Text>}
                          />

                          {/* BXGY Progress Bar Preview */}
                          <div style={{
                            background: "#f9fafb",
                            borderRadius: 12,
                            padding: 16,
                            border: "1px solid #e5e7eb"
                          }}>
                            {bxgyOffers.map(offer => {
                              const totalSlots = offer.buyQuantity + offer.getQuantity;
                              const filledSlots = Math.min(previewBxgyQuantity, offer.buyQuantity);
                              const freeUnlocked = previewBxgyQuantity >= offer.buyQuantity;
                              const remaining = Math.max(0, offer.buyQuantity - previewBxgyQuantity);

                              // Calculate free items "in cart" - items beyond the buy threshold
                              const freeItemsInCart = freeUnlocked
                                ? Math.min(previewBxgyQuantity - offer.buyQuantity, offer.getQuantity)
                                : 0;
                              const remainingFree = offer.getQuantity - freeItemsInCart;
                              const rewardMode = offer.rewardMode || 'cheapest_in_cart';

                              // Determine message based on mode
                              let message;
                              if (!freeUnlocked) {
                                message = `Add ${remaining} more`;
                              } else if (rewardMode === 'cheapest_in_cart') {
                                message = `🎉 ${offer.getQuantity} free!`;
                              } else if (remainingFree > 0) {
                                message = `🎁 ${remainingFree} free to claim`;
                              } else {
                                message = `🎉 ${freeItemsInCart} free!`;
                              }

                              return (
                                <div key={offer.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  {/* Compact pill-shaped progress bar */}
                                  <div style={{ display: "flex", flex: 1, maxWidth: totalSlots * 70 }}>
                                    {Array.from({ length: offer.buyQuantity }).map((_, i) => {
                                      const isFilled = i < filledSlots;
                                      const isFirst = i === 0;
                                      const isLast = i === totalSlots - 1;
                                      return (
                                        <div key={i} style={{
                                          flex: 1,
                                          maxWidth: 70,
                                          height: 26,
                                          background: isFilled ? formState.bxgyFillColor : formState.bxgyBgColor,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: 11,
                                          fontWeight: 600,
                                          color: isFilled ? "#fff" : "#374151",
                                          borderRadius: isFirst ? "13px 0 0 13px" : isLast ? "0 13px 13px 0" : 0,
                                          borderRight: i < totalSlots - 1 ? "1px solid rgba(255,255,255,0.3)" : "none",
                                        }}>{i + 1}</div>
                                      );
                                    })}
                                    {Array.from({ length: offer.getQuantity }).map((_, i) => {
                                      const slotIndex = offer.buyQuantity + i;
                                      const isLast = slotIndex === totalSlots - 1;
                                      // For cheapest_in_cart: highlight immediately when unlocked
                                      // For selection/automatic: only highlight when free item is "in cart"
                                      const isFreeEarned = rewardMode === 'cheapest_in_cart'
                                        ? freeUnlocked
                                        : (i + 1) <= freeItemsInCart;
                                      return (
                                        <div key={`free-${i}`} style={{
                                          flex: 1,
                                          maxWidth: 70,
                                          height: 26,
                                          background: isFreeEarned ? "#10b981" : formState.bxgyBgColor,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: 9,
                                          fontWeight: 700,
                                          color: isFreeEarned ? "#fff" : "#6b7280",
                                          borderRadius: isLast ? "0 13px 13px 0" : 0,
                                        }}>FREE</div>
                                      );
                                    })}
                                  </div>
                                  {/* Message */}
                                  <div style={{
                                    fontSize: 12,
                                    color: freeUnlocked ? (remainingFree > 0 && rewardMode !== 'cheapest_in_cart' ? "#f59e0b" : "#059669") : "#374151",
                                    fontWeight: 500,
                                  }}>
                                    {message}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </BlockStack>
                      </>
                    )}

                    <Divider />

                    {/* BXGY Colors */}
                    <Text as="h3" variant="headingSm">Progress bar colors</Text>
                    <InlineStack gap="400">
                      <TextField label="Background" value={formState.bxgyBgColor} onChange={(value) => updateField("bxgyBgColor", value)} autoComplete="off" prefix={<div style={{ width: 20, height: 20, background: formState.bxgyBgColor, borderRadius: 4, border: "1px solid #ccc" }} />} />
                      <TextField label="Fill color" value={formState.bxgyFillColor} onChange={(value) => updateField("bxgyFillColor", value)} autoComplete="off" prefix={<div style={{ width: 20, height: 20, background: formState.bxgyFillColor, borderRadius: 4, border: "1px solid #ccc" }} />} />
                    </InlineStack>
                  </>
                )}
              </BlockStack>
            </Card>
          )}

          {/* Cart Items Section */}
          {activeSection === "cart-items" && (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Cart Items</Text>
                <Divider />
                <Checkbox label="Show product image" checked={formState.showItemImage} onChange={(checked) => updateField("showItemImage", checked)} />
                <Checkbox label="Show variant info" checked={formState.showItemVariant} onChange={(checked) => updateField("showItemVariant", checked)} />
                <Checkbox label="Show vendor" checked={formState.showItemVendor} onChange={(checked) => updateField("showItemVendor", checked)} />
                <Checkbox label="Show quantity selector" checked={formState.showQuantitySelector} onChange={(checked) => updateField("showQuantitySelector", checked)} />
                <Checkbox label="Show remove button" checked={formState.showRemoveButton} onChange={(checked) => updateField("showRemoveButton", checked)} />
                <Divider />
                <RangeSlider label="Image size" value={formState.itemImageSize} onChange={(value) => updateField("itemImageSize", value)} min={40} max={120} step={10} output suffix={<Text as="span" variant="bodyMd">{formState.itemImageSize}px</Text>} />
              </BlockStack>
            </Card>
          )}

          {/* Upsells Section */}
          {activeSection === "upsells" && (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Upsells</Text>
                  <Checkbox label="" labelHidden checked={formState.upsellsEnabled} onChange={(checked) => updateField("upsellsEnabled", checked)} />
                </InlineStack>
                <Divider />

                {formState.upsellsEnabled && (
                  <>
                    <TextField label="Section title" value={formState.upsellsTitle} onChange={(value) => updateField("upsellsTitle", value)} autoComplete="off" />
                    <Select label="Display style" options={[{ label: "Carousel", value: "carousel" }, { label: "Grid", value: "grid" }, { label: "List", value: "list" }]} value={formState.upsellsStyle} onChange={(value) => updateField("upsellsStyle", value)} />

                    <Divider />
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">Products</Text>
                      <Button size="slim" onClick={openProductPicker}>Add products</Button>
                    </InlineStack>

                    {upsells.length === 0 ? (
                      <Banner tone="info">Add products to recommend to customers.</Banner>
                    ) : (
                      <BlockStack gap="200">
                        {upsells.map((upsell, index) => (
                          <Card key={upsell.id} padding="200">
                            <InlineStack align="space-between" blockAlign="center">
                              <Text as="span" variant="bodyMd">{upsell.title}</Text>
                              <Button variant="plain" tone="critical" onClick={() => setUpsells(upsells.filter((_, i) => i !== index))}>Remove</Button>
                            </InlineStack>
                          </Card>
                        ))}
                      </BlockStack>
                    )}
                  </>
                )}
              </BlockStack>
            </Card>
          )}

          {/* Add-ons Section */}
          {activeSection === "addons" && (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Add-ons</Text>
                  <Checkbox label="" labelHidden checked={formState.addOnsEnabled} onChange={(checked) => updateField("addOnsEnabled", checked)} />
                </InlineStack>
                <Divider />

                {formState.addOnsEnabled && (
                  <>
                    <TextField label="Section title" value={formState.addOnsTitle} onChange={(value) => updateField("addOnsTitle", value)} autoComplete="off" />

                    <Divider />
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">Products</Text>
                      <Button size="slim" onClick={openAddOnPicker}>Add products</Button>
                    </InlineStack>

                    {addOns.length === 0 ? (
                      <Banner tone="info">Add products like shipping protection or gift wrap.</Banner>
                    ) : (
                      <BlockStack gap="200">
                        {addOns.map((addon, index) => (
                          <Card key={addon.id} padding="300">
                            <BlockStack gap="200">
                              <InlineStack align="space-between" blockAlign="center">
                                <InlineStack gap="200" blockAlign="center">
                                  <Text as="span" variant="headingMd">{addon.icon}</Text>
                                  <Text as="span" variant="bodyMd">{addon.title}</Text>
                                </InlineStack>
                                <Button variant="plain" tone="critical" onClick={() => setAddOns(addOns.filter((_, i) => i !== index))}>Remove</Button>
                              </InlineStack>
                              <InlineStack gap="300">
                                <TextField label="Name" value={addon.title} onChange={(value) => setAddOns(addOns.map((a, i) => i === index ? { ...a, title: value } : a))} autoComplete="off" />
                                <TextField label="Price" type="number" value={String(addon.price / 100)} onChange={(value) => setAddOns(addOns.map((a, i) => i === index ? { ...a, price: Math.round(parseFloat(value || "0") * 100) } : a))} autoComplete="off" prefix="$" />
                                <Select label="Icon" options={[{ label: "🛡️ Shield", value: "🛡️" }, { label: "📦 Package", value: "📦" }, { label: "🎁 Gift", value: "🎁" }, { label: "⚡ Lightning", value: "⚡" }]} value={addon.icon || "🛡️"} onChange={(value) => setAddOns(addOns.map((a, i) => i === index ? { ...a, icon: value } : a))} />
                              </InlineStack>
                            </BlockStack>
                          </Card>
                        ))}
                      </BlockStack>
                    )}
                  </>
                )}
              </BlockStack>
            </Card>
          )}

          {/* Checkout Section */}
          {activeSection === "checkout" && (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Cart Summary</Text>
                <Divider />
                <TextField label="Checkout button text" value={formState.checkoutBtnText} onChange={(value) => updateField("checkoutBtnText", value)} autoComplete="off" />
                <Checkbox label="Show subtotal" checked={formState.showSubtotal} onChange={(checked) => updateField("showSubtotal", checked)} />
                <TextField label="Subtotal label" value={formState.subtotalLabel} onChange={(value) => updateField("subtotalLabel", value)} autoComplete="off" />
                <TextField label="Tax/shipping note" value={formState.taxShippingNote} onChange={(value) => updateField("taxShippingNote", value)} autoComplete="off" />
                <Checkbox label="Show 'View Cart' link" checked={formState.showViewCartLink} onChange={(checked) => updateField("showViewCartLink", checked)} />
              </BlockStack>
            </Card>
          )}

          {/* Settings Section */}
          {activeSection === "settings" && (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Settings</Text>
                <Divider />
                <Checkbox label="Enable PopCart drawer" checked={formState.enabled} onChange={(checked) => updateField("enabled", checked)} helpText="When disabled, the default theme cart will be used" />
                <Divider />
                <Text as="h3" variant="headingSm">Empty cart</Text>
                <TextField label="Empty cart message" value={formState.emptyCartText} onChange={(value) => updateField("emptyCartText", value)} autoComplete="off" />
                <TextField label="Button text" value={formState.emptyCartBtnText} onChange={(value) => updateField("emptyCartBtnText", value)} autoComplete="off" />
                <TextField label="Button URL" value={formState.emptyCartBtnUrl} onChange={(value) => updateField("emptyCartBtnUrl", value)} autoComplete="off" />
              </BlockStack>
            </Card>
          )}
        </div>
      </div>

      {/* Right Preview Panel */}
      <div style={{
        width: 400,
        background: "#e8e8e8",
        borderLeft: "1px solid #e1e3e5",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}>
        {/* Preview Cart */}
        <div style={{
          flex: 1,
          padding: 20,
          overflow: "auto",
        }}>
          <div style={{
            background: formState.drawerBgColor,
            borderRadius: 8,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            border: "1px solid #e5e7eb",
          }}>
            {/* Cart Header */}
            <div style={{
              padding: "14px 16px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: formState.drawerBgColor,
            }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: formState.drawerTextColor }}>
                {formState.cartTitle} <span style={{ fontWeight: 400 }}>(2)</span>
              </span>
              <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke={formState.drawerTextColor} strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Announcement Bar with Timer */}
            {formState.announcementEnabled && (
              <div style={{
                padding: "8px 16px",
                background: formState.announcementBgColor,
                color: formState.announcementTextColor,
                fontSize: 12,
                textAlign: "center",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}>
                <span>{formState.announcementText.replace("{TIMER}", "")}</span>
                {formState.timerEnabled && (
                  <span style={{
                    background: "rgba(255,255,255,0.2)",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontFamily: "monospace",
                    fontWeight: 600,
                  }}>7:38:56</span>
                )}
              </div>
            )}

            {/* Progress Bar */}
            {formState.progressBarEnabled && (
              <div style={{ padding: "10px 16px", background: formState.drawerBgColor }}>
                <p style={{
                  fontSize: 12,
                  color: formState.progressBarFillColor,
                  marginBottom: 6,
                  textAlign: "center",
                  fontWeight: 500,
                }}>
                  🎉 You've unlocked FREE shipping!
                </p>
                <div style={{ height: 4, background: formState.progressBarBgColor, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "100%", background: formState.progressBarFillColor, borderRadius: 2 }} />
                </div>
              </div>
            )}

            {/* BXGY Progress Bar Preview */}
            {formState.bxgyEnabled && bxgyOffers.length > 0 && (
              <div style={{ padding: "10px 16px", borderBottom: "1px solid #f0f0f0" }}>
                {bxgyOffers.map(offer => {
                  const filledSlots = Math.min(previewBxgyQuantity, offer.buyQuantity);
                  const freeUnlocked = previewBxgyQuantity >= offer.buyQuantity;
                  const remaining = Math.max(0, offer.buyQuantity - previewBxgyQuantity);
                  const totalSlots = offer.buyQuantity + offer.getQuantity;

                  // Calculate free items "in cart" - items beyond the buy threshold
                  const freeItemsInCart = freeUnlocked
                    ? Math.min(previewBxgyQuantity - offer.buyQuantity, offer.getQuantity)
                    : 0;
                  const remainingFree = offer.getQuantity - freeItemsInCart;
                  const rewardMode = offer.rewardMode || 'cheapest_in_cart';

                  // Determine message based on mode
                  let message;
                  if (!freeUnlocked) {
                    message = `Add ${remaining} more`;
                  } else if (rewardMode === 'cheapest_in_cart') {
                    message = `🎉 ${offer.getQuantity} free!`;
                  } else if (remainingFree > 0) {
                    message = `🎁 ${remainingFree} free to claim`;
                  } else {
                    message = `🎉 ${freeItemsInCart} free!`;
                  }

                  return (
                    <div key={offer.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {/* Compact pill-shaped progress bar */}
                      <div style={{ display: "flex", flex: 1, maxWidth: totalSlots * 70 }}>
                        {Array.from({ length: offer.buyQuantity }).map((_, i) => {
                          const isFilled = i < filledSlots;
                          const isFirst = i === 0;
                          const isLast = i === totalSlots - 1;
                          return (
                            <div key={i} style={{
                              flex: 1,
                              maxWidth: 70,
                              height: 26,
                              background: isFilled ? formState.bxgyFillColor : formState.bxgyBgColor,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 600,
                              color: isFilled ? "#fff" : formState.drawerTextColor,
                              borderRadius: isFirst ? "13px 0 0 13px" : isLast ? "0 13px 13px 0" : 0,
                              borderRight: i < totalSlots - 1 ? "1px solid rgba(255,255,255,0.3)" : "none",
                            }}>{i + 1}</div>
                          );
                        })}
                        {Array.from({ length: offer.getQuantity }).map((_, i) => {
                          const slotIndex = offer.buyQuantity + i;
                          const isLast = slotIndex === totalSlots - 1;
                          // For cheapest_in_cart: highlight immediately when unlocked
                          // For selection/automatic: only highlight when free item is "in cart"
                          const isFreeEarned = rewardMode === 'cheapest_in_cart'
                            ? freeUnlocked
                            : (i + 1) <= freeItemsInCart;
                          return (
                            <div key={`free-${i}`} style={{
                              flex: 1,
                              maxWidth: 70,
                              height: 26,
                              background: isFreeEarned ? "#10b981" : formState.bxgyBgColor,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 9,
                              fontWeight: 700,
                              color: isFreeEarned ? "#fff" : "#6b7280",
                              borderRadius: isLast ? "0 13px 13px 0" : 0,
                            }}>FREE</div>
                          );
                        })}
                      </div>
                      {/* Message */}
                      <div style={{
                        fontSize: 11,
                        color: freeUnlocked ? (remainingFree > 0 && rewardMode !== 'cheapest_in_cart' ? "#f59e0b" : formState.bxgyFillColor) : formState.drawerTextColor,
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}>
                        {message}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* BXGY Selection Picker Preview */}
            {formState.bxgyEnabled && bxgyOffers.length > 0 && bxgyOffers[0]?.rewardMode === 'selection' && previewBxgyQuantity >= bxgyOffers[0]?.buyQuantity && (
              <div style={{ padding: "10px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: formState.drawerTextColor }}>
                    {bxgyOffers[0]?.selectionTitle || "Choose your free item(s)"}
                  </span>
                  <span style={{ fontSize: 11, color: formState.bxgyFillColor, fontWeight: 500 }}>
                    {bxgyOffers[0]?.getQuantity} free item{bxgyOffers[0]?.getQuantity > 1 ? 's' : ''} remaining
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[1, 2].map(i => (
                    <div key={i} style={{
                      flex: 1,
                      background: "#fff",
                      borderRadius: 8,
                      padding: 8,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      border: "1px solid #e5e7eb",
                    }}>
                      <div style={{
                        width: 50,
                        height: 50,
                        background: `linear-gradient(135deg, hsl(${i * 80}, 70%, 60%) 0%, hsl(${i * 80 + 40}, 70%, 50%) 100%)`,
                        borderRadius: 6,
                      }} />
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "#6b7280" }}>Sample Product {i}</div>
                        <div style={{ fontSize: 10 }}>
                          <span style={{ textDecoration: "line-through", color: "#9ca3af" }}>$49.99</span>
                          <span style={{ color: formState.bxgyFillColor, fontWeight: 600, marginLeft: 4 }}>FREE</span>
                        </div>
                      </div>
                      <button style={{
                        padding: "4px 10px",
                        background: formState.bxgyFillColor,
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}>Add Free</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cart Items */}
            <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
              {/* Sample Item */}
              <div style={{ display: "flex", gap: 12, padding: "12px 16px", borderBottom: "1px solid #f0f0f0" }}>
                {formState.showItemImage && (
                  <div style={{
                    width: formState.itemImageSize,
                    height: formState.itemImageSize,
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    borderRadius: 6,
                    flexShrink: 0,
                  }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: formState.drawerTextColor }}>Sample Product</div>
                    {formState.showRemoveButton && (
                      <button style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 3L3 9M3 3L9 9" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    )}
                  </div>
                  {formState.showItemVariant && <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Size: Medium</div>}
                  <div style={{ fontSize: 13, fontWeight: 600, color: formState.drawerTextColor, marginBottom: 8 }}>$729.95</div>
                  {formState.showQuantitySelector && (
                    <div style={{ display: "inline-flex", border: "1px solid #e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                      <button style={{ width: 26, height: 26, border: "none", background: "#f9fafb", cursor: "pointer", fontSize: 14 }}>−</button>
                      <span style={{ width: 30, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", fontSize: 12, fontWeight: 500 }}>2</span>
                      <button style={{ width: 26, height: 26, border: "none", background: "#f9fafb", cursor: "pointer", fontSize: 14 }}>+</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Spacer to push add-ons and upsells to bottom */}
              <div style={{ flex: 1 }} />

              {/* Add-ons Preview - at bottom */}
              {formState.addOnsEnabled && addOns.length > 0 && (
                <div style={{ padding: "10px 16px", background: "#f9fafb", borderTop: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>{formState.addOnsTitle}</div>
                  {addOns.map((addon, i) => (
                    <div key={i} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "#fff",
                      borderRadius: 6,
                      marginBottom: i < addOns.length - 1 ? 6 : 0,
                      border: "1px solid #e5e7eb",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 16 }}>{addon.icon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: formState.drawerTextColor }}>{addon.title}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{formatMoney(addon.price)}</div>
                        </div>
                      </div>
                      <div style={{
                        width: 40,
                        height: 22,
                        background: "#d1d5db",
                        borderRadius: 11,
                        position: "relative",
                        cursor: "pointer",
                      }}>
                        <div style={{
                          width: 18,
                          height: 18,
                          background: "#fff",
                          borderRadius: "50%",
                          position: "absolute",
                          top: 2,
                          left: 2,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upsells Preview - at bottom, shows actual upsells */}
              {formState.upsellsEnabled && upsells.length > 0 && (
                <div style={{ padding: "10px 16px", borderTop: formState.addOnsEnabled && addOns.length > 0 ? "none" : "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: formState.drawerTextColor, marginBottom: 10 }}>{formState.upsellsTitle}</div>

                  {/* Carousel Style */}
                  {formState.upsellsStyle === "carousel" && (
                    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                      {upsells.map((upsell, i) => (
                        <div key={upsell.id} style={{
                          background: "#f9fafb",
                          borderRadius: 6,
                          padding: 8,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                          minWidth: 90,
                          flexShrink: 0,
                        }}>
                          <div style={{
                            width: 50,
                            height: 50,
                            background: `linear-gradient(135deg, hsl(${(i * 60) % 360}, 70%, 60%) 0%, hsl(${(i * 60 + 40) % 360}, 70%, 50%) 100%)`,
                            borderRadius: 4,
                          }} />
                          <div style={{ textAlign: "center", width: "100%" }}>
                            <div style={{ fontSize: 10, fontWeight: 500, color: formState.drawerTextColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {upsell.title.length > 12 ? upsell.title.substring(0, 12) + "..." : upsell.title}
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: formState.drawerTextColor }}>${(600 + i * 50).toFixed(2)}</div>
                          </div>
                          <button style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            background: formState.checkoutBtnBgColor,
                            border: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 2V8M2 5H8" stroke={formState.checkoutBtnTextColor} strokeWidth="2" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Grid Style */}
                  {formState.upsellsStyle === "grid" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {upsells.map((upsell, i) => (
                        <div key={upsell.id} style={{
                          background: "#f9fafb",
                          borderRadius: 6,
                          padding: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}>
                          <div style={{
                            width: 40,
                            height: 40,
                            background: `linear-gradient(135deg, hsl(${(i * 60) % 360}, 70%, 60%) 0%, hsl(${(i * 60 + 40) % 360}, 70%, 50%) 100%)`,
                            borderRadius: 4,
                            flexShrink: 0,
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 500, color: formState.drawerTextColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {upsell.title.length > 10 ? upsell.title.substring(0, 10) + "..." : upsell.title}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: formState.drawerTextColor }}>${(600 + i * 50).toFixed(2)}</div>
                          </div>
                          <button style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: formState.checkoutBtnBgColor,
                            border: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2.5V9.5M2.5 6H9.5" stroke={formState.checkoutBtnTextColor} strokeWidth="2" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* List Style */}
                  {formState.upsellsStyle === "list" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {upsells.map((upsell, i) => (
                        <div key={upsell.id} style={{
                          background: "#f9fafb",
                          borderRadius: 6,
                          padding: 10,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}>
                          <div style={{
                            width: 48,
                            height: 48,
                            background: `linear-gradient(135deg, hsl(${(i * 60) % 360}, 70%, 60%) 0%, hsl(${(i * 60 + 40) % 360}, 70%, 50%) 100%)`,
                            borderRadius: 4,
                            flexShrink: 0,
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: formState.drawerTextColor, marginBottom: 2 }}>
                              {upsell.title}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: formState.drawerTextColor }}>${(600 + i * 50).toFixed(2)}</div>
                          </div>
                          <button style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: formState.checkoutBtnBgColor,
                            border: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3V11M3 7H11" stroke={formState.checkoutBtnTextColor} strokeWidth="2" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", background: formState.drawerBgColor }}>
              {formState.showSubtotal && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: formState.drawerTextColor }}>{formState.subtotalLabel}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: formState.drawerTextColor }}>$1,459.90</span>
                </div>
              )}
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>{formState.taxShippingNote}</p>
              <button style={{
                width: "100%",
                padding: "12px",
                background: formState.checkoutBtnBgColor,
                color: formState.checkoutBtnTextColor,
                border: "none",
                borderRadius: formState.drawerBorderRadius,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}>
                {formState.checkoutBtnText}
              </button>
              {formState.showViewCartLink && (
                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <a style={{ fontSize: 12, color: "#6b7280", textDecoration: "underline", cursor: "pointer" }}>View Cart</a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
