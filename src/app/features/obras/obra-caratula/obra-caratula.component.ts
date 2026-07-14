import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';

interface ObraCaratula {
  id: number;
  nombre: string;
  expediente: string;
  anioEmision: number;
  numeroObra: string | null;
  municipio: string | null;
  localidad: string | null;
  seccion: string | null;
  manzana: string | null;
  parcela: string | null;
  calles: string | null;
  partida: string | null;
  sistemaContratacion: string;
  tipoObra: { nombre: string };
  empresa: { razonSocial: string; cuit: string };
  contratos: Array<{
    numeroContrato: string | null;
    montoDelta: string;
    fechaFirma: string;
    plazoObraDias: number | null;
  }>;
}

@Component({
  selector: 'app-obra-caratula',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './obra-caratula.component.html',
  styleUrl: './obra-caratula.component.scss',
})
export class ObraCaratulaComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  obra = signal<ObraCaratula | null>(null);
  cargando = signal(true);
  error = signal<string | null>(null);

  contratoOriginal = computed(() => this.obra()?.contratos?.[0] ?? null);

  ubicacion = computed(() => {
    const obra = this.obra();
    if (!obra) return '';

    const partes = [
      this.formatearParte('Sección', obra.seccion),
      this.formatearParte('Manzana', obra.manzana),
      this.formatearParte('Parcela', obra.parcela),
      this.formatearParte('Partida Inmobiliaria', obra.partida),
      obra.calles,
      obra.localidad,
      obra.municipio,
    ].filter(Boolean);

    return partes.join(' - ');
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.error.set('No se indicó una obra válida.');
      this.cargando.set(false);
      return;
    }

    this.api.get<ObraCaratula>(`obras/${id}`).subscribe({
      next: (obra) => {
        this.obra.set(obra);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la obra para imprimir.');
        this.cargando.set(false);
      },
    });
  }

  imprimir(): void {
    window.print();
  }

  volver(): void {
    this.router.navigate(['/obras']);
  }

  formatoMoneda(valor: string | null | undefined): string {
    if (!valor) return 'Sin cargar';
    const numero = Number(valor);
    if (Number.isNaN(numero)) return valor;

    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(numero);
  }

  formatoFecha(valor: string | null | undefined): string {
    if (!valor) return 'Sin cargar';
    return new Intl.DateTimeFormat('es-AR').format(new Date(valor));
  }

  private formatearParte(etiqueta: string, valor: string | null): string | null {
    return valor ? `${etiqueta} ${valor}` : null;
  }
}
