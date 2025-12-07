// src/app/vehicle-detect.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface VehicleBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  nx: number;
  ny: number;
  nwidth: number;
  nheight: number;
}

export interface VehicleDetection {
  bbox: VehicleBox;
  confidence: number;
  class_id: number;
  class_name: string;
}

export interface VehicleDetectResponse {
  success: boolean;
  num_vehicles: number;
  vehicles: VehicleDetection[];
  inference_time_ms: number;
  image_width: number;
  image_height: number;
  model: string;
}

@Injectable({
  providedIn: 'root',
})
export class VehicleDetectService {
  private baseUrl = environment.vDetectURL;

  constructor(private http: HttpClient) {}

  sendVehicleFrame(frame: Blob): Observable<VehicleDetectResponse> {
    const formData = new FormData();
    formData.append('file', frame, 'frame.jpg'); // FastAPI expects `file`
    return this.http.post<VehicleDetectResponse>(
      `${this.baseUrl}/detect`,
      formData
    );
  }
}
