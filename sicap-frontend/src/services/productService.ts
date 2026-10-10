import api from '@/lib/axios';

export interface Product {
  idProducto: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  precioActual: number | string;
  estado: boolean;
}

export const productService = {
  getAll: async (): Promise<Product[]> => {
    const response = await api.get<Product[]>('/products');

    return response.data.filter((product) => product.estado);
  },

  getById: async (idProducto: string): Promise<Product> => {
    const response = await api.get<Product>(`/products/${idProducto}`);
    return response.data;
  },
};