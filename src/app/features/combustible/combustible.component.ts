import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/services/api.service';

type Catalogo = { id: number; nombre: string };

@Component({
  selector: 'app-combustible',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatSelectModule, MatSnackBarModule, MatTableModule, MatTooltipModule, DatePipe, DecimalPipe],
  templateUrl: './combustible.component.html',
  styleUrls: ['./combustible.component.scss'],
})
export class CombustibleComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  consumos = signal<any[]>([]);
  choferes = signal<Catalogo[]>([]);
  puntosCarga = signal<Catalogo[]>([]);
  cargando = signal(false);
  modalOpen = signal(false);
  editando = signal<any | null>(null);
  columnas = ['fecha', 'hora', 'interno', 'chofer', 'litros', 'puntoCarga', 'acciones'];

  form = this.fb.group({
    fecha: [{ value: this.hoy(), disabled: true }],
    hora: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    choferId: [null as number | null, Validators.required],
    litros: [null as number | null, [Validators.required, Validators.min(0.01)]],
    puntoCargaId: [null as number | null, Validators.required],
    interno: ['', [Validators.required, Validators.pattern(/^\d{1,3}$/)]],
  });

  ngOnInit() { this.cargarTodo(); }

  cargarTodo() {
    this.cargando.set(true);
    forkJoin({
      consumos: this.api.get<any[]>('combustible/consumos'),
      choferes: this.api.get<Catalogo[]>('combustible/choferes'),
      puntos: this.api.get<Catalogo[]>('combustible/puntos-carga'),
    }).subscribe({
      next: ({ consumos, choferes, puntos }) => {
        this.consumos.set(consumos); this.choferes.set(choferes); this.puntosCarga.set(puntos); this.cargando.set(false);
      },
      error: () => { this.cargando.set(false); this.snack.open('No se pudieron cargar los consumos', 'Cerrar', { duration: 4000 }); },
    });
  }

  abrirModal(consumo?: any) {
    this.editando.set(consumo ?? null);
    this.form.reset({ fecha: consumo ? String(consumo.fecha).slice(0, 10) : this.hoy(), hora: consumo?.hora ?? '',
      choferId: consumo?.choferId ?? null, litros: consumo ? Number(consumo.litros) : null,
      puntoCargaId: consumo?.puntoCargaId ?? null, interno: consumo ? String(consumo.interno) : '' });
    this.modalOpen.set(true);
  }
  cerrarModal() { this.modalOpen.set(false); this.editando.set(null); }

  limitarInterno(event: Event) {
    const input = event.target as HTMLInputElement;
    const limpio = input.value.replace(/\D/g, '').slice(0, 3);
    input.value = limpio;
    this.form.controls.interno.setValue(limpio);
  }

  guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    const body = { hora: raw.hora!, choferId: Number(raw.choferId), litros: Number(raw.litros),
      puntoCargaId: Number(raw.puntoCargaId), interno: Number(raw.interno) };
    const op = this.editando()
      ? this.api.put(`combustible/consumos/${this.editando().id}`, body)
      : this.api.post('combustible/consumos', body);
    op.subscribe({
      next: () => { this.snack.open(this.editando() ? 'Consumo actualizado' : 'Consumo registrado', '', { duration: 3000 }); this.cerrarModal(); this.cargarTodo(); },
      error: err => this.snack.open(err?.error?.message ?? 'No se pudo guardar', 'Cerrar', { duration: 4000 }),
    });
  }

  eliminar(consumo: any) {
    if (!confirm(`¿Eliminar el consumo del interno ${consumo.interno}?`)) return;
    this.api.delete(`combustible/consumos/${consumo.id}`).subscribe({
      next: () => { this.snack.open('Consumo eliminado', '', { duration: 3000 }); this.cargarTodo(); },
      error: err => this.snack.open(err?.error?.message ?? 'No se pudo eliminar', 'Cerrar', { duration: 4000 }),
    });
  }

  private hoy() {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
  }
}
