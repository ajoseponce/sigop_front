import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, interval, Subscription } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { descargarInformeTecnico, HallazgoInforme, InformeTecnico } from './informe-tecnico-pdf.util';

interface AnalisisDocumental {
  id: number;
  obraId: number;
  empresaId: number;
  nombrePliego: string;
  nombreOferta: string;
  instrucciones?: string | null;
  estado: 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADO' | 'ERROR';
  resultado?: InformeTecnico | null;
  error?: string | null;
  createdAt: string;
}

@Component({
  selector: 'app-analisis-documental', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule],
  templateUrl: './analisis-documental.component.html', styleUrl: './analisis-documental.component.scss',
})
export class AnalisisDocumentalComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(MatSnackBar);
  private polling?: Subscription;
  obras: any[] = [];
  empresas: any[] = [];
  analisis: AnalisisDocumental[] = [];
  seleccionado: AnalisisDocumental | null = null;
  pliego: File | null = null;
  oferta: File | null = null;
  enviando = false;
  form = this.fb.group({ obraId: [null as number | null, Validators.required], empresaId: [null as number | null, Validators.required], instrucciones: [''] });

  ngOnInit(): void {
    forkJoin({ obras: this.api.get<any[]>('obras'), empresas: this.api.get<any[]>('empresas') }).subscribe({
      next: ({ obras, empresas }) => { this.obras = obras; this.empresas = empresas; },
      error: () => this.snack.open('No se pudieron cargar obras y empresas', 'Cerrar', { duration: 4000 }),
    });
    this.cargarHistorial();
    this.polling = interval(10000).subscribe(() => {
      if (this.analisis.some((item) => item.estado === 'PENDIENTE' || item.estado === 'PROCESANDO')) this.cargarHistorial(false);
    });
  }
  ngOnDestroy(): void { this.polling?.unsubscribe(); }
  seleccionarObra(obraId: number): void {
    const empresaId = this.obras.find((obra) => obra.id === obraId)?.empresa?.id;
    if (empresaId) this.form.patchValue({ empresaId });
  }
  elegirArchivo(event: Event, tipo: 'pliego' | 'oferta'): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (file && file.type !== 'application/pdf') { this.snack.open('El archivo debe ser PDF', 'Cerrar', { duration: 3000 }); return; }
    if (tipo === 'pliego') this.pliego = file; else this.oferta = file;
  }
  analizar(): void {
    if (this.form.invalid || !this.pliego || !this.oferta) {
      this.form.markAllAsTouched();
      this.snack.open('Seleccioná obra, empresa, pliego y oferta', 'Cerrar', { duration: 4000 });
      return;
    }
    const data = new FormData();
    data.append('obraId', String(this.form.value.obraId));
    data.append('empresaId', String(this.form.value.empresaId));
    data.append('instrucciones', this.form.value.instrucciones?.trim() ?? '');
    data.append('pliego', this.pliego);
    data.append('oferta', this.oferta);
    this.enviando = true;
    this.api.post<AnalisisDocumental>('analisis-documentales', data).subscribe({
      next: (item) => { this.enviando = false; this.analisis = [item, ...this.analisis]; this.seleccionado = item; this.snack.open('Archivos guardados. El análisis comenzó en segundo plano.', 'Cerrar', { duration: 5000 }); },
      error: (error) => { this.enviando = false; this.snack.open(error?.error?.message ?? 'No se pudo iniciar el análisis', 'Cerrar', { duration: 5000 }); },
    });
  }
  cargarHistorial(mostrarError = true): void {
    this.api.get<AnalisisDocumental[]>('analisis-documentales').subscribe({
      next: (items) => { this.analisis = items; if (this.seleccionado) this.seleccionado = items.find((item) => item.id === this.seleccionado?.id) ?? this.seleccionado; },
      error: () => { if (mostrarError) this.snack.open('No se pudo cargar el historial', 'Cerrar', { duration: 3000 }); },
    });
  }
  ver(item: AnalisisDocumental): void { this.seleccionado = item; }
  reintentar(item: AnalisisDocumental): void {
    this.api.post<AnalisisDocumental>(`analisis-documentales/${item.id}/reintentar`, {}).subscribe({ next: (actualizado) => { this.seleccionado = actualizado; this.cargarHistorial(false); }, error: (e) => this.snack.open(e?.error?.message ?? 'No se pudo reintentar', 'Cerrar', { duration: 4000 }) });
  }
  descargar(): void { if (this.seleccionado?.resultado) void descargarInformeTecnico(this.seleccionado.resultado); }
  tituloObra(id: number): string { return this.obras.find((obra) => obra.id === id)?.nombre ?? `Obra #${id}`; }
  etiquetaEstado(estado: string): string { return ({ PENDIENTE: 'Pendiente', PROCESANDO: 'Analizando', COMPLETADO: 'Completado', ERROR: 'Error' } as Record<string, string>)[estado] ?? estado; }
  trackHallazgo(_: number, item: HallazgoInforme): string { return `${item.estado}-${item.texto}`; }
}
