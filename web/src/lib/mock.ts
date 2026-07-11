// Mock backend: the entire app works offline (`npm run dev`, zero config,
// no AWS). Shapes and error semantics mirror the real API exactly —
// including the checkout saga's 402 compensation path, which is the demo
// centerpiece. State is in-memory and resets on reload.

import { ApiError, type ApiClient, type Rental, type Tool } from "./types";
import { priceFor } from "./types";

export const MOCK_USER = { sub: "mock-user", email: "you@toolshare.dev", groups: [] as string[] };
export const MOCK_VERIFY_CODE = "123456";

const delay = () => new Promise((r) => setTimeout(r, 150 + Math.random() * 250));
const id = () => Math.random().toString(36).slice(2, 10);

function svg(hue: number, label: string): string {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400">
    <rect width="640" height="400" fill="hsl(${hue} 45% 88%)"/>
    <rect x="0" y="330" width="640" height="70" fill="hsl(${hue} 45% 78%)"/>
    <text x="50%" y="52%" text-anchor="middle" font-family="system-ui" font-size="120">${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;
}

const seedTools: Array<Tool & { _img: string }> = [
  { toolId: "t-drill", name: "Cordless Drill 18V", type: "power", costPerDay: 120, ownerId: "u-somchai", status: "active", createdAt: "2026-06-02T09:00:00Z", _img: svg(30, "🔩") },
  { toolId: "t-saw", name: "Circular Saw", type: "power", costPerDay: 180, ownerId: "u-somchai", status: "active", createdAt: "2026-06-03T10:00:00Z", _img: svg(15, "🪚") },
  { toolId: "t-ladder", name: "Telescopic Ladder 3.8m", type: "access", costPerDay: 90, ownerId: "u-nok", status: "active", createdAt: "2026-06-05T08:30:00Z", _img: svg(200, "🪜") },
  { toolId: "t-washer", name: "Pressure Washer", type: "cleaning", costPerDay: 250, ownerId: "u-nok", status: "active", createdAt: "2026-06-08T14:00:00Z", _img: svg(210, "💦") },
  { toolId: "t-sander", name: "Orbital Sander", type: "power", costPerDay: 100, ownerId: "u-beam", status: "active", createdAt: "2026-06-10T11:00:00Z", _img: svg(45, "🟤") },
  { toolId: "t-mixer", name: "Cement Mixer 140L", type: "construction", costPerDay: 400, ownerId: "u-beam", status: "active", createdAt: "2026-06-12T16:00:00Z", _img: svg(0, "🧱") },
  { toolId: "t-hedge", name: "Hedge Trimmer", type: "garden", costPerDay: 110, ownerId: "u-fah", status: "active", createdAt: "2026-06-15T09:15:00Z", _img: svg(120, "🌿") },
  { toolId: "t-jack", name: "Trolley Jack 2T", type: "automotive", costPerDay: 150, ownerId: MOCK_USER.sub, status: "active", createdAt: "2026-06-18T13:00:00Z", _img: svg(260, "🚗") },
  { toolId: "t-nailer", name: "Brad Nailer", type: "power", costPerDay: 130, ownerId: MOCK_USER.sub, status: "active", createdAt: "2026-06-20T10:45:00Z", _img: svg(330, "📌") },
];

const tools: Tool[] = seedTools.map(({ _img, ...t }) => ({ ...t }));
const imageUrls = new Map<string, string>(seedTools.map((t) => [t.toolId, t._img]));

const rentals: Rental[] = [
  {
    rentalId: "r-seed-active", toolId: "t-washer", renterId: MOCK_USER.sub, ownerId: "u-nok",
    startDate: "2026-07-09T00:00:00Z", endDate: "2026-07-13T00:00:00Z", totalPrice: 1000,
    status: "active", createdAt: "2026-07-08T12:00:00Z", confirmedAt: "2026-07-08T12:00:20Z",
  },
  {
    rentalId: "r-seed-requested", toolId: "t-ladder", renterId: MOCK_USER.sub, ownerId: "u-nok",
    startDate: "2026-07-14T00:00:00Z", endDate: "2026-07-16T00:00:00Z", totalPrice: 180,
    status: "requested", createdAt: "2026-07-11T08:00:00Z",
  },
  {
    rentalId: "r-seed-returned", toolId: "t-drill", renterId: MOCK_USER.sub, ownerId: "u-somchai",
    startDate: "2026-06-25T00:00:00Z", endDate: "2026-06-27T00:00:00Z", totalPrice: 240,
    status: "returned", createdAt: "2026-06-24T09:00:00Z", returnedAt: "2026-06-27T10:00:00Z",
  },
];

// First checkout per rental always hits the payment-failure/compensation
// path so the demo is guaranteed visible; retries succeed (mostly).
const failedOnce = new Set<string>();

export const mockApi: ApiClient = {
  async listTools() {
    await delay();
    return [...tools];
  },

  async getTool(toolId) {
    await delay();
    const tool = tools.find((t) => t.toolId === toolId);
    if (!tool) throw new ApiError(404, "Tool not found");
    return { ...tool };
  },

  async createTool(input) {
    await delay();
    if (!input.name || !input.costPerDay) throw new ApiError(400, "name and costPerDay are required");
    if (input.costPerDay <= 0) throw new ApiError(400, "costPerDay must be a positive number");
    const tool: Tool = {
      toolId: `t-${id()}`,
      name: input.name,
      type: input.type || "general",
      costPerDay: input.costPerDay,
      ownerId: MOCK_USER.sub,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    tools.unshift(tool);
    return { ...tool };
  },

  async listMyTools() {
    await delay();
    return tools.filter((t) => t.ownerId === MOCK_USER.sub);
  },

  async uploadToolImage(toolId, file) {
    await delay();
    if (!tools.some((t) => t.toolId === toolId)) throw new ApiError(404, "Tool not found");
    imageUrls.set(toolId, URL.createObjectURL(file));
    return `tools/${toolId}/${id()}.jpg`;
  },

  async createRental(input) {
    await delay();
    const tool = tools.find((t) => t.toolId === input.toolId);
    if (!tool) throw new ApiError(404, "Tool not found or inactive");
    if (tool.ownerId === MOCK_USER.sub) throw new ApiError(400, "Cannot rent your own tool");
    const totalPrice = priceFor(tool.costPerDay, input.startDate, input.endDate);
    if (totalPrice === null) throw new ApiError(400, "endDate must be after startDate");
    const rental: Rental = {
      rentalId: `r-${id()}`,
      toolId: tool.toolId,
      renterId: MOCK_USER.sub,
      ownerId: tool.ownerId,
      startDate: input.startDate,
      endDate: input.endDate,
      totalPrice,
      status: "requested",
      createdAt: new Date().toISOString(),
    };
    rentals.unshift(rental);
    return { ...rental };
  },

  async listMyRentals() {
    await delay();
    return rentals.filter((r) => r.renterId === MOCK_USER.sub).map((r) => ({ ...r }));
  },

  async checkout(rentalId) {
    await delay();
    const rental = rentals.find((r) => r.rentalId === rentalId);
    if (!rental) throw new ApiError(404, "Rental not found");
    if (rental.status !== "requested")
      throw new ApiError(409, `Cannot checkout a rental in status "${rental.status}"`);

    // saga: reserve → charge → confirm | compensate back to requested
    rental.status = "reserved";
    await delay();
    const mustFail = !failedOnce.has(rentalId) || Math.random() < 0.15;
    if (mustFail) {
      failedOnce.add(rentalId);
      rental.status = "requested";
      rental.lastFailureAt = new Date().toISOString();
      throw new ApiError(
        402,
        "Payment failed; reservation released",
        "Payment charge failed; reservation was released via compensation."
      );
    }
    rental.status = "active";
    rental.confirmedAt = new Date().toISOString();
    return { rentalId, status: "active" };
  },

  async returnRental(rentalId) {
    await delay();
    const rental = rentals.find((r) => r.rentalId === rentalId);
    if (!rental) throw new ApiError(404, "Rental not found");
    if (rental.status === "returned") throw new ApiError(409, "Rental already returned");
    rental.status = "returned";
    rental.returnedAt = new Date().toISOString();
    return { ...rental };
  },

  imageUrl(tool) {
    return imageUrls.get(tool.toolId) ?? null;
  },
};
