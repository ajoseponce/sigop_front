import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { DELEGACIONES } from './delegaciones.data';

const TIPOS = ['Poda', 'Iluminación', 'Mantenimiento de calle', 'Mantenimiento de plaza', 'Cesto de basura', 'Reductor de velocidad', 'Bacheo', 'Otro'];
type Estado = 'SOLICITADO' | 'VISTO' | 'EN_PROCESO' | 'RESUELTO' | 'VALIDADO';
interface Historial { id: number; estado: Estado; observacion: string | null; createdAt: string; usuario: { perfil: { nombre: string; apellido: string } | null }; }
interface Reclamo { id: number; delegacion: string; barrio: string; tipo: string; detalle: string; estado: Estado; createdAt: string; historial: Historial[]; }

@Component({ selector: 'app-reclamos-delegaciones', standalone: true, imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatSnackBarModule], templateUrl: './reclamos.component.html', styleUrl: './reclamos.component.scss' })
export class ReclamosComponent implements OnInit {
  private api = inject(ApiService); private snack = inject(MatSnackBar); private auth = inject(AuthService);
  readonly delegaciones = DELEGACIONES; readonly tipos = TIPOS;
  delegacion = ''; barrio = ''; tipo = ''; detalle = ''; guardando = false; modalAbierto = false; cargando = false;
  reclamos: Reclamo[] = []; busqueda = '';
  reclamoGestion: Reclamo | null = null; observacionEstado = ''; gestionando = false; validando = false; soloSeguimiento = false;
  readonly etiquetas: Record<Estado, string> = { SOLICITADO: 'Solicitado', VISTO: 'Visto', EN_PROCESO: 'En proceso', RESUELTO: 'Terminado', VALIDADO: 'Validado' };
  get esOperadorDelegacion(): boolean { return this.auth.tieneRol('DELEGACION_RECLAMOS'); }
  get esAdmin(): boolean { return this.auth.tieneRol('ADMIN'); }
  get delegacionAsignada(): string { return this.auth.usuario()?.perfil?.delegacion ?? ''; }
  get barrios(): string[] { return this.delegaciones.find(d => d.nombre === this.delegacion)?.barrios ?? []; }
  get reclamosFiltrados(): Reclamo[] { const texto = this.busqueda.trim().toLocaleLowerCase('es-AR'); return !texto ? this.reclamos : this.reclamos.filter(r => [r.delegacion, r.barrio, r.tipo, r.detalle, this.etiqueta(r.estado)].join(' ').toLocaleLowerCase('es-AR').includes(texto)); }
  get proximoEstado(): Estado | null { return this.reclamoGestion ? this.siguienteEstado(this.reclamoGestion) : null; }
  get requiereObservacion(): boolean { return this.validando || this.proximoEstado === 'EN_PROCESO'; }
  ngOnInit(): void { this.cargar(); }
  etiqueta(estado: Estado): string { return this.etiquetas[estado]; }
  siguienteEstado(reclamo: Reclamo): Estado | null { return ({ SOLICITADO: 'VISTO', VISTO: 'EN_PROCESO', EN_PROCESO: 'RESUELTO', RESUELTO: null, VALIDADO: null } as Record<Estado, Estado | null>)[reclamo.estado]; }
  cambiarDelegacion(): void { this.barrio = ''; }
  guardar(): void { if (!this.delegacion || !this.barrio || !this.tipo || !this.detalle.trim()) return; this.guardando = true; this.api.post('reclamos-delegaciones', { delegacion: this.delegacion, barrio: this.barrio, tipo: this.tipo, detalle: this.detalle.trim() }).subscribe({ next: () => { this.snack.open('Reclamo registrado como solicitado', 'Cerrar', { duration: 3500 }); this.limpiar(); this.modalAbierto = false; this.guardando = false; this.cargar(); }, error: e => { this.snack.open(e?.error?.message || 'No se pudo registrar el reclamo', 'Cerrar', { duration: 4000 }); this.guardando = false; } }); }
  abrirModal(): void { this.limpiar(); this.delegacion = this.delegacionAsignada; this.modalAbierto = true; }
  cerrarModal(): void { if (!this.guardando) this.modalAbierto = false; }
  abrirGestion(reclamo: Reclamo, validar = false): void { this.reclamoGestion = reclamo; this.validando = validar; this.soloSeguimiento = false; this.observacionEstado = ''; }
  verSeguimiento(reclamo: Reclamo): void { this.reclamoGestion = reclamo; this.soloSeguimiento = true; }
  cerrarGestion(): void { if (!this.gestionando) { this.reclamoGestion = null; this.soloSeguimiento = false; } }
  guardarEstado(): void {
    if (!this.reclamoGestion || !this.proximoEstado || (this.requiereObservacion && !this.observacionEstado.trim())) return;
    this.gestionando = true;
    const ruta = this.validando ? `reclamos-delegaciones/${this.reclamoGestion.id}/validar` : `reclamos-delegaciones/${this.reclamoGestion.id}/estado`;
    const body = this.validando ? { observacion: this.observacionEstado.trim() } : { estado: this.proximoEstado, observacion: this.observacionEstado.trim() || undefined };
    this.api.patch(ruta, body).subscribe({ next: () => { this.snack.open(`Reclamo marcado como ${this.etiqueta(this.validando ? 'VALIDADO' : this.proximoEstado!)}`, 'Cerrar', { duration: 3500 }); this.gestionando = false; this.reclamoGestion = null; this.cargar(); }, error: (e: { error?: { message?: string } }) => { this.snack.open(e?.error?.message || 'No se pudo actualizar el estado', 'Cerrar', { duration: 4000 }); this.gestionando = false; } });
  }
  private limpiar(): void { this.delegacion = ''; this.barrio = ''; this.tipo = ''; this.detalle = ''; }
  cargar(): void { this.cargando = true; this.api.get<Reclamo[]>('reclamos-delegaciones').subscribe({ next: r => { this.reclamos = r; this.cargando = false; }, error: () => { this.cargando = false; this.snack.open('No se pudieron cargar los reclamos', 'Cerrar', { duration: 3500 }); } }); }
}
