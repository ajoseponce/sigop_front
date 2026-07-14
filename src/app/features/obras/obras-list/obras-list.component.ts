import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-obras-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './obras-list.component.html',
  styleUrl: './obras-list.component.scss',
})
export class ObrasListComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  obras: any[] = [];
  cargando = false;

  columnas: string[] = [
    'id',
    'nombre',
    'expediente',
    'municipio',
    'estado',
    'acciones',
  ];

  ngOnInit(): void {
    this.cargarObras();
  }

  cargarObras(): void {
    this.cargando = true;

    this.api.get<any[]>('obras').subscribe({
      next: (res) => {
        this.obras = res;
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar obras', error);
        this.cargando = false;
      },
    });
  }

  nuevaObra(): void {
    this.router.navigate(['/obras/nueva']);
  }

  editarObra(id: number): void {
    this.router.navigate(['/obras', id, 'editar']);
  }

  imprimirCaratula(id: number): void {
    this.router.navigate(['/obras', id, 'caratula']);
  }
}
