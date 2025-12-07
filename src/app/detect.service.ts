import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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

export interface DetectResponse {
  data: {
    stream_id: string;
    image_w: number;
    image_h: number;
    focus_plate?: string | null;
    detections: PlateDetection[];
  }
}

@Injectable({
  providedIn: 'root',
})
export class DetectService {
  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  sendFrame(frame: Blob, streamId: string): Observable<DetectResponse> {
    const formData = new FormData();
    // must match FastAPI param name: frame: UploadFile = File(...)
    formData.append('frame', frame, 'frame.jpg');

    const params = new HttpParams().set('stream_id', streamId);

    // choose /api/detect-mobile or /api/detect depending on which you use
    return this.http.post<DetectResponse>(
      `${this.baseUrl}/detect`,
      formData,
      { params }
    );
  }

  sendPreviewFrame(frame: Blob, streamId: string){
    const formData = new FormData();
    formData.append('frame', frame, 'stream.jpg');
    formData.append('stream_id', streamId);

    // choose /api/detect-mobile or /api/detect depending on which you use
    return this.http.post<{success: boolean}>(
      `${this.baseUrl}/stream-frame`,
      formData,
    );
  }
}
