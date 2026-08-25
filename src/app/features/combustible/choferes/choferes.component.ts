import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api.service';

type Chofer = { id: number; nombre: string; legajo: string | null; dni: string | null; activo: boolean };

@Component({
  selector: 'app-combustible-choferes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatSnackBarModule, MatTableModule, MatTooltipModule],
  templateUrl: './choferes.component.html',
  styleUrls: ['./choferes.component.scss'],
})
export class ChoferesComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  choferes = signal<Chofer[]>([]);
  cargando = signal(false);
  modalOpen = signal(false);
  editando = signal<Chofer | null>(null);
  columnas = ['nombre', 'legajo', 'dni', 'estado', 'acciones'];

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    legajo: ['', [Validators.required, Validators.pattern(/^\d{1,5}$/)]],
    dni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
  });

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando.set(true);
    this.api.get<Chofer[]>('combustible/choferes?incluirInactivos=true').subscribe({
      next: choferes => { this.choferes.set(choferes); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.snack.open('No se pudieron cargar los choferes', 'Cerrar', { duration: 4000 }); },
    });
  }

  abrirModal(chofer?: Chofer) {
    this.editando.set(chofer ?? null);
    this.form.reset({ nombre: chofer?.nombre ?? '', legajo: chofer?.legajo ?? '', dni: chofer?.dni ?? '' });
    this.modalOpen.set(true);
  }

  cerrarModal() { this.modalOpen.set(false); this.editando.set(null); }

  soloDigitos(campo: 'legajo' | 'dni', maximo: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const valor = input.value.replace(/\D/g, '').slice(0, maximo);
    input.value = valor;
    this.form.controls[campo].setValue(valor);
  }

  guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const body = { nombre: this.form.value.nombre!.trim(), legajo: this.form.value.legajo!, dni: this.form.value.dni! };
    const op = this.editando()
      ? this.api.put(`combustible/choferes/${this.editando()!.id}`, body)
      : this.api.post('combustible/choferes', body);
    op.subscribe({
      next: () => { this.snack.open(this.editando() ? 'Chofer actualizado' : 'Chofer creado', '', { duration: 3000 }); this.cerrarModal(); this.cargar(); },
      error: err => this.snack.open(err?.error?.message ?? 'No se pudo guardar el chofer', 'Cerrar', { duration: 4000 }),
    });
  }

  eliminar(chofer: Chofer) {
    if (!confirm(`¿Dar de baja al chofer ${chofer.nombre}? Sus cargas anteriores se conservarán.`)) return;
    this.api.delete(`combustible/choferes/${chofer.id}`).subscribe({
      next: () => { this.snack.open('Chofer dado de baja', '', { duration: 3000 }); this.cargar(); },
      error: err => this.snack.open(err?.error?.message ?? 'No se pudo dar de baja al chofer', 'Cerrar', { duration: 4000 }),
    });
  }
}
