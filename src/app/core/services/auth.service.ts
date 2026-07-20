import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  LoginRequest, LoginResponse, UsuarioAuth, ApiResponse,
} from '../models/auth.model';

const TOKEN_KEY   = 'sigop_token';
const USUARIO_KEY = 'sigop_usuario';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);

  // Signals reactivos
  private _usuario = signal<UsuarioAuth | null>(this.cargarUsuario());
  private _token   = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  readonly usuario  = this._usuario.asReadonly();
  readonly token    = this._token.asReadonly();
  readonly logueado = computed(() => !!this._token());
  readonly esAdmin  = computed(() =>
    this._usuario()?.roles.some(r => r.nombre === 'ADMIN') ?? false
  );
  readonly nombreCompleto = computed(() => {
    const p = this._usuario()?.perfil;
    return p ? `${p.nombre} ${p.apellido}` : this._usuario()?.email ?? '';
  });

  login(dto: LoginRequest) {
    return this.http
      .post<ApiResponse<LoginResponse>>(`${environment.apiUrl}/auth/login`, dto)
      .pipe(
        map(res => res.data),
        tap(data => {
          localStorage.setItem(TOKEN_KEY, data.accessToken);
          localStorage.setItem(USUARIO_KEY, JSON.stringify(data.usuario));
          this._token.set(data.accessToken);
          this._usuario.set(data.usuario);
        }),
      );
  }

  logout() {
    this.http
      .post(`${environment.apiUrl}/auth/logout`, {})
      .subscribe({ error: () => {} });
    this.limpiarSesion();
  }

  cambiarPassword(dto: { passwordActual: string; passwordNueva: string }) {
    return this.http.patch<ApiResponse<{ message: string }>>(
      `${environment.apiUrl}/usuarios/cambiar-password`,
      dto,
    ).pipe(map(res => res.data));
  }

  limpiarSesion() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USUARIO_KEY);
    this._token.set(null);
    this._usuario.set(null);
    this.router.navigate(['/login']);
  }

  tieneRol(rol: string): boolean {
    return this._usuario()?.roles.some(r => r.nombre === rol) ?? false;
  }

  private cargarUsuario(): UsuarioAuth | null {
    try {
      const raw = localStorage.getItem(USUARIO_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
