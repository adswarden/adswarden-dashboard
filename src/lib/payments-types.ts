export type PaymentStatusFilter = 'pending' | 'completed' | 'failed' | 'refunded';

export type PaymentsDashboardFilters = {
  q?: string;
  status?: PaymentStatusFilter;
  /** When set, restrict rows to this extension user (UUID). */
  endUserId?: string;
};

/** Shape of a payment row joined to end user (payments dashboard / export). */
export type PaymentListRow = {
  id: string;
  endUserId: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  paymentDate: Date;
  createdAt: Date;
  endUserEmail: string | null;
  endUserName: string | null;
};
