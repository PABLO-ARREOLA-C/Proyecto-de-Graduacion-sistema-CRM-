// import api from '@/lib/axios';  //

export interface Order {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  total: number;
  status: 'pending' | 'processing' | 'delivered' | 'cancelled';
  address: string;
}

export const orderService = {
  getAll: async (): Promise<Order[]> => {
    // Simulación: reemplazar con llamada real al backend
    return [
      {
        id: '1',
        clientId: '1',
        clientName: 'Juan Pérez',
        date: '2025-03-20',
        total: 125.50,
        status: 'pending',
        address: 'Calle Principal #123',
      },
      {
        id: '2',
        clientId: '2',
        clientName: 'María López',
        date: '2025-03-21',
        total: 85.00,
        status: 'delivered',
        address: 'Avenida Central #456',
      },
    ];
  },
};