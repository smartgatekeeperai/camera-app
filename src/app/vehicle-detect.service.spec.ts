import { TestBed } from '@angular/core/testing';

import { VehicleDetectService } from './vehicle-detect.service';

describe('VehicleDetectService', () => {
  let service: VehicleDetectService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VehicleDetectService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
