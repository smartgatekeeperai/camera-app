import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface PlateBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  nx1: number;
  ny1: number;
  nx2: number;
  ny2: number;
}

export interface PlateDetection {
  plate_text: string;
  detection_conf: number;
  ocr_conf: number;
  is_focus: boolean;
  box: PlateBox;
}

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

export interface DetectResponse {
  data: {
    stream_id: string;
    image_w: number;
    image_h: number;
    focus_plate?: string | null;
    detections: PlateDetection[];
    vehicles: VehicleDetection[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class DetectService {
  // 🔗 Use the vehicle-detector server as the main URL

  constructor(private http: HttpClient) {}

  /** Combined YOLO+ALPR detection */
  sendFrame(frame: Blob, streamId: string): Observable<DetectResponse> {
    const formData = new FormData();
    formData.append('file', frame, 'frame.jpg');

    return this.http.post<any>(`${environment.apiBaseUrl}/detect`, formData).pipe(
      map((apiRes) => {
        const image_w = apiRes?.image_width ?? 640;
        const image_h = apiRes?.image_height ?? 480;

        // Plates from FastALPR part of the response
        const platesRaw = apiRes?.plates || [];
        const plateDetections: PlateDetection[] = platesRaw.map((p: any) => {
          const b = p.bbox || {};
          const x1 = b.x1 || 0;
          const y1 = b.y1 || 0;
          const x2 = b.x2 || 0;
          const y2 = b.y2 || 0;
          const width = x2 - x1;
          const height = y2 - y1;

          return {
            plate_text: p.ocr?.text || '',
            detection_conf: 1.0,
            ocr_conf: p.ocr?.confidence || 0,
            is_focus: true,
            box: {
              x1,
              y1,
              x2,
              y2,
              width,
              height,
              cx: x1 + width / 2,
              cy: y1 + height / 2,
              // FastALPR does not give normalized coords
              nx1: 0,
              ny1: 0,
              nx2: 0,
              ny2: 0,
            },
          };
        });

        const vehiclesRaw = apiRes?.vehicles || [];
        const vehicleDetections: VehicleDetection[] = vehiclesRaw.map(
          (v: any) => {
            const b = v.bbox || {};
            return {
              bbox: {
                x1: b.x1 || 0,
                y1: b.y1 || 0,
                x2: b.x2 || 0,
                y2: b.y2 || 0,
                width: b.width || 0,
                height: b.height || 0,
                cx: b.cx || 0,
                cy: b.cy || 0,
                nx: b.nx || 0,
                ny: b.ny || 0,
                nwidth: b.nwidth || 0,
                nheight: b.nheight || 0,
              },
              confidence: v.confidence || 0,
              class_id: v.class_id ?? -1,
              class_name: v.class_name || 'vehicle',
            };
          }
        );

        return {
          data: {
            stream_id: streamId,
            image_w,
            image_h,
            focus_plate: plateDetections.length
              ? plateDetections[0].plate_text
              : null,
            detections: plateDetections,
            vehicles: vehicleDetections,
          },
        } as DetectResponse;
      })
    );
  }

  /** Preview stream (unchanged) */
  sendPreviewFrame(frame: Blob, streamId: string) {
    const formData = new FormData();
    formData.append('frame', frame, 'stream.jpg');
    formData.append('stream_id', streamId);

    return this.http.post<{ success: boolean }>(
      `${environment.apiBaseUrl}/stream-frame`,
      formData
    );
  }
}
