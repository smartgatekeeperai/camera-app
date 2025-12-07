import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ActionSheetController, IonApp, IonRouterOutlet, LoadingController, ModalController, Platform } from '@ionic/angular/standalone';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, ],
  schemas: [],
})
export class AppComponent {
  private backSub?: Subscription;
  constructor(
    private readonly platform: Platform,
    private readonly router: Router,
    private readonly modalCtrl: ModalController,
    private readonly loadingCtrl: LoadingController, // from @ionic/angular
    private readonly actionSheetController: ActionSheetController,
  ) {
    this.backSub = this.platform.backButton.subscribeWithPriority(10, async () => {
      const modal = await this.modalCtrl.getTop();
      const activeSheet = await this.actionSheetController.getTop();
      const loading = await this.loadingCtrl.getTop();
      if (modal) {
        await modal.dismiss();
        return;
      }
      if (activeSheet) {
        await activeSheet.dismiss();
        return;
      }
      if (loading) {
        await loading.dismiss();
        return;
      }
      console.log('Current route:', this.router.url);


      const extra = [];
      const defaultButtons = [
        {
          text: 'Minimize the app?',
          handler: async () => App.minimizeApp(),
        },
        {
          text: 'Close the app?',
          handler: async () => App.exitApp(),
        }
      ];
      const sheet = await this.actionSheetController.create({ buttons: [...extra, ...defaultButtons] });
      await sheet.present();

    });



    this.initializeStatusBar();
  }

  ionViewWillEnter() {
    this.initializeStatusBar();
  }

  ionViewWillLeave() {
    this.backSub?.unsubscribe();
    this.backSub = undefined;
  }

  initializeStatusBar() {
  }

  ngOnInit(): void {
    this.platform.ready().then(async () => {
      if (Capacitor.getPlatform() !== 'web') {
        this.initializeStatusBar();
      }
    });

  }

  ngOnDestroy() {
    this.backSub?.unsubscribe();
  }
}
