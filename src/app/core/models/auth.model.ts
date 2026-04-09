export interface LoginRequest {
  email: string;
  password: string;
}

export interface UsuarioAuth {
  id: number;
  email: string;
  activo: boolean;
  ultimoLogin: string | null;
  perfil: {
    nombre: string;
    apellido: string;
    telefono?: string;
    avatarUrl?: string;
    area: { id: number; nombre: string } | null;
  } | null;
  roles: { id: number; nombre: string }[];
}

export interface LoginResponse {
  accessToken: string;
  usuario: UsuarioAuth;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}
