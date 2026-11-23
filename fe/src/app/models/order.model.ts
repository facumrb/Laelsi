export enum OrderState {
  Pending = 'Pendiente',
  Paid = 'Pagado',
  Shipped = 'Enviado',
  Delivered = 'Entregado',
  Cancelled = 'Cancelado',
}

export enum DeliveryMethod {
  Envio = 'Envío',
  RetiroSucursal = 'Retiro en sucursal',
}

export enum PaymentMethod {
  Transferencia = 'Transferencia',
  Local = 'Local',
}

// ==========================================================
// MODELOS DE LECTURA (READ / GET)
// ==========================================================

export interface IApiOrderLine {
  id: number;
  quantity: number;
  price: number;
  product: {
    id: number;
    name: string;
    brand: string;
    photos?: { fileName: string }[];
  };
}

export interface IApiOrder {
  id: number;
  status: OrderState;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  dateTime: string;
  client: {
    id: number;
    // Pueden ser null: la página de registro y el acceso con Google no piden nombre, apellido ni teléfono
    name: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
  };
  items: IApiOrderLine[];
  createdAt: string;
  updatedAt: string;
}

// ==========================================================
// MODELOS DE CREACIÓN (CREATE / POST)
// ==========================================================

export interface ICreateOrderItem {
  productId: number;
  quantity: number;
}

export interface ICreateOrder {
  clientId: number;
  deliveryMethod?: DeliveryMethod;
  paymentMethod: PaymentMethod;
  items: ICreateOrderItem[];
}

// ==========================================================
// MODELOS DE ACTUALIZACIÓN (UPDATE / PATCH)
// ==========================================================

export interface IUpdateOrderStatus {
  status: OrderState;
}

export interface IUpdateDeliveryMethod {
  deliveryMethod: DeliveryMethod;
}
