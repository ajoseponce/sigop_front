import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DELEGACIONES, Delegacion } from './delegaciones.data';

/*export const DELEGACIONES: Delegacion[] = [
  {
    numero: '32-33', nombre: 'Delegación 32-33', plano: 'deleg 32-33.pdf', barrios: [
      '9 de Julio', 'Alta Gracia', 'Centro Comercial', 'Cristo Rey', 'Hipólito Yrigoyen', 'Kennedy',
      'La Cumbre', 'La Rotonda', 'Las Malvinas', 'Livia de Oro', 'Luz y Fuerza', 'Malvinas',
      'Parque Adam', 'Primera Junta', 'Radio Parque', 'Residencial Sur', 'Rocomora', 'Rowing',
      'San Alberto', 'San Juan', 'Santa Rosa', 'Tte. 1° R. N. Estévez', 'Villa Flor', 'Villa Vedoya',
      'Virgen del Itatí',
    ],
  },
  {
    numero: '01', nombre: 'Dolores Norte', plano: 'deleg dolores norte.pdf', barrios: [
      'Altos de Bella Vista', 'El Libertador', 'El Mensú', 'El Progreso', 'Hermoso', 'Independencia',
      'Las Dolores', 'Los Lapachitos', 'Los Lapachos', 'Nazareno', 'San Francisco de Asís', 'San Jorge',
      'San Juan Evangelista', 'San Lorenzo', 'San Lucas', 'San Marcos', 'San Onofre', 'San Onofre 2',
    ],
  },
  {
    numero: '02', nombre: 'Dolores Sur', plano: 'deleg dolores sur.pdf', barrios: [
      'Alberto Fernández', 'Altos del Sur', 'Cocomarola Este', 'Cocomarola Oeste', 'El Porvenir (parajes)',
      'Estepa', 'Familias Unidas (el Porvenir II)', 'Giovinazzo', 'La Cima del Sol', 'La Nueva Esperanza (A4)',
      'La Olla', 'Las Margaritas', 'Los Oleros (El Porvenir 1)', 'Los Patitos', 'Los Patitos II',
      'Néstor Kirchner', 'Nissi', 'Pratt', 'San Isidro', 'Sur Argentino',
    ],
  },
  {
    numero: '03', nombre: 'Itaembé Guazú', plano: 'deleg itaembe guazu.pdf', barrios: [
      '508 Viviendas', 'Campo Bauer', 'Colonia Aeroparque', 'Costa Mango', 'Cruz del Sur',
      'Itaembé Guazú', 'Nemesio Parma', 'Pueblo Chico', 'Puerto Canela',
    ],
  },
  {
    numero: '04', nombre: 'Itaembé Miní Este', plano: 'deleg itaembe mini este.pdf', barrios: [
      '21 de Diciembre', '28 de Abril', 'Acaraguá', 'Aeroclub Este', 'Aeroclub Oeste', 'Club Educación',
      'Congreso', 'Divina Providencia', 'El Lucero', 'El Pino', 'Evita Hildreco', 'Genesis',
      'Giovinazzo (100 Viv.)', 'Gob. Don A. Almeda', 'Jardín', 'Laureles Sur', 'La Posada', 'Las Viñas',
      'Latinoamérica', 'Los Álamos', 'Los Naranjos', 'Luis Piedrabuena', 'Martín M. de Güemes', 'Mini City',
      'Misionerita', 'Olero', 'Panambí', 'Pje. Itaembé M. Salomón Barrios', 'Prosol 1', 'Prosol 2',
      'Rincón del Sur', 'Santa Clara', 'Victoria Ingar',
    ],
  },
  {
    numero: '05', nombre: 'Itaembé Miní Oeste', plano: 'deleg itaembe mini oeste.pdf', barrios: [
      '1 de Abril', '17 de Octubre', 'Aires del Pinar', 'Artex', 'Belén', 'Bicentenario', 'Carlos Pellegrini',
      'Casa Quinta', 'Club Vial', 'Colonia La Lodosina', 'Costanera', 'Esperanza', 'Eva Perón', 'Farcón',
      'Forestal', 'Hospital', 'Itaembé Porá', 'La Cima', 'Las Lomas', 'Las Tacuaritas', 'Las Tacuaritas',
      'Los Árboles', 'María Elena Walsh', 'Nostalgia (124 Viv.)', 'Nuevo Amanecer',
      'Pje. Itaembé M. Salomón', 'Sol de Misiones', 'Sol de Misiones 2', 'Terraza', 'Unión',
    ],
  },
  {
    numero: '06', nombre: 'Miguel Lanús', plano: 'deleg miguel lanus.pdf', barrios: [
      '6 de Septiembre', 'Campus Universitario', 'Don Pedro', 'Las Vertientes', 'Los Paraísos', 'Madrigal',
      'Miguel Lanús', 'Santa Cecilia', 'Sesquicentenario', 'Villa Bonita', 'Villa Longa', 'Villa Poujade',
      'Virgen del Rosario (A 3-2 Sector A)', 'Yacyretá (A 3-2 Sector B)',
    ],
  },
  {
    numero: '07', nombre: 'Riberas del Paraná', plano: 'deleg riberas del parana.pdf', barrios: [
      'A.P.O.S.A.', 'Bajada Vieja', 'Bardaro', 'Centenario', 'Docente', 'El Brete', 'El Laurel', 'La Rivera',
      'Las Orquídeas', 'Los Aguacates', 'Lucas Braulio Areco', 'Monseñor Jorge Kemerer', 'Paitití', 'Primavera',
      'Primero de Mayo', 'Regimiento', 'San Miguel', 'Santa Catalina', 'Santa Teresita del Niño Jesús',
      'Tiro Federal', 'Villa Blosset', 'Villa Cabello', 'Villa Molas', 'Villa Sarita', 'Virgen del Valle',
      'Ch. 42', 'Ch. 43', 'Ch. 44',
    ],
  },
  {
    numero: '08', nombre: 'Santa Rita', plano: 'deleg Santa Rita.pdf', barrios: [
      'Bahía Oeste', 'Centinela', 'Ciudad Nueva', 'Costa Bonita', 'Cristo Redentor', 'El Yerbal', 'Guazupí',
      'Héroes de Malvinas', 'Itá Verá', 'Juan G. Las Heras', 'La Misión', 'Las Rosas', 'Legislativo',
      'Los Jilgueros', 'Los Kiris', 'Los Manantiales', 'Martín Fierro', 'Oeste', 'Olímpia', 'Parque 2 de Abril',
      'Parque 25 de Octubre', 'Parque Alta Vista', 'Puertas del Sol', 'San José de la Sagrada Familia',
      'San Ramón', 'Santa Lucía', 'Santa Rita', 'Sol Naciente', 'Tacurú', 'Yohazá', 'Ch. 235', 'Ch. 234',
      'Ch. 241', 'Ch. 245', 'Ch. 248', 'Ch. 251', 'Ch. 258',
    ],
  },
  {
    numero: '09', nombre: 'Villa Cabello', plano: 'deleg villa cabello.pdf', barrios: [
      '10 de Junio', '12 de Octubre', '20 de Junio', '25 de Diciembre', '30 de Octubre', '8 de Diciembre',
      'Andresito Guacurarí', 'Diputado Ramón Brouss', 'El Solar', 'El Territorio', 'La Picada', 'La Querencia',
      'Libertad', 'Libertador San Martín', 'Los Pinos', 'María de Nazaret', 'Monseñor Jorge Kemerer',
      'Padre René Perno', 'Papel Misionero', 'San Cayetano (Ex Yacyretá A-1)', 'San Gerardo', 'San Miguel',
      'Vicente López y Planes', 'Villa Cabello', 'Yohazá', 'Ch. 110', 'Ch. 127', 'Ch. 129', 'Ch. 159',
    ],
  },
  {
    numero: '10', nombre: 'Villa Urquiza', plano: 'deleg villa urquiza.pdf', barrios: [
      '23 de Septiembre', '25 de Mayo', 'Aguas Corrientes', 'Cementerio', 'El Palomar', 'Jorge Mario Bergoglio',
      'Las Tomas', 'Lavalette', 'Libertador San Martín', 'Manuel Belgrano', 'Mariano Moreno', 'Parque de la Salud',
      'Resid. Gral. J. F. de San Martín', 'Rocomar', 'Sagrado Corazón de Jesús', 'Tajamar', 'Sargento Papini',
      'Villa Urquiza', 'Virgen de Lourdes', 'Ch. 160', 'Ch. 20', 'Ch. 210', 'Ch. 214', 'Ch. 40', 'Ch. 46',
      'Ch. 63', 'Ch. 67',
    ],
  },
];*/

@Component({
  selector: 'app-delegaciones', standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './delegaciones.component.html', styleUrl: './delegaciones.component.scss',
})
export class DelegacionesComponent {
  readonly delegaciones = DELEGACIONES;
  mapaUrl: SafeResourceUrl | null = null;
  detalle: Delegacion | null = null;
  private mapaObjectUrl: string | null = null;

  constructor(private readonly sanitizer: DomSanitizer) {}

  verMapa(delegacion: Delegacion): void {
    this.cerrarMapa();
    this.mapaObjectUrl = `/assets/delegaciones/${encodeURIComponent(delegacion.plano)}`;
    this.mapaUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.mapaObjectUrl);
  }
  cerrarMapa(): void { this.mapaUrl = null; this.mapaObjectUrl = null; }
  verDetalle(delegacion: Delegacion): void { this.detalle = delegacion; }
  cerrarDetalle(): void { this.detalle = null; }
}
