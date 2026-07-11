// Field names mirror the backend contract exactly (see repo root README
// and template.yaml) — do not rename client-side.

export interface Tool {
  toolId: string;
  name: string;
  type: string;
  costPerDay: number;
  ownerId: string;
  status: "active";
  createdAt: string;
  imageKey?: string;
}

export type RentalStatus = "requested" | "reserved" | "active" | "returned";

export interface Rental {
  rentalId: string;
  toolId: string;
  renterId: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status: RentalStatus;
  createdAt: string;
  confirmedAt?: string;
  returnedAt?: string;
  lastFailureAt?: string;
  /** denormalized client-side for display (joined from the tool list) */
  toolName?: string;
}

export class ApiError extends Error {
  status: number;
  cause?: string;

  constructor(status: number, message: string, cause?: string) {
    super(message);
    this.status = status;
    this.cause = cause;
  }
}

/** Mirror of the backend price rule: ceil(days) * costPerDay. */
export function priceFor(costPerDay: number, startDate: string, endDate: string): number | null {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.ceil((end - start) / 86_400_000) * costPerDay;
}

export interface ApiClient {
  listTools(): Promise<Tool[]>;
  getTool(toolId: string): Promise<Tool>;
  createTool(input: { name: string; type?: string; costPerDay: number }): Promise<Tool>;
  listMyTools(): Promise<Tool[]>;
  /** presign + PUT the file; resolves to the stored imageKey */
  uploadToolImage(toolId: string, file: Blob): Promise<string>;
  createRental(input: { toolId: string; startDate: string; endDate: string }): Promise<Rental>;
  listMyRentals(): Promise<Rental[]>;
  /** synchronous checkout saga: resolves active, rejects ApiError(402) on payment failure */
  checkout(rentalId: string): Promise<{ rentalId: string; status: string }>;
  returnRental(rentalId: string): Promise<Rental>;
  /** display URL for a tool's photo, or null if it has none */
  imageUrl(tool: Tool): string | null;
}
