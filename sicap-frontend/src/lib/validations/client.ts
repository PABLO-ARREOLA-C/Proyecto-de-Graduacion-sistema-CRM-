import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  email: z.string().email("Correo electrónico inválido"),
  phone: z.string().min(8, "Teléfono inválido"),
  address: z.string().min(5, "Dirección inválida"),
});

export type ClientFormData = z.infer<typeof clientSchema>;