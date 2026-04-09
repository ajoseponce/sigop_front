import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  get<T>(path: string) {
    return this.http.get<ApiResponse<T>>(`${this.base}/${path}`)
      .pipe(map(r => r.data));
  }

  post<T>(path: string, body: any) {
    return this.http.post<ApiResponse<T>>(`${this.base}/${path}`, body)
      .pipe(map(r => r.data));
  }

  put<T>(path: string, body: any) {
    return this.http.put<ApiResponse<T>>(`${this.base}/${path}`, body)
      .pipe(map(r => r.data));
  }

  delete<T>(path: string) {
    return this.http.delete<ApiResponse<T>>(`${this.base}/${path}`)
      .pipe(map(r => r.data));
  }
}
