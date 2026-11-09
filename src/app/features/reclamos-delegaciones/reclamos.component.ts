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

interface Reclamo { id: number; delegacion: string; barrio: string; tipo: string; detalle: string; estado: string; createdAt: string; }

@Component({ selector: 'app-reclamos-delegaciones', standalone: true, imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatSnackBarModule], templateUrl: './reclamos.component.html', styleUrl: './reclamos.component.scss' })
export class ReclamosComponent implements OnInit {
  private api = inject(ApiService); private snack = inject(MatSnackBar); private auth = inject(AuthService);
  readonly delegaciones = DELEGACIONES; readonly tipos = TIPOS;
  delegacion = ''; barrio = ''; tipo = ''; detalle = ''; guardando = false; modalAbierto = false; cargando = false;
  reclamos: Reclamo[] = [];
  busqueda = '';
  get esOperadorDelegacion(): boolean { return this.auth.tieneRol('DELEGACION_RECLAMOS'); }
  get delegacionAsignada(): string { return this.auth.usuario()?.perfil?.delegacion ?? ''; }
  ngOnInit(): void { this.cargar(); }
  get barrios(): string[] { return this.delegaciones.find(d => d.nombre === this.delegacion)?.barrios ?? []; }
  get reclamosFiltrados(): Reclamo[] {
    const texto = this.busqueda.trim().toLocaleLowerCase('es-AR');
    return !texto ? this.reclamos : this.reclamos.filter((reclamo) =>
      [reclamo.delegacion, reclamo.barrio, reclamo.tipo, reclamo.detalle, reclamo.estado].join(' ').toLocaleLowerCase('es-AR').includes(texto),
    );
  }
  cambiarDelegacion(): void { this.barrio = ''; }
  guardar(): void {
    if (!this.delegacion || !this.barrio || !this.tipo || !this.detalle.trim()) return;
    this.guardando = true;
    this.api.post('reclamos-delegaciones', { delegacion: this.delegacion, barrio: this.barrio, tipo: this.tipo, detalle: this.detalle.trim() }).subscribe({
      next: () => { this.snack.open('Reclamo registrado como solicitado', 'Cerrar', { duration: 3500 }); this.limpiar(); this.modalAbierto = false; this.guardando = false; this.cargar(); },
      error: e => { this.snack.open(e?.error?.message || 'No se pudo registrar el reclamo', 'Cerrar', { duration: 4000 }); this.guardando = false; },
    });
  }
  abrirModal(): void { this.limpiar(); this.delegacion = this.delegacionAsignada; this.modalAbierto = true; }
  cerrarModal(): void { if (!this.guardando) this.modalAbierto = false; }
  private limpiar(): void { this.delegacion = ''; this.barrio = ''; this.tipo = ''; this.detalle = ''; }
  cargar(): void { this.cargando = true; this.api.get<Reclamo[]>('reclamos-delegaciones').subscribe({ next: r => { this.reclamos = r; this.cargando = false; }, error: () => { this.cargando = false; this.snack.open('No se pudieron cargar los reclamos', 'Cerrar', { duration: 3500 }); } }); }
}
