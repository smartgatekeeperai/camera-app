import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  OnDestroy,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonFab,
  IonFabButton,
  IonFooter,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack, radioButtonOn, stop } from 'ionicons/icons';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  DetectService,
  DetectResponse,
  PlateDetection,
  VehicleDetection,
} from '../detect.service';
import { Capacitor } from '@capacitor/core';
import { Animation, StatusBar, Style } from '@capacitor/status-bar';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-stream',
  standalone: true,
  templateUrl: './stream.page.html',
  styleUrls: ['./stream.page.scss'],
  imports: [
    CommonModule,
    IonContent,
    FormsModule,
    RouterModule,
    IonTitle,
    IonHeader,
    IonToolbar,
    IonIcon,
    IonButtons,
    IonButton,
    IonCard,
    IonCardHeader,
    IonCardContent,
    IonCardTitle,
    IonFooter,
    IonToolbar,
    IonFab,
    IonFabButton,
    IonSpinner,
    HttpClientModule,
  ],
})
export class StreamPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('video', { static: false })
  videoRef!: ElementRef<HTMLVideoElement>;

  // Canvas for visible overlay (boxes)
  @ViewChild('overlayCanvas', { static: false })
  overlayCanvasRef!: ElementRef<HTMLCanvasElement>;

  // Hidden canvas used only for grabbing RAW frames for detection
  @ViewChild('captureCanvas', { static: false })
  captureCanvasRef!: ElementRef<HTMLCanvasElement>;

  // Hidden canvas used only for streaming (video + overlay composited)
  @ViewChild('streamCanvas', { static: false })
  streamCanvasRef!: ElementRef<HTMLCanvasElement>;

  isStreaming = false;
  stream: MediaStream | null = null;
  intervalId: any = null; // capture + detect loop

  readonly streamId = 'mobile-1';

  statusMessage = 'Camera not started';
  lastFocusPid: string | null = null;
  lastDetCount: number | null = null;

  // Splash state
  isCameraReady = false;

  // Capture loop & detection throttle
  readonly captureIntervalMs = 1000; // 2 frames/sec
  readonly detectEveryNthFrame = 2; // detect ~ every 1s
  private frameCounter = 0;

  // Concurrency flag (combined detection)
  private requestInFlight = false;

  // Last combined detection (plates + vehicles)
  private lastRes: DetectResponse | null = null;

  constructor(private detectService: DetectService) {
    addIcons({ arrowBack, radioButtonOn, stop });
  }

  ngOnInit(): void {}

  async ngAfterViewInit() {
    await this.initCamera();
    this.syncOverlaySize();
    window.addEventListener('resize', this.syncOverlaySizeBound);
  }

  ngOnDestroy() {
    this.stopStreaming();
    this.stopCamera();
    window.removeEventListener('resize', this.syncOverlaySizeBound);
  }

  private syncOverlaySizeBound = () => this.syncOverlaySize();

  async ionViewDidEnter() {
    const platform = Capacitor.getPlatform();
    if (platform !== 'web') {
      await StatusBar.show({ animation: Animation.Fade });
      await StatusBar.setStyle({ style: Style.Dark });
    }
  }

  async initCamera() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.statusMessage = 'Camera API not supported';
        return;
      }

      this.isCameraReady = false;

      let stream: MediaStream | null = null;

      const strictConstraints: MediaStreamConstraints = {
        video: {
          facingMode: { exact: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const fallbackConstraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      try {
        stream = await navigator.mediaDevices.getUserMedia(strictConstraints);
      } catch (strictErr) {
        console.warn(
          'Strict environment constraints failed, using fallback.',
          strictErr
        );
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      }

      this.stream = stream;

      const videoEl = this.videoRef.nativeElement;
      videoEl.srcObject = this.stream;

      videoEl.onloadeddata = () => {
        this.isCameraReady = true;
        this.syncOverlaySize();
      };

      await videoEl.play();

      const track = this.stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities
        ? track.getCapabilities()
        : undefined;

      if (capabilities && (capabilities.width || capabilities.height)) {
        const targetWidth =
          capabilities.width && typeof capabilities.width.max === 'number'
            ? Math.min(1920, capabilities.width.max)
            : 1920;
        const targetHeight =
          capabilities.height && typeof capabilities.height.max === 'number'
            ? Math.min(1080, capabilities.height.max)
            : 1080;

        try {
          await track.applyConstraints({
            width: targetWidth,
            height: targetHeight,
          });
          console.log('Applied high-res constraints:', targetWidth, targetHeight);
        } catch (e) {
          console.warn(
            'applyConstraints failed, using default stream resolution.',
            e
          );
        }
      }

      this.statusMessage = 'Tap the button to start.';
    } catch (err: any) {
      this.statusMessage = 'Error accessing camera: ' + (err?.message || err);
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  toggleStreaming() {
    this.lastDetCount = 0;
    this.lastFocusPid = null;
    if (this.isStreaming) {
      this.stopStreaming();
    } else {
      this.startStreaming();
    }
  }

  startStreaming() {
    if (!this.stream) {
      this.statusMessage = 'Camera not initialized';
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.isStreaming = true;
    this.statusMessage = 'Streaming frames to server…';
    this.frameCounter = 0;

    this.intervalId = setInterval(() => {
      this.captureAndSendFrame();
    }, this.captureIntervalMs);
  }

  stopStreaming() {
    this.isStreaming = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.statusMessage = 'Streaming stopped.';
    this.clearOverlay();
  }

  /**
   * Capture current video frame, send:
   *  - RAW frame -> combined /detect (vehicles + plates)  [throttled]
   *  - COMPOSITED -> /stream-frame                       [always]
   */
  private captureAndSendFrame() {
    if (!this.isStreaming) return;

    const videoEl = this.videoRef?.nativeElement;
    const captureCanvasEl = this.captureCanvasRef?.nativeElement;
    const streamCanvasEl = this.streamCanvasRef?.nativeElement;
    const overlayCanvasEl = this.overlayCanvasRef?.nativeElement;

    if (!videoEl || !captureCanvasEl || !streamCanvasEl) return;
    if (videoEl.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return;

    const width = videoEl.videoWidth;
    const height = videoEl.videoHeight;
    if (!width || !height) return;

    const targetWidth = 640;
    const scale = targetWidth / width;
    const targetHeight = Math.round(height * scale);

    // RAW canvas for detection
    captureCanvasEl.width = targetWidth;
    captureCanvasEl.height = targetHeight;
    const rawCtx = captureCanvasEl.getContext('2d');
    if (!rawCtx) return;
    rawCtx.drawImage(videoEl, 0, 0, targetWidth, targetHeight);

    // COMPOSITE canvas for streaming
    streamCanvasEl.width = targetWidth;
    streamCanvasEl.height = targetHeight;
    const streamCtx = streamCanvasEl.getContext('2d');
    if (!streamCtx) return;
    streamCtx.drawImage(videoEl, 0, 0, targetWidth, targetHeight);
    if (overlayCanvasEl) {
      streamCtx.drawImage(overlayCanvasEl, 0, 0, targetWidth, targetHeight);
    }

    // Always send preview stream
    streamCanvasEl.toBlob(
      (previewBlob) => {
        if (!previewBlob || !this.isStreaming) return;
        this.detectService.sendPreviewFrame(previewBlob, this.streamId).subscribe({
          next: () => {},
          error: () => {},
        });
      },
      'image/jpeg',
      0.7
    );

    // Combined detection throttling
    const shouldDetect = this.frameCounter % this.detectEveryNthFrame === 0;

    if (shouldDetect) {
      captureCanvasEl.toBlob(
        (blob) => {
          if (!blob || !this.isStreaming) return;
          if (this.requestInFlight) return;

          this.requestInFlight = true;
          this.detectService.sendFrame(blob, this.streamId).subscribe({
            next: (res: DetectResponse) => {
              this.requestInFlight = false;
              this.lastRes = res;
              this.lastFocusPid = res.data?.focus_plate ?? null;
              this.lastDetCount = res.data?.detections?.length ?? 0;
              this.statusMessage = `Streaming… detections: ${this.lastDetCount}`;
              this.redrawOverlay();
            },
            error: (err) => {
              this.requestInFlight = false;
              this.statusMessage =
                'Error sending frame: ' +
                (err?.message || err.statusText || err);
            },
          });
        },
        'image/jpeg',
        0.7
      );
    }

    this.frameCounter++;
  }

  private syncOverlaySize() {
    const videoEl = this.videoRef?.nativeElement;
    const overlayCanvasEl = this.overlayCanvasRef?.nativeElement;
    if (!videoEl || !overlayCanvasEl) return;

    const rect = videoEl.getBoundingClientRect();
    overlayCanvasEl.width = rect.width;
    overlayCanvasEl.height = rect.height;

    this.clearOverlay();
  }

  private clearOverlay() {
    const overlayCanvasEl = this.overlayCanvasRef?.nativeElement;
    if (!overlayCanvasEl) return;
    const ctx = overlayCanvasEl.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlayCanvasEl.width, overlayCanvasEl.height);

    this.lastRes = null;
  }

  /** Draw BOTH plate + vehicle boxes using a single combined response. */
  private redrawOverlay() {
    if (!this.lastRes) return;

    const overlayCanvasEl = this.overlayCanvasRef?.nativeElement;
    if (!overlayCanvasEl) return;

    const ctx = overlayCanvasEl.getContext('2d');
    if (!ctx) return;

    const canvasW = overlayCanvasEl.width;
    const canvasH = overlayCanvasEl.height;

    const imgW = this.lastRes.data?.image_w || 1;
    const imgH = this.lastRes.data?.image_h || 1;

    ctx.clearRect(0, 0, canvasW, canvasH);

    // 1) Plates
    const plateDetections = this.lastRes.data?.detections || [];
    plateDetections.forEach((det: PlateDetection) => {
      const b = det.box;

      let x1: number, y1: number, x2: number, y2: number;

      if (
        b.nx1 !== undefined &&
        b.ny1 !== undefined &&
        b.nx2 !== undefined &&
        b.ny2 !== undefined &&
        (b.nx1 !== 0 || b.ny1 !== 0 || b.nx2 !== 0 || b.ny2 !== 0)
      ) {
        x1 = b.nx1 * canvasW;
        y1 = b.ny1 * canvasH;
        x2 = b.nx2 * canvasW;
        y2 = b.ny2 * canvasH;
      } else {
        x1 = (b.x1 / imgW) * canvasW;
        y1 = (b.y1 / imgH) * canvasH;
        x2 = (b.x2 / imgW) * canvasW;
        y2 = (b.y2 / imgH) * canvasH;
      }

      const boxW = x2 - x1;
      const boxH = y2 - y1;

      ctx.lineWidth = 3;
      ctx.strokeStyle = det.is_focus ? '#00ff00' : '#ffcc00';
      ctx.strokeRect(x1, y1, boxW, boxH);

      const label = det.plate_text || 'Plate';
      ctx.font = '14px sans-serif';
      const textWidth = ctx.measureText(label).width;
      const padding = 4;
      const labelX = x1;
      const labelY = Math.max(y1 - 20, 0);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(labelX, labelY, textWidth + padding * 2, 18);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, labelX + padding, labelY + 13);
    });

    // 2) Vehicles
    const vehicleDetections = this.lastRes.data?.vehicles || [];
    vehicleDetections.forEach((det: VehicleDetection) => {
      const b = det.bbox;

      const x = b.nx * canvasW;
      const y = b.ny * canvasH;
      const w = b.nwidth * canvasW;
      const h = b.nheight * canvasH;

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#00e5ff'; // cyan for vehicles
      ctx.strokeRect(x, y, w, h);

      const label = `${det.class_name} ${(det.confidence * 100).toFixed(1)}%`;
      ctx.font = '14px sans-serif';
      const textWidth = ctx.measureText(label).width;
      const padding = 4;
      const labelX = x;
      const labelY = Math.max(y - 20, 0);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(labelX, labelY, textWidth + padding * 2, 18);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, labelX + padding, labelY + 13);
    });
  }
}
