import api from '@/lib/axios';

export interface Product {
  idProducto: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  precioActual: number | string;
  estado: boolean;
}

export interface ProductPayload {
  codigo: string;
  nombre: string;
  descripcion: string;
  precioActual: number;
}

export const productService = {
  getCatalog: async (): Promise<Product[]> => {
    const { data } = await api.get<Product[]>('/products');
    return data;
  },
  create: async (payload: ProductPayload): Promise<Product> => {
    const { data } = await api.post<Product>('/products', payload);
    return data;
  },
  update: async (id: string, payload: Partial<ProductPayload> & { estado?: boolean }): Promise<Product> => {
    const { data } = await api.patch<Product>(`/products/${id}`, payload);
    return data;
  },
  deactivate: async (id: string): Promise<Product> => {
    const { data } = await api.delete<Product>(`/products/${id}`);
    return data;
  },
  getAll: async (): Promise<Product[]> => {
    const response = await api.get<Product[]>('/products');

    return response.data.filter((product) => product.estado);
  },

  getById: async (idProducto: string): Promise<Product> => {
    const response = await api.get<Product>(`/products/${idProducto}`);
    return response.data;
  },
};
